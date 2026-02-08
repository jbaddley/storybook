import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  PageBreak,
  convertInchesToTwip,
  UnderlineType,
  Header,
  Footer,
  PageNumber,
  Tab,
  TabStopType,
} from 'docx';
import { Book, Chapter, TipTapNode, TipTapContent, PageSize, Margins } from '../../shared/types';

export interface ExportDocxOptions {
  selectedChapterIds?: string[];
  pageSize?: PageSize;
  margins?: Margins;
}

class ExportService {
  /**
   * Export book to DOCX format (all chapters, book settings).
   * Returns base64 encoded data.
   */
  async exportToDocx(book: Book): Promise<string> {
    return this.exportToDocxWithOptions(book, {});
  }

  /**
   * Export book to DOCX with optional chapter selection and page/margin overrides.
   * Used for PDF-via-DOCX when user selects chapters and custom page size/margins.
   */
  async exportToDocxWithOptions(book: Book, options: ExportDocxOptions): Promise<string> {
    const { settings } = book;
    const pageSize = options.pageSize ?? settings.pageSize;
    const margins = options.margins ?? settings.margins;
    const chapterIds = options.selectedChapterIds ?? book.chapters.map((ch) => ch.id);
    const chapters = book.chapters.filter((ch) => chapterIds.includes(ch.id)).sort((a, b) => a.order - b.order);

    const contentWidth = pageSize.width - margins.left - margins.right;
    const headerTabStops = [
      { type: TabStopType.CENTER, position: convertInchesToTwip(contentWidth / 2) },
      { type: TabStopType.RIGHT, position: convertInchesToTwip(contentWidth) },
    ];
    const headerFontSize = 18;

    const isPageNumberField = (v: unknown): v is typeof PageNumber.CURRENT =>
      v === PageNumber.CURRENT || v === PageNumber.TOTAL_PAGES || v === PageNumber.TOTAL_PAGES_IN_SECTION || v === PageNumber.CURRENT_SECTION;

    const createHeaderParagraph = (left: string | typeof PageNumber.CURRENT, center: string, right: string | typeof PageNumber.CURRENT) => {
      const leftRun = isPageNumberField(left)
        ? new TextRun({ children: [left], size: headerFontSize })
        : new TextRun({ text: left, size: headerFontSize });
      const rightRun = isPageNumberField(right)
        ? new TextRun({ children: [right], size: headerFontSize })
        : new TextRun({ text: right, size: headerFontSize });
      return new Paragraph({
        tabStops: headerTabStops,
        children: [
          leftRun,
          new TextRun({ children: [new Tab()] }),
          new TextRun({ text: center, size: headerFontSize }),
          new TextRun({ children: [new Tab()] }),
          rightRun,
        ],
      });
    };

    const sections: Array<{
      properties: object;
      headers: { default?: Header; first?: Header; even?: Header };
      footers: { default?: Footer; first?: Footer; even?: Footer };
      children: Paragraph[];
    }> = [];

    // Section 1: Title page only (no header on first page)
    sections.push({
      properties: {
        page: {
          size: { width: convertInchesToTwip(pageSize.width), height: convertInchesToTwip(pageSize.height) },
          margin: {
            top: convertInchesToTwip(margins.top),
            bottom: convertInchesToTwip(margins.bottom),
            left: convertInchesToTwip(margins.left),
            right: convertInchesToTwip(margins.right),
          },
        },
        titlePage: true,
      },
      headers: {
        first: new Header({ children: [new Paragraph({ text: '' })] }),
        default: new Header({
          children: [createHeaderParagraph(book.title, 'Chapter 1', PageNumber.CURRENT)],
        }),
        even: new Header({
          children: [createHeaderParagraph(PageNumber.CURRENT, 'Chapter 1', book.title)],
        }),
      },
      footers: {
        first: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: headerFontSize })],
            }),
          ],
        }),
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: headerFontSize })],
            }),
          ],
        }),
        even: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: headerFontSize })],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: book.title, bold: true, size: 48 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        ...(book.author
          ? [
              new Paragraph({
                children: [new TextRun({ text: `by ${book.author}`, size: 28 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 800 },
              }),
            ]
          : []),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    });

    // One section per chapter (with chapter-specific header)
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const chapterLabel = `Chapter ${chapter.order}`;
      const chapterChildren: Paragraph[] = [
        new Paragraph({
          text: `Chapter ${chapter.order}: ${chapter.title}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        ...this.convertTipTapToDocx(chapter.content, settings.defaultFontSize),
      ];
      if (i < chapters.length - 1) {
        chapterChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }
      sections.push({
        properties: {
          page: {
            size: { width: convertInchesToTwip(pageSize.width), height: convertInchesToTwip(pageSize.height) },
            margin: {
              top: convertInchesToTwip(margins.top),
              bottom: convertInchesToTwip(margins.bottom),
              left: convertInchesToTwip(margins.left),
              right: convertInchesToTwip(margins.right),
            },
          },
          titlePage: false,
        },
        headers: {
          default: new Header({
            children: [createHeaderParagraph(book.title, chapterLabel, PageNumber.CURRENT)],
          }),
          even: new Header({
            children: [createHeaderParagraph(PageNumber.CURRENT, chapterLabel, book.title)],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: headerFontSize })],
              }),
            ],
          }),
          even: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: headerFontSize })],
              }),
            ],
          }),
        },
        children: chapterChildren,
      });
    }

    const doc = new Document({
      evenAndOddHeaderAndFooters: true,
      sections,
    });

    const buffer = await Packer.toBase64String(doc);
    return buffer;
  }

  /**
   * Convert TipTap content to DOCX paragraphs
   */
  private convertTipTapToDocx(content: TipTapContent, defaultFontSize: number): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    if (!content.content) return paragraphs;

    for (const node of content.content) {
      const paragraph = this.convertNode(node, defaultFontSize);
      if (paragraph) {
        paragraphs.push(paragraph);
      }
    }

    return paragraphs;
  }

  private convertNode(node: TipTapNode, defaultFontSize: number): Paragraph | null {
    switch (node.type) {
      case 'paragraph':
        return this.convertParagraph(node, defaultFontSize);
      case 'heading':
        return this.convertHeading(node);
      case 'bulletList':
      case 'orderedList':
        // For lists, we need to flatten them
        return null; // TODO: Handle lists
      case 'blockquote':
        return this.convertBlockquote(node, defaultFontSize);
      case 'horizontalRule':
        return new Paragraph({
          children: [new TextRun({ text: '───────────────────────' })],
          alignment: AlignmentType.CENTER,
        });
      default:
        return null;
    }
  }

  private convertParagraph(node: TipTapNode, defaultFontSize: number): Paragraph {
    const children = this.convertContent(node.content || [], defaultFontSize);
    
    // Get alignment from node attrs
    let alignment: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT;
    if (node.attrs?.textAlign) {
      switch (node.attrs.textAlign) {
        case 'center':
          alignment = AlignmentType.CENTER;
          break;
        case 'right':
          alignment = AlignmentType.RIGHT;
          break;
        case 'justify':
          alignment = AlignmentType.JUSTIFIED;
          break;
      }
    }

    return new Paragraph({
      children,
      alignment,
      spacing: { after: 200 },
    });
  }

  private convertHeading(node: TipTapNode): Paragraph {
    const level = (node.attrs?.level || 1) as number;
    const headingLevel = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ][level - 1] || HeadingLevel.HEADING_1;

    const text = this.extractText(node.content || []);

    return new Paragraph({
      text,
      heading: headingLevel,
      spacing: { before: 300, after: 150 },
    });
  }

  private convertBlockquote(node: TipTapNode, defaultFontSize: number): Paragraph {
    const children = this.convertContent(node.content?.[0]?.content || [], defaultFontSize);

    return new Paragraph({
      children,
      indent: { left: convertInchesToTwip(0.5) },
      spacing: { before: 200, after: 200 },
    });
  }

  private convertContent(nodes: TipTapNode[], defaultFontSize: number): TextRun[] {
    const runs: TextRun[] = [];

    for (const node of nodes) {
      if (node.type === 'text') {
        const options: any = {
          text: node.text || '',
          size: defaultFontSize * 2, // DOCX uses half-points
        };

        // Apply marks
        if (node.marks) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case 'bold':
                options.bold = true;
                break;
              case 'italic':
                options.italics = true;
                break;
              case 'underline':
                options.underline = { type: UnderlineType.SINGLE };
                break;
              case 'strike':
                options.strike = true;
                break;
              case 'textStyle':
                if (mark.attrs?.fontFamily && typeof mark.attrs.fontFamily === 'string') {
                  options.font = mark.attrs.fontFamily;
                }
                if (mark.attrs?.fontSize && typeof mark.attrs.fontSize === 'string') {
                  const size = parseFloat(mark.attrs.fontSize);
                  if (!isNaN(size)) {
                    options.size = size * 2;
                  }
                }
                if (mark.attrs?.color && typeof mark.attrs.color === 'string') {
                  options.color = mark.attrs.color.replace('#', '');
                }
                break;
            }
          }
        }

        runs.push(new TextRun(options));
      } else if (node.type === 'hardBreak') {
        runs.push(new TextRun({ break: 1 }));
      }
    }

    return runs;
  }

  private extractText(nodes: TipTapNode[]): string {
    let text = '';
    for (const node of nodes) {
      if (node.text) {
        text += node.text;
      }
      if (node.content) {
        text += this.extractText(node.content);
      }
    }
    return text;
  }

  /**
   * Export book to PDF format
   * Returns base64 encoded data
   * @deprecated Use generateHtmlForPdf instead
   */
  async exportToPdf(book: Book): Promise<string> {
    const { settings } = book;
    
    // Generate HTML for PDF conversion
    const html = this.generateHtmlForPdf(
      book,
      book.chapters.map(ch => ch.id),
      settings.pageSize,
      settings.margins
    );
    
    // Create a blob from HTML and convert to base64
    const blob = new Blob([html], { type: 'text/html' });
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    return base64;
  }

  /**
   * Generate HTML representation of the book for PDF export
   * @param book The book to export
   * @param selectedChapterIds Array of chapter IDs to include
   * @param pageSize Page size settings
   * @param margins Margin settings
   */
  generateHtmlForPdf(
    book: Book,
    selectedChapterIds: string[],
    pageSize: PageSize,
    margins: Margins
  ): string {
    const { settings } = book;
    const escapedBookTitle = this.escapeHtml(book.title);
    const bodyFont = settings.bodyFont || settings.defaultFont || 'serif';
    const bodyFontSize = settings.bodyFontSize ?? settings.defaultFontSize ?? 12;
    const titleFont = settings.titleFont || settings.defaultFont || 'serif';
    const titleFontSize = settings.titleFontSize ?? 24;
    const bodyFontCss = bodyFont.includes(' ') ? `"${bodyFont}", serif` : `${bodyFont}, serif`;
    const titleFontCss = titleFont.includes(' ') ? `"${titleFont}", serif` : `${titleFont}, serif`;

    // Filter chapters by selection
    const selectedChapters = book.chapters.filter(ch => selectedChapterIds.includes(ch.id));

    let chaptersHtml = '';
    for (let i = 0; i < selectedChapters.length; i++) {
      const chapter = selectedChapters[i];
      const isLast = i === selectedChapters.length - 1;
      const chapterHeading = `Chapter ${chapter.order}: ${this.escapeHtml(chapter.title)}`;
      chaptersHtml += `
        <div class="chapter"${isLast ? '' : ' style="page-break-after: always;"'}>
          <h1 class="chapter-title">${chapterHeading}</h1>
          ${this.tipTapToHtml(chapter.content, settings)}
        </div>
      `;
    }

    const paragraphSpacing = settings.paragraphSpacing ?? 0;
    const settingsPageHtml = `
        <div class="settings-page">
          <h2>Manuscript settings</h2>
          <p style="margin-bottom: 1em;">The two lines below are rendered in the actual title and body font/size. If the body line looks smaller than the title line, the export may not be honoring the selected body size.</p>
          <ul class="settings-list">
            <li><span class="label">Title font:</span> <span class="settings-demo-title" style="font-family: ${titleFontCss}; font-size: ${titleFontSize}pt;">${this.escapeHtml(titleFont)} at ${titleFontSize}pt</span></li>
            <li><span class="label">Body font:</span> <span class="settings-demo-body" style="font-family: ${bodyFontCss}; font-size: ${bodyFontSize}pt;">${this.escapeHtml(bodyFont)} at ${bodyFontSize}pt</span></li>
            <li><span class="label">Page size:</span> ${this.escapeHtml(pageSize.name)} (${pageSize.width}" × ${pageSize.height}")</li>
            <li><span class="label">Margins:</span> top ${margins.top}", bottom ${margins.bottom}", left ${margins.left}", right ${margins.right}"</li>
            <li><span class="label">Line spacing:</span> ${settings.lineSpacing}</li>
            <li><span class="label">Paragraph spacing:</span> ${paragraphSpacing === 0 ? 'First line indent only' : `${paragraphSpacing}em between paragraphs`}</li>
          </ul>
          <p style="margin-top: 1.5em;"><span class="label">Sample at body size:</span> <span class="settings-demo-body" style="font-family: ${bodyFontCss}; font-size: ${bodyFontSize}pt;">The quick brown fox jumps over the lazy dog. 0123456789.</span></p>
        </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${escapedBookTitle}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @page {
            size: ${pageSize.width}in ${pageSize.height}in;
            margin: 0;
          }
          html {
            margin: 0;
            padding: 0;
          }
          .pdf-running-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.25in ${margins.right}in 0.15in ${margins.left}in;
            font-family: ${bodyFontCss};
            font-size: 10pt;
            color: #333;
            border-bottom: 1px solid #ccc;
            background: #fff;
            z-index: 1;
          }
          .pdf-running-header .header-left { text-align: left; }
          .pdf-running-header .header-center { text-align: center; flex: 1; }
          .pdf-running-header .header-right { text-align: right; }
          .pdf-running-header .header-right::after { content: counter(page); }
          body {
            margin: 0;
            padding: max(${margins.top}in, 0.55in) ${margins.right}in ${margins.bottom}in ${margins.left}in;
            width: 100%;
            max-width: 100%;
            min-height: 100%;
            box-sizing: border-box;
            font-family: ${bodyFontCss};
            font-size: ${bodyFontSize}pt;
            line-height: ${settings.lineSpacing};
            color: #000;
          }
          .title-page {
            page-break-after: always;
            text-align: center;
            padding-top: 2in;
          }
          .title-page h1 {
            font-family: ${titleFontCss};
            font-size: 36pt;
            font-weight: bold;
            margin-bottom: 0.5em;
          }
          .title-page-author {
            font-family: ${bodyFontCss};
            font-size: ${bodyFontSize}pt;
            margin-top: 0.5em;
          }
          .settings-page {
            page-break-after: always;
            padding-top: 0.5in;
          }
          .settings-page h2 {
            font-family: ${titleFontCss};
            font-size: ${titleFontSize}pt;
            font-weight: bold;
            margin-bottom: 1em;
            border-bottom: 1px solid #ccc;
            padding-bottom: 0.25em;
          }
          .settings-page .settings-list {
            list-style: none;
            padding-left: 0;
          }
          .settings-page .settings-list li {
            margin-bottom: 0.5em;
            padding-left: 0;
          }
          .settings-page .settings-list .label {
            font-weight: 600;
            display: inline-block;
            min-width: 10em;
          }
          .chapter {
            margin: 0;
          }
          .chapter-title {
            font-family: ${titleFontCss};
            font-size: ${titleFontSize}pt;
            font-weight: bold;
            margin-top: 0;
            margin-bottom: 1em;
            page-break-after: avoid;
          }
          h1, h2, h3, h4, h5, h6 {
            font-family: ${titleFontCss};
            font-weight: bold;
            page-break-after: avoid;
            margin-top: 1em;
            margin-bottom: 0.5em;
          }
          h1 { font-size: ${titleFontSize * 1.2}pt; }
          h2 { font-size: ${titleFontSize * 1.0}pt; }
          h3 { font-size: ${titleFontSize * 0.85}pt; }
          h4 { font-size: ${titleFontSize * 0.75}pt; }
          h5 { font-size: ${titleFontSize * 0.65}pt; }
          h6 { font-size: ${titleFontSize * 0.55}pt; }
          p {
            font-family: ${bodyFontCss};
            font-size: ${bodyFontSize}pt;
            margin: 0;
            padding: 0;
            margin-bottom: ${(settings.paragraphSpacing && settings.paragraphSpacing > 0) ? `${settings.paragraphSpacing}em` : '0'};
            text-indent: ${(settings.paragraphSpacing === 0 || !settings.paragraphSpacing) ? '0.5in' : '0'};
            orphans: 2;
            widows: 2;
            line-height: ${settings.lineSpacing};
            display: block;
          }
          p:first-of-type {
            text-indent: 0;
            margin-top: 0;
          }
          p + p {
            margin-top: ${(settings.paragraphSpacing === 0 || !settings.paragraphSpacing) ? '-0.01em' : '0'};
            margin-bottom: ${(settings.paragraphSpacing && settings.paragraphSpacing > 0) ? `${settings.paragraphSpacing}em` : '0'};
          }
          ul, ol {
            margin-bottom: 1em;
            padding-left: 1.5em;
          }
          li {
            font-family: ${bodyFontCss};
            font-size: ${bodyFontSize}pt;
            margin-bottom: 0.25em;
          }
          blockquote {
            font-family: ${bodyFontCss};
            font-size: ${bodyFontSize}pt;
            margin: 1em 2em;
            padding-left: 1em;
            border-left: 3px solid #ccc;
            font-style: italic;
          }
          hr {
            border: none;
            border-top: 1px solid #ccc;
            margin: 1em 0;
          }
        </style>
      </head>
      <body>
        <div class="pdf-running-header" aria-hidden="true">
          <span class="header-left">${this.escapeHtml(book.title)}</span>
          <span class="header-center"></span>
          <span class="header-right"></span>
        </div>
        <div class="title-page">
          <h1>${this.escapeHtml(book.title)}</h1>
          ${book.author ? `<p class="title-page-author">by ${this.escapeHtml(book.author)}</p>` : ''}
        </div>
        ${settingsPageHtml}
        ${chaptersHtml}
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML representation of the book (legacy method)
   * @deprecated Use generateHtmlForPdf instead
   */
  private generateHtml(book: Book): string {
    const { settings } = book;
    return this.generateHtmlForPdf(
      book,
      book.chapters.map(ch => ch.id),
      settings.pageSize,
      settings.margins
    );
  }

  private tipTapToHtml(content: TipTapContent, settings?: Book['settings']): string {
    if (!content.content) return '';
    return content.content.map((node) => this.nodeToHtml(node, settings)).join('');
  }

  private nodeToHtml(node: TipTapNode, settings?: Book['settings']): string {
    switch (node.type) {
      case 'paragraph':
        const align = node.attrs?.textAlign ? ` style="text-align: ${node.attrs.textAlign}"` : '';
        return `<p${align}>${this.contentToHtml(node.content || [], settings)}</p>`;
      case 'heading':
        const level = node.attrs?.level || 1;
        return `<h${level}>${this.contentToHtml(node.content || [], settings)}</h${level}>`;
      case 'bulletList':
        return `<ul>${(node.content || []).map((li) => this.nodeToHtml(li, settings)).join('')}</ul>`;
      case 'orderedList':
        return `<ol>${(node.content || []).map((li) => this.nodeToHtml(li, settings)).join('')}</ol>`;
      case 'listItem':
        return `<li>${(node.content || []).map((n) => this.nodeToHtml(n, settings)).join('')}</li>`;
      case 'blockquote':
        return `<blockquote>${(node.content || []).map((n) => this.nodeToHtml(n, settings)).join('')}</blockquote>`;
      case 'horizontalRule':
        return '<hr>';
      default:
        return '';
    }
  }

  private contentToHtml(nodes: TipTapNode[], settings?: Book['settings']): string {
    return nodes.map((node) => {
      if (node.type === 'text') {
        let text = this.escapeHtml(node.text || '');
        const inlineStyles: string[] = [];
        const tags: string[] = [];
        
        if (node.marks) {
          // Process marks in order - build up tags and styles
          for (const mark of node.marks) {
            switch (mark.type) {
              case 'bold':
                tags.push('strong');
                break;
              case 'italic':
                tags.push('em');
                break;
              case 'underline':
                tags.push('u');
                break;
              case 'strike':
                tags.push('s');
                break;
              case 'textStyle':
                // Handle custom font, size, and color. For PDF export (when settings is provided),
                // do not output font-family or font-size from marks so the book's body/paragraph
                // settings (e.g. 16pt) are honored; only output color overrides.
                if (mark.attrs) {
                  const forPdf = !!settings;
                  if (mark.attrs.fontFamily && typeof mark.attrs.fontFamily === 'string' && !forPdf) {
                    const ff = mark.attrs.fontFamily.includes(' ') ? `"${mark.attrs.fontFamily}"` : mark.attrs.fontFamily;
                    inlineStyles.push(`font-family: ${ff}`);
                  }
                  if (mark.attrs.fontSize && typeof mark.attrs.fontSize === 'string' && !forPdf) {
                    inlineStyles.push(`font-size: ${mark.attrs.fontSize}`);
                  }
                  if (mark.attrs.color && typeof mark.attrs.color === 'string') {
                    inlineStyles.push(`color: ${mark.attrs.color}`);
                  }
                }
                break;
            }
          }
        }
        
        // Wrap text in tags (outermost first)
        for (const tag of tags) {
          text = `<${tag}>${text}</${tag}>`;
        }
        
        // Apply inline styles if any
        if (inlineStyles.length > 0) {
          text = `<span style="${inlineStyles.join('; ')}">${text}</span>`;
        }
        
        return text;
      } else if (node.type === 'hardBreak') {
        return '<br>';
      }
      return '';
    }).join('');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const exportService = new ExportService();

