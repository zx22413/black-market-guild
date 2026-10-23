import { useState, type ReactNode } from 'react';
import { Flow, HouseIcon, IconDisc, InfoIcon, tokenIconUrl } from '../table3d/icons';
import { LockHint } from '../table3d/LockHint';
import { RulesPanel } from '../table3d/RulesPanel';
import { SealSubmit } from '../table3d/SealSubmit';
import { PanelsApplied } from './SkinLabPanels';
import { TitleApplied } from './SkinLabTitle';
import '../beats/beat.css';
import '../menu/menu.css';
import '../skin/layers.css';
import '../skin/menu.css';
import './skinLab.css';

/**
 * Dev-only: the skin lab (`/v07.html?dev=skin-lab`). Pieces of the UI as they look now (the real
 * classes and layers.css), next to a trial where one is still being tried. The applied panels and the
 * rule book sit in the cell instead of covering the screen (skinLab.css). Then two pictures
 * that do a job: the rules as a handbook whose thumb-index tabs are the chapter tabs, and submitting
 * as pressing a wax seal, which stays on the bar once the decision is sealed. A row that has been
 * applied to the game shows only the game's own look ("已套用").
 */
export function SkinLabPreview() {
  return (
    <div className="lab">
      <header className="lab-head">
        <h1>介面質感試驗</h1>
        <p>左邊是現在的樣子，右邊是新做法。底欄與按鈕可以實際點按。</p>
      </header>
      <LabRow
        title="遊戲名稱：暗潮商戰／Contrabay（已套用）"
        note="型板字噴漆直接噴在羊皮紙上，旁邊蓋朱印（docs/title-wordmark.html 的 H3-A）；下面是英文為主的版本，遊戲還沒有英文介面"
        now={<TitleApplied />}
      />
      <LabRow title="底欄與封蠟章（第 1 層，已套用）" note="斜面木條＋凹槽、黃銅端蓋、吊牌晶片（黑市列的孔圈是貨品色）；提交是封蠟章，封上後留在底欄寫「已封」、選擇變淡，等其他人決定" now={<BarNow />} />
      <LabRow
        wide
        title="面板（第 2 層＋美術層，已套用）"
        note="一張 9-slice 外框：斜面木框、凹槽、紙面下沉的邊與黃銅護角；標題掛在上框下的標題牌；帳單、結果、市場卡的紙上印著淡淡的羅盤"
        now={
          <div className="lab-panels">
            <PanelNow />
            <PanelsApplied />
          </div>
        }
      />
      <LabRow title="主按鈕（已套用）" note="切角按鍵：主要是黃銅、次要是壓印羊皮紙，按下時鍵面落到底邊上" now={<ButtonsNow />} />
      <LabRow
        wide
        title="規則面板 → 航海手冊（已套用）"
        note="書籤就是章節頁籤，翻到的那章書籤最突出、和書頁同色；寬螢幕雙頁，手機單頁、書籤移到上緣"
        now={
          <div className="lab-overlay">
            <RulesPanel onClose={() => undefined} />
          </div>
        }
      />
    </div>
  );
}

interface LabRowProps {
  readonly title: string;
  readonly note: string;
  readonly now: ReactNode;
  /** The trial version; left out once the row has been applied to the game. */
  readonly next?: ReactNode;
  /** Stack the two versions instead of setting them side by side (for wide pieces like the book). */
  readonly wide?: boolean;
}

function LabRow({ title, note, now, next, wide = false }: LabRowProps) {
  return (
    <section className="lab-row">
      <h2>
        {title}
        <small>{note}</small>
      </h2>
      <div className={`lab-pair ${wide ? 'wide' : ''}`}>
        <figure className="lab-cell">
          <figcaption>{next === undefined ? '已套用到遊戲' : '現在'}</figcaption>
          <div className="lab-stage">{now}</div>
        </figure>
        {next !== undefined && (
          <figure className="lab-cell">
            <figcaption>新做法</figcaption>
            <div className="lab-stage">{next}</div>
          </figure>
        )}
      </div>
    </section>
  );
}

const LOCK_TEXT = '提交後不能更改；所有人都提交後，建築與出航同時公開，船上的貨不公開。';
const REMINDER_LINES = ['還沒選建築：會不蓋', '船是空的：不出航，也不付出航成本'];

// ---------- bottom bar ----------

function BarNow() {
  return (
    <div className="lab-stack">
      <div className="inv-bar lab-static">
        <span className="bar-chips">
          <span className="chip" title="建築">
            <HouseIcon /> 不蓋
          </span>
          <span className="chip" title="出航">
            <IconDisc src={tokenIconUrl('ship')} /> 不出航
          </span>
          <span className="chip cash" title="現金（G）">
            <IconDisc src={tokenIconUrl('coin')} />
            <Flow from={1000} to={<b>1000</b>} />
          </span>
        </span>
        <SealSubmit />
        <LockHint icon={<InfoIcon />} text={LOCK_TEXT} />
      </div>
      <div className="inv-bar lab-static lab-seal-states">
        <span className="sealed-choice">
          <span className="bar-chips">
            <span className="chip" title="建築">
              <HouseIcon /> 不蓋
            </span>
          </span>
        </span>
        <SealSubmit sealed />
        <span>等待 黑潮會 決定…</span>
        <SealSubmit disabled />
        <span className="lab-hint">還不能提交</span>
      </div>
    </div>
  );
}

// ---------- panel ----------

function PanelNow() {
  const [skip, setSkip] = useState(false);
  return (
    <div className="beat-card reminder lab-static">
      <header className="beat-head">
        <strong>還沒做完</strong>
      </header>
      <ul className="reminder-lines">
        {REMINDER_LINES.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <label className="reminder-skip">
        <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
        不再提醒
      </label>
      <footer className="beat-foot">
        <button type="button" className="primary">
          回去補上
        </button>
        <button type="button">仍要提交</button>
      </footer>
    </div>
  );
}

// ---------- buttons ----------

function ButtonsNow() {
  return (
    <div className="lab-btns">
      {(['primary', ''] as const).map((kind) => (
        <div key={kind} className="beat-foot lab-btn-row">
          <button type="button" className={kind}>
            {kind ? '提交' : '仍要提交'}
          </button>
          <button type="button" className={kind} disabled>
            停用
          </button>
          <span className="lab-hint">滑過與按下請直接操作</span>
        </div>
      ))}
    </div>
  );
}
