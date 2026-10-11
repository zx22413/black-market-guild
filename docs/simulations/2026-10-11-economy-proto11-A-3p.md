# 黑市商會 經濟原型模擬報表（方案 A）

- 規則：economy-proto-8（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1、buildings.broker.enabled=0、roles.broker.enabled=1、roles.broker.payout=100、demand.extraPerPlayerAbove3=0、demand.max.wood=2、demand.max.iron=2、demand.max.spice=2、demand.extraMax.wood=1、demand.extraMax.iron=1、demand.extraMax.spice=1、roles.broker.fee=75、productionEvery.wood=2、productionEvery.iron=2
- 對局數：2000；人數：3；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；出航成本 100 G；護航費 75 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 1500 | 35.7% | 1722.03 |
| cautious | 1500 | 29.8% | 1666.95 |
| aggressive | 1500 | 43.5% | 1722.86 |
| builder | 1500 | 24.3% | 1636.21 |

- 每局最高與最低財富差距平均 711.05 G。

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 1588 | 26.5% | 1.81 |
| 航運保險 | 5326 | 88.8% | 1.17 |
| 打撈公司 | 530 | 8.8% | 2.19 |
| 貿易交易所 | 1114 | 18.6% | 2.52 |
| 牙行 | 0 | 0.0% | — |

- 每名玩家終局平均持有 1.43 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：89.4%；平均每回合到港前裝運 6.40 單位。
- 到港量對需求（每種材料每回合）：少於需求 40.8%、剛好 34.7%、多於需求 24.5%。
- 終局每名玩家平均剩下 1.55 單位材料（歸零）：木材 0.21、鐵礦 0.15、香料 0.00、違禁品 1.20。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.1% | 5.0% | 18.1% | 31.6% | 26.9% | 18.2% |
| 鐵礦 | 0.0% | 0.1% | 8.2% | 20.7% | 31.6% | 25.4% | 13.9% |
| 香料 | 8.5% | 24.5% | 5.4% | 32.0% | 4.7% | 17.7% | 7.2% |
| 違禁品 | 1.4% | 5.7% | 19.0% | 33.0% | 27.0% | 10.7% | 3.2% |

- 牙人：押注 4763 次，押中 73.7%。
- 牙行調整需求 0 次（每局平均 0.00）；違禁品被護衛沒收 3480 單位、536408 G。
- 交易所（效果 做市佣金）：佣金共 197010 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 497 | 1.4% |
| 護衛 | 21357 | 59.3% |
| 海盜 | 5667 | 15.7% |
| 走私商人 | 2974 | 8.3% |
| 牙人 | 4763 | 13.2% |

- 護衛守「自己沒有貨的船」：56.9%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 542 次、上別人船走私 2432 次；掩護佔走私 18.2%；有違禁品的出航中被掩護 11.5%。
- 海盜：目標沉沒率 53.8%；每次平均淨收益 12 G。
- 護航費總額 552450 G；保險補償 0 G、保住 9658 單位；打撈 1664 單位；走私取走 75400 G。共 35258 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
