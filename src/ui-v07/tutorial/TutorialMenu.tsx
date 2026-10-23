import { TUTORIALS, type TutorialId } from '../../v07/tutorial';
import { isLessonDone } from './progress';
import './tutorial.css';

// The list of lessons: the guided match, one lesson per role, then the island draft. Any lesson
// can be started or replayed at any time; a check mark shows the ones finished in this browser.

export const TUTORIAL_GROUPS: readonly { readonly title: string; readonly ids: readonly TutorialId[] }[] = [
  { title: '基礎', ids: ['basics'] },
  { title: '角色', ids: ['guard', 'pirate', 'intel', 'smuggler', 'arms-cover', 'broker'] },
  { title: '開局', ids: ['islands'] },
];

interface TutorialMenuProps {
  readonly onStart: (id: TutorialId) => void;
  readonly onBack: () => void;
}

export function TutorialMenu({ onStart, onBack }: TutorialMenuProps) {
  const lesson = (t: (typeof TUTORIALS)[number]) => (
    <li key={t.id}>
      <button type="button" className="tut-lesson" onClick={() => onStart(t.id)}>
        <span className={isLessonDone(t.id) ? 'tut-done on' : 'tut-done'} aria-label={isLessonDone(t.id) ? '已完成' : '未完成'} />
        <span className="tut-lesson-text">
          <strong>{t.title}</strong>
          <small>{t.summary}</small>
        </span>
      </button>
    </li>
  );

  return (
    <main className="menu-panel menu-page tut-menu">
      <h2>新手教學</h2>
      <p className="menu-note">先玩基礎，再一課一課學角色與開局選島。每一課都可以隨時重玩。</p>
      {TUTORIAL_GROUPS.map((g) => (
        <section key={g.title}>
          <h3>{g.title}</h3>
          <ol className="tut-lessons">{TUTORIALS.filter((t) => g.ids.includes(t.id)).map(lesson)}</ol>
        </section>
      ))}
      <div className="menu-foot">
        <button type="button" className="menu-small" onClick={onBack}>
          返回
        </button>
      </div>
    </main>
  );
}
