import { useEffect, useState } from 'react';

const read = (names: readonly string[]): Record<string, string> => {
  const style = typeof window === 'undefined' ? null : getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  names.forEach((n) => {
    out[n] = style?.getPropertyValue(`--${n}`).trim() || '';
  });
  return out;
};

/**
 * Resolved values of design tokens for SVG charts (recharts writes colours as attributes, where var()
 * is not reliable). Re-reads when the light or dark class on <html> changes.
 */
export function useCssVars<T extends string>(names: readonly T[]): Record<T, string> {
  const key = names.join('|');
  const [values, setValues] = useState(() => read(names));
  useEffect(() => {
    const list = key.split('|');
    setValues(read(list));
    const observer = new MutationObserver(() => setValues(read(list)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, [key]);
  return values as Record<T, string>;
}
