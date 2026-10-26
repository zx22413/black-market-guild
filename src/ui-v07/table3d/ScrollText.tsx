import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Text in a box that may be taller than the room it gets (a role's description on a phone): it
// scrolls, and while there is more below, a small "往下滑" mark says so (the scrollbar and the paper
// shadows in hudPhone.css say the same). On a screen with room for all of it nothing shows.

export function ScrollText({ children, className = '' }: { readonly children: ReactNode; readonly className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const check = useCallback(() => {
    const el = box.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);
  useLayoutEffect(check);
  return (
    <div className="scroll-text-wrap">
      <div ref={box} className={`scroll-text ${className}`} onScroll={check}>
        {children}
      </div>
      {more && (
        <span className="scroll-more" aria-hidden="true">
          ▾ 往下滑
        </span>
      )}
    </div>
  );
}
