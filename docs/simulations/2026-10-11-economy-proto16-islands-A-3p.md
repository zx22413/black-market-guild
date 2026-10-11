# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-13（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2、roles.hand.mode=2、roles.hand.cooldown=2、islands.enabled=1、islands.draft=1
- 對局數：4000；人數：3；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 3000 | 35.4% | 1627.91 |
| cautious | 3000 | 26.4% | 1527.40 |
| aggressive | 3000 | 42.6% | 1680.83 |
| builder | 3000 | 29.0% | 1563.95 |

- 每局最高與最低財富差距平均 788.89 G。

島嶼特色（公平勝率 33.3%）：

| 島 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| 燈塔島 | 1280 | 36.5% | 1629.33 |
| 礦山島 | 1636 | 34.8% | 1604.89 |
| 林場島 | 1599 | 34.6% | 1613.00 |
| 海盜灣 | 1600 | 33.9% | 1585.81 |
| 走私港 | 1439 | 33.5% | 1575.83 |
| 自由港 | 1459 | 32.3% | 1652.67 |
| 要塞島 | 1561 | 30.9% | 1586.75 |
| 香料群島 | 1426 | 30.3% | 1554.59 |

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 4358 | 36.3% | 1.93 |
| 航運保險 | 10294 | 85.8% | 1.18 |
| 打撈公司 | 1767 | 14.7% | 2.35 |
| 貿易交易所 | 1693 | 14.1% | 2.38 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.51 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：89.4%；平均每回合到港前裝運 6.50 單位。
- 到港量對需求（每種材料每回合）：少於需求 45.7%、剛好 33.9%、多於需求 20.3%。
- 終局每名玩家平均剩下 2.54 單位材料（歸零）：木材 0.37、鐵礦 0.28、香料 0.15、違禁品 1.74。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.1% | 4.3% | 14.3% | 28.7% | 27.9% | 24.7% |
| 鐵礦 | 0.0% | 0.3% | 7.1% | 18.4% | 28.2% | 25.1% | 20.9% |
| 香料 | 4.5% | 17.3% | 3.9% | 31.1% | 6.5% | 22.8% | 13.9% |
| 違禁品 | 1.1% | 4.7% | 16.0% | 31.4% | 28.2% | 13.8% | 4.8% |

- 牙人：押注 15641 次，押中 69.4%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 2534 單位、376638 G。
- 交易所（效果 做市佣金）：佣金共 267630 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 5621 | 7.8% |
| 護衛 | 22043 | 30.6% |
| 海盜 | 12215 | 17.0% |
| 走私商人 | 13263 | 18.4% |
| 牙人 | 15641 | 21.7% |

- 護衛守「自己沒有貨的船」：55.6%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 2808 次、上別人船走私 10455 次；掩護佔走私 21.2%；有違禁品的出航中被掩護 29.0%。
- 海盜：目標沉沒率 62.8%；每次平均淨收益 26 G。
- 護航費總額 592050 G；保險補償 0 G、保住 23320 單位；打撈 6549 單位；走私取走 433525 G。共 68783 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
