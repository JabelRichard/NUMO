export type TimeScope = 'month' | 'ytd' | 'all';
export type MathOpFilter = 'all' | 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';

export interface DayWorkoutSummary {
  date: string;
  workoutsCount: number;
  problemsSolved: number;
  avgSpeed: number;
  accuracy: number;
}

export interface BestEffortMilestone {
  label: string;
  value: string;
  subValue?: string;
  date?: string;
}

export interface DetailedOpStats {
  mastery: {
    level: number;
    title: string;
    currentSolved: number;
    nextLevelSolved: number;
    progressPercent: number;
  };
  activity: {
    avgWorkoutsWeek: number;
    avgTimeWeekStr: string;
    avgSolvedWeek: number;
  };
  ytd: {
    workouts: number;
    timeStr: string;
    solved: number;
    accuracy: number;
  };
  allTime: {
    workouts: number;
    solved: number;
  };
  bestEfforts: BestEffortMilestone[];
}