export type FocusOperation = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';

export interface NextFocusRecommendation {
  targetOp: FocusOperation;
  heading: string;
  subheading: string;
}

export function getNextFocus(workouts: any[]): NextFocusRecommendation {
  if (!workouts || workouts.length === 0) {
    return {
      targetOp: 'mixed',
      heading: "Let's find your baseline.",
      subheading: 'Start with a balanced challenge so NUMO can learn how you solve.',
    };
  }

  const categories: Record<FocusOperation, { label: string; totalQ: number; correct: number; totalTimeMs: number }> = {
    addition: { label: 'Addition', totalQ: 0, correct: 0, totalTimeMs: 0 },
    subtraction: { label: 'Subtraction', totalQ: 0, correct: 0, totalTimeMs: 0 },
    multiplication: { label: 'Multiplication', totalQ: 0, correct: 0, totalTimeMs: 0 },
    division: { label: 'Division', totalQ: 0, correct: 0, totalTimeMs: 0 },
    mixed: { label: 'Mixed Challenge', totalQ: 0, correct: 0, totalTimeMs: 0 },
  };

  workouts.forEach((w) => {
    let rawOp = (w.operation || 'mixed').toLowerCase();
    if (rawOp === 'adaptive_mix') rawOp = 'mixed';
    if (!categories[rawOp as FocusOperation]) return;

    const opKey = rawOp as FocusOperation;
    categories[opKey].totalQ += Number(w.total_questions) || 0;
    categories[opKey].correct += Number(w.correct_answers) || 0;
    categories[opKey].totalTimeMs += Number(w.total_time) || 0;
  });

  const parsed = (Object.keys(categories) as FocusOperation[]).map((key) => {
    const data = categories[key];
    const acc = data.totalQ > 0 ? (data.correct / data.totalQ) * 100 : 0;
    const avgPace = data.totalQ > 0 ? data.totalTimeMs / data.totalQ / 1000 : 0;
    const friction = data.totalQ > 0 ? (100 - acc) * 1.4 + avgPace * 3.5 : -1;
    const mastery = data.totalQ > 0 ? acc * 0.7 + Math.max(0, 10 - avgPace) * 3 : 0;

    return {
      key,
      name: data.label,
      totalQ: data.totalQ,
      accuracy: acc,
      avgPace,
      frictionScore: friction,
      masteryScore: mastery,
    };
  });

  const eligibleOperations = parsed.filter((p) => p.totalQ >= 20);
  const unpracticedOps = parsed.filter((p) => p.totalQ < 10 && p.key !== 'mixed');

  // Case 1: 2 or more mature operations -> Target the weakest area
  if (eligibleOperations.length >= 2) {
    const sortedByMastery = [...eligibleOperations].sort((a, b) => b.masteryScore - a.masteryScore);
    const strongest = sortedByMastery[0];

    const sortedByFriction = [...eligibleOperations].sort((a, b) => b.frictionScore - a.frictionScore);
    const worstCandidate = sortedByFriction[0];

    if (worstCandidate.key !== strongest.key) {
      return {
        targetOp: worstCandidate.key,
        heading: `Let's strengthen your ${worstCandidate.name.toLowerCase()}.`,
        subheading: 'Recommended challenge to reinforce your fundamentals.',
      };
    }

    // If mature ops are balanced but unpracticed ops remain, introduce them
    if (unpracticedOps.length > 0) {
      const nextOp = unpracticedOps[0];
      return {
        targetOp: nextOp.key,
        heading: `Explore ${nextOp.name}`,
        subheading: `Try ${nextOp.name}`,
      };
    }

    return {
      targetOp: 'mixed',
      heading: "Let's test your all-around speed.",
      subheading: 'Take on a balanced challenge across all operations.',
    };
  }

  // Case 2: Exactly 1 mature operation (e.g. 2 mixed workouts finished)
  if (eligibleOperations.length === 1) {
    if (unpracticedOps.length > 0) {
      const nextOp = unpracticedOps[0];
      return {
        targetOp: nextOp.key,
        heading: `Explore ${nextOp.name}`,
        subheading: `Try ${nextOp.name}`,
      };
    }

    return {
      targetOp: 'mixed',
      heading: "Let's test your all-around speed.",
      subheading: 'Take on a balanced challenge across all operations.',
    };
  }

  // Case 3: Less than 20 questions total completed
  return {
    targetOp: 'mixed',
    heading: "Let's find your baseline.",
    subheading: 'Start with a balanced challenge so NUMO can learn how you solve.',
  };
}