# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-8（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1
- 對局數：2000；人數：3；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 1500 | 34.8% | 1921.63 |
| cautious | 1500 | 22.7% | 1821.26 |
| aggressive | 1500 | 42.7% | 1942.48 |
| builder | 1500 | 33.1% | 1931.68 |

- 每局最高與最低財富差距平均 795.00 G。

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 3726 | 62.1% | 2.16 |
| 航運保險 | 5809 | 96.8% | 1.18 |
| 打撈公司 | 829 | 13.8% | 2.45 |
| 貿易交易所 | 1104 | 18.4% | 2.14 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.91 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：96.2%；平均每回合到港前裝運 8.19 單位。
- 到港量對需求（每種材料每回合）：少於需求 31.8%、剛好 34.5%、多於需求 33.8%。
- 終局每名玩家平均剩下 3.51 單位材料（歸零）。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.6% | 3.3% | 14.3% | 27.6% | 32.3% | 17.7% | 4.3% |
| 鐵礦 | 2.5% | 8.9% | 24.1% | 31.3% | 23.6% | 8.0% | 1.5% |
| 香料 | 10.4% | 23.4% | 6.7% | 31.1% | 5.1% | 17.4% | 5.9% |
| 違禁品 | 1.1% | 5.5% | 18.3% | 32.5% | 26.9% | 11.8% | 3.9% |

- 牙人：押注 7039 次，押中 67.3%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 2233 單位、351678 G。
- 交易所（效果 做市佣金）：佣金共 241470 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 323 | 0.9% |
| 護衛 | 22196 | 61.7% |
| 海盜 | 4287 | 11.9% |
| 走私商人 | 1833 | 5.1% |
| 牙人 | 7039 | 19.6% |

- 護衛守「自己沒有貨的船」：44.8%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 271 次、上別人船走私 1562 次；掩護佔走私 14.8%；有違禁品的出航中被掩護 7.4%。
- 海盜：目標沉沒率 52.5%；每次平均淨收益 15 G。
- 護航費總額 493125 G；保險補償 0 G、保住 10745 單位；打撈 2358 單位；走私取走 49650 G。共 35678 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
