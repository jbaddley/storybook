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
} from 'docx';
import { Book, Chapter, TipTapNode, TipTapContent } from '../../shared/types';

class ExportService {
  /**
   * Export book to DOCX format
   * Returns base64 encoded data
   */
  async exportToDocx(book: Book): Promise<string> {
    const { settings } = book;
    
    // Convert all chapters to DOCX paragraphs
    const children: Paragraph[] = [];
    
    // Title page
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: book.title,
            bold: true,
            size: 48, // 24pt
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    if (book.author) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `by ${book.author}`,
              size: 28, // 14pt
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 800 },
        })
      );
    }

    // Add page break after title
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // Process each chapter
    for (let i = 0; i < book.chapters.length; i++) {
      const chapter = book.chapters[i];
      
      // Chapter title
      children.push(
        new Paragraph({
          text: chapter.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      // Chapter content
      const chapterParagraphs = this.convertTipTapToDocx(chapter.content, settings.defaultFontSize);
      children.push(...chapterParagraphs);

      // Add page break between chapters (except last)
      if (i < book.chapters.length - 1) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                width: convertInchesToTwip(settings.pageSize.width),
                height: convertInchesToTwip(settings.pageSize.height),
              },
              margin: {
                top: convertInchesToTwip(settings.margins.top),
                bottom: convertInchesToTwip(settings.margins.bottom),
                left: convertInchesToTwip(settings.margins.left),
                right: convertInchesToTwip(settings.margins.right),
              },
            },
          },
          children,
        },
      ],
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
   */
  async exportToPdf(book: Book): Promise<string> {
    const { settings } = book;
    
    // Generate HTML for PDF conversion
    const html = this.generateHtml(book);
    
    // For now, we'll create a simple PDF using the browser's print functionality
    // In a real implementation, you'd use puppeteer in the main process
    
    // Create a blob from HTML and convert to base64
    // This is a placeholder - actual PDF generation would happen in main process
    const blob = new Blob([html], { type: 'text/html' });
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    return base64;
  }

  /**
   * Generate HTML representation of the book
   */
  private generateHtml(book: Book): string {
    const { settings } = book;
    
    let chaptersHtml = '';
    for (const chapter of book.chapters) {
      chaptersHtml += `
        <div class="chapter">
          <h1>${this.escapeHtml(chapter.title)}</h1>
          ${this.tipTapToHtml(chapter.content)}
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${this.escapeHtml(book.title)}</title>
        <style>
          @page {
            size: ${settings.pageSize.width}in ${settings.pageSize.height}in;
            margin: ${settings.margins.top}in ${settings.margins.right}in ${settings.margins.bottom}in ${settings.margins.left}in;
          }
          body {
            font-family: ${settings.defaultFont}, serif;
            font-size: ${settings.defaultFontSize}pt;
            line-height: ${settings.lineSpacing};
          }
          .chapter {
            page-break-after: always;
          }
          .chapter:last-child {
            page-break-after: auto;
          }
          h1 { font-size: 24pt; margin-bottom: 1em; }
          h2 { font-size: 18pt; margin-bottom: 0.8em; }
          h3 { font-size: 14pt; margin-bottom: 0.6em; }
          p { margin-bottom: 1em; text-indent: 0.5in; }
          p:first-of-type { text-indent: 0; }
        </style>
      </head>
      <body>
        <div class="title-page">
          <h1 style="text-align: center; font-size: 36pt;">${this.escapeHtml(book.title)}</h1>
          ${book.author ? `<p style="text-align: center; font-size: 18pt;">by ${this.escapeHtml(book.author)}</p>` : ''}
        </div>
        ${chaptersHtml}
      </body>
      </html>
    `;
  }

  private tipTapToHtml(content: TipTapContent): string {
    if (!content.content) return '';
    return content.content.map((node) => this.nodeToHtml(node)).join('');
  }

  private nodeToHtml(node: TipTapNode): string {
    switch (node.type) {
      case 'paragraph':
        const align = node.attrs?.textAlign ? ` style="text-align: ${node.attrs.textAlign}"` : '';
        return `<p${align}>${this.contentToHtml(node.content || [])}</p>`;
      case 'heading':
        const level = node.attrs?.level || 1;
        return `<h${level}>${this.contentToHtml(node.content || [])}</h${level}>`;
      case 'bulletList':
        return `<ul>${(node.content || []).map((li) => this.nodeToHtml(li)).join('')}</ul>`;
      case 'orderedList':
        return `<ol>${(node.content || []).map((li) => this.nodeToHtml(li)).join('')}</ol>`;
      case 'listItem':
        return `<li>${(node.content || []).map((n) => this.nodeToHtml(n)).join('')}</li>`;
      case 'blockquote':
        return `<blockquote>${(node.content || []).map((n) => this.nodeToHtml(n)).join('')}</blockquote>`;
      case 'horizontalRule':
        return '<hr>';
      default:
        return '';
    }
  }

  private contentToHtml(nodes: TipTapNode[]): string {
    return nodes.map((node) => {
      if (node.type === 'text') {
        let text = this.escapeHtml(node.text || '');
        
        if (node.marks) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case 'bold':
                text = `<strong>${text}</strong>`;
                break;
              case 'italic':
                text = `<em>${text}</em>`;
                break;
              case 'underline':
                text = `<u>${text}</u>`;
                break;
              case 'strike':
                text = `<s>${text}</s>`;
                break;
            }
          }
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

