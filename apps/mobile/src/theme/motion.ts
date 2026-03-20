/**
 * Motion helpers — unified entering/exiting presets.
 * Use these instead of ad-hoc duration/delay in components.
 */
import { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { tokens } from './tokens';

const D = tokens.motion.duration;
const S = tokens.motion.stagger;

/** Empty state / list empty component */
export const enteringEmptyState = () => FadeIn.duration(D.normal);

/** Skeleton placeholder */
export const enteringSkeleton = () => FadeIn.duration(D.fast);

/** List item with optional stagger (cap at 3 levels) */
export const enteringListItem = (index = 0) =>
  FadeInDown.duration(D.normal).delay(Math.min(index, 3) * S.short);

/** Screen / section block */
export const enteringSection = (delay = 0) => FadeInDown.duration(D.normal).delay(delay);

/** Modal / Sheet content (bottom sheet style) */
export const enteringModalContent = () => FadeInUp.duration(D.normal);

/** Modal / Sheet content (center dialog style) */
export const enteringDialogContent = () => FadeInUp.duration(D.normal);
