# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-7（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1
- 對局數：2000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 2000 | 24.5% | 2367.33 |
| cautious | 2000 | 17.4% | 2256.17 |
| aggressive | 2000 | 34.0% | 2449.14 |
| builder | 2000 | 24.1% | 2362.75 |

- 每局最高與最低財富差距平均 1302.99 G。

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 1893 | 23.7% | 2.05 |
| 航運保險 | 6297 | 78.7% | 1.57 |
| 打撈公司 | 4297 | 53.7% | 1.36 |
| 貿易交易所 | 3225 | 40.3% | 1.50 |
| 牙行 | 7 | 0.1% | 6.00 |

- 每名玩家終局平均持有 1.96 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：94.7%；平均每回合到港前裝運 10.29 單位。
- 到港量對需求（每種材料每回合）：少於需求 64.5%、剛好 19.9%、多於需求 15.7%。
- 終局每名玩家平均剩下 5.76 單位材料（歸零）。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.5% | 5.0% | 14.2% | 32.0% | 28.3% | 19.9% |
| 鐵礦 | 0.0% | 0.1% | 1.1% | 4.9% | 27.5% | 34.8% | 31.6% |
| 香料 | 0.9% | 5.6% | 2.1% | 16.8% | 9.4% | 26.6% | 38.6% |
| 違禁品 | 0.0% | 0.0% | 0.9% | 5.3% | 22.3% | 21.3% | 50.3% |

- 牙行調整需求 6 次（每局平均 0.00）；違禁品被護衛沒收 2243 單位、449156 G。
- 交易所（效果 做市佣金）：佣金共 922560 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 656 | 1.4% |
| 護衛 | 36420 | 75.9% |
| 海盜 | 6286 | 13.1% |
| 走私商人 | 4101 | 8.5% |

- 護衛守「自己沒有貨的船」：69.1%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 331 次、上別人船走私 3770 次；掩護佔走私 8.1%；有違禁品的出航中被掩護 13.4%。
- 海盜：目標沉沒率 52.4%；每次平均淨收益 2 G。
- 護航費總額 1457925 G；保險補償 0 G、保住 10313 單位；打撈 20211 單位；走私取走 106675 G。共 47463 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
