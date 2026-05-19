import type { RegionData } from './region';

export type MinigameMetrics = {
  attempts: number;
  clearTime: number; // seconds
};

export interface MinigameProps {
  stageId: number;
  regionData: RegionData;
  onComplete: (metrics?: Partial<MinigameMetrics>) => void;
  onFail?: () => void;
}

