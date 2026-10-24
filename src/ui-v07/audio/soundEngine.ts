// Plays the soundscape with Web Audio: looping buffers are sample-accurate, so the music's
// beat-aligned loop points stay seamless (an <audio loop> element can leave a gap). Browsers only
// let sound start after the player touches the page, so nothing plays before `unlock`.

import { FADE, INTERLUDE, MIX, SFX_GAIN, SFX_GIVE_WAY, SOUND_FILES, musicNow, type AmbienceId, type EventBedId, type MusicId, type SfxId, type Soundscape } from './soundPlan';

type SoundId = keyof typeof SOUND_FILES;
import { isMuted, subscribeMuted } from './soundSettings';

type Slot = 'music' | 'ambience';
type TrackId = MusicId | AmbienceId;

interface Layer {
  readonly id: TrackId;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

/** Stop whatever a gain is doing and ramp it from where it is now to `value`. */
function rampTo(param: AudioParam, value: number, at: number, seconds: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(at);
  else {
    param.cancelScheduledValues(at);
    param.setValueAtTime(param.value, at);
  }
  param.linearRampToValueAtTime(value, at + seconds);
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unsubscribeMute: (() => void) | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly layers: Record<Slot, Layer | null> = { music: null, ambience: null };
  /** When each slot's outgoing track has gone quiet (audio-context time). */
  private readonly quietAt: Record<Slot, number> = { music: 0, ambience: 0 };
  private wanted: Soundscape | null = null;
  /** When each one-shot last started (audio-context time), for `SFX_GIVE_WAY`. */
  private readonly lastSfx = new Map<SfxId, number>();
  /** A round is resolving: interlude music stays out. */
  private held = false;
  /** The voyage event's bed, in place of the match's ambience while the round's show runs. */
  private eventBed: EventBedId | null = null;
  /** Interlude music finished a play and waits out its rest. */
  private restTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(previous: SoundEngine | undefined) {
    // Carry on with what the replaced engine was asked for (a hot update in development).
    if (previous) {
      this.wanted = previous.wanted;
      this.held = previous.held;
      this.eventBed = previous.eventBed;
    }
  }

  /** Call from a user gesture: creates or resumes the audio context and starts the soundscape. */
  unlock(): void {
    if (!this.ctx) {
      if (typeof AudioContext === 'undefined') return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = isMuted() ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.unsubscribeMute = subscribeMuted(() => this.applyMute());
    }
    void this.ctx.resume().then(() => this.apply());
  }

  /** Pause everything while the page is hidden; pick up where it was when it comes back. */
  setPageVisible(visible: boolean): void {
    if (!this.ctx) return;
    void (visible ? this.ctx.resume() : this.ctx.suspend());
  }

  /** Silence and release everything (the engine is not used again). */
  close(): void {
    this.clearRest();
    for (const layer of Object.values(this.layers)) layer?.source.stop();
    this.unsubscribeMute?.();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  setSoundscape(scape: Soundscape): void {
    if (scape.music !== this.wanted?.music) this.clearRest();
    this.wanted = scape;
    this.apply();
  }

  /**
   * While a round resolves the interlude music fades out; when the next round opens it starts
   * again from the top, the round's own opening.
   */
  holdMusic(held: boolean): void {
    if (held === this.held) return;
    this.held = held;
    if (!held) this.clearRest();
    this.apply();
  }

  /** The voyage event is out (its bed replaces the waves) or the round's show is over (null). */
  setEventBed(bed: EventBedId | null): void {
    if (bed === this.eventBed) return;
    this.eventBed = bed;
    // Load the storm's thunder before its first bolt, so the first clap is not late on its flash.
    if (bed === 'storm' && this.ctx) for (const id of ['storm-strike', 'storm-bolt'] as const) void this.sound(id);
    this.apply();
  }

  playSfx(id: SfxId): void {
    const { ctx, master } = this;
    if (!ctx || !master || ctx.state !== 'running' || isMuted()) return;
    const giveWay = SFX_GIVE_WAY[id];
    if (giveWay && giveWay.after.some((other) => ctx.currentTime - (this.lastSfx.get(other) ?? -Infinity) < giveWay.gap)) return;
    this.lastSfx.set(id, ctx.currentTime);
    void this.sound(id).then((buffer) => {
      if (!buffer) return;
      const gain = ctx.createGain();
      gain.gain.value = SFX_GAIN[id] ?? MIX.sfx;
      gain.connect(master);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => gain.disconnect();
      source.start();
    });
  }

  private apply(): void {
    if (!this.wanted || this.ctx?.state !== 'running') return;
    this.switchTo('music', this.target('music'));
    this.switchTo('ambience', this.target('ambience'));
  }

  /** What `slot` should be playing now. */
  private target(slot: Slot): TrackId | null {
    if (!this.wanted) return null;
    if (slot === 'music') return musicNow(this.wanted, { held: this.held, resting: this.restTimer !== null });
    return this.wanted.ambience && (this.eventBed ?? this.wanted.ambience);
  }

  private applyMute(): void {
    if (this.ctx && this.master) rampTo(this.master.gain, isMuted() ? 0 : 1, this.ctx.currentTime, FADE.mute);
  }

  private clearRest(): void {
    if (this.restTimer !== null) clearTimeout(this.restTimer);
    this.restTimer = null;
  }

  /** Change `slot` to `id` (null just fades it out): the old track out first, then the new one in. */
  private switchTo(slot: Slot, id: TrackId | null): void {
    const current = this.layers[slot];
    if (current?.id === id) return;
    if (current) this.quietAt[slot] = this.fadeOut(current);
    this.layers[slot] = null;
    if (id) void this.fadeIn(slot, id);
  }

  /** Returns when the layer is silent. */
  private fadeOut(layer: Layer): number {
    const ctx = this.ctx!;
    const end = ctx.currentTime + FADE.out;
    rampTo(layer.gain.gain, 0, ctx.currentTime, FADE.out);
    layer.source.stop(end);
    layer.source.onended = () => layer.gain.disconnect();
    return end;
  }

  private async fadeIn(slot: Slot, id: TrackId): Promise<void> {
    const buffer = await this.sound(id);
    const { ctx, master } = this;
    // Something else was asked for while this one loaded.
    if (!buffer || !ctx || !master || this.layers[slot] || this.target(slot) !== id) return;
    const once = slot === 'music' && this.wanted?.playback === 'interlude';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = !once;
    source.connect(gain);
    const at = Math.max(ctx.currentTime, this.quietAt[slot] + FADE.rest);
    source.start(at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(MIX[slot], at + FADE.in);
    const layer = { id, source, gain };
    if (once) {
      // One play, faded out at its end, then the rest with only the ambience.
      const end = at + buffer.duration;
      gain.gain.setValueAtTime(MIX[slot], end - INTERLUDE.outro);
      gain.gain.linearRampToValueAtTime(0, end);
      source.onended = () => {
        gain.disconnect();
        if (this.layers[slot] === layer) this.rest(slot);
      };
    }
    this.layers[slot] = layer;
  }

  private rest(slot: Slot): void {
    this.layers[slot] = null;
    this.clearRest();
    this.restTimer = setTimeout(() => {
      this.restTimer = null;
      this.apply();
    }, INTERLUDE.rest * 1000);
  }

  /** The sound's buffer: a licensed cut when this checkout has it, else its generated fallback. */
  private async sound(id: SoundId): Promise<AudioBuffer | null> {
    const file = SOUND_FILES[id];
    if (typeof file === 'string') return this.load(file, false);
    const licensed = await this.load(`licensed/${file.licensed}`, true);
    return licensed ?? (file.fallback === null ? null : this.load(file.fallback, false));
  }

  /**
   * `optional`: a missing file is expected (a licensed cut this checkout does not have), so it is
   * remembered as missing without a warning; any other failure only costs that sound.
   */
  private load(file: string, optional: boolean): Promise<AudioBuffer | null> {
    let pending = this.buffers.get(file);
    if (!pending) {
      const ctx = this.ctx!;
      pending = fetch(`${import.meta.env.BASE_URL}audio/${file}`)
        .then((res) => {
          // The dev server answers a missing file with the app's HTML page.
          if (!res.ok || res.headers.get('content-type')?.includes('text/html')) throw new Error(`HTTP ${res.status}, not audio`);
          return res.arrayBuffer();
        })
        .then((data) => ctx.decodeAudioData(data))
        .catch((error: unknown) => {
          if (optional) return null;
          console.warn(`sound ${file} could not be played:`, error);
          this.buffers.delete(file);
          return null;
        });
      this.buffers.set(file, pending);
    }
    return pending;
  }
}

// Only one engine may ever sound on a page. A hot update in development builds a new one while the
// old one may still be playing, so the new engine closes whatever engine came before it.
const registry = globalThis as typeof globalThis & { __bmgSoundEngine?: SoundEngine };
const previous = registry.__bmgSoundEngine;
previous?.close();

/** One engine for the page: the menu and the match hand the same soundtrack to each other. */
export const soundEngine = new SoundEngine(previous);
registry.__bmgSoundEngine = soundEngine;
