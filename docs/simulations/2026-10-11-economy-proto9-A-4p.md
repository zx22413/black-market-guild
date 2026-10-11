# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-8（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100
- 對局數：2000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 2000 | 26.6% | 2414.34 |
| cautious | 2000 | 16.1% | 2277.59 |
| aggressive | 2000 | 33.0% | 2491.77 |
| builder | 2000 | 24.4% | 2413.60 |

- 每局最高與最低財富差距平均 1304.34 G。

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 1961 | 24.5% | 2.04 |
| 航運保險 | 6352 | 79.4% | 1.58 |
| 打撈公司 | 4337 | 54.2% | 1.36 |
| 貿易交易所 | 3088 | 38.6% | 1.47 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.97 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：95.0%；平均每回合到港前裝運 10.33 單位。
- 到港量對需求（每種材料每回合）：少於需求 65.7%、剛好 19.2%、多於需求 15.1%。
- 終局每名玩家平均剩下 5.78 單位材料（歸零）。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.1% | 0.4% | 4.3% | 13.0% | 31.3% | 29.2% | 21.8% |
| 鐵礦 | 0.0% | 0.1% | 1.0% | 4.8% | 26.0% | 34.9% | 33.2% |
| 香料 | 0.7% | 3.2% | 2.3% | 11.8% | 10.7% | 25.4% | 45.8% |
| 違禁品 | 0.0% | 0.1% | 1.1% | 5.5% | 22.3% | 21.9% | 49.1% |

- 牙人：押注 7028 次，押中 81.5%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 1979 單位、399452 G。
- 交易所（效果 做市佣金）：佣金共 877410 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 439 | 0.9% |
| 護衛 | 32828 | 68.4% |
| 海盜 | 4987 | 10.4% |
| 走私商人 | 2409 | 5.0% |
| 牙人 | 7028 | 14.6% |

- 護衛守「自己沒有貨的船」：67.8%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 227 次、上別人船走私 2182 次；掩護佔走私 9.4%；有違禁品的出航中被掩護 8.2%。
- 海盜：目標沉沒率 53.1%；每次平均淨收益 8 G。
- 護航費總額 1301175 G；保險補償 0 G、保住 10799 單位；打撈 20876 單位；走私取走 75475 G。共 47691 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
