import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ComfortLevel, FrictionArea } from '../types/profile';
import type { OnboardingPrimaryGoal } from '../utils/onboardingDraft';

// Plan choices shared by onboarding and the Profile "Your plan" section,
// so both screens use the same names and wording.

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const GOALS: { id: OnboardingPrimaryGoal; icon: IoniconName; title: string; desc: string }[] = [
  {
    id: 'everyday',
    icon: 'cart-outline',
    title: 'Everyday Quick Math',
    desc: 'Shopping, tips, discounts and splitting bills.',
  },
  {
    id: 'school',
    icon: 'school-outline',
    title: 'School & Homework',
    desc: 'Get faster and more confident for class and tests.',
  },
  {
    id: 'memory',
    icon: 'bulb-outline',
    title: 'Sharper Focus & Memory',
    desc: 'Keep your mind quick and sharp.',
  },
  {
    id: 'work',
    icon: 'briefcase-outline',
    title: 'Work & Exams',
    desc: 'Fast math for interviews, exams and meetings.',
  },
];

// Math operations show their symbol; the others use an icon.
export const WEAK_SPOTS: {
  id: FrictionArea;
  symbol?: string;
  icon?: IoniconName;
  title: string;
  desc: string;
}[] = [
  { id: 'addition', symbol: '+', title: 'Adding', desc: 'Sums with carrying.' },
  { id: 'subtraction', symbol: '−', title: 'Subtracting', desc: 'Borrowing between numbers.' },
  { id: 'multiplication', symbol: '×', title: 'Multiplying', desc: 'Times tables like 7s, 8s and 12s.' },
  { id: 'division', symbol: '÷', title: 'Dividing', desc: 'Splitting numbers quickly.' },
  { id: 'mixed', icon: 'shuffle', title: 'Mixing them up', desc: 'Switching between operations.' },
];

export const NOT_SURE_OPTION = {
  icon: 'help-circle-outline' as IoniconName,
  title: 'Not sure, test me',
  desc: "We'll find out with a short warm-up.",
};

export const COMFORT_LEVELS: { id: ComfortLevel; icon: IoniconName; title: string; desc: string }[] = [
  {
    id: 'starting',
    icon: 'leaf-outline',
    title: 'Just starting',
    desc: "I'd like to begin with easy questions.",
  },
  {
    id: 'getting_there',
    icon: 'trending-up-outline',
    title: 'Getting there',
    desc: "I'm okay, but want to get quicker.",
  },
  {
    id: 'confident',
    icon: 'trophy-outline',
    title: 'Confident',
    desc: 'Give me a challenge.',
  },
];
