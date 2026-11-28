# 音樂與音效來源

本目錄的音檔都是 **AI 生成**，在本機以 [audio-studio-mcp](https://github.com/kanaworksai-hue/audio-studio-mcp)（commit `5dc6311` 時的版本，MIT）呼叫 Stability AI 的 **Stable Audio 3 medium**（MLX，`stable-audio-3-optimized`）生成，沒有手動修音。生成日期 2026-10-24。

**授權：** 生成內容受 [Stability AI Community License](https://stability.ai/license) 約束：年營收低於 100 萬美元的個人或組織可商用，以上需要 Enterprise License。商業發行（例如上架 Steam）前要重讀正式條款，確認是否需要向 Stability AI 登記或標示。純 AI 生成的內容在美國目前可能無法取得著作權。模型訓練資料依官方說明為 AudioSparx 授權曲庫與 Freesound 的 CC0／CC-BY／CC Sampling+ 錄音。

每個檔案都能以下表的提示詞、seed 與設定重新生成（steps 8，原始輸出 44.1 kHz 24-bit WAV；`negative_prompt` 只在 cfg ≠ 1 時生效）。後製一律重取樣為 48 kHz 並輸出 Ogg Vorbis（quality 0.6）。

| 檔案 | 用途 | 提示詞（不含伺服器自動加的 `TrackType` 前綴） | Seed | 設定 | 後製 |
|---|---|---|---|---|---|
| music-cover.ogg | 主選單、大廳等選單畫面的音樂 | Sunny tropical chill track with airy warm synth pads, plucked steel drum and marimba-like melody, soft kick and shaker, wide open stereo, carefree sunset on a white sand beach. BPM: 76. | 7002 | music，60 秒，cfg 4，negative：jazz, lounge, cafe, bossa nova, piano, upright bass, brushed drums, saxophone | 切掉開頭 6 秒；循環終點選在節奏與開頭對齊處（50.6 秒）；0.4 秒等功率交叉淡化；−16 LUFS；循環 44.2 秒 |
| music-ingame.ogg | 對局中的音樂 | Slow lazy Hawaiian beach music with unhurried slack-key acoustic guitar fingerpicking, lap steel slide guitar gliding slowly between notes, softly strummed ukulele, relaxed swaying feel, warm sleepy afternoon in a hammock under palm trees. BPM: 68. | 5001 | music，120 秒，cfg 4，negative：jazz, lounge, cafe, bossa nova, piano, upright bass, brushed drums, saxophone, upbeat, energetic, cheerful bouncy, fast strumming, sad, melancholic, romantic ballad | 切掉開頭 6 秒；循環終點 104.8 秒（節奏對齊）；0.4 秒交叉淡化；−16 LUFS；循環 98.4 秒 |
| ambience-waves.ogg | 海浪環境音的 AI 備用版（沒有 `licensed/` 時播） | SFX：gentle ocean waves on a sandy tropical beach / continuous soft waves rolling in and washing back, steady and calm / water and light foam, soft hiss / outdoor beach, wide stereo, no wind noise | 4001 | sfx，20 秒，cfg 1 | −22 LUFS；2 秒交叉淡化循環；循環 18 秒 |
| sfx-bill-register.ogg | 回合帳單出現時的收銀機聲 | SFX：vintage cash register with a small bright bell / a quick mechanical clunk, then one loud clear high 'ding' of the bell ringing out, the drawer pops open / bright brass bell with a pure ringing tone, metal drawer / small shop, close-up, dry | 12001 | sfx，3 秒，cfg 4，negative：music, voice, long noise, no bell | 切掉頭尾靜音（−60 dB）；300 ms 淡出；峰值 −3 dBFS；2.7 秒 |
| sfx-result-open.ogg | 終局結算面板彈出時的收尾樂句（面板的彈跳、標題金光與背後的光芒火花對著它的三個重音：0.46、0.84、1.30 秒） | 原曲：Short cheerful tropical steel drum ending flourish, a quick rising phrase that resolves on a bright final chord, like a little ta-da, the end.（seed 73001，music，4 秒，cfg 4，negative：drums loop, sad, vocals, long）。原曲有破音，以 Stable Audio 3 的 variation（音訊轉音訊）重新渲染：Short cheerful tropical steel drum ending flourish, a quick rising phrase that resolves on a bright final chord, like a little ta-da, clean high quality studio recording. | 74102 | variation，強度 0.45，4 秒，cfg 4，negative：distorted, glitchy, artifacts, crackle, warbling, noise, drums loop, sad, vocals | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS；3.8 秒 |
| sfx-match-end-horn.ogg | 結果畫面公布第一名時的勝利號角 | Short triumphant brass fanfare of ship horns and trumpets announcing a safe arrival in port, bold and victorious, ending on a held major chord. | 50002 | music，5 秒，cfg 4，negative：drums loop, electronic, sad, vocals | 切掉頭尾靜音（−55 dB）；500 ms 淡出；峰值 −3 dBFS；4.8 秒 |
| sfx-seal.ogg | 投資、部署送出（封蠟章，像蓋印章的「啪」） | SFX：rubber stamp, pressed down hard once onto a sheet of paper, a short sharp slap, rubber, ink pad, paper on a wooden desk, office, close-up, dry. | 60001 | sfx，1.5 秒，cfg 4，negative：music, voice, reverb tail, long | 只取第一下（起音前 0.01 秒起 0.45 秒），0.12 秒淡出；峰值 −0.5 dBFS |
| event-storm.ogg | 暴風雨公開後的背景（取代海浪） | heavy tropical rainstorm at sea, howling wind, waves crashing against a wooden ship's hull, continuous pouring rain and gusts, with a distant thunder rumble now and then, rain on wood and canvas, rough water, out on the open sea, wide stereo. | 20001 | sfx，24 秒，cfg 1 | −20 LUFS；2 秒交叉淡化循環；22 秒 |
| event-tailwind-shanty.ogg | 順風公開後的背景（船歌，取代海浪） | TrackType: Music, VocalType: Vocal, Rousing sea shanty sung by a crew of rough male sailors, call and response chanting heave-ho, accordion and fiddle, foot stomps and hand claps, hearty, sailing fast with a strong wind. BPM: 104.（`raw`，提示詞原樣使用；AI 唱不出聽得懂的歌詞，只有含糊的吆喝） | 40003 | raw，30 秒，cfg 4，negative：instrumental only, electronic, synth, sad | 切掉開頭 4 秒，循環終點選在節奏與開頭對齊處（23.02 秒），短交叉淡化；−21 LUFS；循環 18.6 秒 |
| event-fog.ogg | 海霧公開後的配樂 | 原曲：Laid-back hazy island music, soft slack-key acoustic guitar with lots of space, gentle steel drum echoes far away, warm airy pad, drifting through a light sea mist on a lazy afternoon, peaceful and curious. BPM: 70.（seed 63003，music，32 秒，cfg 4，negative：eerie, creepy, horror, scary, dark, ominous, menacing, dissonant, drone, suspense, thriller, sad, melancholic, loud drums, fast）。原曲以 Rubber Band 4.0（`-3`，R3 引擎）放慢到 0.75 倍後，以 Stable Audio 3 的 variation（音訊轉音訊）重新渲染：Very slow laid-back hazy island music, soft slack-key acoustic guitar with lots of space, gentle steel drum echoes far away, warm airy pad, drifting through a light sea mist on a lazy afternoon, peaceful and curious, clean high quality recording. BPM: 52. | 66102 | variation，強度 0.45，42.7 秒，cfg 4，negative：distorted, glitchy, artifacts, warbling, phasey, eerie, dark, fast | 切掉開頭 5.3 秒，取 7 小節（約 52.5 BPM）+ 0.4 秒；0.4 秒交叉淡化循環；−21 LUFS；32 秒 |
| event-moonless.ogg | 月黑風高公開後的配樂 | Playful sneaky slow tiptoe music for cheeky smugglers at night, plucked pizzicato strings, soft muted upright bass walking, light finger snaps, a little clarinet melody, cartoon heist caper, mischievous and fun, tropical night, unhurried. BPM: 82. | 64102 | music，36 秒，cfg 4，negative：eerie, creepy, horror, scary, dark, ominous, menacing, dissonant, drone, suspense, thriller, sad, melancholic, loud, epic, orchestral hit, fast | 切掉開頭 4 秒，取 9 小節 + 0.4 秒；0.4 秒交叉淡化循環；−21 LUFS；26.3 秒 |
| event-rush.ogg | 黑市熱絡公開後的配樂 | Feverish lively bazaar groove with energetic hand drums, shakers, plucked oud-like strings and punchy brass stabs, excited bustling market crowd energy. BPM: 124. | 24002 | music，32 秒，cfg 4，negative：slow, sad, calm | 切掉開頭 4 秒，循環終點選在節奏對齊處；0.4 秒交叉淡化；−19 LUFS；23.2 秒 |
| sfx-guard.ogg | 航程拍：護衛 +1 | heavy round iron shield, struck once, a firm protective metallic clang with a deep thud, iron and oak, outdoors on a ship's deck, close. | 31001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-pirate.ogg | 航程拍：海盜 −1 | old iron ship cannon, one cannon shot boom, the cannonball whistling and splashing into the sea nearby, black powder blast, water splash, open sea, medium distance. | 32001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-tailwind.ogg | 航程拍：順風 +1 | a sudden gust of sea wind into sails, a rising whoosh that fills the canvas with a snap, wind, canvas, outdoors, wide. | 33001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-storm.ogg | 暴風雨雷聲的 AI 備用版（沒有 `licensed/` 時，擊中船與海上閃電都播這個） | lightning strike and thunder, one sharp thunder crack close by, rolling into a low rumble, thunder, open sea, huge outdoor space. | 34001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-fog.ogg | 航程拍：海霧（被海盜鎖定的船 +1） | ship's foghorn, one long low mournful blast fading into mist, brass horn, deep tone, foggy harbor, distant, reverberant. | 35001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-moonless.ogg | 航程拍：月黑風高（被護衛鎖定的船 −1） | deep cinematic low impact, one dark ominous boom with a soft reverse swell before it, sub bass, muffled drum, large dark space. | 36001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-island.ogg | 航程拍：燈塔島 +1 | lighthouse lamp switching on, a bright magical ascending shimmer with a warm hum, glass chimes, electric hum, close, light reverb. | 37001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-sink.ogg | 航程拍：船沉沒 | wooden ship hull breaking apart, timber cracking and splintering, a big splash, then bubbling as it sinks, wood, water, open sea, close. | 39001 | sfx，4 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-salute-pop.ogg | 要塞島禮炮：每門砲發射（5 發連射） | a small ceremonial saluting cannon fired once from a fort, a short sharp muffled pop boom, black powder, outdoors, medium distance. | 71001 | sfx，1.5 秒，cfg 4，negative：music, melody, voice, speech, whistle, splash, long rumble | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −7.4 dBFS（五發疊在一起不會太響） |
| sfx-salute-splash.ogg | 要塞島禮炮：每發落下的落水聲 | a small object dropping into the sea, a short light plop splash, water, outdoors, close. | 72001 | sfx，1.5 秒，cfg 4，negative：music, melody, voice, speech, big splash, waves | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −9 dBFS |
| sfx-salute-ding.ogg | 要塞島禮炮：每發落下後的「叮」（遊戲以 1、1.12、1.24… 倍速播，一聲比一聲高） | a single small brass bell, struck once, a bright clear high ding ringing out, metal bell, close, light reverb. | 70001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech, long noise, multiple hits | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −6.1 dBFS |

## V0.8 的音效（2026-11-29）

AI 部分的生成方式、授權與上表相同（Stable Audio 3 medium，steps 8，cfg 4，sfx 的 negative 一律含 `music, melody, voice, speech`）；疊合用的 Kenney 檔案是 CC0（見下方 Kenney 一節）。剪輯一律切掉頭尾靜音（−55 dB）、250 ms 淡出、峰值 −3 dBFS，48 kHz Ogg Vorbis（quality 0.6）。候選與腳本在 git 排除的 `audio-drafts/v08/`（`make.py`）。

| 檔案 | 用途 | 來源 | Seed | 剪輯 |
|---|---|---|---|---|
| sfx-crate-drop.ogg | 結算拍：每掉一箱貨（`CrateDrop` 箱子離開甲板，0.8 秒後落水） | Kenney Impact Sounds `impactWood_light_001.ogg`（0 秒，0.5 倍音量）＋合成水花：白噪音經共振帶通（Q 0.9，中心 5000→900 Hz）、130 ms 指數衰減，疊 2.5 kHz 以上的嘶聲（60 ms，0.35 倍）與短促低音（140→60 Hz 下滑正弦，70 ms，0.32 倍），再加 7 滴水滴（900～1500 Hz 上刷 1.6～2.4 倍的短正弦，30～70 ms）；numpy 亂數 seed 8128 | — | 水花起音對在 0.8 秒；共 2.1 秒；作者自製部分無授權限制 |
| sfx-skill-omen.ogg | 結算拍：信天翁號「好兆頭」重擲 | 本目錄的 `sfx-reroll.ogg`（Kenney 搖骰＋落骰，0.8 倍音量），0.95 秒疊 AI 幸運閃光：a lucky charm sparkle, a bright magical ascending twinkle of small glass chimes and a soft harp glissando, good fortune, magical, close, light reverb.（negative 另加 dark, scary，2 秒）的前 1.2 秒（0.6 倍） | 82001 | 2.2 秒 |
| sfx-skill-surge.ogg | 結算拍：海嘯號「巨浪」加擲 1d3 | 合成：白噪音經共振帶通（Q 2，中心 250→2600 Hz）0.85 秒漸強聚浪，0.8 秒接明亮水花（700 Hz～11 kHz 帶通噪音，220 ms 衰減，0.6 倍）與 8 滴水滴；1.1 秒疊 Kenney Casino Audio `die-throw-2.ogg` 的第一下（0.7 倍）；numpy 亂數 seed 8128 | — | 1.9 秒；作者自製部分無授權限制 |
| sfx-skill-raise-won.ogg | 結算拍：孤注號「加注」成功（取代抵達的鐘聲） | music：Short cheerful jackpot win jingle, bright steel drum and marimba rising run ending on a big happy major chord, with coins jingling, ta-da, clean high quality studio recording.（negative：drums loop, sad, vocals, long, distorted，3 秒） | 84002 | 3.0 秒 |
| sfx-works-hammer.ogg | 碼頭工事：煙塵裡施工 | shipwrights at work on a wooden dock, quick busy hammering of mallets on timber and a short saw stroke, wood, outdoor harbor, medium close.（negative 另加 power tools, machine，2 秒） | 85002 | 取前 1.2 秒 |
| sfx-works-cloth.ogg | 碼頭工事：帆布放下 | a large canvas sheet unrolled and dropped down quickly, one soft heavy fabric whoosh and flap, canvas cloth, outdoors, close.（1.5 秒） | 85101 | 取前 0.8 秒 |
| sfx-works-unveil.ogg | 碼頭工事：揭幕金光 | a grand reveal, a curtain whooshing down followed by a warm golden magical shimmer rising, bright chimes and a soft swell, triumphant, close, light reverb.（negative 另加 dark, scary，2.5 秒） | 85202 | 取前 2.0 秒 |
| event-omen.ogg | 暗潮將至那一整回合的背景（取代海浪；`TideOmen`） | sfx，cfg 1：deep slow heavy ocean swells rolling in and drawing back along a rocky shore, a low rumbling surge every few seconds, dark water rising, distant wind, wide stereo, no music.（30 秒） | 86001 | 切掉開頭 1 秒；2 秒等功率交叉淡化循環；−21 LUFS；循環 27 秒 |

碼頭工事的木樁落水、平台木板沿用本目錄的 `sfx-salute-splash.ogg`、`sfx-produce.ogg`（`dockWorksSounds.ts`）。

## V0.8 回合卡與暗潮捲走貨（2026-11-29）

聲音照動畫的動作拆成小段，由遊戲在動畫的時間點觸發（`src/ui-v07/audio/roundCardSounds.ts`）；錄音剪輯時讓重音落在動畫的那一刻。曲風由使用者選定：暗潮將至＝電影式緊張、暗潮面＝管弦樂重音、最後的大市集＝市集喧鬧＋煙火、捲走貨＝水聲＋低沉弦樂。腳本在 git 排除的 `audio-drafts/v08/`（`make4.py` 合成、`make5.py` 錄音剪輯），下載的原始錄音在 `audio-drafts/sonniss-raw/`（清單 `SOURCES.txt`，取自 ftpmirror.your.org 的 Sonniss GDC 2016／2018／2019／2020 `individual/` 目錄，2026-11-29）。

**錄音剪輯（`licensed/`，不進 git，授權同下方 Sonniss 一節）**：第三版「太磅礡」又「破音」，量出來是 80 Hz 以下的超低音太多（筆電、手機喇叭放不出來就破），所以每段都切掉 100 Hz 以下（兩個 12 dB/oct 高通疊成 24 dB/oct；低音提琴切在 70 Hz），換掉 Braam 與預告片 Downer 這類最誇張的素材、尾巴剪短；音量以響度對齊（EBU R128，`make6.py`），峰值不超過 −1 dBFS。重取樣 48 kHz 立體聲、Ogg Vorbis quality 0.6。

| 檔案 | 用途 | 原始錄音 | 剪輯 |
|---|---|---|---|
| licensed/sfx-boss-flip-storm.ogg | 第一個暗潮面翻牌（風暴潮）：翻面的「咻」，0.38 秒閃電那一刻接雷聲 | 《MOVIE TRAILER》`BC0237_transition_whoosh_hit_006`（只取到它自己的重擊之前）、`licensed/sfx-storm-bolt.ogg`（Mixkit 雷聲）、`BC0237_impact_017` | 咻 0.42 秒；雷聲從它的第一下取 2.4 秒、疊 0.3 倍重擊；切掉 100 Hz 以下；共 2.8 秒；−18 LUFS；`make12.py` |
| licensed/sfx-boss-flip-pirate.ogg | 第一個暗潮面翻牌（海盜潮）：霧湧上來，0.38 秒霧裡一聲砲響 | 同上的咻；`licensed/sfx-pirate.ogg`（遠處砲擊） | 咻＋合成的霧（150～900 Hz 帶通噪音，湧到 0.38 秒再慢慢散）；砲擊從它的第一下取 2.2 秒；共 2.8 秒；−18 LUFS；`make12.py` |
| licensed/sfx-boss-flip-crash.ogg | 第一個暗潮面翻牌（崩盤潮）：0.38 秒玻璃裂開，接著硬幣散落 | 同上的咻；`licensed/sfx-settle-coins.ogg` | 咻＋合成的玻璃裂聲（尖銳的一下＋14 個 2.8～7.5 kHz 的碎響）＋合成硬幣 11 枚（各帶一次彈跳），疊 0.35 倍錄音硬幣；共 2.4 秒；−18 LUFS；`make12.py` |
| licensed/sfx-boss-hit-storm.ogg、sfx-boss-hit-pirate.ogg、sfx-boss-hit-crash.ogg | 之後的暗潮面（沒有翻牌，卡片落定時）：同一種暗潮的聲音，短一點、沒有咻 | 同上 | 各自的主題從 0 秒開始；海盜潮的霧從湧起之後開始；−20 LUFS；`make12.py` |
| licensed/sfx-bazaar-crowd.ogg | 最後的大市集：卡片在時的節慶人群（每 9.6 秒接一段，前後淡入淡出互相疊） | West Wolf《Balkan Tribal Festival》`BTF 06 Tribal_05_Bells, Dance, People, Crowd, Ambience_05` | 6 秒起取 10.4 秒，0.4 秒淡入、0.8 秒淡出；−30 LUFS |
| licensed/sfx-firework-volley.ogg | 最後的大市集：每輪三發煙火（每 2.4 秒一輪，一輪比一輪小聲） | Sound Villain《Fireworks Malta》`006_Strong blast with medium crackles` | 0.18 秒起取 2.8 秒：錄音裡三發的爆點落在 0.30、1.06、1.80 秒，對上畫面的 0.3、1.1、1.9 秒；另切 150 Hz 以下；−21 LUFS |
| licensed/sfx-sweep-surge.ogg | 暗潮捲走貨：海水漫上島，低音提琴往下滑到第一箱沉下去（2.64 秒） | Bluezone《Splash》`BC0256_water_splash_008`；Articulated Sounds《Special Double Bass Fx》`INSTRU STRING Double Bass, Bowed, Slide Down, High Pitch 02` | 水花取 2.6 秒（1.2 秒淡出）放 0 秒；低音提琴對齊讓最響處落在 2.64 秒，0.7 倍；共 4.2 秒；−20 LUFS |
| licensed/sfx-crate-sink.ogg | 暗潮捲走貨：每一箱沉下去（一箱一聲，錯開 0.14 秒） | Bluezone《Splash》`BC0256_water_splash_drop_006` | 取 0.9 秒；−24 LUFS（幾箱會疊在一起） |

**沒有 `licensed/` 時的合成備用版（作者自製，無授權限制；numpy 亂數 seed 8128）**

| 檔案 | 用途 | 合成方式 |
|---|---|---|
| sfx-card-in.ogg | 回合卡翻進來（0.6 秒，0.36 秒時最大）：咻一聲落在桌上 | 帶通噪音（Q 1.2，400→3000 Hz）音量隨動作先升後降、0.3 秒最大，0.34 秒疊一聲短促的低音敲擊（180→90 Hz 正弦，50 ms）與紙張拍擊（1.8 kHz 以上噪音，10 ms） |
| sfx-tide-wave.ogg | 暗潮將至：卡片翻進來時一道短浪（使用者要「浪 > 鈴 > 水滴」依序、浪不要長） | 合成：300 Hz～9 kHz 的噪音（稍偏暖），0.5 秒湧到最大（卡片落定後），之後 0.28 秒衰減的水沫；左右各一段；共 1.3 秒；−24 LUFS；numpy 亂數 seed 3600；`make10.py` |
| sfx-tide-ripple.ogg | 暗潮將至：鈴聲之後的水滴（2.3 秒起，之後每 2.6 秒隨一圈水波紋一聲；遊戲以 1、0.94、1.06 倍速輪播） | 兩滴水滴：900 Hz 往上刷 2.2 倍的正弦（0.12 秒，50 ms 衰減），0.12 秒再一滴（1250 Hz，較小）；−44 LUFS（使用者要水聲小一點）；`make7.py`、`make9.py` |
| sfx-tide-pick.ogg | 暗潮將至：1.5 秒揭曉時一聲帶迴響的鈴（使用者要「低一點、有點迴響」） | 合成鈴：A5（880 Hz）疊八度與 3 倍頻（0.35、0.15），基音衰減約 0.61 秒、泛音更快，3 ms 起音；乾聲 0.45 倍疊合成殘響 0.75 倍（左右各一段指數衰減 1.2 秒、越後面越暗的噪音脈衝響應，長 4.2 秒）；共 5.8 秒；−23 LUFS；numpy 亂數 seed 1318；`make11.py` |
| sfx-boss-flip-storm.ogg、sfx-boss-hit-storm.ogg | 錄音版的備用：風暴潮 | 舊的合成翻牌備用聲 `sfx-boss-strike.ogg`（帶通噪音的咻、合成雷擊、玻璃般碎片、低音重擊；已從本目錄移除，見 git 歷史）從 0.36 秒起當雷聲，翻牌版前面接咻 |
| sfx-boss-flip-pirate.ogg、sfx-boss-hit-pirate.ogg | 錄音版的備用：海盜潮 | 咻＋合成的霧＋本目錄的 AI 砲擊 `sfx-pirate.ogg` |
| sfx-boss-flip-crash.ogg、sfx-boss-hit-crash.ogg | 錄音版的備用：崩盤潮 | 咻＋合成的玻璃裂聲＋合成硬幣（不疊錄音硬幣） |
| sfx-boss-flip-inspection.ogg、sfx-boss-hit-inspection.ogg | 暗潮面（查緝潮）：探照燈掃到卡片上（0.38 秒鎖定），蓋章，0.3 秒後一聲哨音；只用本目錄素材，所以沒有 licensed 版 | 本目錄的 `sfx-beam-sweep.ogg`（剪到 0.38 秒鎖定）、`sfx-seal.ogg`（蓋章）；合成哨子（2850 Hz，每秒 32 次顫音，帶氣聲，0.55 秒，0.22 倍）；翻牌版 2.4 秒 −18 LUFS，落定版 1.8 秒 −20 LUFS；`make12.py` |
| sfx-firework-volley.ogg | 錄音版的備用：一輪三發煙火 | 合成煙火（明亮噪音爆開、輕微低音、40 個細碎劈啪聲）放在 0.3、1.1、1.9 秒 |
| sfx-sweep-surge.ogg | 錄音版的備用：海水漫上島 | 帶通噪音湧起（200→1800 Hz，0.55 秒）接白色水沫（0.3 秒衰減） |
| sfx-crate-sink.ogg | 錄音版的備用：每一箱沉下去 | 同 `sfx-crate-drop.ogg` 的合成水花，較輕（0.6 秒） |

## V0.8 的配樂（程式編曲，2026-11-28）

不用 AI，也不用錄音：旋律、和弦、節奏都寫在腳本裡，樂器用 numpy 合成（Karplus-Strong 撥弦當吉他與烏克麗麗、加法合成的滑音吉他與顫音弦、模態合成的木琴與鋼鼓、合成的手鼓、沙鈴、拍手、定音鼓），再疊合成殘響。母帶：切掉 70 Hz 以下（事件背景切 100 Hz 以下）、軟限幅、以 LUFS 對齊（音樂 −16、事件背景 −19）；每首都把超出一輪的尾巴繞回開頭，所以能無縫循環。腳本在 `audio-drafts/music/`（`kit.py` 樂器與編曲器，`compose1～3.py` 各曲），不進 git。

| 檔案 | 用途 | 編曲 |
|---|---|---|
| music-tide.ogg | 暗潮季（暗潮將至之後到倒數第二回合）的對局音樂（`matchMusic` 的 `tide`） | 對局音樂（G 大調、約 65 BPM、G–C–D）的關係小調 E 小調，72 BPM，16 小節 53 秒：低音弦悶音奔馳的頑固音型、加快的「咚－咚」心跳鼓、顫音弦襯底加一層高音細顫音、穿插不和諧的 F 和弦（降二級）、每 8 小節尾巴鼓聲滾奏，滑音吉他長音常滑半音；`compose2.py` 的 B |
| music-final.ogg | 最後一回合的對局音樂（`final`） | G 大調 116 BPM，16 小節 33 秒：烏克麗麗刷弦、鋼鼓主旋律、手鼓與沙鈴，第二輪木琴低八度加入，最後一小節小鼓推回開頭；`compose1.py` |
| music-result.ogg | 終局結果：勝利號角之後在排名下循環（`ResultCard`） | G 大調 112 BPM 嘉年華卡利普索，16 小節 34 秒：烏克麗麗密集刷弦、鋼鼓主旋律、拍手、手鼓、四拍大鼓，後半木琴三度和聲，句尾滑音吉他接話，最後鋼鼓往上刷回開頭；`compose2.py` |
| event-boss-storm.ogg | 暗潮面「所有船 −2」（風暴潮）的背景 | 本目錄的 `event-storm.ogg`（22 秒循環）壓低 8 dB 當底，上面是 E 小調、8 小節剛好 22 秒的音樂：低音弦十六分音符奔馳、八分音符連打的戰鼓、顫音弦、每 4 小節定音鼓滾奏、滑音吉他長音，每 2 小節一聲合成的近雷（明亮的劈啪＋低吼）；切掉 120 Hz 以下；`compose4.py` 的 B |
| event-boss-pirate.ogg | 暗潮面「海盜伏擊」（海盜潮）的背景 | D 小調 96 BPM，12 小節 30 秒：低音弦奔馳的頑固音型、戰鼓與小鼓、顫音弦、滑音吉他往下半音的威脅動機；`compose3.py` |
| event-boss-inspection.ogg | 暗潮面「嚴查」（查緝潮）的背景 | C 小調 100 BPM，12 小節 29 秒：左右交替的木魚滴答（時鐘）、斷奏撥弦行進低音、輕軍鼓與滾奏、顫音弦、木琴短促的盤查動機；`compose3.py` |
| event-boss-crash.ogg | 暗潮面「貨滿為患」（崩盤潮）的背景 | A 小調 76 BPM，8 小節 25 秒：木琴每小節兩次往下掉的琶音（第二次微微走音，像價格滑落）、低音半音一路往下、慢顫音弦、走音的鋼鼓叮聲；`compose3.py` |

## 程式合成的音效

| 檔案 | 用途 | 合成方式 |
|---|---|---|
| sfx-bubble.ogg | 生產的 +N 冒出（遊戲以播放速度 1、1.12、1.24… 讓每一聲比前一聲高） | 正弦波，頻率由 300 Hz 指數上刷到 900 Hz（時間常數 18 ms），疊 0.35 倍的低八度，2 ms 起音、60 ms 指數衰減，長 0.2 秒，峰值 −1 dBFS；作者自製，無授權限制 |
| sfx-island-pop.ogg | 島嶼技能通知的晶片冒出（代價晶片以 0.82 倍速播，更低沉） | 正弦波，頻率由 260 Hz 指數上刷到 760 Hz（時間常數 20 ms），疊 0.5 倍的低八度，2 ms 起音、80 ms 指數衰減，長 0.25 秒，峰值 −1 dBFS（低沉的大泡泡）；作者自製，無授權限制 |
| sfx-beacon-ding.ogg | 燈塔島：「燈塔！」字樣跳出時的叮 | 鈴聲：基頻 1175 Hz 的正弦波，疊 0.5、2、2.76、5.4 倍頻的泛音（振幅 0.25、0.55、0.35、0.18），各自指數衰減（時間常數 0.55 秒乘上 1.3、0.7、0.5、0.3），2 ms 起音，長 1.6 秒，峰值 −3 dBFS；作者自製，無授權限制 |
| sfx-beam-sweep.ogg | 燈塔島：光束掃向船、到鎖定的那一下（Spotlight，左到右） | 合成：白噪音經共振帶通濾波器（Q 4），中心頻率由 500 Hz 指數上掃到 3200 Hz（曲線 t^1.3），振幅先升後降（0.8 秒處最大，之後衰減），tanh 軟限幅提高響度，聲像由左 0.15 掃到右 0.85，長 1.0 秒，峰值 −2 dBFS；作者自製，無授權限制 |
| sfx-ui-tick.ogg | 線上對局限時的最後 10 秒，每秒一聲（最後 3 秒以 1.25 倍速播，更急） | 木頭時鐘的「答」：1850 Hz 與 3100 Hz 兩個正弦波（振幅 0.6、0.35，衰減常數 90、140／秒）疊白噪音的短促點擊（衰減常數 900／秒，0.25 倍），1.5 ms 起音，長 0.12 秒，峰值 −3 dBFS，以 ffmpeg 內建的 Vorbis 編碼（q 6）；作者自製，無授權限制 |
| sfx-gamble-pick.ogg | 最後的大市集：兩顆骰落定後「取高的」那一下（0.10 秒低骰被彈走，0.30、0.42 秒兩聲上行的叮對著高骰發金光） | 骰子敲擊：Kenney Casino Audio `die-throw-2.ogg`（CC0）的第一下（0.05～0.20 秒），放在 0.10 秒。鈴聲：正弦波疊 2、2.76、5.4 倍頻的泛音（振幅 1、0.5、0.3、0.14；衰減時間常數乘上 1、0.6、0.45、0.25），2 ms 起音；E6（1318.5 Hz，時間常數 0.16 秒，音量 0.55）在 0.30 秒、A6（1760 Hz，時間常數 0.30 秒，音量 0.8）在 0.42 秒。長 1.25 秒，80 ms 淡出，峰值 −3 dBFS；2026-11-24 作者自製，無授權限制 |

## Kenney 的 CC0 音效（直接放在本目錄）

取自 Kenney 的 [Casino Audio](https://kenney.nl/assets/casino-audio)（1.1）、[Impact Sounds](https://kenney.nl/assets/impact-sounds)、[RPG Audio](https://kenney.nl/assets/rpg-audio)、[Music Jingles](https://kenney.nl/assets/music-jingles)、[Interface Sounds](https://kenney.nl/assets/interface-sounds) 與 [UI Audio](https://kenney.nl/assets/ui-audio)（2026-10-25），授權 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)：可商用、免署名、可散布，所以放在公開 repo 裡。單一檔案只把峰值調到 −1 dBFS；疊合的（角色揭露、擲骰）另註，疊好後 +8 dB 進軟限幅、峰值 −0.3 dBFS。

| 檔案 | 用途 | 原始檔案 |
|---|---|---|
| sfx-card-deal.ogg | 選島與島嶼公開：一張島卡發到桌上 | Casino Audio `card-shove-1.ogg` |
| sfx-card-flip.ogg | 島卡翻面 | Casino Audio `card-place-3.ogg` |
| sfx-card-pick.ogg | 選一座島 | Casino Audio `card-place-4.ogg` |
| sfx-card-confirm.ogg | 選定，島卡飛向座位 | Casino Audio `card-shove-2.ogg` |
| sfx-islands-reveal.ogg | 各商會的島公開 | Casino Audio `card-shuffle.ogg` |
| sfx-arrive.ogg | 航程拍：船抵達 | Impact Sounds `impactBell_heavy_000.ogg` |
| sfx-dice.ogg | 航程拍：起始骰值（沒有 `licensed/` 時；骰面跳動 0.52 秒後落下） | Casino Audio `dice-shake-1.ogg` 0.52 秒（0.7 倍）接 `die-throw-2.ogg`；+6 dB 軟限幅，峰值 −0.3 dBFS |
| sfx-role-intel.ogg | 角色揭露：情報商人 | RPG Audio `metalLatch.ogg`，0.18 秒後疊 `metalClick.ogg`（望遠鏡拉開） |
| sfx-role-guard.ogg | 角色揭露：護衛 | Impact Sounds `impactMetal_heavy_000.ogg` 疊 RPG Audio `beltHandle1.ogg`（0.5 倍） |
| sfx-role-pirate.ogg | 角色揭露：海盜 | RPG Audio `drawKnife2.ogg`，0.12 秒後疊 Impact Sounds `impactMetal_light_002.ogg`（0.6 倍，拔刀的金屬餘響） |
| sfx-role-smuggler.ogg | 角色揭露：走私商人 | RPG Audio `cloth3.ogg`，0.12 秒後疊 `beltHandle2.ogg`（0.6 倍） |
| sfx-role-broker.ogg | 角色揭露：莊家 | RPG Audio `handleCoins2.ogg`（把玩硬幣） |
| sfx-round-open.ogg | 新回合開始（進入投資） | Music Jingles `jingles_STEEL09.ogg`（鋼鼓短樂句） |
| sfx-price-up.ogg | 市場卡：漲價（漲兩格時遊戲以 1.12 倍速播，音調更高） | Music Jingles `jingles_STEEL16.ogg` |
| sfx-price-down.ogg | 市場卡：跌價（跌兩格時以 1/1.12 倍速播） | Music Jingles `jingles_STEEL16.ogg` 降 4 個半音（重取樣），峰值 −1 dBFS |
| sfx-produce.ogg | 島嶼生產的貨箱落進倉庫 | Impact Sounds `impactPlank_medium_001.ogg`，0.16 秒後 `impactPlank_medium_003.ogg`（0.8 倍） |
| sfx-market-open.ogg | 黑市成交面板出現：沉重的木板放下 | `sfx-produce.ogg`（Impact Sounds 的兩聲木板）以 0.65 倍速重取樣（更低、更沉），峰值 −1 dBFS |
| sfx-wanted.ogg | 通緝令插旗 | RPG Audio `cloth4.ogg`，0.1 秒後疊 Music Jingles `jingles_PIZZI06.ogg`（0.7 倍，低沉撥弦） |
| sfx-book-open.ogg | 打開規則書 | RPG Audio `bookOpen.ogg` |
| sfx-book-flip.ogg | 規則書換章節 | RPG Audio `bookFlip3.ogg` |
| sfx-book-close.ogg | 闔上規則書 | RPG Audio `bookClose.ogg` |
| sfx-reroll.ogg | 情報重擲：骰子跳 1.4 秒後落定 | Casino Audio `dice-shake-1.ogg` 重複到 1.4 秒（0.7 倍），1.38 秒接 `die-throw-1.ogg` |
| sfx-build.ogg | 建築升起（敲槌）到金光完成 | Impact Sounds `impactPlank_medium_000`、`impactWood_medium_001`、`impactPlank_medium_002`、`impactWood_medium_003` 於 0／0.35／0.7／1.05 秒，1.5 秒接 Interface Sounds `confirmation_002.ogg` |
| sfx-ui-click.ogg | 一般按鈕點擊 | UI Audio `click1.ogg` |
| sfx-ui-question.ogg | 「還沒做完」提醒 | Interface Sounds `question_003.ogg` |
| sfx-ui-turn.ogg | 輪到你部署角色 | Interface Sounds `drop_002.ogg` |
| sfx-ui-join.ogg | 線上大廳有人入座 | Interface Sounds `maximize_006.ogg` |
| sfx-ui-leave.ogg | 線上大廳有人離開 | Interface Sounds `minimize_006.ogg` |
| sfx-role-pick.ogg | 部署時選一張角色卡（像轉珠落格） | UI Audio `click5.ogg` 升調 1.15 倍，疊 Casino Audio `chips-collide-1.ogg` 前 0.12 秒（0.35 倍）；+8 dB 進軟限幅，峰值 −0.3 dBFS |

## 授權音效庫的剪輯（`licensed/`，不進 git）

`licensed/` 裡的音檔是從 [Sonniss GDC Game Audio Bundle](https://sonniss.com/gameaudiogdc)（2016～2020，經官方鏡像 ftpmirror.your.org 取得，2026-10-24）與 Mixkit 的錄音剪輯、疊合而成，授權為 [Sonniss GDC Bundle License 2.0](https://sonniss.com/gdc-bundle-license/)：可商用、免署名、可修改，用在遊戲裡沒問題；**不得把音效（含修改過的）當成音效檔散布**，也不得用於 AI 訓練。這個 repo 是公開的，所以 `public/audio/licensed/` 列在 `.gitignore`，檔案備份在作者的 iCloud 雲碟（`暗潮商戰音效/licensed/`），部署時從本機一起打包。沒有這個資料夾的 checkout 會改播同名的 AI 版本（`soundPlan.ts` 的 `fallback`）。

| 檔案 | 用途 | 原始錄音（Sonniss 檔名） | 剪輯 |
|---|---|---|---|
| licensed/sfx-dice.ogg | 航程拍：起始骰值（骰面跳動 0.52 秒後落下） | Kenney Casino Audio `dice-shake-1.ogg`（CC0）；Sonniss Dice 9 | 搖骰 0.52 秒（0.7 倍），接著骰子落桌（Dice 9，+8 dB 軟限幅）；整體 +6 dB 軟限幅，峰值 −0.3 dBFS |
| licensed/sfx-bill-register.ogg | 回合帳單出現時的收銀聲 | 本目錄的 AI 收銀機 `sfx-bill-register.ogg`；Money,Coins,Drop In Cash Register | AI 收銀機的「叮」之後 0.35 秒，硬幣掉進收銀機（0.8 倍） |
| licensed/event-tailwind.ogg | 順風公開後的背景（2026-10-25 起改用船歌，已不使用） | W 04 Water_19_Splashing, Sailing, Ship_T03 | 20 秒起取 40 秒，−21 LUFS，2 秒交叉淡化循環（38 秒） |
| licensed/ambience-waves.ogg | 對局中的海浪環境音 | JSE_Ocean Waves Gentle Sand_07 | 10 秒起取 60 秒，−22 LUFS，2 秒交叉淡化循環（58 秒） |
| licensed/sfx-guard.ogg | 航程拍：護衛 +1 | The Captain's Shield Metal Hit 5；Ice_Spell_Ice_Spell_Buff_Positive_02 | 盾牌撞擊（0.42 秒起 1.8 秒），0.05 秒後疊上增益魔法音（0.8 倍） |
| licensed/sfx-pirate.ogg | 航程拍：海盜 −1 | warfare_t1b_cannon_firing_forest_distant_MKH8060_2；DeepExplosion02 | 第一聲砲擊（0.42 秒起 2.2 秒），0.5 秒後接低沉爆炸 |
| licensed/sfx-island.ogg | 航程拍：燈塔島 +1（舞台燈打開） | Switch,ElectricalPanelBreaker,On；signal_lever_on；PM_FN_Events_LvlUps_PowerUps_25 | 斷路器「喀咚」疊上降調 0.6 倍的同一聲加厚低頻；0.35 秒後再接號誌拉桿＋斷路器＋能量上升（0.9 倍） |
| licensed/sfx-sink.ogg | 航程拍：船沉沒 | wood_breaking_cracking_snapping_breaking_peeling_bones_break_snap_crack_13；Bluezone_BC0256_water_splash_008；Elemental - Water Bubbles Big_4 | 木頭碎裂，0.3 秒後落水，1.3 秒後氣泡（0.45 倍） |
| licensed/sfx-event-storm.ogg | 航程拍：暴風雨 −1，閃電擊中船 | Mixkit「Mid strength single thunder」（#1298）；Mixkit「Explosion hit」（#1704） | 單雷剪到最響處在 0.03 秒、爆炸最響處在 0.33 秒（對上白閃的兩下），共 4 秒，最後 1.4 秒淡出；+9 dB 進軟限幅（tanh），峰值 −0.3 dBFS |
| licensed/sfx-storm-bolt.ogg | 暴風雨時桌上每道閃電落進海裡的雷聲 | Mixkit「Strong close thunder explosion」（#1300） | 從 0.35 秒起取 4 秒，最後 1.5 秒淡出；峰值 −1 dBFS |
| licensed/sfx-settle-sale.ogg | 結算：賣貨收入 | Coins_Pouch_Leather_Drop_Into_Takes_3；Coin_Wood_Table_Singles_Drop_Spin_Takes_5 | 錢幣掉進皮錢袋（0.35 秒起 1 秒），疊上兩枚單幣落桌的「叮」（升調 1.15、1.2 倍，0.02 與 0.12 秒）；+9 dB 進軟限幅，峰值 −0.3 dBFS |
| licensed/sfx-settle-coins.ogg | 結算：護航費、莊家獎金／抬價補貼／壓價差額 | 264604 - Stack Coin Bag 04；Coin_Wood_Table_Singles_Drop_Spin_Takes_5 | 錢袋放下（前 0.8 秒），0.03 秒後疊一枚單幣的「叮」（升調 1.15 倍）；+9 dB 進軟限幅，峰值 −0.3 dBFS |
| licensed/sfx-settle-tick.ogg | 結算：交易所佣金 | Coin02 | 整段，0.2 秒淡出；峰值 −1 dBFS |
| licensed/sfx-settle-smuggle.ogg | 結算：走私抽成 | Coin_Slide_Carpet；Coins_In_Sack_Held_By_Drawstring_06 | 硬幣滑過，0.18 秒後疊束口錢袋（0.8 倍）；峰值 −1 dBFS |
| licensed/sfx-settle-caught.ogg | 結算：抓到走私 | Whistle_Finger_Moderate_02 | 第一聲哨（0.03 秒起 0.6 秒）；峰值 −1 dBFS |
| licensed/sfx-settle-fine.ogg | 結算：走私罰款 | Money,Coins,Handle | 0.1 秒起 0.7 秒，0.2 秒淡出；峰值 −1 dBFS |
| licensed/sfx-settle-loot.ogg | 結算：海盜戰利品、搶走私貨 | CST_Chest_Ancient_Close2_SFXWiz；coins sack throwing mono | 寶箱闔上（0.75 秒起 1.1 秒，0.9 倍），0.25 秒後疊一袋硬幣丟出（0.8 倍）；峰值 −1 dBFS |
| licensed/sfx-settle-arms.ogg | 結算：沒收軍火 | Pile of Scrap Metal - Metal Scrap Pile, Rustle, Drop, Long Tail 03 | 0.55 秒起 1.1 秒；峰值 −1 dBFS |
| licensed/sfx-settle-insurance.ogg | 結算：保險保住貨 | drop_multiple_boxes_003 | 整段；峰值 −1 dBFS |
| licensed/sfx-settle-salvage.ogg | 結算：打撈撈到貨 | Bluezone_BC0256_water_splash_drop_006；drop_multiple_boxes_003 | 落水，0.35 秒後箱子落地（0.9 倍）；峰值 −1 dBFS |
| licensed/sfx-settle-spoil.ogg | 結算：香料壞掉 | Bluezone_BC0263_creature_crab_organic_texture_carapace_crack_squishy_003 | 前 0.6 秒；峰值 −1 dBFS |

Mixkit 的三段素材取自 [mixkit.co](https://mixkit.co/free-sound-effects/thunder/)（2026-10-24），授權為 [Mixkit Sound Effects Free License](https://mixkit.co/license/#sfxFree)：可免費用於商業專案與電子遊戲、不需署名；**不得單獨散布音效本身**，所以同樣放在 `licensed/`。

所有剪輯都重取樣為 48 kHz、峰值 −1 dBFS，輸出 Ogg Vorbis（quality 0.8）。

