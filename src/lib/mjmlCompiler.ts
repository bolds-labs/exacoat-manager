/**
 * MJML Compiler Engine for Exacoat Marketing Studio
 * Compiles semantic MJML templates to bulletproof responsive email HTML.
 */

export interface MjmlCompilationResult {
  html: string;
  errors: string[];
  success: boolean;
}

export function sanitizeMjmlContent(code: string): string {
  if (!code) return '';
  let sanitized = code;

  // 1. Strip illegal attributes from <mj-text ...> (border, border-radius, background, background-color)
  sanitized = sanitized.replace(/<mj-text\b([^>]*?)>/gi, (_match, attrs) => {
    const cleanAttrs = attrs
      .replace(/\s+(?:border|border-radius|border-top|border-bottom|border-left|border-right)=["'][^"']*["']/gi, '')
      .replace(/\s+(?:background|background-color)=["'][^"']*["']/gi, '');
    return `<mj-text${cleanAttrs}>`;
  });

  // 2. Fix illegal direct children of <mj-wrapper>:
  // In MJML, <mj-wrapper> can only contain <mj-section> or <mj-raw>.
  // If an AI or user writes <mj-button>, <mj-text>, <mj-image>, <mj-social>, or <mj-divider> directly
  // inside <mj-wrapper>, auto-wrap it into <mj-section padding="0 0 16px"><mj-column>...</mj-column></mj-section>!
  sanitized = sanitized.replace(/(<mj-wrapper\b[^>]*>)([\s\S]*?)(<\/mj-wrapper>)/gi, (_match, openWrapper, innerContent, closeWrapper) => {
    const tokens = innerContent.split(/(<mj-section\b[\s\S]*?<\/mj-section>|<mj-raw\b[\s\S]*?<\/mj-raw>)/gi);
    const fixedTokens = tokens.map((token: string) => {
      const trimmed = token.trim();
      if (!trimmed || trimmed.startsWith('<mj-section') || trimmed.startsWith('<mj-raw')) {
        return token;
      }
      return token.replace(/(<(?:mj-button|mj-text|mj-image|mj-social|mj-divider)\b[\s\S]*?<\/(?:mj-button|mj-text|mj-image|mj-social|mj-divider)>)/gi, (elem) => {
        return `\n<mj-section padding="0 0 16px">\n  <mj-column>\n    ${elem}\n  </mj-column>\n</mj-section>\n`;
      });
    });
    return openWrapper + fixedTokens.join('') + closeWrapper;
  });

  // 3. Compact social icons so they are sleek, small (16px), and elegantly spaced
  sanitized = sanitized.replace(/<mj-social\b([^>]*?)>/gi, (_match, attrs) => {
    let cleanAttrs = attrs;
    if (!/icon-size=["'][^"']+["']/i.test(cleanAttrs) || /icon-size=["']0(?:px)?["']/i.test(cleanAttrs)) {
      cleanAttrs = `${cleanAttrs} icon-size="16px"`;
    }
    if (!/font-size=["'][^"']+["']/i.test(cleanAttrs)) {
      cleanAttrs = `${cleanAttrs} font-size="0px"`;
    }
    return `<mj-social${cleanAttrs}>`;
  });

  return sanitized;
}

export async function compileMjmlToHtml(mjmlContent: string): Promise<MjmlCompilationResult> {
  try {
    const sanitized = sanitizeMjmlContent(mjmlContent);
    const mod = await import('mjml-browser');
    const mjml2html = (mod as any).default || mod;
    const res = await mjml2html(sanitized, {
      validationLevel: 'soft',
      minify: false,
    });

    const errors = (res.errors || [])
      .map((e: any) => e.formattedMessage || e.message || String(e))
      .filter((msg: string) => !msg.toLowerCase().includes('attributes border, border-radius are illegal'));

    return {
      html: res.html || '',
      errors,
      success: Boolean(res.html),
    };
  } catch (err: any) {
    console.error('[MJML Engine] Compilation failed:', err);
    return {
      html: '',
      errors: [err?.message || 'MJML compilation failed.'],
      success: false,
    };
  }
}

/**
 * Checks if code snippet is MJML markup
 */
export function isMjmlMarkup(code: string): boolean {
  if (!code) return false;
  const trimmed = code.trim().toLowerCase();
  return trimmed.startsWith('<mjml') || trimmed.includes('<mj-');
}
