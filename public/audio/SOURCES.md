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
| sfx-match-end-horn.ogg | 結果畫面公布第一名時的勝利號角 | Short triumphant brass fanfare of ship horns and trumpets announcing a safe arrival in port, bold and victorious, ending on a held major chord. | 50002 | music，5 秒，cfg 4，negative：drums loop, electronic, sad, vocals | 切掉頭尾靜音（−55 dB）；500 ms 淡出；峰值 −3 dBFS；4.8 秒 |
| sfx-seal.ogg | 投資、部署送出（封蠟章，像蓋印章的「啪」） | SFX：rubber stamp, pressed down hard once onto a sheet of paper, a short sharp slap, rubber, ink pad, paper on a wooden desk, office, close-up, dry. | 60001 | sfx，1.5 秒，cfg 4，negative：music, voice, reverb tail, long | 只取第一下（起音前 0.01 秒起 0.45 秒），0.12 秒淡出；峰值 −0.5 dBFS |
| event-storm.ogg | 暴風雨公開後的背景（取代海浪） | heavy tropical rainstorm at sea, howling wind, waves crashing against a wooden ship's hull, continuous pouring rain and gusts, with a distant thunder rumble now and then, rain on wood and canvas, rough water, out on the open sea, wide stereo. | 20001 | sfx，24 秒，cfg 1 | −20 LUFS；2 秒交叉淡化循環；22 秒 |
| event-tailwind.ogg | 順風背景的 AI 備用版 | strong steady sea wind filling the canvas sails of a wooden sailing ship, continuous brisk wind, sails flapping and ropes creaking, the hull cutting fast through water, canvas, hemp rope, timber, spray, on deck, outdoors, wide stereo. | 21001 | sfx，24 秒，cfg 1 | −21 LUFS；2 秒交叉淡化循環；22 秒 |
| event-fog.ogg | 海霧公開後的配樂 | Eerie misty ambient drone with soft low synth pads, a distant lonely foghorn and faint lapping water, slow, sparse and mysterious. | 22001 | music，32 秒，cfg 4，negative：drums, beat, fast, cheerful | 只取音量穩定的段落（0～28 秒）；−21 LUFS；1.5 秒交叉淡化循環；26.5 秒 |
| event-moonless.ogg | 月黑風高公開後的配樂 | Dark suspenseful night ambient with a low cello drone, soft ticking percussion and quiet crickets, tense and secretive, smugglers sneaking in the dark. | 23001 | music，32 秒，cfg 4，negative：cheerful, upbeat, bright, loud drums | 只取音量穩定的段落（0～30 秒）；−21 LUFS；1.5 秒交叉淡化循環；28.5 秒 |
| event-rush.ogg | 黑市熱絡公開後的配樂 | Feverish lively bazaar groove with energetic hand drums, shakers, plucked oud-like strings and punchy brass stabs, excited bustling market crowd energy. BPM: 124. | 24002 | music，32 秒，cfg 4，negative：slow, sad, calm | 切掉開頭 4 秒，循環終點選在節奏對齊處；0.4 秒交叉淡化；−19 LUFS；23.2 秒 |
| sfx-guard.ogg | 航程拍：護衛 +1 | heavy round iron shield, struck once, a firm protective metallic clang with a deep thud, iron and oak, outdoors on a ship's deck, close. | 31001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-pirate.ogg | 航程拍：海盜 −1 | old iron ship cannon, one cannon shot boom, the cannonball whistling and splashing into the sea nearby, black powder blast, water splash, open sea, medium distance. | 32001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-tailwind.ogg | 航程拍：順風 +1 | a sudden gust of sea wind into sails, a rising whoosh that fills the canvas with a snap, wind, canvas, outdoors, wide. | 33001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-storm.ogg | 暴風雨雷聲的 AI 備用版（沒有 `licensed/` 時，擊中船與海上閃電都播這個） | lightning strike and thunder, one sharp thunder crack close by, rolling into a low rumble, thunder, open sea, huge outdoor space. | 34001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-fog.ogg | 航程拍：海霧（被海盜鎖定的船 +1） | ship's foghorn, one long low mournful blast fading into mist, brass horn, deep tone, foggy harbor, distant, reverberant. | 35001 | sfx，3 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-event-moonless.ogg | 航程拍：月黑風高（被護衛鎖定的船 −1） | deep cinematic low impact, one dark ominous boom with a soft reverse swell before it, sub bass, muffled drum, large dark space. | 36001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-island.ogg | 航程拍：燈塔島 +1 | lighthouse lamp switching on, a bright magical ascending shimmer with a warm hum, glass chimes, electric hum, close, light reverb. | 37001 | sfx，2 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |
| sfx-sink.ogg | 航程拍：船沉沒 | wooden ship hull breaking apart, timber cracking and splintering, a big splash, then bubbling as it sinks, wood, water, open sea, close. | 39001 | sfx，4 秒，cfg 4，negative：music, melody, voice, speech | 切掉頭尾靜音（−55 dB）；250 ms 淡出；峰值 −3 dBFS |

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
| sfx-produce.ogg | 島嶼生產的貨箱落進倉庫 | Impact Sounds `impactPlank_medium_001.ogg`，0.16 秒後 `impactPlank_medium_003.ogg`（0.8 倍） |
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
| licensed/event-tailwind.ogg | 順風公開後的背景 | W 04 Water_19_Splashing, Sailing, Ship_T03 | 20 秒起取 40 秒，−21 LUFS，2 秒交叉淡化循環（38 秒） |
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

