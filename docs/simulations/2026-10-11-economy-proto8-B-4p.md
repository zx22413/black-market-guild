# 黑市商會 經濟原型模擬報表（方案 B）

- 規則：economy-proto-7（原型，非正式規則），覆寫：production.spice=1、production.contraband=1、productionEvery.contraband=2、price.volatility.spice=2、demand.min.spice=1、demand.max.spice=3、demand.min.contraband=0、demand.max.contraband=1、capacity.base=3、buildings.broker.enabled=1、maxBuildingsPerPlayer=2、buildings.exchange.variant=1、buildings.exchange.commissionPerUnit=20、roles.smuggler.coversSeizable=1、roles.guard.escortWhenSeizing=0、roles.smuggler.caughtFine=100、buildings.exchange.commissionPerUnit=15、roles.smuggler.anonymous=0、roles.smuggler.goodsValue=100、buildings.insurance.keepPerRound=1
- 對局數：2000；人數：4；起始 seed：1；陣容（每局輪換座位）：balanced、cautious、aggressive、builder
- 可裝貨量 3（造船廠 +1）；運費每單位 30 G

## 1. 勝率與財富

| 策略 | 座位數 | 勝率 | 平均財富 |
| --- | --- | --- | --- |
| balanced | 2000 | 27.1% | 1931.23 |
| cautious | 2000 | 11.2% | 1747.74 |
| aggressive | 2000 | 38.5% | 2007.32 |
| builder | 2000 | 23.2% | 1914.23 |

- 每局最高與最低財富差距平均 690.00 G。

## 2. 建築

| 建築 | 建造次數 | 建造率（每座位） | 平均建造回合 |
| --- | --- | --- | --- |
| 造船廠 | 251 | 3.1% | 3.98 |
| 航運保險 | 7442 | 93.0% | 1.43 |
| 打撈公司 | 3276 | 41.0% | 1.80 |
| 貿易交易所 | 4973 | 62.2% | 1.47 |
| 牙行 | 6 | 0.1% | 6.00 |

- 每名玩家終局平均持有 1.99 棟（目標 2～3）。

## 3. 出航與市場

- 有裝貨出航的玩家回合：99.1%；平均每回合到港前裝運 8.64 單位。
- 到港量對需求（每種材料每回合）：少於需求 73.1%、剛好 12.2%、多於需求 14.7%。
- 終局每名玩家平均剩下 7.81 單位材料（歸零）。

回合結束時的價格分布：

| 材料 | 75 G | 100 G | 125 G | 150 G | 175 G | 200 G | 225 G |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 木材 | 0.0% | 0.0% | 1.5% | 5.9% | 25.5% | 32.1% | 35.0% |
| 鐵礦 | 0.0% | 0.0% | 0.6% | 2.7% | 22.5% | 33.3% | 41.0% |
| 香料 | 1.7% | 9.4% | 2.9% | 18.9% | 8.5% | 24.1% | 34.5% |
| 違禁品 | 0.0% | 0.0% | 0.5% | 3.9% | 20.5% | 19.4% | 55.8% |

- 牙行調整需求 6 次（每局平均 0.00）；違禁品被護衛沒收 2651 單位、511791 G。
- 交易所（效果 做市佣金）：佣金共 1173870 G；直售 0 單位、0 G。

## 4. 角色

| 角色 | 部署次數 | 佔所有玩家回合 |
| --- | --- | --- |
| 情報商人 | 2029 | 4.2% |
| 護衛 | 18969 | 39.5% |
| 海盜 | 17174 | 35.8% |
| 走私商人 | 7336 | 15.3% |

- 護衛守「自己沒有貨的船」：34.2%（V0.6 約 23%）。
- 走私商人：掩護自己違禁品 681 次、上別人船走私 6655 次；掩護佔走私 9.3%；有違禁品的出航中被掩護 27.9%。
- 海盜：目標沉沒率 61.1%；每次平均淨收益 11 G。
- 護航費總額 0 G；保險補償 0 G、保住 26481 單位；打撈 8515 單位；走私取走 235423 G。共 45508 次部署。

> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。
