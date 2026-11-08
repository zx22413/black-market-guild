// The dev log shown from the main menu: one entry per version, newest first. Player-facing words
// only; the rules themselves live in docs/game-design.md and the changelog in docs/changelog.md.
// Add a new version at the top and the 「新」 dot on the menu button comes back by itself.

export interface DevLogSection {
  readonly title: string;
  readonly items: readonly string[];
}

export interface DevLogEntry {
  /** Shown as the heading, such as 'V0.7.1'. Also what the 「seen」 mark remembers. */
  readonly version: string;
  readonly date: string;
  readonly title: string;
  /** One or two sentences on why the version exists. */
  readonly summary: string;
  readonly sections: readonly DevLogSection[];
}

export const DEV_LOG: readonly DevLogEntry[] = [
  {
    version: 'V0.7.1',
    date: '2026-11-08',
    title: '船艙改版：每回合先選船，風險自己挑',
    summary: '試玩回饋說建築「蓋了就一直有用」、骰子結果又全看運氣。這一版把建築拿掉，換成五艘各有脾氣的船，並讓航海事件提早亮相。',
    sections: [
      {
        title: '五艘船取代建築',
        items: [
          '本版沒有建築了。每回合投資時先選一艘船、再裝貨；船費付出去，沉了不退。',
          '信天翁號：基準款。孤注號：船費 150 G，只有骰到 5、6 才賺，而且 5 賺 125%、6 賺 250%，用過要休息一回合。',
          '巨鯨號：不會沉、多載 2 單位，但要隔一回合才靠岸。幽靈號：海關指名它的貨無效。海嘯號：骰值不封頂，越疊越賺，最高 300%。',
          '每艘船都有自己的模型與帆，出航後全桌看得到船型，貨艙裡裝了什麼要到結算才揭曉。',
          '貨改用一手「貨物牌」來裝，不再從 3D 倉庫挑。',
        ],
      },
      {
        title: '骰值與角色重做',
        items: [
          '航海事件改成回合一開始就公開，投資和派角色前你就知道今天是順風還是暴風雨。重擲階段拿掉，每回合只剩兩個決定：投資、部署角色。',
          '情報商人與莊家退場，換上海關（指名對手船上的一種貨，優先沒收）與外交官（猜誰會針對你的船，猜中就讓對方白派）。',
          '護衛改成只守自己的船；走私商人可以派在自己的船上掩護貨物；海盜沉船時一律拿貨值的 70%。',
          '只有最終值 1 會沉船；抵達的船依最終值 2～6 拿貨值的 30%、45%、60%、75%、100%。',
        ],
      },
      {
        title: '八座島重新調整',
        items: [
          '燈塔島的船 +1 太強，改成沉船少但最高只到 5。林場島改成船塢島，載貨量 +1。',
          '自由港的孤注號、走私港的幽靈號船費歸零。香料群島的香料可以賣到比價格軌最高格再貴一格。',
          '八座島的島基與地標全部用 Blender 重做，巴扎港黑市改成一座有大階梯的小鎮。',
        ],
      },
      {
        title: '其他',
        items: [
          '遊戲固定 4 人，空位由電腦補上；2 人、3 人局不做了。',
          '新手教學已依船艙規則重寫。線上房間新增觀戰席。',
          '手機版桌面閒置時降到 20 幀，比較不燙。',
          '大廳新增這本開發日誌。',
        ],
      },
    ],
  },
  {
    version: 'V0.7',
    date: '2026-10-23',
    title: '各島生產、黑市交易',
    summary: '舊版的合資邀請太難懂、節奏又慢，船沉不沉也只看一顆骰子。V0.7 把互動拉回「別人運什麼，我賺多少」。',
    sections: [
      {
        title: '新的經濟循環',
        items: [
          '移除合資，每人只有自己的船。每回合的決定從最多 7 個降到 3 個。',
          '每座島生產木材、鐵礦、香料、軍火。可以蓋建築，也可以裝船運去黑市。',
          '黑市價格依「需求卡」與到港量漲跌：大家運同一種貨，價格就崩。',
          '8 座各有優缺點的島，開局抽 2 選 1。',
        ],
      },
      {
        title: '角色與建築',
        items: [
          '五個角色：護衛、海盜、走私商人、情報商人、莊家；用過的角色冷卻 2 回合。',
          '四種建築：造船廠、航運保險、打撈公司、貿易交易所，每人最多 2 棟。',
          '現金最多的人會被通緝，擊沉他的海盜另有賞金。',
        ],
      },
      {
        title: '3D 桌面與線上',
        items: [
          '整桌改成低面數 3D 海上桌面，決策介面是木框、羊皮紙、黃銅的卡牌質感。',
          '主選單、單人對電腦、同機輪流、線上房間（房號與再來一局）。',
          '線上每個決定限時 1、2 或 5 分鐘；斷線或連續逾時由電腦託管，隨時可以接回。',
        ],
      },
    ],
  },
];

/** The newest version, which the menu button's 「新」 dot compares against what this browser has seen. */
export const LATEST_VERSION: string = DEV_LOG[0]?.version ?? '';
