# 音樂與音效來源

本目錄的音檔都是 **AI 生成**，在本機以 [audio-studio-mcp](https://github.com/kanaworksai-hue/audio-studio-mcp)（commit `5dc6311` 時的版本，MIT）呼叫 Stability AI 的 **Stable Audio 3 medium**（MLX，`stable-audio-3-optimized`）生成，沒有手動修音。生成日期 2026-10-24。

**授權：** 生成內容受 [Stability AI Community License](https://stability.ai/license) 約束：年營收低於 100 萬美元的個人或組織可商用，以上需要 Enterprise License。商業發行（例如上架 Steam）前要重讀正式條款，確認是否需要向 Stability AI 登記或標示。純 AI 生成的內容在美國目前可能無法取得著作權。模型訓練資料依官方說明為 AudioSparx 授權曲庫與 Freesound 的 CC0／CC-BY／CC Sampling+ 錄音。

每個檔案都能以下表的提示詞、seed 與設定重新生成（steps 8，原始輸出 44.1 kHz 24-bit WAV；`negative_prompt` 只在 cfg ≠ 1 時生效）。後製一律重取樣為 48 kHz 並輸出 Ogg Vorbis（quality 0.6）。

| 檔案 | 用途 | 提示詞（不含伺服器自動加的 `TrackType` 前綴） | Seed | 設定 | 後製 |
|---|---|---|---|---|---|
| music-cover.ogg | 主選單、大廳等選單畫面的音樂 | Sunny tropical chill track with airy warm synth pads, plucked steel drum and marimba-like melody, soft kick and shaker, wide open stereo, carefree sunset on a white sand beach. BPM: 76. | 7002 | music，60 秒，cfg 4，negative：jazz, lounge, cafe, bossa nova, piano, upright bass, brushed drums, saxophone | 切掉開頭 6 秒；循環終點選在節奏與開頭對齊處（50.6 秒）；0.4 秒等功率交叉淡化；−16 LUFS；循環 44.2 秒 |
| music-ingame.ogg | 對局中的音樂 | Slow lazy Hawaiian beach music with unhurried slack-key acoustic guitar fingerpicking, lap steel slide guitar gliding slowly between notes, softly strummed ukulele, relaxed swaying feel, warm sleepy afternoon in a hammock under palm trees. BPM: 68. | 5001 | music，120 秒，cfg 4，negative：jazz, lounge, cafe, bossa nova, piano, upright bass, brushed drums, saxophone, upbeat, energetic, cheerful bouncy, fast strumming, sad, melancholic, romantic ballad | 切掉開頭 6 秒；循環終點 104.8 秒（節奏對齊）；0.4 秒交叉淡化；−16 LUFS；循環 98.4 秒 |
| ambience-waves.ogg | 對局中的海浪環境音（疊在音樂下） | SFX：gentle ocean waves on a sandy tropical beach / continuous soft waves rolling in and washing back, steady and calm / water and light foam, soft hiss / outdoor beach, wide stereo, no wind noise | 4001 | sfx，20 秒，cfg 1 | −22 LUFS；2 秒交叉淡化循環；循環 18 秒 |
| sfx-bill-register.ogg | 回合帳單出現時的收銀機聲 | SFX：vintage cash register with a small bright bell / a quick mechanical clunk, then one loud clear high 'ding' of the bell ringing out, the drawer pops open / bright brass bell with a pure ringing tone, metal drawer / small shop, close-up, dry | 12001 | sfx，3 秒，cfg 4，negative：music, voice, long noise, no bell | 切掉頭尾靜音（−60 dB）；300 ms 淡出；峰值 −3 dBFS；2.7 秒 |
| sfx-match-end-horn.ogg | 結果畫面公布第一名時的勝利號角 | Short triumphant brass fanfare of ship horns and trumpets announcing a safe arrival in port, bold and victorious, ending on a held major chord. | 50002 | music，5 秒，cfg 4，negative：drums loop, electronic, sad, vocals | 切掉頭尾靜音（−55 dB）；500 ms 淡出；峰值 −3 dBFS；4.8 秒 |
| event-storm.ogg | 暴風雨公開後的背景（取代海浪） | heavy tropical rainstorm at sea, howling wind, waves crashing against a wooden ship's hull, continuous pouring rain and gusts, with a distant thunder rumble now and then, rain on wood and canvas, rough water, out on the open sea, wide stereo. | 20001 | sfx，24 秒，cfg 1 | −20 LUFS；2 秒交叉淡化循環；22 秒 |
| event-tailwind.ogg | 順風公開後的背景 | strong steady sea wind filling the canvas sails of a wooden sailing ship, continuous brisk wind, sails flapping and ropes creaking, the hull cutting fast through water, canvas, hemp rope, timber, spray, on deck, outdoors, wide stereo. | 21001 | sfx，24 秒，cfg 1 | −21 LUFS；2 秒交叉淡化循環；22 秒 |
| event-fog.ogg | 海霧公開後的配樂 | Eerie misty ambient drone with soft low synth pads, a distant lonely foghorn and faint lapping water, slow, sparse and mysterious. | 22001 | music，32 秒，cfg 4，negative：drums, beat, fast, cheerful | 只取音量穩定的段落（0～28 秒）；−21 LUFS；1.5 秒交叉淡化循環；26.5 秒 |
| event-moonless.ogg | 月黑風高公開後的配樂 | Dark suspenseful night ambient with a low cello drone, soft ticking percussion and quiet crickets, tense and secretive, smugglers sneaking in the dark. | 23001 | music，32 秒，cfg 4，negative：cheerful, upbeat, bright, loud drums | 只取音量穩定的段落（0～30 秒）；−21 LUFS；1.5 秒交叉淡化循環；28.5 秒 |
| event-rush.ogg | 黑市熱絡公開後的配樂 | Feverish lively bazaar groove with energetic hand drums, shakers, plucked oud-like strings and punchy brass stabs, excited bustling market crowd energy. BPM: 124. | 24002 | music，32 秒，cfg 4，negative：slow, sad, calm | 切掉開頭 4 秒，循環終點選在節奏對齊處；0.4 秒交叉淡化；−19 LUFS；23.2 秒 |
| sfx-dice.ogg | 航程拍：起始骰值 | two small wooden dice, rolled across a table, tumbling and clattering, then settling, bone dice on an oak table, close-up, dry. | 30001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-guard.ogg | 航程拍：護衛 +1 | heavy round iron shield, struck once, a firm protective metallic clang with a deep thud, iron and oak, outdoors on a ship's deck, close. | 31001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-pirate.ogg | 航程拍：海盜 −1 | old iron ship cannon, one cannon shot boom, the cannonball whistling and splashing into the sea nearby, black powder blast, water splash, open sea, medium distance. | 32001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-tailwind.ogg | 航程拍：順風 +1 | a sudden gust of sea wind into sails, a rising whoosh that fills the canvas with a snap, wind, canvas, outdoors, wide. | 33001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-storm.ogg | 航程拍：暴風雨 −1 | lightning strike and thunder, one sharp thunder crack close by, rolling into a low rumble, thunder, open sea, huge outdoor space. | 34001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-fog.ogg | 航程拍：海霧（被海盜鎖定的船 +1） | ship's foghorn, one long low mournful blast fading into mist, brass horn, deep tone, foggy harbor, distant, reverberant. | 35001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-moonless.ogg | 航程拍：月黑風高（被護衛鎖定的船 −1） | deep cinematic low impact, one dark ominous boom with a soft reverse swell before it, sub bass, muffled drum, large dark space. | 36001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-island.ogg | 航程拍：燈塔島 +1 | lighthouse lamp switching on, a bright magical ascending shimmer with a warm hum, glass chimes, electric hum, close, light reverb. | 37001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-arrive.ogg | 航程拍：船抵達 | wooden sailing ship docking, bumping gently into a wooden pier, ropes tightening, anchor chain rattling down, timber, rope, iron chain, busy harbor, close. | 38001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-sink.ogg | 航程拍：船沉沒 | wooden ship hull breaking apart, timber cracking and splintering, a big splash, then bubbling as it sinks, wood, water, open sea, close. | 39001 | sfx，4 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |

## 授權音效庫的剪輯（`licensed/`，不進 git）

`licensed/` 裡的音檔是從 [Sonniss GDC Game Audio Bundle](https://sonniss.com/gameaudiogdc)（2016～2020，經官方鏡像 ftpmirror.your.org 取得，2026-10-24）與 Mixkit 的錄音剪輯、疊合而成，授權為 [Sonniss GDC Bundle License 2.0](https://sonniss.com/gdc-bundle-license/)：可商用、免署名、可修改，用在遊戲裡沒問題；**不得把音效（含修改過的）當成音效檔散布**，也不得用於 AI 訓練。這個 repo 是公開的，所以 `public/audio/licensed/` 列在 `.gitignore`，檔案備份在作者的 iCloud 雲碟（`暗潮商戰音效/licensed/`），部署時從本機一起打包。沒有這個資料夾的 checkout 會改播同名的 AI 版本（`soundPlan.ts` 的 `fallback`）。

| 檔案 | 用途 | 原始錄音（Sonniss 檔名） | 剪輯 |
|---|---|---|---|
| licensed/sfx-guard.ogg | 航程拍：護衛 +1 | The Captain's Shield Metal Hit 5；Ice_Spell_Ice_Spell_Buff_Positive_02 | 盾牌撞擊（0.42 秒起 1.8 秒），0.05 秒後疊上增益魔法音（0.8 倍） |
| licensed/sfx-pirate.ogg | 航程拍：海盜 −1 | warfare_t1b_cannon_firing_forest_distant_MKH8060_2；DeepExplosion02 | 第一聲砲擊（0.42 秒起 2.2 秒），0.5 秒後接低沉爆炸 |
| licensed/sfx-island.ogg | 航程拍：燈塔島 +1（舞台燈打開） | Switch,ElectricalPanelBreaker,On；signal_lever_on；PM_FN_Events_LvlUps_PowerUps_25 | 斷路器「喀咚」疊上降調 0.6 倍的同一聲加厚低頻；0.35 秒後再接號誌拉桿＋斷路器＋能量上升（0.9 倍） |
| licensed/sfx-arrive.ogg | 航程拍：船抵達 | Bell_10_b | 同一聲鈴相隔 0.38 秒敲兩下 |
| licensed/sfx-sink.ogg | 航程拍：船沉沒 | wood_breaking_cracking_snapping_breaking_peeling_bones_break_snap_crack_13；Bluezone_BC0256_water_splash_008；Elemental - Water Bubbles Big_4 | 木頭碎裂，0.3 秒後落水，1.3 秒後氣泡（0.45 倍） |
| licensed/sfx-event-storm.ogg | 航程拍：暴風雨 −1 | Mixkit「Mid strength single thunder」（#1298）；Mixkit「Explosion hit」（#1704） | 單雷從 0.2 秒起，1.35 秒後接爆炸重擊（0.9 倍），共 5 秒，最後 1.5 秒淡出；峰值 −0.5 dBFS |
| licensed/sfx-storm-strike.ogg | 暴風雨時桌上每道閃電落下的雷聲 | Mixkit「Strong close thunder explosion」（#1300）；Mixkit「Cinematic impact thunder」（#1286） | 近距離雷爆從 0.35 秒起，0.85 秒後接電影感雷擊（0.9 倍），共 5 秒，最後 1.5 秒淡出；峰值 −0.5 dBFS |

Mixkit 的四段取自 [mixkit.co](https://mixkit.co/free-sound-effects/thunder/)（2026-10-24），授權為 [Mixkit Sound Effects Free License](https://mixkit.co/license/#sfxFree)：可免費用於商業專案與電子遊戲、不需署名；**不得單獨散布音效本身**，所以同樣放在 `licensed/`。

所有剪輯都重取樣為 48 kHz、峰值 −1 dBFS，輸出 Ogg Vorbis（quality 0.8）。

