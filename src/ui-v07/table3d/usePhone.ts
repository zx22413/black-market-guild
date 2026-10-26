import { useEffect, useState } from 'react';

/** True on a phone-wide window (the same breakpoint as hudPhone.css); follows the window as it changes. */
export function usePhone(): boolean {
  const query = '(max-width: 640px)';
  const [phone, setPhone] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setPhone(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return phone;
}
