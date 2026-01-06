/**
 * Google Docs/Drive Service
 * Handles interactions with Google Drive and Docs APIs
 */

import { googleAuthService } from './googleAuthService';
import { TipTapContent, Chapter, generateId } from '../../shared/types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DOCS_API_BASE = 'https://docs.googleapis.com/v1';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
  iconLink?: string;
  webViewLink?: string;
}

export interface GoogleDocsDocument {
  documentId: string;
  title: string;
  body: GoogleDocsBody;
}

interface GoogleDocsBody {
  content: GoogleDocsElement[];
}

interface GoogleDocsElement {
  startIndex: number;
  endIndex: number;
  paragraph?: GoogleDocsParagraph;
  sectionBreak?: GoogleDocsSectionBreak;
  table?: object;
  tableOfContents?: object;
}

interface GoogleDocsSectionBreak {
  sectionStyle?: {
    sectionType?: string; // CONTINUOUS, NEXT_PAGE, etc.
  };
}

interface GoogleDocsParagraph {
  elements: GoogleDocsParagraphElement[];
  paragraphStyle?: GoogleDocsParagraphStyle;
}

interface GoogleDocsParagraphElement {
  startIndex: number;
  endIndex: number;
  textRun?: GoogleDocsTextRun;
  pageBreak?: object; // Page break within a paragraph
}

interface GoogleDocsTextRun {
  content: string;
  textStyle?: GoogleDocsTextStyle;
}

interface GoogleDocsParagraphStyle {
  namedStyleType?: string;
  alignment?: string;
  lineSpacing?: number;
  direction?: string;
  spacingMode?: string;
  spaceAbove?: { magnitude: number; unit: string };
  spaceBelow?: { magnitude: number; unit: string };
  indentFirstLine?: { magnitude: number; unit: string };
  indentStart?: { magnitude: number; unit: string };
  pageBreakBefore?: boolean;
}

interface GoogleDocsTextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: { magnitude: number; unit: string };
  foregroundColor?: { color: { rgbColor: { red?: number; green?: number; blue?: number } } };
  weightedFontFamily?: { fontFamily: string; weight: number };
  link?: { url: string };
}

export interface ImportedChapter {
  title: string;
  content: TipTapContent;
}

export interface ImportResult {
  bookTitle: string;
  chapters: ImportedChapter[];
  documentId: string;
  documentName: string;
}

class GoogleDocsService {
  /**
   * Make an authenticated request to Google APIs
   * Uses IPC to main process to avoid CORS issues
   */
  private async makeRequest<T>(url: string): Promise<T> {
    let accessToken = googleAuthService.getAccessToken();
    
    if (!accessToken) {
      // Try to refresh token
      if (googleAuthService.loadTokens()) {
        await googleAuthService.refreshAccessToken();
        accessToken = googleAuthService.getAccessToken();
      }
      
      if (!accessToken) {
        throw new Error('Not authenticated with Google');
      }
    }

    if (!window.electronAPI?.googleApiGet) {
      throw new Error('Electron API not available');
    }

    try {
      return await window.electronAPI.googleApiGet<T>({ url, accessToken });
    } catch (error: any) {
      // If unauthorized, try to refresh token and retry
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        await googleAuthService.refreshAccessToken();
        googleAuthService.saveTokens();
        
        const newAccessToken = googleAuthService.getAccessToken();
        if (!newAccessToken) {
          throw new Error('Failed to refresh authentication');
        }
        
        return await window.electronAPI.googleApiGet<T>({ url, accessToken: newAccessToken });
      }
      throw error;
    }
  }

  /**
   * Get file metadata from Google Drive (including last modified time)
   */
  async getFileMetadata(fileId: string): Promise<GoogleDriveFile | null> {
    try {
      const params = new URLSearchParams({
        fields: 'id,name,mimeType,modifiedTime,createdTime,webViewLink',
      });

      const data = await this.makeRequest<GoogleDriveFile>(
        `${DRIVE_API_BASE}/files/${fileId}?${params.toString()}`
      );

      return data;
    } catch (err) {
      console.error('Failed to get file metadata:', err);
      return null;
    }
  }

  /**
   * List Google Docs files from Drive
   */
  async listDocuments(pageToken?: string): Promise<{ files: GoogleDriveFile[]; nextPageToken?: string }> {
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.document'",
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,iconLink,webViewLink)',
      orderBy: 'modifiedTime desc',
      pageSize: '20',
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const data = await this.makeRequest<{ files: GoogleDriveFile[]; nextPageToken?: string }>(
      `${DRIVE_API_BASE}/files?${params.toString()}`
    );

    return data;
  }

  /**
   * Search for documents by name
   */
  async searchDocuments(query: string): Promise<GoogleDriveFile[]> {
    const params = new URLSearchParams({
      q: `mimeType='application/vnd.google-apps.document' and name contains '${query.replace(/'/g, "\\'")}'`,
      fields: 'files(id,name,mimeType,modifiedTime,createdTime,iconLink,webViewLink)',
      orderBy: 'modifiedTime desc',
      pageSize: '20',
    });

    const data = await this.makeRequest<{ files: GoogleDriveFile[] }>(
      `${DRIVE_API_BASE}/files?${params.toString()}`
    );

    return data.files || [];
  }

  /**
   * Get a specific document's content
   */
  async getDocument(documentId: string): Promise<GoogleDocsDocument> {
    return this.makeRequest<GoogleDocsDocument>(
      `${DOCS_API_BASE}/documents/${documentId}`
    );
  }

  /**
   * Import a Google Doc as a book with chapters split by page breaks
   */
  async importDocument(file: GoogleDriveFile): Promise<ImportResult> {
    const doc = await this.getDocument(file.id);
    const chapters = this.splitIntoChapters(doc);
    
    return {
      bookTitle: doc.title,
      chapters,
      documentId: file.id,
      documentName: file.name,
    };
  }

  /**
   * Split Google Docs content into chapters based on page breaks
   */
  private splitIntoChapters(doc: GoogleDocsDocument): ImportedChapter[] {
    const chapters: ImportedChapter[] = [];
    let currentChapterContent: any[] = [];
    let currentChapterTitle: string | null = null;
    let chapterIndex = 1;

    for (let i = 0; i < doc.body.content.length; i++) {
      const element = doc.body.content[i];
      
      // Check for section break (page break at section level)
      if (element.sectionBreak) {
        const sectionType = element.sectionBreak.sectionStyle?.sectionType;
        // NEXT_PAGE indicates a page break
        if (sectionType === 'NEXT_PAGE') {
          // Save current chapter if it has content
          if (currentChapterContent.length > 0) {
            chapters.push(this.createChapter(
              currentChapterTitle || `Chapter ${chapterIndex}`,
              currentChapterContent
            ));
            chapterIndex++;
            currentChapterContent = [];
            currentChapterTitle = null;
          }
          continue;
        }
      }

      // Check for paragraph with page break
      if (element.paragraph) {
        // Check if paragraph has pageBreakBefore style
        if (element.paragraph.paragraphStyle?.pageBreakBefore) {
          // Save current chapter if it has content
          if (currentChapterContent.length > 0) {
            chapters.push(this.createChapter(
              currentChapterTitle || `Chapter ${chapterIndex}`,
              currentChapterContent
            ));
            chapterIndex++;
            currentChapterContent = [];
            currentChapterTitle = null;
          }
        }

        // Check for inline page breaks within paragraph elements
        let hasPageBreak = false;
        for (const paragraphElement of element.paragraph.elements) {
          if (paragraphElement.pageBreak) {
            hasPageBreak = true;
            break;
          }
        }

        if (hasPageBreak) {
          // Save current chapter if it has content
          if (currentChapterContent.length > 0) {
            chapters.push(this.createChapter(
              currentChapterTitle || `Chapter ${chapterIndex}`,
              currentChapterContent
            ));
            chapterIndex++;
            currentChapterContent = [];
            currentChapterTitle = null;
          }
          // Skip the page break paragraph itself if it only contains the break
          continue;
        }

        // Convert paragraph to TipTap format
        const node = this.convertParagraph(element.paragraph);
        if (node) {
          // Check if this is a heading that could be a chapter title
          if (node.type === 'heading' && !currentChapterTitle) {
            const headingText = this.extractTextFromNode(node);
            if (headingText) {
              currentChapterTitle = headingText;
            }
          }
          currentChapterContent.push(node);
        }
      }
    }

    // Don't forget the last chapter
    if (currentChapterContent.length > 0) {
      chapters.push(this.createChapter(
        currentChapterTitle || `Chapter ${chapterIndex}`,
        currentChapterContent
      ));
    }

    // If no chapters were created, create one with all content
    if (chapters.length === 0) {
      chapters.push(this.createChapter(doc.title, [{ type: 'paragraph', content: [] }]));
    }

    return chapters;
  }

  /**
   * Extract plain text from a TipTap node
   */
  private extractTextFromNode(node: any): string {
    if (node.text) return node.text;
    if (node.content) {
      return node.content.map((n: any) => this.extractTextFromNode(n)).join('');
    }
    return '';
  }

  /**
   * Create a chapter object from content
   */
  private createChapter(title: string, content: any[]): ImportedChapter {
    return {
      title,
      content: {
        type: 'doc',
        content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
      },
    };
  }

  /**
   * Convert Google Docs content to TipTap format (single document)
   * @deprecated Use importDocument instead for proper chapter splitting
   */
  convertToTipTap(doc: GoogleDocsDocument): { title: string; content: TipTapContent } {
    const content: any[] = [];
    
    for (const element of doc.body.content) {
      if (element.paragraph) {
        const node = this.convertParagraph(element.paragraph);
        if (node) {
          content.push(node);
        }
      }
    }

    // If content is empty, add an empty paragraph
    if (content.length === 0) {
      content.push({ type: 'paragraph', content: [] });
    }

    return {
      title: doc.title,
      content: {
        type: 'doc',
        content,
      },
    };
  }

  /**
   * Convert a Google Docs paragraph to TipTap format
   */
  private convertParagraph(paragraph: GoogleDocsParagraph): any | null {
    const textContent: any[] = [];
    
    for (const element of paragraph.elements) {
      // Skip page breaks
      if (element.pageBreak) continue;
      
      if (element.textRun) {
        const text = element.textRun.content;
        
        // Skip empty text or just newlines
        if (!text || text === '\n') continue;
        
        // Remove trailing newline
        const cleanText = text.replace(/\n$/, '');
        if (!cleanText) continue;

        const textNode: any = {
          type: 'text',
          text: cleanText,
        };

        // Convert text styling to marks
        const marks = this.convertTextStyle(element.textRun.textStyle);
        if (marks.length > 0) {
          textNode.marks = marks;
        }

        textContent.push(textNode);
      }
    }

    // Determine paragraph type based on style
    const styleType = paragraph.paragraphStyle?.namedStyleType;
    
    if (styleType?.startsWith('HEADING_')) {
      const level = parseInt(styleType.replace('HEADING_', ''), 10);
      if (level >= 1 && level <= 6) {
        return {
          type: 'heading',
          attrs: { level },
          content: textContent.length > 0 ? textContent : undefined,
        };
      }
    }

    if (styleType === 'TITLE') {
      return {
        type: 'heading',
        attrs: { level: 1 },
        content: textContent.length > 0 ? textContent : undefined,
      };
    }

    if (styleType === 'SUBTITLE') {
      return {
        type: 'heading',
        attrs: { level: 2 },
        content: textContent.length > 0 ? textContent : undefined,
      };
    }

    // Regular paragraph
    return {
      type: 'paragraph',
      content: textContent.length > 0 ? textContent : undefined,
    };
  }

  /**
   * Convert Google Docs text style to TipTap marks
   */
  private convertTextStyle(style?: GoogleDocsTextStyle): any[] {
    if (!style) return [];
    
    const marks: any[] = [];

    if (style.bold) {
      marks.push({ type: 'bold' });
    }

    if (style.italic) {
      marks.push({ type: 'italic' });
    }

    if (style.underline) {
      marks.push({ type: 'underline' });
    }

    if (style.strikethrough) {
      marks.push({ type: 'strike' });
    }

    if (style.link?.url) {
      marks.push({
        type: 'link',
        attrs: { href: style.link.url },
      });
    }

    // Font family and size
    const textStyleAttrs: any = {};
    
    if (style.weightedFontFamily?.fontFamily) {
      textStyleAttrs.fontFamily = style.weightedFontFamily.fontFamily;
    }

    if (style.fontSize?.magnitude) {
      textStyleAttrs.fontSize = `${style.fontSize.magnitude}pt`;
    }

    if (style.foregroundColor?.color?.rgbColor) {
      const rgb = style.foregroundColor.color.rgbColor;
      const r = Math.round((rgb.red || 0) * 255);
      const g = Math.round((rgb.green || 0) * 255);
      const b = Math.round((rgb.blue || 0) * 255);
      textStyleAttrs.color = `rgb(${r}, ${g}, ${b})`;
    }

    if (Object.keys(textStyleAttrs).length > 0) {
      marks.push({
        type: 'textStyle',
        attrs: textStyleAttrs,
      });
    }

    return marks;
  }

  // ============= EXPORT METHODS =============

  /**
   * List folders in Google Drive
   */
  async listFolders(parentId?: string): Promise<GoogleDriveFile[]> {
    const query = parentId 
      ? `mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
      : `mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;
    
    const params = new URLSearchParams({
      q: query,
      fields: 'files(id,name,mimeType,modifiedTime,createdTime)',
      orderBy: 'name',
      pageSize: '100',
    });

    const data = await this.makeRequest<{ files: GoogleDriveFile[] }>(
      `${DRIVE_API_BASE}/files?${params.toString()}`
    );

    return data.files || [];
  }

  /**
   * Create a new Google Doc in a specific folder
   */
  async createDocument(title: string, folderId?: string): Promise<{ documentId: string; webViewLink: string }> {
    const accessToken = googleAuthService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    if (!window.electronAPI?.googleApiPost) {
      throw new Error('Electron API not available');
    }

    // Create the document in Drive first
    const metadata: any = {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    const createResult = await window.electronAPI.googleApiPost<{
      id: string;
      webViewLink: string;
    }>({
      url: `${DRIVE_API_BASE}/files`,
      accessToken,
      body: JSON.stringify(metadata),
    });

    return {
      documentId: createResult.id,
      webViewLink: createResult.webViewLink || `https://docs.google.com/document/d/${createResult.id}/edit`,
    };
  }

  /**
   * Clear all content from a Google Doc (to prepare for update)
   */
  async clearDocument(documentId: string, tabId?: string): Promise<void> {
    // Get the document to find its content length
    const doc = await this.getDocument(documentId);
    
    // Find the content end index
    let endIndex = 1;
    if (tabId) {
      const tab = (doc as any).tabs?.find((t: any) => t.tabProperties?.tabId === tabId);
      if (tab?.documentTab?.body?.content) {
        const lastElement = tab.documentTab.body.content[tab.documentTab.body.content.length - 1];
        endIndex = lastElement?.endIndex || 1;
      }
    } else {
      // Default tab
      const body = (doc as any).body || (doc as any).tabs?.[0]?.documentTab?.body;
      if (body?.content) {
        const lastElement = body.content[body.content.length - 1];
        endIndex = lastElement?.endIndex || 1;
      }
    }

    // Only delete if there's content (endIndex > 2 because of trailing newline)
    if (endIndex > 2) {
      const deleteRequest: any = {
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: endIndex - 1,
          },
        },
      };
      
      if (tabId) {
        deleteRequest.deleteContentRange.range.tabId = tabId;
      }
      
      await this.batchUpdateDocument(documentId, [deleteRequest]);
    }
  }

  /**
   * Sync (update) an existing Google Doc with new content
   */
  async syncToGoogleDoc(
    documentId: string,
    title: string,
    chapters: Array<{ title: string; content: TipTapContent }>,
    references: {
      characters?: string;
      locations?: string;
      timeline?: string;
      summaries?: string;
    },
    onProgress?: (message: string) => void,
    fontSettings?: {
      titleFont: string;
      titleFontSize: number;
      bodyFont: string;
      bodyFontSize: number;
    }
  ): Promise<{ documentId: string; webViewLink: string }> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const API_DELAY = 1500;

    onProgress?.('Preparing to sync...');
    
    // Get the document to find tabs
    const docInfo = await this.getDocument(documentId);
    const tabs = (docInfo as any).tabs || [];
    const mainTab = tabs[0];
    const mainTabId = mainTab?.tabProperties?.tabId;

    // Clear and update main tab content
    onProgress?.('Clearing existing content...');
    await this.clearDocument(documentId, mainTabId);
    await delay(API_DELAY);

    // Build main content requests
    const mainRequests: any[] = [];
    let currentIndex = 1;

    // Add chapters with page breaks
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      onProgress?.(`Syncing chapter ${i + 1} of ${chapters.length}: ${chapter.title}`);

      if (i > 0) {
        mainRequests.push({
          insertPageBreak: {
            location: { index: currentIndex, ...(mainTabId && { tabId: mainTabId }) },
          },
        });
        currentIndex += 1;
      }

      const contentResult = this.convertTipTapToGoogleDocsWithTab(chapter.content, currentIndex, mainTabId, fontSettings);
      mainRequests.push(...contentResult.requests);
      currentIndex = contentResult.endIndex;
    }

    // Apply main content in batches
    onProgress?.('Uploading content...');
    const BATCH_SIZE = 500;
    for (let i = 0; i < mainRequests.length; i += BATCH_SIZE) {
      const batch = mainRequests.slice(i, i + BATCH_SIZE);
      await this.batchUpdateDocument(documentId, batch);
      if (i + BATCH_SIZE < mainRequests.length) {
        await delay(API_DELAY);
      }
    }

    // Add reference sections to the document (after all chapters)
    const referenceSections = [
      { key: 'characters', title: '📚 CHARACTERS', content: references.characters },
      { key: 'locations', title: '📍 LOCATIONS', content: references.locations },
      { key: 'timeline', title: '⏱️ TIMELINE', content: references.timeline },
      { key: 'summaries', title: '📝 CHAPTER SUMMARIES', content: references.summaries },
    ].filter(s => s.content && s.content.trim());

    if (referenceSections.length > 0) {
      onProgress?.('Adding reference sections...');
      await delay(API_DELAY);

      // Get current document to find the end index
      const currentDoc = await this.getDocument(documentId);
      const body = (currentDoc as any).body || (currentDoc as any).tabs?.[0]?.documentTab?.body;
      const lastElement = body?.content?.[body.content.length - 1];
      let appendIndex = lastElement?.endIndex ? lastElement.endIndex - 1 : currentIndex;

      const referenceRequests: any[] = [];
      
      // Page break before references
      referenceRequests.push({
        insertPageBreak: {
          location: { index: appendIndex, ...(mainTabId && { tabId: mainTabId }) },
        },
      });
      appendIndex += 1;

      // Add "REFERENCE MATERIALS" header
      const refHeader = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nREFERENCE MATERIALS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      referenceRequests.push({
        insertText: {
          location: { index: appendIndex, ...(mainTabId && { tabId: mainTabId }) },
          text: refHeader,
        },
      });
      appendIndex += refHeader.length;

      // Add each reference section
      for (let i = 0; i < referenceSections.length; i++) {
        const section = referenceSections[i];
        onProgress?.(`Adding section: ${section.title}`);

        if (i > 0) {
          referenceRequests.push({
            insertPageBreak: {
              location: { index: appendIndex, ...(mainTabId && { tabId: mainTabId }) },
            },
          });
          appendIndex += 1;
        }

        const sectionHeader = `\n${section.title}\n${'─'.repeat(40)}\n\n`;
        const headerStartIndex = appendIndex;
        referenceRequests.push({
          insertText: {
            location: { index: appendIndex, ...(mainTabId && { tabId: mainTabId }) },
            text: sectionHeader,
          },
        });
        
        referenceRequests.push({
          updateParagraphStyle: {
            range: { 
              startIndex: headerStartIndex + 1, 
              endIndex: headerStartIndex + section.title.length + 2,
              ...(mainTabId && { tabId: mainTabId })
            },
            paragraphStyle: { namedStyleType: 'HEADING_1' },
            fields: 'namedStyleType',
          },
        });

        if (fontSettings) {
          referenceRequests.push({
            updateTextStyle: {
              range: { 
                startIndex: headerStartIndex + 1, 
                endIndex: headerStartIndex + section.title.length + 1,
                ...(mainTabId && { tabId: mainTabId })
              },
              textStyle: {
                weightedFontFamily: { fontFamily: fontSettings.titleFont },
                fontSize: { magnitude: fontSettings.titleFontSize, unit: 'PT' },
              },
              fields: 'weightedFontFamily,fontSize',
            },
          });
        }
        appendIndex += sectionHeader.length;

        const sectionContent = section.content + '\n\n';
        const contentStartIndex = appendIndex;
        referenceRequests.push({
          insertText: {
            location: { index: appendIndex, ...(mainTabId && { tabId: mainTabId }) },
            text: sectionContent,
          },
        });

        if (fontSettings) {
          referenceRequests.push({
            updateTextStyle: {
              range: { 
                startIndex: contentStartIndex, 
                endIndex: contentStartIndex + sectionContent.length - 1,
                ...(mainTabId && { tabId: mainTabId })
              },
              textStyle: {
                weightedFontFamily: { fontFamily: fontSettings.bodyFont },
                fontSize: { magnitude: fontSettings.bodyFontSize, unit: 'PT' },
              },
              fields: 'weightedFontFamily,fontSize',
            },
          });
        }
        appendIndex += sectionContent.length;
      }

      // Apply reference section updates in batches
      for (let i = 0; i < referenceRequests.length; i += BATCH_SIZE) {
        const batch = referenceRequests.slice(i, i + BATCH_SIZE);
        await this.batchUpdateDocument(documentId, batch);
        if (i + BATCH_SIZE < referenceRequests.length) {
          await delay(API_DELAY);
        }
      }
    }

    onProgress?.('Sync complete!');
    return {
      documentId,
      webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
    };
  }

  /**
   * Convert TipTap to Google Docs with optional tab ID
   */
  private convertTipTapToGoogleDocsWithTab(
    content: TipTapContent,
    startIndex: number,
    tabId?: string,
    fontSettings?: {
      titleFont: string;
      titleFontSize: number;
      bodyFont: string;
      bodyFontSize: number;
    }
  ): { requests: any[]; endIndex: number } {
    const result = this.convertTipTapToGoogleDocs(content, startIndex, fontSettings);
    
    // Add tabId to all requests if provided
    if (tabId) {
      for (const req of result.requests) {
        if (req.insertText?.location) req.insertText.location.tabId = tabId;
        if (req.insertPageBreak?.location) req.insertPageBreak.location.tabId = tabId;
        if (req.updateParagraphStyle?.range) req.updateParagraphStyle.range.tabId = tabId;
        if (req.updateTextStyle?.range) req.updateTextStyle.range.tabId = tabId;
        if (req.createParagraphBullets?.range) req.createParagraphBullets.range.tabId = tabId;
      }
    }
    
    return result;
  }

  /**
   * Apply batch updates to a Google Doc
   */
  async batchUpdateDocument(documentId: string, requests: any[]): Promise<void> {
    const accessToken = googleAuthService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    if (!window.electronAPI?.googleApiPost) {
      throw new Error('Electron API not available');
    }

    await window.electronAPI.googleApiPost({
      url: `${DOCS_API_BASE}/documents/${documentId}:batchUpdate`,
      accessToken,
      body: JSON.stringify({ requests }),
    });
  }

  /**
   * Export book to Google Docs with chapters separated by page breaks
   * and reference documents as separate tabs
   */
  async exportBook(
    title: string,
    chapters: Array<{ title: string; content: TipTapContent }>,
    references: {
      characters?: string;
      locations?: string;
      timeline?: string;
      summaries?: string;
    },
    folderId?: string,
    onProgress?: (message: string) => void,
    fontSettings?: {
      titleFont: string;
      titleFontSize: number;
      bodyFont: string;
      bodyFontSize: number;
    }
  ): Promise<{ documentId: string; webViewLink: string }> {
    // Helper to add delay between API calls to avoid rate limits
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const API_DELAY = 1500;

    onProgress?.('Creating document...');
    
    // Create the main document
    const doc = await this.createDocument(title, folderId);
    await delay(API_DELAY);

    // Build requests for the main content
    const mainRequests: any[] = [];
    let currentIndex = 1; // Google Docs index starts at 1

    // Add chapters with page breaks between them
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      onProgress?.(`Adding chapter ${i + 1} of ${chapters.length}: ${chapter.title}`);

      // Add page break before chapter (except first)
      if (i > 0) {
        mainRequests.push({
          insertPageBreak: {
            location: { index: currentIndex },
          },
        });
        currentIndex += 1;
      }

      // Convert and add chapter content (title is already part of content)
      const contentResult = this.convertTipTapToGoogleDocs(chapter.content, currentIndex, fontSettings);
      mainRequests.push(...contentResult.requests);
      currentIndex = contentResult.endIndex;
    }

    // Apply main content updates in a single batch (larger batch size to reduce calls)
    onProgress?.('Uploading main content...');
    const BATCH_SIZE = 500; // Larger batch size to reduce API calls
    for (let i = 0; i < mainRequests.length; i += BATCH_SIZE) {
      const batch = mainRequests.slice(i, i + BATCH_SIZE);
      await this.batchUpdateDocument(doc.documentId, batch);
      if (i + BATCH_SIZE < mainRequests.length) {
        await delay(API_DELAY);
      }
    }

    // Add reference sections to the main document (after all chapters)
    // Google Docs API doesn't support creating tabs programmatically
    const referenceSections = [
      { key: 'characters', title: '📚 CHARACTERS', icon: '📚', content: references.characters },
      { key: 'locations', title: '📍 LOCATIONS', icon: '📍', content: references.locations },
      { key: 'timeline', title: '⏱️ TIMELINE', icon: '⏱️', content: references.timeline },
      { key: 'summaries', title: '📝 CHAPTER SUMMARIES', icon: '📝', content: references.summaries },
    ].filter(s => s.content && s.content.trim());

    if (referenceSections.length > 0) {
      onProgress?.('Adding reference sections...');
      await delay(API_DELAY);

      // Get current document to find the end index
      const currentDoc = await this.getDocument(doc.documentId);
      const body = (currentDoc as any).body || (currentDoc as any).tabs?.[0]?.documentTab?.body;
      const lastElement = body?.content?.[body.content.length - 1];
      let appendIndex = lastElement?.endIndex ? lastElement.endIndex - 1 : currentIndex;

      // Add a divider section before references
      const referenceRequests: any[] = [];
      
      // Page break before references
      referenceRequests.push({
        insertPageBreak: {
          location: { index: appendIndex },
        },
      });
      appendIndex += 1;

      // Add "REFERENCE MATERIALS" header
      const refHeader = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nREFERENCE MATERIALS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      referenceRequests.push({
        insertText: {
          location: { index: appendIndex },
          text: refHeader,
        },
      });
      appendIndex += refHeader.length;

      // Add each reference section
      for (let i = 0; i < referenceSections.length; i++) {
        const section = referenceSections[i];
        onProgress?.(`Adding section: ${section.title} (${i + 1}/${referenceSections.length})`);

        // Add page break between sections (not before the first one)
        if (i > 0) {
          referenceRequests.push({
            insertPageBreak: {
              location: { index: appendIndex },
            },
          });
          appendIndex += 1;
        }

        // Add section header
        const sectionHeader = `\n${section.title}\n${'─'.repeat(40)}\n\n`;
        const headerStartIndex = appendIndex;
        referenceRequests.push({
          insertText: {
            location: { index: appendIndex },
            text: sectionHeader,
          },
        });
        
        // Style the header as Heading 1
        referenceRequests.push({
          updateParagraphStyle: {
            range: { 
              startIndex: headerStartIndex + 1, 
              endIndex: headerStartIndex + section.title.length + 2 
            },
            paragraphStyle: { namedStyleType: 'HEADING_1' },
            fields: 'namedStyleType',
          },
        });

        // Apply title font to header
        if (fontSettings) {
          referenceRequests.push({
            updateTextStyle: {
              range: { 
                startIndex: headerStartIndex + 1, 
                endIndex: headerStartIndex + section.title.length + 1 
              },
              textStyle: {
                weightedFontFamily: { fontFamily: fontSettings.titleFont },
                fontSize: { magnitude: fontSettings.titleFontSize, unit: 'PT' },
              },
              fields: 'weightedFontFamily,fontSize',
            },
          });
        }
        appendIndex += sectionHeader.length;

        // Add section content
        const sectionContent = section.content + '\n\n';
        const contentStartIndex = appendIndex;
        referenceRequests.push({
          insertText: {
            location: { index: appendIndex },
            text: sectionContent,
          },
        });

        // Apply body font to content
        if (fontSettings) {
          referenceRequests.push({
            updateTextStyle: {
              range: { 
                startIndex: contentStartIndex, 
                endIndex: contentStartIndex + sectionContent.length - 1 
              },
              textStyle: {
                weightedFontFamily: { fontFamily: fontSettings.bodyFont },
                fontSize: { magnitude: fontSettings.bodyFontSize, unit: 'PT' },
              },
              fields: 'weightedFontFamily,fontSize',
            },
          });
        }
        appendIndex += sectionContent.length;
      }

      // Apply reference section updates in batches
      for (let i = 0; i < referenceRequests.length; i += BATCH_SIZE) {
        const batch = referenceRequests.slice(i, i + BATCH_SIZE);
        await this.batchUpdateDocument(doc.documentId, batch);
        if (i + BATCH_SIZE < referenceRequests.length) {
          await delay(API_DELAY);
        }
      }
    }

    onProgress?.('Export complete!');
    return doc;
  }

  /**
   * Convert TipTap content to Google Docs batch update requests
   */
  private convertTipTapToGoogleDocs(
    content: TipTapContent,
    startIndex: number,
    fontSettings?: {
      titleFont: string;
      titleFontSize: number;
      bodyFont: string;
      bodyFontSize: number;
    }
  ): { requests: any[]; endIndex: number } {
    const requests: any[] = [];
    let currentIndex = startIndex;

    if (!content.content) {
      return { requests, endIndex: currentIndex };
    }

    for (const node of content.content) {
      const nodeResult = this.convertTipTapNode(node, currentIndex, fontSettings);
      requests.push(...nodeResult.requests);
      currentIndex = nodeResult.endIndex;
    }

    return { requests, endIndex: currentIndex };
  }

  /**
   * Convert a single TipTap node to Google Docs requests
   */
  private convertTipTapNode(
    node: any,
    startIndex: number,
    fontSettings?: {
      titleFont: string;
      titleFontSize: number;
      bodyFont: string;
      bodyFontSize: number;
    }
  ): { requests: any[]; endIndex: number } {
    const requests: any[] = [];
    let currentIndex = startIndex;

    if (node.type === 'paragraph' || node.type === 'heading') {
      const textContent = this.extractPlainText(node);
      const text = textContent + '\n';
      const nodeStart = currentIndex;
      
      if (text.length > 1) { // More than just newline
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text,
          },
        });

        // Apply heading style if needed
        if (node.type === 'heading' && node.attrs?.level) {
          const headingLevel = Math.min(node.attrs.level, 6);
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + text.length,
              },
              paragraphStyle: {
                namedStyleType: `HEADING_${headingLevel}`,
              },
              fields: 'namedStyleType',
            },
          });
          
          // Apply title font to headings
          if (fontSettings) {
            requests.push({
              updateTextStyle: {
                range: {
                  startIndex: nodeStart,
                  endIndex: nodeStart + text.length - 1,
                },
                textStyle: {
                  weightedFontFamily: {
                    fontFamily: fontSettings.titleFont,
                  },
                  fontSize: {
                    magnitude: fontSettings.titleFontSize,
                    unit: 'PT',
                  },
                },
                fields: 'weightedFontFamily,fontSize',
              },
            });
          }
        } else if (node.type === 'paragraph' && fontSettings) {
          // Apply body font to paragraphs
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: nodeStart,
                endIndex: nodeStart + text.length - 1,
              },
              textStyle: {
                weightedFontFamily: {
                  fontFamily: fontSettings.bodyFont,
                },
                fontSize: {
                  magnitude: fontSettings.bodyFontSize,
                  unit: 'PT',
                },
              },
              fields: 'weightedFontFamily,fontSize',
            },
          });
        }

        // Apply text formatting (bold, italic, etc.)
        if (node.content) {
          let textOffset = 0;
          for (const textNode of node.content) {
            if (textNode.type === 'text' && textNode.marks) {
              const textLen = textNode.text?.length || 0;
              const formatRequests = this.createTextFormatRequests(
                textNode.marks,
                currentIndex + textOffset,
                currentIndex + textOffset + textLen
              );
              requests.push(...formatRequests);
            }
            textOffset += textNode.text?.length || 0;
          }
        }

        currentIndex += text.length;
      } else {
        // Empty paragraph - just add newline
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: '\n',
          },
        });
        currentIndex += 1;
      }
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      // Handle lists
      const listItems = node.content || [];
      for (const item of listItems) {
        if (item.type === 'listItem' && item.content) {
          for (const itemContent of item.content) {
            const text = this.extractPlainText(itemContent) + '\n';
            const listItemStart = currentIndex;
            requests.push({
              insertText: {
                location: { index: currentIndex },
                text,
              },
            });
            
            // Apply bullet/number formatting
            requests.push({
              createParagraphBullets: {
                range: {
                  startIndex: currentIndex,
                  endIndex: currentIndex + text.length,
                },
                bulletPreset: node.type === 'bulletList' 
                  ? 'BULLET_DISC_CIRCLE_SQUARE'
                  : 'NUMBERED_DECIMAL_NESTED',
              },
            });
            
            // Apply body font to list items
            if (fontSettings) {
              requests.push({
                updateTextStyle: {
                  range: {
                    startIndex: listItemStart,
                    endIndex: listItemStart + text.length - 1,
                  },
                  textStyle: {
                    weightedFontFamily: {
                      fontFamily: fontSettings.bodyFont,
                    },
                    fontSize: {
                      magnitude: fontSettings.bodyFontSize,
                      unit: 'PT',
                    },
                  },
                  fields: 'weightedFontFamily,fontSize',
                },
              });
            }
            
            currentIndex += text.length;
          }
        }
      }
    } else if (node.type === 'hardBreak') {
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n',
        },
      });
      currentIndex += 1;
    }

    return { requests, endIndex: currentIndex };
  }

  /**
   * Extract plain text from a TipTap node
   */
  private extractPlainText(node: any): string {
    if (node.type === 'text') {
      return node.text || '';
    }
    if (node.content) {
      return node.content.map((n: any) => this.extractPlainText(n)).join('');
    }
    return '';
  }

  /**
   * Create text formatting requests for Google Docs
   */
  private createTextFormatRequests(
    marks: any[],
    startIndex: number,
    endIndex: number
  ): any[] {
    const requests: any[] = [];
    
    for (const mark of marks) {
      if (mark.type === 'bold') {
        requests.push({
          updateTextStyle: {
            range: { startIndex, endIndex },
            textStyle: { bold: true },
            fields: 'bold',
          },
        });
      } else if (mark.type === 'italic') {
        requests.push({
          updateTextStyle: {
            range: { startIndex, endIndex },
            textStyle: { italic: true },
            fields: 'italic',
          },
        });
      } else if (mark.type === 'underline') {
        requests.push({
          updateTextStyle: {
            range: { startIndex, endIndex },
            textStyle: { underline: true },
            fields: 'underline',
          },
        });
      } else if (mark.type === 'strike') {
        requests.push({
          updateTextStyle: {
            range: { startIndex, endIndex },
            textStyle: { strikethrough: true },
            fields: 'strikethrough',
          },
        });
      } else if (mark.type === 'link' && mark.attrs?.href) {
        requests.push({
          updateTextStyle: {
            range: { startIndex, endIndex },
            textStyle: {
              link: { url: mark.attrs.href },
            },
            fields: 'link',
          },
        });
      }
    }

    return requests;
  }
}

export const googleDocsService = new GoogleDocsService();
