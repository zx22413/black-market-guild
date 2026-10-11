# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-10（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2、roles.hand.mode=2、roles.hand.cooldown=2、islands.enabled=1
- 對局數：4000；人數：3；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 3000 | 36.9% | 1603.83 |
| cautious | 3000 | 26.0% | 1467.81 |
| aggressive | 3000 | 40.5% | 1630.12 |
| builder | 3000 | 29.9% | 1528.39 |

- 每局最高與最低財富差距平均 807.95 G。

島嶼特色（公平勝率 33.3%）：

| 島 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| 走私港 | 1653 | 42.1% | 1672.88 |
| 自由港 | 1758 | 39.1% | 1674.56 |
| 林場島 | 1689 | 38.1% | 1611.00 |
| 礦山島 | 1756 | 36.6% | 1599.11 |
| 要塞島 | 1645 | 35.0% | 1598.53 |
| 香料群島 | 1746 | 27.6% | 1463.57 |
| 海盜灣 | 1753 | 15.5% | 1293.37 |

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 4150 | 34.6% | 1.92 |
| 航運保險 | 10293 | 85.8% | 1.14 |
| 打撈公司 | 1979 | 16.5% | 2.47 |
| 貿易交易所 | 2074 | 17.3% | 2.34 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.54 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：89.3%；平均每回合到港前裝運 6.30 單位。
- 到港量對需求（每種材料每回合）：少於需求 48.7%、剛好 32.8%、多於需求 18.5%。
- 終局每名玩家平均剩下 2.83 單位材料（歸零）：木材 0.42、鐵礦 0.40、香料 0.18、違禁品 1.82。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.1% | 3.6% | 12.5% | 25.5% | 26.1% | 32.2% |
| 鐵礦 | 0.0% | 0.2% | 6.4% | 16.7% | 27.1% | 25.0% | 24.6% |
| 香料 | 3.8% | 16.0% | 3.5% | 28.6% | 7.0% | 23.1% | 17.9% |
| 違禁品 | 1.2% | 4.6% | 16.6% | 31.4% | 27.9% | 13.4% | 4.9% |

- 牙人：押注 15851 次，押中 68.1%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 2682 單位、390695 G。
- 交易所（效果 做市佣金）：佣金共 303945 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 3916 | 5.4% |
| 護衛 | 23100 | 32.1% |
| 海盜 | 12371 | 17.2% |
| 走私商人 | 13549 | 18.8% |
| 牙人 | 15851 | 22.0% |

- 護衛守「自己沒有貨的船」：55.8%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 2846 次、上別人船走私 10703 次；掩護佔走私 21.0%；有違禁品的出航中被掩護 29.4%。
- 海盜：目標沉沒率 66.1%；每次平均淨收益 35 G。
- 護航費總額 600600 G；保險補償 0 G、保住 25300 單位；打撈 7597 單位；走私取走 412150 G。共 68787 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
