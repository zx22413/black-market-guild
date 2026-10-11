# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-8（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2
- 對局數：2000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 2000 | 25.9% | 1733.14 |
| cautious | 2000 | 17.1% | 1651.18 |
| aggressive | 2000 | 35.4% | 1787.43 |
| builder | 2000 | 21.6% | 1697.33 |

- 每局最高與最低財富差距平均 986.02 G。

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 2479 | 31.0% | 1.99 |
| 航運保險 | 4805 | 60.1% | 1.90 |
| 打撈公司 | 3721 | 46.5% | 1.15 |
| 貿易交易所 | 3060 | 38.3% | 1.61 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.76 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：82.1%；平均每回合到港前裝運 7.92 單位。
- 到港量對需求（每種材料每回合）：少於需求 47.7%、剛好 28.4%、多於需求 23.9%。
- 終局每名玩家平均剩下 2.46 單位材料（歸零）：木材 0.61、鐵礦 0.33、香料 0.00、違禁品 1.52。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.3% | 6.4% | 16.3% | 30.0% | 27.2% | 19.8% |
| 鐵礦 | 0.0% | 0.0% | 2.0% | 7.7% | 24.3% | 31.4% | 34.5% |
| 香料 | 3.8% | 12.6% | 5.1% | 24.3% | 10.7% | 23.4% | 20.2% |
| 違禁品 | 2.1% | 6.6% | 18.9% | 31.8% | 26.3% | 10.9% | 3.4% |

- 牙人：押注 6575 次，押中 69.6%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 3640 單位、549090 G。
- 交易所（效果 做市佣金）：佣金共 713265 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 758 | 1.6% |
| 護衛 | 25429 | 53.0% |
| 海盜 | 8828 | 18.4% |
| 走私商人 | 5290 | 11.0% |
| 牙人 | 6575 | 13.7% |

- 護衛守「自己沒有貨的船」：70.4%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 640 次、上別人船走私 4650 次；掩護佔走私 12.1%；有違禁品的出航中被掩護 14.6%。
- 海盜：目標沉沒率 57.6%；每次平均淨收益 8 G。
- 護航費總額 824175 G；保險補償 0 G、保住 8162 單位；打撈 19029 單位；走私取走 147275 G。共 46880 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
