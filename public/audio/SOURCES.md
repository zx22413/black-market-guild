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
| sfx-match-end-bells.ogg | 整局結束、結果畫面出現時的連續鐘聲 | 由一聲港口鐘組成。鐘聲原檔的提示詞：SFX：large heavy bronze harbor bell, low pitched / one slow deep toll struck by a heavy clapper, long resonant hum decaying over several seconds / thick cast bronze, dark warm low overtones, no high tinkling / outdoor harbor at a distance, gentle natural reverb | 8002 | sfx，7 秒，cfg 1 | 原檔切掉頭尾靜音、600 ms 淡出後，疊成 5 下（0、1.3、2.6、3.95、5.4 秒），單數下原音、雙數下降低小三度（重取樣），模擬鐘來回擺動；峰值 −3 dBFS；600 ms 淡出；13 秒 |
