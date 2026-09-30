/**
 * Dev-only full-resolution capture of the 3D canvas: the browser pane's screenshots are scaled
 * down, so this reads the WebGL frame itself and posts it to `scripts/capture-receiver.py`,
 * which saves it to disk. DOM overlays (tags, HUD) are not part of the canvas and are left out.
 *
 *   python3 scripts/capture-receiver.py out.jpg      # in a terminal
 *   await window.bmgCapture()                        # in the page's console
 */
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8765/';
const FRAME_TIMEOUT_MS = 8000;

/** The next rendered frame as a JPEG data URL, read before the drawing buffer is cleared. */
function nextFrame(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no frame rendered: is the page visible?')), FRAME_TIMEOUT_MS);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    });
  });
}

export async function captureCanvas(endpoint = DEFAULT_ENDPOINT): Promise<string> {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('no 3D canvas on this page');
  const image = await nextFrame(canvas);
  // text/plain keeps this a simple request: no CORS preflight for the receiver to answer.
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: image });
  if (!response.ok) throw new Error(`receiver answered ${response.status}`);
  return `${canvas.width}×${canvas.height} saved by the receiver`;
}

declare global {
  interface Window {
    bmgCapture?: typeof captureCanvas;
  }
}

export function installCapture(): void {
  window.bmgCapture = captureCanvas;
}
