import { marked } from 'marked';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { useChaptersStore } from '../../stores/chaptersStore';
import { electronAPI } from '../../utils/electronAPI';

export type ExportFormat = 'pdf' | 'docx' | 'html';

export interface ExportOptions {
  format: ExportFormat;
  includeTOC?: boolean;
  pageNumbers?: boolean;
  headersFooters?: boolean;
}

async function markdownToHTML(markdown: string): Promise<string> {
  return await marked(markdown);
}

async function htmlToDocx(html: string, metadata: { title?: string; author?: string }): Promise<void> {
  // DOCX export temporarily disabled - will be implemented via IPC to main process
  alert('DOCX export is not yet available. Please use HTML or PDF export.');
  throw new Error('DOCX export not implemented');
}

async function htmlToPDF(html: string): Promise<Blob> {
  // For PDF export, we'll use the browser's print functionality
  // In a real implementation, you'd use puppeteer or similar
  // For now, we'll create a downloadable HTML file styled for printing
  const printHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @media print {
            @page {
              margin: 1in;
              size: letter;
            }
            body {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.6;
            }
            h1, h2, h3 {
              page-break-after: avoid;
            }
            p {
              margin: 0.5em 0;
            }
          }
          body {
            max-width: 8.5in;
            margin: 0 auto;
            padding: 1in;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;

  return new Blob([printHTML], { type: 'text/html' });
}

export async function exportDocument(
  format: ExportFormat,
  options: ExportOptions = { format }
): Promise<void> {
  const { content, htmlContent, mode } = useEditorStore.getState();
  const { metadata } = useProjectStore.getState();
  const { chapters } = useChaptersStore.getState();

  // If chapters exist, combine them; otherwise use current editor content
  let html = '';
  if (chapters.length > 0) {
    // Combine all chapters
    const chapterHTMLs = await Promise.all(
      chapters
        .sort((a, b) => a.order - b.order)
        .map(async (chapter) => {
          const chapterTitle = `<h1>${chapter.title}</h1>`;
          let chapterContent = chapter.htmlContent || '';
          if (!chapterContent && chapter.content) {
            chapterContent = await markdownToHTML(chapter.content);
          }
          return chapterTitle + chapterContent;
        })
    );
    html = chapterHTMLs.join('\n\n');
  } else {
    // Legacy: single content
    if (mode === 'wysiwyg') {
      html = htmlContent;
    } else {
      html = await markdownToHTML(content);
    }
  }

  let blob: Blob;
  let filename: string;
  let mimeType: string;

  if (format === 'docx') {
    await htmlToDocx(html, metadata);
    return; // DOCX export is handled in main process
  } else if (format === 'pdf') {
    blob = await htmlToPDF(html);
    filename = `${metadata.title || 'document'}.html`; // Fallback to HTML for now
    mimeType = 'text/html';
  } else {
    // HTML export
    blob = new Blob([html], { type: 'text/html' });
    filename = `${metadata.title || 'document'}.html`;
    mimeType = 'text/html';
  }

  // Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

