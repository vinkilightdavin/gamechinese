import "server-only";

export function clamp(value: unknown, maxLen: number): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

export const NPC_FIELD_LIMITS = {
  name: 60,
  nameZh: 60,
  emoji: 8,
  role: 300,
  goal: 300,
  greeting: 300,
};
