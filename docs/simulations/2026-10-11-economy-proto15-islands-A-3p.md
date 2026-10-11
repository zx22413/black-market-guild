# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-12（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2、roles.hand.mode=2、roles.hand.cooldown=2、islands.enabled=1、islands.draft=1
- 對局數：4000；人數：3；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 3000 | 36.5% | 1618.08 |
| cautious | 3000 | 25.5% | 1505.23 |
| aggressive | 3000 | 42.1% | 1674.23 |
| builder | 3000 | 29.3% | 1560.61 |

- 每局最高與最低財富差距平均 819.38 G。

島嶼特色（公平勝率 33.3%）：

| 島 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| 礦山島 | 1636 | 39.7% | 1645.15 |
| 林場島 | 1599 | 39.7% | 1666.08 |
| 走私港 | 1439 | 35.4% | 1588.48 |
| 海盜灣 | 1600 | 34.5% | 1597.52 |
| 自由港 | 1459 | 33.6% | 1657.22 |
| 要塞島 | 1561 | 32.4% | 1601.70 |
| 香料群島 | 1426 | 31.3% | 1562.17 |
| 燈塔島 | 1280 | 16.6% | 1352.55 |

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 4482 | 37.4% | 1.98 |
| 航運保險 | 10298 | 85.8% | 1.18 |
| 打撈公司 | 1975 | 16.5% | 2.36 |
| 貿易交易所 | 1813 | 15.1% | 2.38 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.55 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：88.7%；平均每回合到港前裝運 6.48 單位。
- 到港量對需求（每種材料每回合）：少於需求 46.6%、剛好 33.8%、多於需求 19.7%。
- 終局每名玩家平均剩下 2.82 單位材料（歸零）：木材 0.46、鐵礦 0.37、香料 0.15、違禁品 1.84。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.1% | 3.9% | 13.4% | 28.3% | 28.4% | 25.8% |
| 鐵礦 | 0.0% | 0.3% | 6.3% | 17.3% | 28.2% | 25.7% | 22.2% |
| 香料 | 3.7% | 15.5% | 3.6% | 29.7% | 7.1% | 23.7% | 16.6% |
| 違禁品 | 1.1% | 4.4% | 15.9% | 31.3% | 28.3% | 13.9% | 5.2% |

- 牙人：押注 15656 次，押中 68.5%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 2405 單位、356131 G。
- 交易所（效果 做市佣金）：佣金共 280050 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 5710 | 7.9% |
| 護衛 | 22083 | 30.7% |
| 海盜 | 12276 | 17.1% |
| 走私商人 | 13023 | 18.1% |
| 牙人 | 15656 | 21.7% |

- 護衛守「自己沒有貨的船」：54.6%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 2590 次、上別人船走私 10433 次；掩護佔走私 19.9%；有違禁品的出航中被掩護 28.6%。
- 海盜：目標沉沒率 64.2%；每次平均淨收益 29 G。
- 護航費總額 578325 G；保險補償 0 G、保住 24041 單位；打撈 7486 單位；走私取走 417125 G。共 68748 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
