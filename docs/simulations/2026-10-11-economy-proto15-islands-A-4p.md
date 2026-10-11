# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-12（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2、roles.hand.mode=2、roles.hand.cooldown=2、islands.enabled=1、islands.draft=1
- 對局數：4000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 4000 | 27.6% | 1641.04 |
| cautious | 4000 | 15.1% | 1498.50 |
| aggressive | 4000 | 31.7% | 1706.60 |
| builder | 4000 | 25.6% | 1636.91 |

- 每局最高與最低財富差距平均 1048.53 G。

島嶼特色（公平勝率 25.0%）：

| 島 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| 林場島 | 2101 | 28.8% | 1683.83 |
| 礦山島 | 2149 | 28.1% | 1675.12 |
| 海盜灣 | 2138 | 26.8% | 1616.22 |
| 自由港 | 1926 | 26.0% | 1686.99 |
| 走私港 | 1937 | 26.0% | 1658.88 |
| 香料群島 | 1905 | 24.1% | 1602.94 |
| 要塞島 | 2108 | 23.9% | 1607.40 |
| 燈塔島 | 1736 | 14.3% | 1402.50 |

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 5683 | 35.5% | 2.05 |
| 航運保險 | 8957 | 56.0% | 1.84 |
| 打撈公司 | 8275 | 51.7% | 1.25 |
| 貿易交易所 | 6026 | 37.7% | 1.52 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.81 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：80.6%；平均每回合到港前裝運 7.91 單位。
- 到港量對需求（每種材料每回合）：少於需求 51.1%、剛好 28.6%、多於需求 20.3%。
- 終局每名玩家平均剩下 4.06 單位材料（歸零）：木材 1.04、鐵礦 0.65、香料 0.23、違禁品 2.15。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.4% | 5.6% | 14.0% | 27.5% | 27.3% | 25.2% |
| 鐵礦 | 0.0% | 0.0% | 1.8% | 6.9% | 23.7% | 29.6% | 38.1% |
| 香料 | 2.1% | 9.4% | 3.3% | 21.9% | 10.3% | 25.1% | 27.9% |
| 違禁品 | 2.1% | 6.0% | 17.8% | 31.7% | 26.6% | 11.4% | 4.3% |

- 牙人：押注 19893 次，押中 64.9%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 3221 單位、460369 G。
- 交易所（效果 做市佣金）：佣金共 1310640 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 7637 | 8.0% |
| 護衛 | 28229 | 29.4% |
| 海盜 | 17783 | 18.5% |
| 走私商人 | 18380 | 19.1% |
| 牙人 | 19893 | 20.7% |

- 護衛守「自己沒有貨的船」：71.5%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 2376 次、上別人船走私 16004 次；掩護佔走私 12.9%；有違禁品的出航中被掩護 29.4%。
- 海盜：目標沉沒率 65.3%；每次平均淨收益 21 G。
- 護航費總額 929475 G；保險補償 0 G、保住 19009 單位；打撈 45743 單位；走私取走 596100 G。共 91922 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
