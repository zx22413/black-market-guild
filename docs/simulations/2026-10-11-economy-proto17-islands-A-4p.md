# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-14（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2、roles.hand.mode=2、roles.hand.cooldown=2、islands.enabled=1、islands.draft=1
- 對局數：4000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 4000 | 27.8% | 1673.15 |
| cautious | 4000 | 15.5% | 1534.30 |
| aggressive | 4000 | 33.0% | 1727.68 |
| builder | 4000 | 23.8% | 1646.90 |

- 每局最高與最低財富差距平均 1012.93 G。

島嶼特色（公平勝率 25.0%）：

| 島 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| 燈塔島 | 1736 | 27.7% | 1690.64 |
| 香料群島 | 1905 | 26.5% | 1638.28 |
| 走私港 | 1937 | 25.6% | 1654.07 |
| 礦山島 | 2149 | 25.1% | 1648.86 |
| 林場島 | 2101 | 24.4% | 1615.40 |
| 要塞島 | 2108 | 24.2% | 1658.12 |
| 海盜灣 | 2138 | 23.6% | 1592.24 |
| 自由港 | 1926 | 23.5% | 1677.79 |

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 5531 | 34.6% | 2.06 |
| 航運保險 | 8719 | 54.5% | 1.84 |
| 打撈公司 | 8154 | 51.0% | 1.25 |
| 貿易交易所 | 6125 | 38.3% | 1.52 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.78 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：81.6%；平均每回合到港前裝運 8.05 單位。
- 到港量對需求（每種材料每回合）：少於需求 49.4%、剛好 28.6%、多於需求 22.0%。
- 終局每名玩家平均剩下 4.13 單位材料（歸零）：木材 0.84、鐵礦 0.50、香料 0.68、違禁品 2.11。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.5% | 6.3% | 15.1% | 27.8% | 26.9% | 23.3% |
| 鐵礦 | 0.0% | 0.0% | 2.0% | 7.6% | 24.4% | 29.7% | 36.2% |
| 香料 | 4.1% | 13.1% | 4.4% | 25.2% | 8.9% | 23.7% | 20.6% |
| 違禁品 | 2.3% | 6.5% | 17.8% | 31.8% | 26.5% | 11.2% | 4.0% |

- 牙人：押注 19679 次，押中 64.7%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 3500 單位、498942 G。
- 交易所（效果 做市佣金）：佣金共 1390635 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 7349 | 7.7% |
| 護衛 | 29876 | 31.1% |
| 海盜 | 17351 | 18.1% |
| 走私商人 | 17782 | 18.5% |
| 牙人 | 19679 | 20.5% |

- 護衛守「自己沒有貨的船」：71.0%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 2406 次、上別人船走私 15376 次；掩護佔走私 13.5%；有違禁品的出航中被掩護 28.5%。
- 海盜：目標沉沒率 63.0%；每次平均淨收益 17 G。
- 護航費總額 1010250 G；保險補償 0 G、保住 17570 單位；打撈 43529 單位；走私取走 592100 G。共 92037 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
