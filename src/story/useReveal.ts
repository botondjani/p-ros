import { useEffect, useRef } from 'react';

/** Beúszó animáció: a látómezőbe érve `data-in="true"` attribútumot kap az elem. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.in = 'true';
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.in = 'true';
            io.unobserve(e.target);
          }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
