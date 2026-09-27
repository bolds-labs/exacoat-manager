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
  // Strip illegal attributes from <mj-text ...> (border, border-radius, background, background-color)
  return code.replace(/<mj-text\b([^>]*?)>/gi, (_match, attrs) => {
    const cleanAttrs = attrs
      .replace(/\s+(?:border|border-radius|border-top|border-bottom|border-left|border-right)=["'][^"']*["']/gi, '')
      .replace(/\s+(?:background|background-color)=["'][^"']*["']/gi, '');
    return `<mj-text${cleanAttrs}>`;
  });
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
