declare module "html-to-docx" {
  interface DocumentOptions {
    table?: { row?: { cantSplit?: boolean } };
    footer?: boolean;
    pageNumber?: boolean;
    fontSize?: number;
    font?: string;
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  }

  /**
   * Converts an HTML string to a .docx Buffer.
   *
   * @param htmlString       - The HTML content to convert
   * @param headerHTMLString - Optional header HTML (pass null to skip)
   * @param documentOptions  - Optional formatting/layout options
   * @returns Promise resolving to a Buffer containing the .docx file
   */
  function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    documentOptions?: DocumentOptions
  ): Promise<Buffer>;

  export = HTMLtoDOCX;
}
