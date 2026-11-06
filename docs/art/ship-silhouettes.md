# 五艘船的剪影（2026-11-06 使用者定案）

五種船（第 8.1 節）要**靠輪廓分辨，不靠顏色**：顏色留給「誰的船」，剪影負責「哪一種船」（Valve 在 TF2 的作法：陣營用色、職業用剪影）。目標是遊戲實際鏡頭（`TableCanvas` 的 `[0, 82, 60]`，約 54° 俯角）下縮到手機大小（約 20～32 px）仍分得出來。

## 原則

- 先做純黑剪影，沒有內部細節也要認得出來；細節只加在縮小後還留得住的地方。
- 每艘船只靠**一個主要特徵**辨識，五個特徵屬於不同類型，不要兩艘共用同一類特徵。
- 造型可以誇張、卡通化（使用者同意），比例誇張比寫實好認。
- 船頭朝向鏡頭時也分得出來（已在剪影圖確認）。

## 五艘船

| 船 | 參考船型 | 主要特徵（縮小後靠它辨識） | 其他 |
| --- | --- | --- | --- |
| 信天翁號 `standard` | 單桅方帆船 | 一根桅杆＋一面加寬的方帆（像展開的翅膀） | 當「標準形」；船尾小艙、桅頂三角旗 |
| 孤注號 `gambler` | 拉丁帆船（xebec） | 細長船身上一面超大、偏向一側的三角斜帆，桅杆前傾，長船首斜桅 | 帆大到看起來會翻；五艘中唯一的大三角帆 |
| 巨鯨號 `freighter` | 中式帆船（junk） | 又寬又圓的橢圓船身，甲板疊兩層貨箱 | 兩根矮桅、中式橫條帆、船尾高艙 |
| 幽靈號 `hidden` | 鬼船 | 破成垂條、下緣鋸齒的歪斜破帆，前桅斷一截往前折 | 船身低；船尾掛燈籠；**夜晚破帆與燈籠發青綠色光** |
| 海嘯號 `breaker` | 撞角槳帆船（三列槳戰船） | 兩側各一排槳（從上方看像梳子）＋船頭低撞角 | 船尾往上捲；一面小方帆 |

## 試過但不採用

- 幽靈號只有光桅杆、收帆：縮小後看不出是什麼，沒特色。
- 幽靈號披床單（圓頂、波浪下擺、眼洞）：沒選。
- 海嘯號楔形船身＋撞角＋側邊刀刃：看不出是什麼。
- 海嘯號捲浪形的帆：醜。
- 海嘯號外撐架＋蟹螯帆、龍首龜甲船：沒選（蟹螯帆可能和孤注號的三角帆搞混；龜甲的寬橢圓像巨鯨號）。

## 下一步

依 [`lowpoly-style.md`](lowpoly-style.md) 與 `.claude/skills/lowpoly-model` 做成低面數模型，取代目前五艘共用的 `ship-medium`；做好後在遊戲鏡頭下以手機大小重新確認剪影。玩家顏色放在哪個部位（帆、旗、船身）尚未決定。

## 參考資料

- Valve, *Stylization With A Purpose: The Illustrative World of Team Fortress 2*（GDC 2008）；Mitchell et al., *Illustrative Rendering in Team Fortress 2*
- 帆裝分類：<https://crewlist.org.uk/about/rigs>、<https://wikipedia.com/wiki/Sailing_rig>
- 三列槳戰船與撞角：<https://www.nationalgeographic.com/history/history-magazine/article/navy-warship-triremes-ancient-greece-athens-mediterranean>
