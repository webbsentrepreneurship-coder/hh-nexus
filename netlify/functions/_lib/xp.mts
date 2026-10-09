import { getStore } from "@netlify/blobs";

export function xpStore() {
  return getStore("xp");
}

export interface XpRecord {
  totalXP: number;
  streak: number;
  lastLoginDate: string; // YYYY-MM-DD (UTC)
}

const BASE_LEVEL_XP = 100;
const LEVEL_GROWTH = 1.5;
const DAILY_XP_CAP = 256;

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00Z").getTime();
  const b = new Date(dateB + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

// XP awarded for the Nth consecutive login day (1-indexed): 2,4,8,16,32,64,128,256,256,256...
export function dayXP(streak: number): number {
  return Math.min(Math.pow(2, streak), DAILY_XP_CAP);
}

// Cumulative XP required to REACH a given level. Level 1 requires 0.
// Each level's increment is 1.5x the previous increment, starting at 100.
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let cumulative = 0;
  let increment = BASE_LEVEL_XP;
  for (let l = 2; l <= level; l++) {
    cumulative += increment;
    increment = Math.round(increment * LEVEL_GROWTH);
  }
  return cumulative;
}

export function levelForXP(totalXP: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXP) {
    level++;
    if (level > 500) break; // safety guard
  }
  const currentFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  return {
    level,
    xpIntoLevel: totalXP - currentFloor,
    xpForNextLevel: nextFloor - currentFloor,
  };
}

/**
 * Applies login-streak XP logic for a given email and returns the updated record
 * plus how much XP (if any) was just earned this call.
 * - Same UTC calendar day as last login: no XP awarded (idempotent, no double-dipping).
 * - Exactly one day after last login: streak continues, XP doubles (capped at 256).
 * - Any other gap (or first-ever login): streak resets to 1, XP = 2.
 */
export async function applyLoginXP(email: string): Promise<{ record: XpRecord; xpEarned: number }> {
  const store = xpStore();
  const existing = (await store.get(email, { type: "json" })) as XpRecord | null;
  const today = todayUTC();

  if (!existing) {
    const record: XpRecord = { totalXP: dayXP(1), streak: 1, lastLoginDate: today };
    await store.setJSON(email, record);
    return { record, xpEarned: record.totalXP };
  }

  const gap = daysBetween(existing.lastLoginDate, today);

  if (gap === 0) {
    // Already logged in today — no additional XP, return as-is.
    return { record: existing, xpEarned: 0 };
  }

  const newStreak = gap === 1 ? existing.streak + 1 : 1;
  const earned = dayXP(newStreak);
  const record: XpRecord = {
    totalXP: existing.totalXP + earned,
    streak: newStreak,
    lastLoginDate: today,
  };
  await store.setJSON(email, record);
  return { record, xpEarned: earned };
}
