import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { TOKEN_NAMES } from './designTokens';
import config from '../../tailwind.config.js';

const css = readFileSync('src/index.css', 'utf8');
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const darkBlock = css.slice(css.indexOf('.dark {'), css.indexOf('}', css.indexOf('.dark {')));

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
  });
  it('maps tokens into Tailwind and sets Geist fonts', () => {
    const colors = (config as any).theme.extend.colors;
    expect(colors.card).toBe('var(--card)');
    expect(colors['st-act'].fg).toBe('var(--st-act-fg)');
    expect((config as any).theme.extend.fontFamily.sans[0]).toBe('Geist');
    expect((config as any).theme.extend.fontFamily.mono[0]).toBe('"Geist Mono"');
  });
});
