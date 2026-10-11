# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-10（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2、roles.hand.mode=2、roles.hand.cooldown=2、islands.enabled=1
- 對局數：4000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 4000 | 26.9% | 1614.27 |
| cautious | 4000 | 15.1% | 1459.73 |
| aggressive | 4000 | 31.9% | 1665.23 |
| builder | 4000 | 26.1% | 1610.28 |

- 每局最高與最低財富差距平均 1046.62 G。

島嶼特色（公平勝率 25.0%）：

| 島 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| 走私港 | 2265 | 36.4% | 1747.17 |
| 礦山島 | 2320 | 28.5% | 1647.51 |
| 自由港 | 2329 | 27.7% | 1684.86 |
| 林場島 | 2194 | 26.6% | 1597.39 |
| 要塞島 | 2310 | 25.2% | 1609.37 |
| 香料群島 | 2270 | 20.1% | 1519.99 |
| 海盜灣 | 2312 | 10.8% | 1306.97 |

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 5525 | 34.5% | 2.01 |
| 航運保險 | 9068 | 56.7% | 1.79 |
| 打撈公司 | 8209 | 51.3% | 1.28 |
| 貿易交易所 | 5961 | 37.3% | 1.53 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.80 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：80.6%；平均每回合到港前裝運 7.67 單位。
- 到港量對需求（每種材料每回合）：少於需求 52.9%、剛好 28.3%、多於需求 18.8%。
- 終局每名玩家平均剩下 4.10 單位材料（歸零）：木材 0.92、鐵礦 0.73、香料 0.27、違禁品 2.19。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.1% | 0.3% | 5.0% | 12.1% | 25.0% | 26.3% | 31.1% |
| 鐵礦 | 0.0% | 0.0% | 2.0% | 6.9% | 22.7% | 28.7% | 39.6% |
| 香料 | 2.2% | 9.1% | 3.2% | 20.6% | 10.2% | 24.6% | 30.2% |
| 違禁品 | 2.1% | 5.9% | 18.3% | 30.4% | 27.4% | 11.7% | 4.2% |

- 牙人：押注 20187 次，押中 64.4%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 3491 單位、495367 G。
- 交易所（效果 做市佣金）：佣金共 1248390 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 5064 | 5.3% |
| 護衛 | 30059 | 31.3% |
| 海盜 | 17756 | 18.5% |
| 走私商人 | 18901 | 19.7% |
| 牙人 | 20187 | 21.0% |

- 護衛守「自己沒有貨的船」：71.9%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 2565 次、上別人船走私 16336 次；掩護佔走私 13.6%；有違禁品的出航中被掩護 30.5%。
- 海盜：目標沉沒率 66.6%；每次平均淨收益 25 G。
- 護航費總額 983325 G；保險補償 0 G、保住 20664 單位；打撈 47312 單位；走私取走 582175 G。共 91967 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
