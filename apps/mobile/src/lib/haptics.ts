/**
 * Haptics — unified haptic feedback utilities.
 *
 * All components should use this module instead of importing expo-haptics directly.
 * This provides a single place to disable haptics globally if needed.
 */
import * as Haptics from 'expo-haptics';

export const haptics = {
    /** Subtle tap — send message, toggle, selection */
    light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    /** Medium press — long-press menu, swipe threshold */
    medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    /** Strong press — reserved for emphasis */
    heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    /** Positive outcome — copy, save, create */
    success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    /** Caution — delete confirmation, destructive action */
    warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    /** Failure — error toast */
    error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    /** Picker / tab switch */
    selection: () => Haptics.selectionAsync(),
};
