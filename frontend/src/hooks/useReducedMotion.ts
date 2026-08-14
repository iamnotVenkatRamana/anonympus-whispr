import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Reads prefers-reduced-motion and keeps following it, because a user can flip
 * the OS setting while the page is open and every scroll scene on the landing
 * page has to honor that immediately rather than at next reload.
 *
 * Initialised synchronously from matchMedia rather than defaulting to false, so
 * the first paint is already the reduced variant and no animation flashes
 * before the effect runs.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
