/**
 * Motion helpers — unified entering/exiting presets.
 * Use these instead of ad-hoc duration/delay in components.
 */
import {
  FadeIn,
  FadeInDown,
  FadeInUp,
  type IEntryExitAnimationBuilder,
} from 'react-native-reanimated';

import { tokens } from './tokens';

const D = tokens.motion.duration;
const S = tokens.motion.stagger;

/** Empty state / list empty component */
export const enteringEmptyState = (): IEntryExitAnimationBuilder => FadeIn.duration(D.normal);

/** Skeleton placeholder */
export const enteringSkeleton = (): IEntryExitAnimationBuilder => FadeIn.duration(D.fast);

/** List item with optional stagger (cap at 3 levels) */
export const enteringListItem = (index = 0): IEntryExitAnimationBuilder =>
  FadeInDown.duration(D.normal).delay(Math.min(index, 3) * S.short);

/** Modal / Sheet content (bottom sheet style) */
export const enteringModalContent = (): IEntryExitAnimationBuilder => FadeInUp.duration(D.normal);

/** Modal / Sheet content (center dialog style) */
export const enteringDialogContent = (): IEntryExitAnimationBuilder => FadeInUp.duration(D.normal);
