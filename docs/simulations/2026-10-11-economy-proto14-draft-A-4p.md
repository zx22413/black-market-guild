# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-11（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2、roles.hand.mode=2、roles.hand.cooldown=2、islands.enabled=1、islands.draft=1
- 對局數：4000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 4000 | 27.6% | 1690.32 |
| cautious | 4000 | 15.2% | 1532.06 |
| aggressive | 4000 | 32.9% | 1745.19 |
| builder | 4000 | 24.3% | 1641.92 |

- 每局最高與最低財富差距平均 1024.37 G。

島嶼特色（公平勝率 25.0%）：

| 島 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| 林場島 | 2441 | 28.4% | 1670.48 |
| 礦山島 | 2432 | 27.7% | 1679.22 |
| 海盜灣 | 2351 | 27.5% | 1657.90 |
| 走私港 | 2131 | 25.6% | 1669.26 |
| 香料群島 | 2199 | 23.4% | 1616.07 |
| 自由港 | 2116 | 22.5% | 1677.13 |
| 要塞島 | 2330 | 19.4% | 1596.14 |

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 5516 | 34.5% | 2.04 |
| 航運保險 | 9131 | 57.1% | 1.83 |
| 打撈公司 | 8142 | 50.9% | 1.27 |
| 貿易交易所 | 6053 | 37.8% | 1.51 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.80 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：82.9%；平均每回合到港前裝運 8.10 單位。
- 到港量對需求（每種材料每回合）：少於需求 50.3%、剛好 28.6%、多於需求 21.1%。
- 終局每名玩家平均剩下 4.13 單位材料（歸零）：木材 1.04、鐵礦 0.64、香料 0.27、違禁品 2.17。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.5% | 6.2% | 14.4% | 27.8% | 26.9% | 24.3% |
| 鐵礦 | 0.0% | 0.1% | 2.0% | 7.5% | 24.1% | 29.6% | 36.8% |
| 香料 | 2.5% | 11.1% | 3.7% | 23.2% | 10.2% | 24.4% | 25.0% |
| 違禁品 | 2.4% | 6.8% | 17.9% | 31.0% | 26.6% | 11.3% | 3.9% |

- 牙人：押注 20649 次，押中 65.2%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 3436 單位、485724 G。
- 交易所（效果 做市佣金）：佣金共 1347780 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 5389 | 5.6% |
| 護衛 | 28971 | 30.2% |
| 海盜 | 17731 | 18.5% |
| 走私商人 | 19169 | 20.0% |
| 牙人 | 20649 | 21.5% |

- 護衛守「自己沒有貨的船」：71.4%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 2444 次、上別人船走私 16725 次；掩護佔走私 12.7%；有違禁品的出航中被掩護 29.8%。
- 海盜：目標沉沒率 65.1%；每次平均淨收益 22 G。
- 護航費總額 948600 G；保險補償 0 G、保住 19417 單位；打撈 46104 單位；走私取走 630025 G。共 91909 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
