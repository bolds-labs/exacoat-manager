declare module 'mjml-browser' {
  export interface MjmlError {
    line: number;
    message: string;
    tagName: string;
    formattedMessage?: string;
  }

  export interface MjmlResult {
    html: string;
    json: any;
    errors: MjmlError[];
  }

  export interface MjmlOptions {
    keepComments?: boolean;
    minify?: boolean;
    validationLevel?: 'strict' | 'soft' | 'skip';
    fonts?: Record<string, string>;
  }

  function mjml2html(mjml: string, options?: MjmlOptions): Promise<MjmlResult>;
  export default mjml2html;
}
