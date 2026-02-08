import { openAIService } from './openaiService';
import { 
  PlotErrorAnalysis, 
  ChapterPlotAnalysis, 
  PlotError, 
  PlotErrorRole,
  PlotErrorType,
  PlotErrorSeverity,
  Chapter, 
  StoryCraftChapterFeedback,
  ChapterSummary,
  BookContextSettings
} from '../../shared/types';
import { generateId } from '../../shared/types';

interface ChapterWindow {
  chapters: Array<{
    chapter: Chapter;
    summary?: ChapterSummary;
    storyCraft?: StoryCraftChapterFeedback;
  }>;
  startIndex: number;
  endIndex: number;
}

interface AnalysisProgress {
  currentWindow: number;
  totalWindows: number;
  status: string;
}

/**
 * Plot Analysis Service
 * Orchestrates plot error analysis using sliding window approach
 */
export class PlotAnalysisService {
  private windowSize: number = 4; // Default: 4 chapters per window
  private windowOverlap: number = 1; // Default: 1 chapter overlap

  /**
   * Analyze book for plot errors using sliding window approach
   */
  async analyzeBookPlotErrors(
    bookId: string,
    chapters: Chapter[],
    summaries: ChapterSummary[],
    storyCraftFeedback: StoryCraftChapterFeedback[],
    bookContext: BookContextSettings,
    characters: Array<{ name: string; aliases?: string[] }>,
    locations: Array<{ name: string; type?: string }>,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<PlotErrorAnalysis> {
    // Sort chapters by order
    const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

    if (sortedChapters.length === 0) {
      throw new Error('No chapters to analyze');
    }

    // Create sliding windows
    const windows = this.createSlidingWindows(sortedChapters, summaries, storyCraftFeedback);

    // Accumulate results
    const allChapterAnalyses: Map<string, ChapterPlotAnalysis> = new Map();
    const allErrors: PlotError[] = [];
    const previousErrors: Array<{ type: string; description: string; affectedChapters: string[] }> = [];

    // Process each window
    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      
      if (onProgress) {
        onProgress({
          currentWindow: i + 1,
          totalWindows: windows.length,
          status: `Analyzing chapters ${window.startIndex + 1}-${window.endIndex + 1}...`,
        });
      }

      try {
        console.log(`[PlotAnalysis] Processing window ${i + 1}/${windows.length} (chapters ${window.startIndex + 1}-${window.endIndex + 1})`);
        
        // Prepare chapter data for this window
        const windowChapters = window.chapters.map(wc => ({
          chapterId: wc.chapter.id,
          chapterTitle: wc.chapter.title,
          order: wc.chapter.order,
          summary: wc.summary?.summary,
          storyCraftSummary: wc.storyCraft?.summary,
          storyCraftAssessment: wc.storyCraft?.assessment,
        }));

        console.log(`[PlotAnalysis] Calling OpenAI service for ${windowChapters.length} chapters...`);
        
        // Call OpenAI service
        const result = await openAIService.analyzePlotErrors(
          windowChapters,
          {
            genre: bookContext.genre,
            subGenres: bookContext.subGenres,
            targetDemographic: bookContext.targetDemographic,
            timePeriod: bookContext.timePeriod,
            year: bookContext.year,
            primaryLocation: bookContext.primaryLocation,
            characters,
            locations,
          },
          previousErrors.length > 0 ? previousErrors : undefined,
          100000 // max tokens per pass (o1 model limit is 100000)
        );

        // Process chapter analyses (merge if chapter appears in multiple windows)
        for (const analysis of result.chapterAnalyses) {
          const existing = allChapterAnalyses.get(analysis.chapterId);
          if (existing) {
            // Merge roles (unique) - cast strings to PlotErrorRole
            const newRoles = analysis.roles.map(r => r as PlotErrorRole);
            const mergedRoles = [...new Set([...existing.roles, ...newRoles])] as PlotErrorRole[];
            existing.roles = mergedRoles;
            // Update if new data is better
            if (analysis.proposedTitle && !existing.proposedTitle) {
              existing.proposedTitle = analysis.proposedTitle;
            }
            if (analysis.plotSummary && (!existing.plotSummary || analysis.plotSummary.length > existing.plotSummary.length)) {
              existing.plotSummary = analysis.plotSummary;
            }
            if (analysis.chapterTheme && (!existing.chapterTheme || analysis.chapterTheme.length > existing.chapterTheme.length)) {
              existing.chapterTheme = analysis.chapterTheme;
            }
          } else {
            // Create new analysis
            const chapter = window.chapters.find(wc => wc.chapter.id === analysis.chapterId)?.chapter;
            if (chapter) {
              allChapterAnalyses.set(analysis.chapterId, {
                id: generateId(),
                analysisId: '', // Will be set later
                chapterId: analysis.chapterId,
                chapterTitle: analysis.chapterTitle,
                proposedTitle: analysis.proposedTitle,
                roles: analysis.roles.map(r => r as PlotErrorRole) as PlotErrorRole[],
                plotSummary: analysis.plotSummary,
                chapterTheme: analysis.chapterTheme,
                order: chapter.order,
              });
            }
          }
        }

        // Process errors
        for (const error of result.errors) {
          allErrors.push({
            id: generateId(),
            analysisId: '', // Will be set later
            type: error.type as PlotErrorType,
            severity: error.severity as PlotErrorSeverity,
            description: error.description,
            context: error.context,
            affectedChapters: error.affectedChapters,
          });

          // Add to previous errors for next windows
          previousErrors.push({
            type: error.type,
            description: error.description,
            affectedChapters: error.affectedChapters,
          });
        }

        // Small delay between windows to avoid rate limiting
        if (i < windows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`[PlotAnalysis] Error processing window ${i + 1}/${windows.length}:`, error);
        console.error(`[PlotAnalysis] Error details:`, error instanceof Error ? error.message : String(error));
        // Continue with next window instead of failing completely
        // This allows partial results to be returned
        // Continue with next window even if one fails
      }
    }

    // Create final analysis object
    const analysisId = generateId();
    const now = new Date().toISOString();

    // Set analysisId for all chapter analyses and errors
    const finalChapterAnalyses = Array.from(allChapterAnalyses.values()).map(ca => ({
      ...ca,
      analysisId,
    }));

    const finalErrors = allErrors.map(e => ({
      ...e,
      analysisId,
    }));

    const analysis: PlotErrorAnalysis = {
      id: analysisId,
      bookId,
      modelUsed: 'o1-preview',
      generatedAt: now,
      lastUpdated: now,
      chapterAnalyses: finalChapterAnalyses,
      errors: finalErrors,
    };

    return analysis;
  }

  /**
   * Create sliding windows from chapters
   */
  private createSlidingWindows(
    chapters: Chapter[],
    summaries: ChapterSummary[],
    storyCraftFeedback: StoryCraftChapterFeedback[]
  ): ChapterWindow[] {
    const windows: ChapterWindow[] = [];
    const summaryMap = new Map(summaries.map(s => [s.chapterId, s]));
    const storyCraftMap = new Map(storyCraftFeedback.map(f => [f.chapterId, f]));

    let startIndex = 0;

    while (startIndex < chapters.length) {
      const endIndex = Math.min(startIndex + this.windowSize, chapters.length);
      const windowChapters = chapters.slice(startIndex, endIndex).map(chapter => ({
        chapter,
        summary: summaryMap.get(chapter.id),
        storyCraft: storyCraftMap.get(chapter.id),
      }));

      windows.push({
        chapters: windowChapters,
        startIndex,
        endIndex: endIndex - 1,
      });

      // Move window forward by (windowSize - overlap)
      startIndex += this.windowSize - this.windowOverlap;

      // Ensure we don't get stuck
      if (startIndex >= chapters.length) {
        break;
      }
    }

    return windows;
  }

  /**
   * Generate markdown outline from plot error analysis
   */
  generateOutline(analysis: PlotErrorAnalysis): string {
    const lines: string[] = [];

    lines.push('# Plot Error Analysis');
    lines.push('');
    lines.push(`**Generated:** ${new Date(analysis.generatedAt).toLocaleString()}`);
    lines.push(`**Model:** ${analysis.modelUsed}`);
    lines.push(`**Total Errors Found:** ${analysis.errors.length}`);
    lines.push('');

    // Sort chapter analyses by order
    const sortedAnalyses = [...analysis.chapterAnalyses].sort((a, b) => a.order - b.order);

    // Chapter outline
    lines.push('## Chapter Outline');
    lines.push('');
    lines.push('For each chapter, this outline provides:');
    lines.push('1. **Chapter Number**');
    lines.push('2. **Generated Chapter Title** (based on content)');
    lines.push('3. **Plot Role** (what the chapter is doing for the plot using plot frameworks)');
    lines.push('4. **Chapter Theme** (one sentence theme)');
    lines.push('');

    for (const chapterAnalysis of sortedAnalyses) {
      lines.push(`### ${chapterAnalysis.order}. ${chapterAnalysis.proposedTitle || chapterAnalysis.chapterTitle}`);
      
      // Show original title if different from proposed
      if (chapterAnalysis.proposedTitle && chapterAnalysis.proposedTitle !== chapterAnalysis.chapterTitle) {
        lines.push(`**Original Title:** ${chapterAnalysis.chapterTitle}`);
      }

      // Plot role (what the chapter is doing for the plot)
      if (chapterAnalysis.roles && chapterAnalysis.roles.length > 0) {
        lines.push(`**Plot Role:** ${chapterAnalysis.roles.join(', ')}`);
      }

      // Chapter theme (one sentence)
      if (chapterAnalysis.chapterTheme) {
        lines.push(`**Theme:** ${chapterAnalysis.chapterTheme}`);
      }

      // Plot summary (optional, for context)
      if (chapterAnalysis.plotSummary) {
        lines.push('');
        lines.push(`*Summary:* ${chapterAnalysis.plotSummary}`);
      }

      // Find errors for this chapter
      const chapterErrors = analysis.errors.filter(e => 
        e.affectedChapters.includes(chapterAnalysis.chapterId)
      );

      if (chapterErrors.length > 0) {
        lines.push('');
        lines.push(`**Errors Found:** ${chapterErrors.length}`);
        for (const error of chapterErrors) {
          lines.push(`- [${error.severity.toUpperCase()}] ${error.type}: ${error.description}`);
        }
      }

      lines.push('');
    }

    // Errors by type
    lines.push('## Errors by Type');
    lines.push('');

    const errorsByType = new Map<string, PlotError[]>();
    for (const error of analysis.errors) {
      if (!errorsByType.has(error.type)) {
        errorsByType.set(error.type, []);
      }
      errorsByType.get(error.type)!.push(error);
    }

    const errorTypeOrder = [
      'plot_hole',
      'timeline_mistake',
      'character_inconsistency',
      'name_mismatch',
      'location_mistake',
      'genre_problem',
      'feasibility_issue',
      'clarity_issue',
    ];

    for (const type of errorTypeOrder) {
      const errors = errorsByType.get(type);
      if (errors && errors.length > 0) {
        lines.push(`### ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} (${errors.length})`);
        lines.push('');

        // Sort by severity
        const severityOrder = ['critical', 'major', 'minor', 'suggestion'];
        const sortedErrors = errors.sort((a, b) => {
          const aIdx = severityOrder.indexOf(a.severity);
          const bIdx = severityOrder.indexOf(b.severity);
          return aIdx - bIdx;
        });

        for (const error of sortedErrors) {
          lines.push(`- **[${error.severity.toUpperCase()}]** ${error.description}`);
          if (error.context) {
            lines.push(`  - Context: ${error.context}`);
          }
          if (error.affectedChapters.length > 0) {
            const chapterTitles = error.affectedChapters.map(chId => {
              const ca = analysis.chapterAnalyses.find(c => c.chapterId === chId);
              return ca ? `Chapter ${ca.order}: ${ca.chapterTitle}` : chId;
            });
            lines.push(`  - Affects: ${chapterTitles.join(', ')}`);
          }
          lines.push('');
        }
      }
    }

    // Errors by severity
    lines.push('## Errors by Severity');
    lines.push('');

    const errorsBySeverity = new Map<string, PlotError[]>();
    for (const error of analysis.errors) {
      if (!errorsBySeverity.has(error.severity)) {
        errorsBySeverity.set(error.severity, []);
      }
      errorsBySeverity.get(error.severity)!.push(error);
    }

    for (const severity of ['critical', 'major', 'minor', 'suggestion']) {
      const errors = errorsBySeverity.get(severity);
      if (errors && errors.length > 0) {
        lines.push(`### ${severity.charAt(0).toUpperCase() + severity.slice(1)} (${errors.length})`);
        lines.push('');
        for (const error of errors) {
          lines.push(`- [${error.type}] ${error.description}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

export const plotAnalysisService = new PlotAnalysisService();
