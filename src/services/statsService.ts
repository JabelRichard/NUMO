import { supabase } from '../config/supabase';
import { DayWorkoutSummary, DetailedOpStats, MathOpFilter, BestEffortMilestone } from '../types/stats';

const formatTimeStr = (ms: number) => {
  if (!ms || ms === 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const getMasteryTier = (solved: number) => {
  if (solved < 100) return { level: 1, title: 'Novice', nextLevelSolved: 100 };
  if (solved < 500) return { level: 2, title: 'Apprentice', nextLevelSolved: 500 };
  if (solved < 1500) return { level: 3, title: 'Practitioner', nextLevelSolved: 1500 };
  if (solved < 4000) return { level: 4, title: 'Expert', nextLevelSolved: 4000 };
  return { level: 5, title: 'Master', nextLevelSolved: 10000 };
};

export const fetchAllWorkouts = async (userId: string) => {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const calculateStats = (
  sessions: any[],
  viewYear: number,
  viewMonth: number
): {
  dailyMap: Record<number, DayWorkoutSummary>;
  detailedStats: Record<MathOpFilter, DetailedOpStats>;
} => {
  const dailyMap: Record<number, DayWorkoutSummary> = {};
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1).getTime();
  const weeksThisYear = Math.max(1, Math.ceil((Date.now() - startOfYear) / (1000 * 60 * 60 * 24 * 7)));

  const defaultBucket = () => ({
    ytdSolved: 0,
    ytdTime: 0,
    ytdCorrect: 0,
    ytdWorkouts: 0,
    allSolved: 0,
    allWorkouts: 0,
    fastestPaceMs: 999999,
    best10SprintMs: 999999,
    maxSessionScore: 0,
  });

  const ops: Record<MathOpFilter, ReturnType<typeof defaultBucket>> = {
    all: defaultBucket(),
    addition: defaultBucket(),
    subtraction: defaultBucket(),
    multiplication: defaultBucket(),
    division: defaultBucket(),
    mixed: defaultBucket(),
  };

  sessions.forEach((s) => {
    const d = new Date(s.completed_at);
    const sYear = d.getFullYear();
    const sMonth = d.getMonth();
    const isCurrentYear = sYear === currentYear;

    const solved = s.total_questions || 0;
    const correct = s.correct_answers || 0;
    const timeMs = s.total_time || 0;
    const avgPaceMs = s.average_time_per_question || (solved > 0 ? timeMs / solved : 0);
    const opKey = (s.operation || 'addition').toLowerCase() as MathOpFilter;

    // Build Calendar Map for viewed month
    if (sYear === viewYear && sMonth === viewMonth) {
      const day = d.getUTCDate();
      if (!dailyMap[day]) {
        dailyMap[day] = { date: s.completed_at.split('T')[0], workoutsCount: 0, problemsSolved: 0, avgSpeed: 0, accuracy: 0 };
      }
      dailyMap[day].workoutsCount += 1;
      dailyMap[day].problemsSolved += solved;
      dailyMap[day].avgSpeed = avgPaceMs > 0 ? parseFloat((avgPaceMs / 1000).toFixed(1)) : 0;
      dailyMap[day].accuracy = solved > 0 ? Math.round((correct / solved) * 100) : 0;
    }

    // Process bucket records
    const processBucket = (b: ReturnType<typeof defaultBucket>) => {
      b.allWorkouts += 1;
      b.allSolved += solved;
      if (avgPaceMs > 0 && avgPaceMs < b.fastestPaceMs) b.fastestPaceMs = avgPaceMs;
      if (correct > b.maxSessionScore) b.maxSessionScore = correct;

      // 10-Problem sprint benchmark
      if (solved >= 10) {
        const est10SprintMs = avgPaceMs * 10;
        if (est10SprintMs < b.best10SprintMs) b.best10SprintMs = est10SprintMs;
      }

      if (isCurrentYear) {
        b.ytdWorkouts += 1;
        b.ytdSolved += solved;
        b.ytdCorrect += correct;
        b.ytdTime += timeMs;
      }
    };

    processBucket(ops.all);
    if (ops[opKey]) processBucket(ops[opKey]);
  });

  const detailedStats = {} as Record<MathOpFilter, DetailedOpStats>;

  (Object.keys(ops) as MathOpFilter[]).forEach((key) => {
    const b = ops[key];
    const tier = getMasteryTier(b.allSolved);
    const prevTierSolved = tier.level === 1 ? 0 : [0, 0, 100, 500, 1500, 4000][tier.level];
    const progressPercent = Math.min(
      100,
      Math.max(5, Math.round(((b.allSolved - prevTierSolved) / (tier.nextLevelSolved - prevTierSolved)) * 100))
    );

    const bestEfforts: BestEffortMilestone[] = [
      {
        label: '10-Problem Sprint',
        value: b.best10SprintMs === 999999 ? '—' : `${(b.best10SprintMs / 1000).toFixed(1)}s`,
        subValue: 'Fastest 10 streak',
      },
      {
        label: 'Best Reaction Pace',
        value: b.fastestPaceMs === 999999 ? '—' : `${(b.fastestPaceMs / 1000).toFixed(2)}s`,
        subValue: 'Avg per question',
      },
      {
        label: 'Single Session High',
        value: b.maxSessionScore > 0 ? `${b.maxSessionScore} Correct` : '—',
        subValue: 'Max in one round',
      },
    ];

    detailedStats[key] = {
      mastery: {
        level: tier.level,
        title: tier.title,
        currentSolved: b.allSolved,
        nextLevelSolved: tier.nextLevelSolved,
        progressPercent: isNaN(progressPercent) ? 0 : progressPercent,
      },
      activity: {
        avgWorkoutsWeek: Math.round(b.ytdWorkouts / weeksThisYear),
        avgTimeWeekStr: formatTimeStr(b.ytdTime / weeksThisYear),
        avgSolvedWeek: Math.round(b.ytdSolved / weeksThisYear),
      },
      ytd: {
        workouts: b.ytdWorkouts,
        timeStr: formatTimeStr(b.ytdTime),
        solved: b.ytdSolved,
        accuracy: b.ytdSolved > 0 ? Math.round((b.ytdCorrect / b.ytdSolved) * 100) : 0,
      },
      allTime: {
        workouts: b.allWorkouts,
        solved: b.allSolved,
      },
      bestEfforts,
    };
  });

  return { dailyMap, detailedStats };
};