import { CinnabarChop, GameTitle } from '../../skin/titleMark';
import { MenuScene } from '../../menu/MenuScene';
import '../../menu/menu.css';
import { markReady } from './director';

// The store cover (/v07.html?dev=trailer&part=cover): the lobby as a player first sees it, the
// title card over the four islands circling the market, without the buttons. Filmed like the
// trailer (a frame at a set time), so the orbit stops where the islands sit best.

export function TrailerCover() {
  return (
    <>
      <div className="menu-backdrop ready" aria-hidden="true">
        <MenuScene view={{ stage: 'title' }} onReady={markReady} />
      </div>
      <main className="menu-panel menu-title trailer-cover-panel">
        <header className="menu-logo">
          <span className="menu-title-mark">
            <h1>
              <GameTitle />
            </h1>
            <CinnabarChop className="menu-title-chop" />
          </span>
          <p className="menu-pitch">各懷鬼胎，讓骰子決定命運</p>
          <p>單人對電腦一局約 10 分鐘・免註冊・瀏覽器免費玩</p>
        </header>
      </main>
    </>
  );
}
