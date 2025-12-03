import { useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useChaptersStore } from '../stores/chaptersStore';
import { useEditorStore } from '../stores/editorStore';
import { electronAPI } from '../utils/electronAPI';
import { useStoryElementsStore } from '../stores/storyElementsStore';

export const useProjectPersistence = () => {
  const { currentFilePath } = useProjectStore();

  useEffect(() => {
    // Auto-load project if there's a saved file path
    const loadSavedProject = async () => {
      const filePath = useProjectStore.getState().currentFilePath;
      if (filePath) {
        try {
          const projectData = await electronAPI.loadProject(filePath);
          
          // Restore chapters if available
          if (projectData.chapters && projectData.chapters.length > 0) {
            useChaptersStore.getState().setChapters(projectData.chapters);
            // Set first chapter as current
            if (projectData.chapters.length > 0) {
              const firstChapter = projectData.chapters[0];
              useChaptersStore.getState().setCurrentChapter(firstChapter.id);
              // Use setTimeout to ensure state updates complete
              setTimeout(() => {
                useEditorStore.getState().setLoadingChapter(true);
                useEditorStore.getState().setContent(firstChapter.content || '');
                useEditorStore.getState().setHtmlContent(firstChapter.htmlContent || '');
                setTimeout(() => {
                  useEditorStore.getState().setLoadingChapter(false);
                }, 50);
              }, 100);
            }
          } else {
            // Legacy format: single content
            useChaptersStore.getState().setChapters([]);
            if (projectData.htmlContent) {
              useEditorStore.getState().setHtmlContent(projectData.htmlContent);
              useEditorStore.getState().setMode('wysiwyg');
            } else if (projectData.content) {
              useEditorStore.getState().setContent(projectData.content);
              useEditorStore.getState().setMode('markdown');
            }
          }

          // Restore story elements if available
          if (projectData.storyElements) {
            useStoryElementsStore.getState().setElements(projectData.storyElements);
          }

          // Restore metadata
          if (projectData.metadata) {
            useProjectStore.getState().setMetadata(projectData.metadata);
          }
        } catch (error) {
          console.error('Failed to auto-load project:', error);
        }
      }
    };

    loadSavedProject();
  }, []); // Only run once on mount

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // Save current chapter content
      const currentChapter = useChaptersStore.getState().getCurrentChapter();
      if (currentChapter) {
        const { content, htmlContent } = useEditorStore.getState();
        useChaptersStore.getState().updateChapter(currentChapter.id, {
          content,
          htmlContent,
        });
      }

      // Auto-save project if file path exists
      if (currentFilePath) {
        try {
          const { content, htmlContent, mode } = useEditorStore.getState();
          const { metadata } = useProjectStore.getState();
          const { chapters } = useChaptersStore.getState();
          const { characters, locations, dates, themes } = useStoryElementsStore.getState();

          const projectData = {
            metadata: {
              ...metadata,
              updatedAt: new Date().toISOString(),
            },
            storyElements: {
              characters,
              locations,
              dates,
              themes,
            },
            chapters: chapters.length > 0 ? chapters : undefined,
            ...(chapters.length === 0 && {
              content: mode === 'markdown' ? content : '',
              htmlContent: mode === 'wysiwyg' ? htmlContent : undefined,
            }),
          };

          await electronAPI.saveProject(currentFilePath, projectData);
        } catch (error) {
          console.error('Failed to auto-save on unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentFilePath]);
};

