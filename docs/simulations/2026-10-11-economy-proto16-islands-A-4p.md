# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-13（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2、roles.hand.mode=2、roles.hand.cooldown=2、islands.enabled=1、islands.draft=1
- 對局數：4000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 4000 | 27.8% | 1659.72 |
| cautious | 4000 | 15.8% | 1524.63 |
| aggressive | 4000 | 32.2% | 1720.76 |
| builder | 4000 | 24.2% | 1648.71 |

- 每局最高與最低財富差距平均 1019.30 G。

島嶼特色（公平勝率 25.0%）：

| 島 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| 燈塔島 | 1736 | 29.7% | 1710.66 |
| 礦山島 | 2149 | 26.0% | 1650.23 |
| 海盜灣 | 2138 | 25.3% | 1597.58 |
| 走私港 | 1937 | 25.0% | 1647.28 |
| 林場島 | 2101 | 24.8% | 1640.97 |
| 自由港 | 1926 | 24.4% | 1679.22 |
| 香料群島 | 1905 | 23.2% | 1597.63 |
| 要塞島 | 2108 | 22.3% | 1597.47 |

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 5490 | 34.3% | 2.06 |
| 航運保險 | 8758 | 54.7% | 1.85 |
| 打撈公司 | 8170 | 51.1% | 1.24 |
| 貿易交易所 | 6071 | 37.9% | 1.52 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.78 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：81.8%；平均每回合到港前裝運 8.00 單位。
- 到港量對需求（每種材料每回合）：少於需求 50.0%、剛好 28.7%、多於需求 21.4%。
- 終局每名玩家平均剩下 3.72 單位材料（歸零）：木材 0.88、鐵礦 0.52、香料 0.22、違禁品 2.10。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.5% | 6.5% | 15.3% | 28.1% | 26.6% | 23.0% |
| 鐵礦 | 0.0% | 0.0% | 2.0% | 7.5% | 24.2% | 29.7% | 36.6% |
| 香料 | 2.6% | 11.1% | 3.9% | 23.9% | 9.9% | 24.6% | 24.0% |
| 違禁品 | 2.4% | 6.3% | 18.0% | 31.5% | 26.5% | 11.4% | 4.0% |

- 牙人：押注 20020 次，押中 65.6%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 3360 單位、477365 G。
- 交易所（效果 做市佣金）：佣金共 1358295 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 7662 | 8.0% |
| 護衛 | 28106 | 29.3% |
| 海盜 | 17752 | 18.5% |
| 走私商人 | 18409 | 19.2% |
| 牙人 | 20020 | 20.9% |

- 護衛守「自己沒有貨的船」：72.4%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 2507 次、上別人船走私 15902 次；掩護佔走私 13.6%；有違禁品的出航中被掩護 29.2%。
- 海盜：目標沉沒率 63.6%；每次平均淨收益 18 G。
- 護航費總額 949350 G；保險補償 0 G、保住 18085 單位；打撈 44544 單位；走私取走 622050 G。共 91949 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
