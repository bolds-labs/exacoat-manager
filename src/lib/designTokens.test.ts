import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { TOKEN_NAMES } from './designTokens';
import config from '../../tailwind.config.js';

const css = readFileSync('src/index.css', 'utf8');
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const darkBlock = css.slice(css.indexOf('.dark {'), css.indexOf('}', css.indexOf('.dark {')));

function tokenValue(block: string, name: string): string {
  const m = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`missing --${name}`);
  return m[1].trim();
}

/** Every rule outside the token blocks whose selector targets light mode (no `.dark`). */
function lightOverrideRules(): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const selector = m[1].trim();
    if (selector.includes('.dark') && !selector.includes(':not(.dark)')) continue;
    rules.push({ selector, body: m[2] });
  }
  return rules;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance([r, g, b]: [number, number, number]): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
function contrast(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('design tokens', () => {
  it('defines every token in light and dark', () => {
    for (const name of TOKEN_NAMES) {
      expect(lightBlock).toContain(`--${name}:`);
      expect(darkBlock).toContain(`--${name}:`);
    }
  });
  it('uses the spec values for key tokens', () => {
    expect(darkBlock).toMatch(/--bg:\s*#09090b/);
    expect(lightBlock).toMatch(/--bg:\s*#f4f4f1/);
    expect(darkBlock).toMatch(/--fg:\s*#e8e8eb/);
    expect(lightBlock).toMatch(/--fg:\s*#18181b/);
    expect(darkBlock).toMatch(/--accent:\s*#f3aa18/);
    expect(lightBlock).toMatch(/--accent:\s*#f3aa18/);
  });
  it('never overrides a design token from a later light-mode rule', () => {
    const offenders: string[] = [];
    for (const rule of lightOverrideRules()) {
      if (rule.selector.trim() === ':root') continue;
      for (const name of TOKEN_NAMES) {
        if (new RegExp(`(^|[\\s;])--${name}:`).test(rule.body)) offenders.push(`${rule.selector} -> --${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
  it('keeps faint text at WCAG AA (4.5:1) on its surfaces', () => {
    const lightFaint = tokenValue(lightBlock, 'faint');
    const darkFaint = tokenValue(darkBlock, 'faint');
    expect(contrast(lightFaint, tokenValue(lightBlock, 'bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightFaint, tokenValue(lightBlock, 'card'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkFaint, tokenValue(darkBlock, 'bg'))).toBeGreaterThanOrEqual(4.5);
  });
  it('maps tokens into Tailwind and sets Geist fonts', () => {
    const colors = (config as any).theme.extend.colors;
    expect(colors.card).toBe('var(--card)');
    expect(colors['st-act'].fg).toBe('var(--st-act-fg)');
    expect((config as any).theme.extend.fontFamily.sans[0]).toBe('Geist');
    expect((config as any).theme.extend.fontFamily.mono[0]).toBe('"Geist Mono"');
  });
});
