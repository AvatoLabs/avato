/**
 * streak — Lightweight AsyncStorage-based usage statistics.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_STREAK = 'avato_streak';
const KEY_LAST_DATE = 'avato_last_usage_date';
const KEY_MSG_COUNT = 'avato_message_count';

function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    return Math.round(Math.abs(da - db) / 86_400_000);
}

/**
 * Record today's usage and update streak.
 */
export async function recordUsage(): Promise<void> {
    const today = todayStr();
    const lastDate = await AsyncStorage.getItem(KEY_LAST_DATE);

    if (lastDate === today) return; // already recorded today

    const streak = parseInt((await AsyncStorage.getItem(KEY_STREAK)) || '0', 10);

    if (lastDate && daysBetween(lastDate, today) === 1) {
        // Consecutive day
        await AsyncStorage.setItem(KEY_STREAK, String(streak + 1));
    } else if (!lastDate || daysBetween(lastDate, today) > 1) {
        // Gap — reset streak to 1
        await AsyncStorage.setItem(KEY_STREAK, '1');
    }

    await AsyncStorage.setItem(KEY_LAST_DATE, today);
}

/**
 * Return the consecutive usage day count.
 */
export async function getStreak(): Promise<number> {
    const val = await AsyncStorage.getItem(KEY_STREAK);
    return parseInt(val || '0', 10);
}

/**
 * Increment message count by 1 and return new total.
 */
export async function incrementMessageCount(): Promise<number> {
    const current = parseInt((await AsyncStorage.getItem(KEY_MSG_COUNT)) || '0', 10);
    const next = current + 1;
    await AsyncStorage.setItem(KEY_MSG_COUNT, String(next));
    return next;
}

/**
 * Return the cumulative message count.
 */
export async function getMessageCount(): Promise<number> {
    const val = await AsyncStorage.getItem(KEY_MSG_COUNT);
    return parseInt(val || '0', 10);
}
