# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-14（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2、roles.hand.mode=2、roles.hand.cooldown=2、islands.enabled=1、islands.draft=1
- 對局數：4000；人數：3；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 3000 | 36.4% | 1643.16 |
| cautious | 3000 | 25.9% | 1529.41 |
| aggressive | 3000 | 43.6% | 1684.35 |
| builder | 3000 | 27.5% | 1563.15 |

- 每局最高與最低財富差距平均 779.73 G。

島嶼特色（公平勝率 33.3%）：

| 島 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| 要塞島 | 1561 | 37.1% | 1670.11 |
| 燈塔島 | 1280 | 36.6% | 1633.98 |
| 香料群島 | 1426 | 33.1% | 1563.30 |
| 海盜灣 | 1600 | 32.7% | 1571.39 |
| 自由港 | 1459 | 32.6% | 1644.49 |
| 走私港 | 1439 | 32.2% | 1573.50 |
| 林場島 | 1599 | 31.8% | 1597.84 |
| 礦山島 | 1636 | 31.1% | 1589.03 |

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 4441 | 37.0% | 1.91 |
| 航運保險 | 10282 | 85.7% | 1.20 |
| 打撈公司 | 1779 | 14.8% | 2.35 |
| 貿易交易所 | 1687 | 14.1% | 2.38 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.52 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：89.0%；平均每回合到港前裝運 6.54 單位。
- 到港量對需求（每種材料每回合）：少於需求 45.0%、剛好 33.9%、多於需求 21.1%。
- 終局每名玩家平均剩下 3.00 單位材料（歸零）：木材 0.35、鐵礦 0.27、香料 0.62、違禁品 1.76。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.1% | 4.2% | 14.6% | 28.8% | 27.6% | 24.6% |
| 鐵礦 | 0.0% | 0.3% | 7.4% | 19.3% | 28.8% | 24.7% | 19.5% |
| 香料 | 6.6% | 19.8% | 4.7% | 31.2% | 5.7% | 20.4% | 11.7% |
| 違禁品 | 1.1% | 4.7% | 15.7% | 31.5% | 28.3% | 13.7% | 5.0% |

- 牙人：押注 15236 次，押中 69.1%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 2678 單位、400131 G。
- 交易所（效果 做市佣金）：佣金共 271335 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 5356 | 7.4% |
| 護衛 | 23492 | 32.6% |
| 海盜 | 12010 | 16.7% |
| 走私商人 | 12750 | 17.7% |
| 牙人 | 15236 | 21.2% |

- 護衛守「自己沒有貨的船」：55.4%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 2821 次、上別人船走私 9929 次；掩護佔走私 22.1%；有違禁品的出航中被掩護 28.4%。
- 海盜：目標沉沒率 61.8%；每次平均淨收益 24 G。
- 護航費總額 641175 G；保險補償 0 G、保住 22601 單位；打撈 6319 單位；走私取走 392450 G。共 68844 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
