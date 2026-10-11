# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-8（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1
- 對局數：2000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 2000 | 26.7% | 1953.48 |
| cautious | 2000 | 13.5% | 1770.08 |
| aggressive | 2000 | 37.0% | 2029.88 |
| builder | 2000 | 22.9% | 1907.83 |

- 每局最高與最低財富差距平均 1085.95 G。

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 1921 | 24.0% | 1.95 |
| 航運保險 | 5455 | 68.2% | 1.62 |
| 打撈公司 | 4677 | 58.5% | 1.30 |
| 貿易交易所 | 3777 | 47.2% | 1.53 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.98 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：89.5%；平均每回合到港前裝運 9.63 單位。
- 到港量對需求（每種材料每回合）：少於需求 40.3%、剛好 30.4%、多於需求 29.3%。
- 終局每名玩家平均剩下 6.61 單位材料（歸零）。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 1.4% | 4.5% | 15.9% | 25.8% | 30.0% | 16.1% | 6.3% |
| 鐵礦 | 0.4% | 1.8% | 7.5% | 17.9% | 33.5% | 25.9% | 12.9% |
| 香料 | 4.7% | 13.7% | 5.6% | 25.1% | 9.5% | 23.8% | 17.6% |
| 違禁品 | 1.7% | 5.5% | 17.6% | 30.7% | 27.1% | 12.2% | 5.2% |

- 牙人：押注 10765 次，押中 64.2%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 1857 單位、284301 G。
- 交易所（效果 做市佣金）：佣金共 981555 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 603 | 1.3% |
| 護衛 | 25568 | 53.3% |
| 海盜 | 7222 | 15.0% |
| 走私商人 | 3335 | 6.9% |
| 牙人 | 10765 | 22.4% |

- 護衛守「自己沒有貨的船」：61.8%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 322 次、上別人船走私 3013 次；掩護佔走私 9.7%；有違禁品的出航中被掩護 10.7%。
- 海盜：目標沉沒率 55.4%；每次平均淨收益 10 G。
- 護航費總額 845700 G；保險補償 0 G、保住 10015 單位；打撈 23500 單位；走私取走 99300 G。共 47493 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
