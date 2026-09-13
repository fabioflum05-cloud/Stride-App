// utils/oneRepMax.ts
// Geschätztes 1RM (Epley-Variante) — vorher identisch dupliziert in training.tsx,
// app/(tabs)/prs-muscles.tsx, app/prs.tsx sowie inline in profile.tsx, achievements.tsx
// und athlete-profile.tsx.

export function calc1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}
