/**
 * MJML Compiler Engine for Exacoat Marketing Studio
 * Compiles semantic MJML templates to bulletproof responsive email HTML.
 */

export interface MjmlCompilationResult {
  html: string;
  errors: string[];
  success: boolean;
}

export async function compileMjmlToHtml(mjmlContent: string): Promise<MjmlCompilationResult> {
  try {
    const mod = await import('mjml-browser');
    const mjml2html = (mod as any).default || mod;
    const res = await mjml2html(mjmlContent, {
      validationLevel: 'soft',
      minify: false,
    });

    const errors = (res.errors || []).map((e: any) => e.formattedMessage || e.message || String(e));
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
