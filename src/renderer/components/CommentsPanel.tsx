import React, { useState, useMemo, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { ChapterComment } from '../../shared/types';

// Icons
const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ClearAllIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SendToChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

// Comment type colors and labels
const commentTypeConfig: Record<ChapterComment['type'], { color: string; bg: string; label: string; icon: string }> = {
  suggestion: { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', label: 'Suggestion', icon: '💡' },
  issue: { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Issue', icon: '⚠️' },
  praise: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Strength', icon: '✨' },
  question: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', label: 'Question', icon: '❓' },
  note: { color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', label: 'Note', icon: '📝' },
};

const categoryLabels: Record<string, string> = {
  plot: 'Plot',
  character: 'Character',
  dialogue: 'Dialogue',
  pacing: 'Pacing',
  theme: 'Theme',
  style: 'Style',
  grammar: 'Grammar',
  general: 'General',
};

interface CommentsPanelProps {
  onClose?: () => void;
  /** When provided, enables "Send to Chat" on each comment; called with comment text and optional target text. */
  onSendToChat?: (commentText: string, targetText?: string) => void;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({ onClose, onSendToChat }) => {
  const { 
    book, 
    activeChapterId,
    resolveComment,
    deleteComment,
    clearChapterComments,
  } = useBookStore();
  
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [typeFilter, setTypeFilter] = useState<ChapterComment['type'] | 'all'>('all');

  const activeChapter = useMemo(() => {
    return book.chapters.find(c => c.id === activeChapterId);
  }, [book.chapters, activeChapterId]);

  const comments = useMemo(() => {
    if (!activeChapter) return [];
    const allComments = activeChapter.comments || [];
    
    return allComments.filter(c => {
      if (filter === 'unresolved' && c.resolved) return false;
      if (filter === 'resolved' && !c.resolved) return false;
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      return true;
    });
  }, [activeChapter, filter, typeFilter]);

  const commentCounts = useMemo(() => {
    if (!activeChapter) return { total: 0, unresolved: 0, resolved: 0 };
    const all = activeChapter.comments || [];
    return {
      total: all.length,
      unresolved: all.filter(c => !c.resolved).length,
      resolved: all.filter(c => c.resolved).length,
    };
  }, [activeChapter]);

  // Remove comment mark from the TipTap editor
  const removeCommentMarkFromEditor = (commentId: string) => {
    const editor = (window as any).__tiptapEditor;
    if (!editor) {
      console.log('[Comments] Editor not available to remove mark');
      return;
    }
    
    // Find the comment mark in the document and remove it
    const { doc, tr } = editor.state;
    let markRemoved = false;
    
    doc.descendants((node: any, pos: number) => {
      if (node.isText && node.marks) {
        const commentMark = node.marks.find((mark: any) => 
          mark.type.name === 'comment' && mark.attrs.commentId === commentId
        );
        
        if (commentMark) {
          // Remove the mark from this text range
          const from = pos;
          const to = pos + node.nodeSize;
          editor.chain()
            .setTextSelection({ from, to })
            .unsetMark('comment')
            .run();
          markRemoved = true;
          console.log(`[Comments] Removed mark for comment ${commentId} at pos ${from}-${to}`);
        }
      }
    });
    
    if (!markRemoved) {
      console.log(`[Comments] No mark found in editor for comment ${commentId}`);
    }
    
    // Reset selection
    editor.commands.setTextSelection(0);
  };
  
  // Remove all comment marks from editor
  const clearAllCommentMarksFromEditor = () => {
    const editor = (window as any).__tiptapEditor;
    if (!editor) return;
    
    // Select all and remove all comment marks
    editor.chain()
      .selectAll()
      .unsetMark('comment')
      .setTextSelection(0)
      .run();
    
    console.log('[Comments] Cleared all comment marks from editor');
  };

  const handleClearAll = () => {
    if (activeChapterId && confirm('Clear all comments from this chapter? This cannot be undone.')) {
      clearAllCommentMarksFromEditor();
      clearChapterComments(activeChapterId);
    }
  };

  const handleResolve = (commentId: string) => {
    if (activeChapterId) {
      // Remove the mark from the editor (resolved comments shouldn't be highlighted)
      removeCommentMarkFromEditor(commentId);
      resolveComment(activeChapterId, commentId);
    }
  };

  const handleDelete = (commentId: string) => {
    if (activeChapterId) {
      // Remove the mark from the editor first
      removeCommentMarkFromEditor(commentId);
      deleteComment(activeChapterId, commentId);
    }
  };

  const [reassessing, setReassessing] = useState<string | null>(null);

  const handleReassess = async (comment: ChapterComment) => {
    if (!activeChapterId || !comment.targetText) {
      alert('Cannot reassess: no target text reference.');
      return;
    }

    setReassessing(comment.id);

    try {
      // Get current text from the editor around the original target
      const editor = (window as any).__tiptapEditor;
      if (!editor) {
        alert('Editor not available');
        return;
      }

      // Get the full chapter text
      const chapterText = editor.getText();
      
      // Try multiple strategies to find the area around the original comment
      const originalText = comment.targetText;
      let currentContext = '';
      let foundOriginal = false;
      let searchStrategy = '';
      
      // Strategy 1: Try to find exact text (first 50 chars)
      const searchText1 = originalText.substring(0, Math.min(50, originalText.length)).toLowerCase();
      let idx = chapterText.toLowerCase().indexOf(searchText1);
      
      if (idx !== -1) {
        foundOriginal = true;
        searchStrategy = 'exact match';
        const start = Math.max(0, idx - 200);
        const end = Math.min(chapterText.length, idx + originalText.length + 200);
        currentContext = chapterText.substring(start, end);
      } else {
        // Strategy 2: Try to find key words from the original
        const words = originalText.split(/\s+/).filter(w => w.length > 4);
        const keyWords = words.slice(0, 5).join(' ').toLowerCase();
        
        // Search for first few significant words together
        if (keyWords.length > 10) {
          const searchText2 = keyWords.substring(0, 30);
          idx = chapterText.toLowerCase().indexOf(searchText2);
          if (idx !== -1) {
            searchStrategy = 'keyword match';
            const start = Math.max(0, idx - 200);
            const end = Math.min(chapterText.length, idx + 400);
            currentContext = chapterText.substring(start, end);
          }
        }
        
        // Strategy 3: Search for sentence-ending punctuation near beginning
        if (!currentContext && originalText.length > 20) {
          const firstSentence = originalText.split(/[.!?]/)[0];
          if (firstSentence && firstSentence.length > 15) {
            const shortSearch = firstSentence.substring(0, 20).toLowerCase();
            idx = chapterText.toLowerCase().indexOf(shortSearch);
            if (idx !== -1) {
              searchStrategy = 'sentence start match';
              const start = Math.max(0, idx - 100);
              const end = Math.min(chapterText.length, idx + 500);
              currentContext = chapterText.substring(start, end);
            }
          }
        }
        
        // Strategy 4: Fallback - provide a wider context around where it might have been
        if (!currentContext) {
          searchStrategy = 'not found - providing broad context';
          // Provide more context when we can't find the original
          currentContext = chapterText.substring(0, Math.min(1500, chapterText.length));
        }
      }
      
      console.log('[Reassess] Search strategy:', searchStrategy);
      console.log('[Reassess] Found original text:', foundOriginal);
      console.log('[Reassess] Context length:', currentContext.length);

      // Call OpenAI to reassess - check both Electron store and localStorage
      let apiKey: string | null = null;
      let model: string = 'gpt-4o-mini';
      
      // Check if running in Electron
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          apiKey = await window.electronAPI.storeGet('openai-api-key') as string | null;
          const storedModel = await window.electronAPI.storeGet('openai-model');
          if (storedModel) model = storedModel as string;
        } catch (e) {
          console.error('[Comments] Error getting API key from Electron store:', e);
        }
      }
      
      // Fallback to localStorage
      if (!apiKey) {
        apiKey = localStorage.getItem('openai-api-key');
        const storedModel = localStorage.getItem('openai-model');
        if (storedModel) model = storedModel;
      }
      
      if (!apiKey) {
        alert('Please set your OpenAI API key in Settings first.');
        return;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: `You are a writing editor. You previously flagged an issue in a piece of writing. 
The author may have edited the text. Your job is to determine if the issue has been resolved.

IMPORTANT: 
- If the original text can no longer be found, this likely means it was edited or removed - consider this when assessing.
- If the feedback was about improving something and the text is now different/better, mark it resolved.
- Be generous - if there's reasonable evidence the author addressed the issue, mark it resolved.

Respond in JSON format:
{
  "resolved": true/false,
  "explanation": "Brief explanation of your assessment"
}`
            },
            {
              role: 'user',
              content: `ORIGINAL COMMENT/ISSUE:
Type: ${comment.type}
Category: ${comment.category || 'general'}
Feedback: ${comment.text}

ORIGINAL TEXT THAT WAS FLAGGED:
"${originalText}"

WAS ORIGINAL TEXT FOUND IN CURRENT DOCUMENT: ${foundOriginal ? 'YES - text still exists' : 'NO - text appears to have been edited or removed'}

CURRENT TEXT IN THAT AREA (search strategy: ${searchStrategy}):
"${currentContext}"

Based on this information, has the issue been resolved? Consider:
1. If the original text is gone, the author likely edited it
2. Look at the current text to see if the feedback was addressed
3. Be generous - give credit if the author made a reasonable effort to address the feedback`
            }
          ],
          temperature: 0.3
        })
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Parse the response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          
          if (result.resolved) {
            // Auto-resolve the comment
            resolveComment(activeChapterId, comment.id);
            removeCommentMarkFromEditor(comment.id);
            alert(`✅ Issue Resolved!\n\n${result.explanation}`);
          } else {
            alert(`❌ Issue Still Present\n\n${result.explanation}`);
          }
        } else {
          alert(`AI Response:\n\n${content}`);
        }
      } catch {
        alert(`AI Response:\n\n${content}`);
      }
    } catch (error) {
      console.error('Reassess error:', error);
      alert('Failed to reassess. Check console for details.');
    } finally {
      setReassessing(null);
    }
  };

  // Normalize text for searching (handle quote variations, whitespace, etc.)
  const normalizeForSearch = (text: string): string => {
    return text
      .replace(/[""„‟❝❞⹂〝〞＂]/g, '"')  // All types of double quotes
      .replace(/[''‚‛❛❜']/g, "'")        // All types of single quotes
      .replace(/[—–―]/g, '-')            // All types of dashes
      .replace(/…/g, '...')              // Ellipsis
      .replace(/\s+/g, ' ')              // Collapse whitespace
      .toLowerCase()
      .trim();
  };

  // Find text in editor by searching each node directly
  const findTextInEditor = (editor: any, searchText: string): { from: number; to: number } | null => {
    const { doc } = editor.state;
    const normalizedSearch = normalizeForSearch(searchText);
    const shortSearch = normalizedSearch.substring(0, Math.min(30, normalizedSearch.length));
    
    let foundPos: { from: number; to: number } | null = null;
    
    // Search through all text nodes
    doc.descendants((node: any, pos: number) => {
      if (foundPos) return false; // Already found
      
      if (node.isText) {
        const nodeText = node.text || '';
        const normalizedNode = normalizeForSearch(nodeText);
        
        // Check if this node contains our search text
        const idx = normalizedNode.indexOf(shortSearch);
        if (idx !== -1) {
          // Found! Calculate the actual position
          // idx is position in normalized text, need to map to original
          let originalIdx = 0;
          let normalizedIdx = 0;
          
          while (normalizedIdx < idx && originalIdx < nodeText.length) {
            const char = nodeText[originalIdx];
            const normalizedChar = normalizeForSearch(char);
            normalizedIdx += normalizedChar.length;
            originalIdx++;
          }
          
          foundPos = {
            from: pos + originalIdx,
            to: pos + Math.min(originalIdx + 40, nodeText.length)
          };
          console.log('[Comments] Found in node at pos', pos, 'offset', originalIdx, '-> editor pos', foundPos);
        }
      }
    });
    
    return foundPos;
  };

  const scrollToComment = (commentId: string) => {
    console.log('[Comments] Click! commentId:', commentId);
    
    const comment = (activeChapter?.comments || []).find(c => c.id === commentId);
    console.log('[Comments] Found comment:', comment?.text?.substring(0, 30));
    
    if (!comment?.targetText) {
      alert('This comment has no location reference stored.');
      return;
    }
    
    const searchFor = comment.targetText.substring(0, 20).trim();
    console.log('[Comments] Searching for:', searchFor);
    
    // HIDE the entire AI panel temporarily
    const aiPanel = document.querySelector('.ai-panel') as HTMLElement;
    const originalDisplay = aiPanel?.style.display;
    if (aiPanel) {
      aiPanel.style.display = 'none';
    }
    
    // Focus editor
    const editorEl = document.querySelector('.ProseMirror') as HTMLElement;
    console.log('[Comments] Editor element:', !!editorEl);
    
    if (editorEl) {
      editorEl.focus();
    }
    
    window.getSelection()?.removeAllRanges();
    
    setTimeout(() => {
      console.log('[Comments] Executing search...');
      // @ts-ignore
      const found = window.find(searchFor, false, false, true, false, false, false);
      console.log('[Comments] Found:', found);
      
      // Show panel again
      if (aiPanel) {
        aiPanel.style.display = originalDisplay || '';
      }
      
      if (found) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const el = range.startContainer.parentElement;
          console.log('[Comments] Found element:', el?.tagName, el?.textContent?.substring(0, 30));
          if (el) {
            el.style.backgroundColor = 'yellow';
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              el.style.backgroundColor = '';
            }, 2500);
          }
        }
      } else {
        alert(`Could not find: "${searchFor}..."`);
      }
    }, 150);
  };
  
  const scrollToElement = (element: Element) => {
    // Scroll the editor container first
    const editorContainer = document.querySelector('.editor-scroll-area');
    if (editorContainer) {
      const elementRect = element.getBoundingClientRect();
      const containerRect = editorContainer.getBoundingClientRect();
      const scrollTop = elementRect.top - containerRect.top + editorContainer.scrollTop - (containerRect.height / 2);
      editorContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
    
    // Also use scrollIntoView as fallback
    setTimeout(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    // Flash highlight
    element.classList.add('comment-flash');
    setTimeout(() => element.classList.remove('comment-flash'), 2000);
  };

  // Clean up orphaned comment marks (marks in editor without matching comment data)
  const cleanupOrphanedMarks = () => {
    const editor = (window as any).__tiptapEditor;
    if (!editor) return 0;
    
    const commentIds = new Set((activeChapter?.comments || []).map(c => c.id));
    const { doc } = editor.state;
    const orphanedRanges: { from: number; to: number }[] = [];
    
    // Find all comment marks that don't have matching comment data
    doc.descendants((node: any, pos: number) => {
      if (node.isText && node.marks) {
        node.marks.forEach((mark: any) => {
          if (mark.type.name === 'comment' && !commentIds.has(mark.attrs.commentId)) {
            orphanedRanges.push({ from: pos, to: pos + node.nodeSize });
          }
        });
      }
    });
    
    // Remove orphaned marks (in reverse to preserve positions)
    orphanedRanges.reverse().forEach(({ from, to }) => {
      editor.chain()
        .setTextSelection({ from, to })
        .unsetMark('comment')
        .run();
    });
    
    if (orphanedRanges.length > 0) {
      editor.commands.setTextSelection(0);
      console.log(`[Comments] Cleaned up ${orphanedRanges.length} orphaned comment marks`);
    }
    
    return orphanedRanges.length;
  };
  
  // Re-apply comment marks for all comments with targetText
  const reapplyAllCommentMarks = (): number => {
    const editor = (window as any).__tiptapEditor;
    if (!editor || !activeChapter) return 0;
    
    const comments = activeChapter.comments || [];
    let appliedCount = 0;
    
    // First, clear all existing comment marks
    editor.chain().selectAll().unsetMark('comment').setTextSelection(0).run();
    
    for (const comment of comments) {
      if (!comment.targetText || comment.resolved) continue;
      
      const foundPos = findTextInEditor(editor, comment.targetText);
      
      if (foundPos) {
        editor.chain()
          .setTextSelection(foundPos)
          .setMark('comment', { commentId: comment.id, commentType: comment.type })
          .run();
        appliedCount++;
      }
    }
    
    editor.commands.setTextSelection(0);
    console.log(`[Comments] Re-applied ${appliedCount} of ${comments.length} comment marks`);
    return appliedCount;
  };

  // Auto-cleanup orphaned marks when panel opens or comments change
  useEffect(() => {
    if (activeChapter) {
      // Small delay to ensure editor is ready
      const timer = setTimeout(() => {
        const cleaned = cleanupOrphanedMarks();
        if (cleaned > 0) {
          console.log(`[Comments] Auto-cleaned ${cleaned} orphaned marks`);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeChapter?.id, activeChapter?.comments?.length]);

  if (!activeChapter) {
    return (
      <div className="comments-panel">
        <div className="comments-panel-header">
          <h3><CommentIcon /> Comments</h3>
        </div>
        <div className="comments-empty">
          <p>Select a chapter to view comments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="comments-panel">
      <div className="comments-panel-header">
        <h3><CommentIcon /> Comments</h3>
        <span className="comment-count">{commentCounts.unresolved} open</span>
      </div>

      {/* Filters */}
      <div className="comments-filters">
        <div className="filter-tabs">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All ({commentCounts.total})
          </button>
          <button 
            className={filter === 'unresolved' ? 'active' : ''} 
            onClick={() => setFilter('unresolved')}
          >
            Open ({commentCounts.unresolved})
          </button>
          <button 
            className={filter === 'resolved' ? 'active' : ''} 
            onClick={() => setFilter('resolved')}
          >
            Resolved ({commentCounts.resolved})
          </button>
        </div>
        
        <select 
          value={typeFilter} 
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="type-filter"
        >
          <option value="all">All Types</option>
          <option value="issue">⚠️ Issues</option>
          <option value="suggestion">💡 Suggestions</option>
          <option value="praise">✨ Strengths</option>
          <option value="question">❓ Questions</option>
          <option value="note">📝 Notes</option>
        </select>
      </div>

      {/* Comments List */}
      <div className="comments-list">
        {comments.length === 0 ? (
          <div className="comments-empty">
            <p>No comments yet</p>
            <small>Run StoryCraft assessment to get AI feedback on your chapter</small>
          </div>
        ) : (
          comments.map((comment) => {
            const config = commentTypeConfig[comment.type];
            return (
              <div 
                key={comment.id} 
                className={`comment-item ${comment.resolved ? 'resolved' : ''}`}
                onClick={() => scrollToComment(comment.id)}
                style={{ borderLeftColor: config.color }}
              >
                <div className="comment-item-header">
                  <span className="comment-type-badge" style={{ background: config.bg, color: config.color }}>
                    {config.icon} {config.label}
                  </span>
                  {comment.category && (
                    <span className="comment-category">
                      {categoryLabels[comment.category] || comment.category}
                    </span>
                  )}
                </div>
                <p className="comment-text">{comment.text}</p>
                {comment.targetText && (
                  <p className="comment-target-text" title={comment.targetText}>
                    📍 "{comment.targetText.substring(0, 50)}..."
                  </p>
                )}
                <div className="comment-actions">
                  {onSendToChat && (
                    <button
                      className="comment-action send-to-chat"
                      onClick={(e) => {
                        e.stopPropagation();
                        const text = comment.targetText
                          ? `Comment: ${comment.text}\n\nReferenced text: "${comment.targetText}"`
                          : comment.text;
                        onSendToChat(text, comment.targetText);
                      }}
                      title="Copy to chat and open Chat panel"
                    >
                      <SendToChatIcon /> Send to Chat
                    </button>
                  )}
                  {!comment.resolved && (
                    <>
                      <button 
                        className="comment-action reassess"
                        onClick={(e) => { e.stopPropagation(); handleReassess(comment); }}
                        title="Have AI check if this issue is resolved"
                        disabled={reassessing === comment.id}
                      >
                        {reassessing === comment.id ? '⏳ Checking...' : '🔄 Re-assess'}
                      </button>
                      <button 
                        className="comment-action resolve"
                        onClick={(e) => { e.stopPropagation(); handleResolve(comment.id); }}
                        title="Mark as resolved"
                      >
                        <CheckIcon /> Resolve
                      </button>
                    </>
                  )}
                  <button 
                    className="comment-action delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(comment.id); }}
                    title="Delete comment"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Buttons */}
      <div className="comments-footer">
        {commentCounts.total > 0 && (
          <>
            <button 
              className="reapply-btn" 
              onClick={() => {
                const applied = reapplyAllCommentMarks();
                alert(`Applied ${applied} comment highlight(s) to the document.`);
              }}
              title="Re-apply highlight marks for all comments"
            >
              🎨 Apply Highlights
            </button>
            <button className="clear-all-btn" onClick={handleClearAll}>
              <ClearAllIcon /> Clear All
            </button>
          </>
        )}
        <button 
          className="cleanup-btn" 
          onClick={() => {
            const cleaned = cleanupOrphanedMarks();
            if (cleaned === 0) {
              alert('No orphaned highlights found.');
            } else {
              alert(`Cleaned up ${cleaned} orphaned highlight(s).`);
            }
          }}
          title="Remove highlight marks that don't have matching comments"
        >
          🧹 Clean Up
        </button>
      </div>
    </div>
  );
};

export default CommentsPanel;

