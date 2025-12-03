import { create } from 'zustand';
import { ConsistencyIssue } from '../services/consistency/checker';
import { PlotHole } from '../services/plot/analyzer';

interface AnalysisState {
  consistencyIssues: ConsistencyIssue[];
  plotHoles: PlotHole[];
  setConsistencyIssues: (issues: ConsistencyIssue[]) => void;
  setPlotHoles: (holes: PlotHole[]) => void;
  clearAll: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  consistencyIssues: [],
  plotHoles: [],
  setConsistencyIssues: (issues) => set({ consistencyIssues: issues }),
  setPlotHoles: (holes) => set({ plotHoles: holes }),
  clearAll: () => set({ consistencyIssues: [], plotHoles: [] }),
}));

