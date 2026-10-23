import { useState, type ReactNode } from 'react';
import { Flow, HouseIcon, IconDisc, InfoIcon, tokenIconUrl } from '../table3d/icons';
import { LockHint } from '../table3d/LockHint';
import { RulesBook, RulesNow } from './SkinLabBook';
import { BrassCorner, CompassWatermark, WaxSeal } from './skinLabArt';
import '../beats/beat.css';
import '../skin/layers.css';
import './skinLab.css';

/**
 * Dev-only: the skin lab (`/v07.html?dev=skin-lab`). Pieces of the UI as they look now (the real
 * classes and layers.css) next to a trial of a richer look: a panel with a title plaque, brass corners
 * and a faint compass rose under the text. Then two pictures
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
      <LabRow title="底欄（第 1 層，已套用）" note="斜面木條＋凹槽、黃銅端蓋、吊牌形狀的晶片；黑市列同樣是斜面＋凹槽，價格是吊牌（孔圈是貨品色）" now={<BarNow />} />
      <LabRow title="面板（第 2 層＋美術層）" note="橫跨上緣的標題牌、黃銅護角、木框斜面、紙上淡淡的羅盤與航線" now={<PanelNow />} next={<PanelNext />} />
      <LabRow title="主按鈕（已套用）" note="切角按鍵：主要是黃銅、次要是壓印羊皮紙，按下時鍵面落到底邊上" now={<ButtonsNow />} />
      <LabRow wide title="規則面板 → 航海手冊" note="書籤就是章節頁籤，翻到的那章書籤最突出、和書頁同色；寬螢幕雙頁，手機單頁、書籤移到上緣" now={<RulesNow />} next={<RulesBook />} />
      <LabRow title="提交 → 封蠟章" note="封蠟章就是提交鈕；封上之後章留在底欄、轉個角度寫「已封」，被封住的選擇變淡（試驗頁可再按一次復原）" now={<BarNow />} next={<BarSeal />} />
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
      <button type="button" className="primary">
        提交
      </button>
      <LockHint text={LOCK_TEXT} />
    </div>
  );
}

// ---------- wax seal submit ----------

function Seal({ state = '', sealed = false, disabled = false, onClick }: { readonly state?: string; readonly sealed?: boolean; readonly disabled?: boolean; readonly onClick?: () => void }) {
  return (
    <button type="button" className={`nb-seal ${state} ${sealed ? 'sealed' : ''}`} disabled={disabled} aria-pressed={sealed} onClick={onClick}>
      <WaxSeal />
      <span>{sealed ? '已封' : '提交'}</span>
    </button>
  );
}

function BarSeal() {
  const [sealed, setSealed] = useState(false);
  return (
    <div className="lab-stack">
      <div className={`inv-bar lab-static ${sealed ? 'is-sealed' : ''}`}>
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
        <Seal sealed={sealed} onClick={() => setSealed((s) => !s)} />
        <LockHint text={LOCK_TEXT} icon={<InfoIcon />} />
      </div>
      <div className="lab-seal-states">
        {[
          { label: '可提交', node: <Seal /> },
          { label: '滑過', node: <Seal state="is-hover" /> },
          { label: '按下', node: <Seal state="is-down" /> },
          { label: '已封', node: <Seal sealed /> },
          { label: '還不能提交', node: <Seal disabled /> },
        ].map((s) => (
          <span key={s.label} className="lab-state">
            {s.node}
            <small>{s.label}</small>
          </span>
        ))}
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

function PanelNext() {
  const [skip, setSkip] = useState(false);
  return (
    <div className="nb-frame">
      <div className="nb-plaque-wrap">
        <i className="nb-gem" />
        <strong className="nb-plaque">還沒做完</strong>
        <i className="nb-gem" />
      </div>
      <div className="nb-paper">
        <CompassWatermark />
        <ul className="nb-lines">
          {REMINDER_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <label className="nb-skip">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          不再提醒
        </label>
        <div className="nb-rule" aria-hidden="true">
          <i className="nb-gem" />
        </div>
        <footer className="nb-foot">
          <button type="button" className="nb-btn primary">
            回去補上
          </button>
          <button type="button" className="nb-btn">
            仍要提交
          </button>
        </footer>
      </div>
      <BrassCorner at="tl" />
      <BrassCorner at="tr" />
      <BrassCorner at="bl" />
      <BrassCorner at="br" />
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
