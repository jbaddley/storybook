import { useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { useChaptersStore } from '../stores/chaptersStore';
import { useStoryElementsStore } from '../stores/storyElementsStore';
import { electronAPI, ProjectData } from '../utils/electronAPI';

export const useFileOperations = () => {
  const { content, htmlContent, mode, syncWithChapter } = useEditorStore();
  const { currentFilePath, metadata, setCurrentFilePath, setMetadata } = useProjectStore();
  const { chapters, getCurrentChapter } = useChaptersStore();
  const { characters, locations, dates, themes } = useStoryElementsStore();

  const saveProject = useCallback(async () => {
    // Save current chapter content before saving
    const currentChapter = getCurrentChapter();
    if (currentChapter) {
      useChaptersStore.getState().updateChapter(currentChapter.id, {
        content,
        htmlContent,
      });
    }

    let filePath: string | null = currentFilePath;
    
    if (!filePath) {
      const newFilePath = await electronAPI.showSaveDialog();
      if (!newFilePath) return;
      filePath = newFilePath;
      setCurrentFilePath(newFilePath);
    }

    if (!filePath) return; // Type guard

    const projectData: ProjectData = {
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
      // Legacy support: if no chapters, save as single content
      ...(chapters.length === 0 && {
        content: mode === 'markdown' ? content : '',
        htmlContent: mode === 'wysiwyg' ? htmlContent : undefined,
      }),
    };

    await electronAPI.saveProject(filePath, projectData);
  }, [content, htmlContent, mode, currentFilePath, metadata, setCurrentFilePath, chapters, getCurrentChapter, characters, locations, dates, themes]);

  const openProject = useCallback(async () => {
    const filePath = await electronAPI.showOpenDialog();
    if (!filePath) return;

    const projectData = await electronAPI.loadProject(filePath);
    
    setCurrentFilePath(filePath || null);
    setMetadata(projectData.metadata);
    
    // Restore chapters if available (new format)
    if (projectData.chapters && projectData.chapters.length > 0) {
      useChaptersStore.getState().setChapters(projectData.chapters);
      // Set first chapter as current
      if (projectData.chapters.length > 0) {
        useChaptersStore.getState().setCurrentChapter(projectData.chapters[0].id);
        syncWithChapter();
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
  }, [setCurrentFilePath, setMetadata, syncWithChapter]);

  const newProject = useCallback(() => {
    setCurrentFilePath(null);
    setMetadata({
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    useChaptersStore.getState().setChapters([]);
    useChaptersStore.getState().setCurrentChapter(null);
    useEditorStore.getState().setContent('');
    useEditorStore.getState().setHtmlContent('');
    useStoryElementsStore.getState().clearAll();
  }, [setCurrentFilePath, setMetadata]);

  return {
    saveProject,
    openProject,
    newProject,
  };
};

