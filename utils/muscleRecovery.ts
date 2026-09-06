// utils/muscleRecovery.ts
// Einzige Quelle der Wahrheit für die Muskel-Recovery-Berechnung — vorher gab es zwei
// unterschiedliche Implementierungen (app/body.tsx: einfache Zeit-Rampe pro Muskel; und
// app/(tabs)/training.tsx: satzzahl-basierte Ermüdung mit Primär-/Sekundärmuskel-Gewichtung
// über ein 7-Tage-Fenster), die für denselben Muskel am selben Tag unterschiedliche Werte
// lieferten. Beide Screens rufen jetzt calculateMuscleRecovery() live mit denselben Workout-
// Daten auf, es gibt keine Diskrepanz mehr.

export type WorkoutSet = { reps: string; weight: string };
export type WorkoutExercise = { name: string; muscleGroup: string; sets: WorkoutSet[] };
export type WorkoutForRecovery = {
  date: string;
  duration: number;
  type: 'gym' | 'run' | 'manual' | 'judo' | 'cardio';
  exercises?: WorkoutExercise[];
};

export type MuscleState = { level: number; lastTrained: string | null };
export type MuscleMap = Record<string, MuscleState>;

type ExerciseData = { name: string; muscleGroup: string; secondary: { muscle: string; weight: number }[]; equipment: string[] };

export const MUSCLE_GROUPS = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden', 'Core'];

export const MUSCLE_RECOVERY_HOURS: Record<string, number> = {
  Brust: 48, Rücken: 48, Schultern: 36, Bizeps: 36,
  Trizeps: 36, Quadrizeps: 72, Hamstrings: 72, Gluteus: 48, Waden: 24, Core: 24,
};

export const EXERCISE_DB: ExerciseData[] = [
  { name: 'Bankdrücken',       muscleGroup: 'Brust',      secondary: [{ muscle: 'Trizeps', weight: 0.45 }, { muscle: 'Schultern', weight: 0.25 }], equipment: ['Langhantel', 'Kurzhantel', 'Maschine', 'Smith'] },
  { name: 'Schrägbankdrücken', muscleGroup: 'Brust',      secondary: [{ muscle: 'Trizeps', weight: 0.40 }, { muscle: 'Schultern', weight: 0.30 }], equipment: ['Langhantel', 'Kurzhantel', 'Kabelzug'] },
  { name: 'Fliegende',         muscleGroup: 'Brust',      secondary: [{ muscle: 'Schultern', weight: 0.15 }], equipment: ['Kurzhantel', 'Kabelzug', 'Maschine'] },
  { name: 'Dips',              muscleGroup: 'Brust',      secondary: [{ muscle: 'Trizeps', weight: 0.55 }, { muscle: 'Schultern', weight: 0.20 }], equipment: ['Körpergewicht', 'Gewichtsgürtel'] },
  { name: 'Klimmzüge',         muscleGroup: 'Rücken',     secondary: [{ muscle: 'Bizeps', weight: 0.50 }], equipment: ['Körpergewicht', 'Gewichtsgürtel'] },
  { name: 'Rudern',            muscleGroup: 'Rücken',     secondary: [{ muscle: 'Bizeps', weight: 0.40 }, { muscle: 'Schultern', weight: 0.15 }], equipment: ['Langhantel', 'Kurzhantel', 'Kabelzug', 'Maschine'] },
  { name: 'Kreuzheben',        muscleGroup: 'Rücken',     secondary: [{ muscle: 'Hamstrings', weight: 0.55 }, { muscle: 'Gluteus', weight: 0.40 }, { muscle: 'Core', weight: 0.30 }], equipment: ['Langhantel', 'Sumo'] },
  { name: 'Latzug',            muscleGroup: 'Rücken',     secondary: [{ muscle: 'Bizeps', weight: 0.45 }], equipment: ['Kabelzug breit', 'Kabelzug eng'] },
  { name: 'Schulterdrücken',   muscleGroup: 'Schultern',  secondary: [{ muscle: 'Trizeps', weight: 0.40 }], equipment: ['Langhantel', 'Kurzhantel', 'Maschine'] },
  { name: 'Seitheben',         muscleGroup: 'Schultern',  secondary: [], equipment: ['Kurzhantel', 'Kabelzug'] },
  { name: 'Curls',             muscleGroup: 'Bizeps',     secondary: [], equipment: ['Kurzhantel', 'Langhantel', 'Kabelzug'] },
  { name: 'Hammer Curls',      muscleGroup: 'Bizeps',     secondary: [], equipment: ['Kurzhantel'] },
  { name: 'Trizepsdrücken',    muscleGroup: 'Trizeps',    secondary: [], equipment: ['Kabelzug', 'Kurzhantel'] },
  { name: 'Skull Crushers',    muscleGroup: 'Trizeps',    secondary: [], equipment: ['Langhantel', 'EZ-Stange'] },
  { name: 'Kniebeugen',        muscleGroup: 'Quadrizeps', secondary: [{ muscle: 'Hamstrings', weight: 0.30 }, { muscle: 'Gluteus', weight: 0.45 }, { muscle: 'Core', weight: 0.20 }], equipment: ['Langhantel (High Bar)', 'Langhantel (Low Bar)', 'Smith'] },
  { name: 'Beinpresse',        muscleGroup: 'Quadrizeps', secondary: [{ muscle: 'Gluteus', weight: 0.30 }], equipment: ['Maschine 45°'] },
  { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', secondary: [{ muscle: 'Gluteus', weight: 0.45 }], equipment: ['Langhantel', 'Kurzhantel'] },
  { name: 'Hip Thrust',        muscleGroup: 'Gluteus',    secondary: [{ muscle: 'Hamstrings', weight: 0.25 }], equipment: ['Langhantel', 'Maschine'] },
  { name: 'Wadenheben',        muscleGroup: 'Waden',      secondary: [], equipment: ['Maschine stehend', 'Körpergewicht'] },
  { name: 'Plank',             muscleGroup: 'Core',       secondary: [], equipment: ['Körpergewicht'] },
  { name: 'Crunches',          muscleGroup: 'Core',       secondary: [], equipment: ['Körpergewicht', 'Kabelzug'] },
];

export const MAX_SETS_FOR_FULL_FATIGUE = 6;

// Maps ALL_EXERCISES categories (and other muscleGroup labels) to the
// canonical MUSCLE_GROUPS used for recovery tracking.
export const MUSCLE_GROUP_ALIASES: Record<string, string> = {
  'Rücken (Breite)': 'Rücken',
  'Rücken (Dicke)': 'Rücken',
  'Rücken (Unterer)': 'Rücken',
  'Trapez': 'Rücken',
  'Gesäß': 'Gluteus',
  'Bauch': 'Core',
  'Obliques': 'Core',
  'Adduktoren': 'Quadrizeps',
  'Abduktoren': 'Gluteus',
  'Olympic Lifts': 'Quadrizeps',
};

export function resolveMuscleGroup(mg: string | undefined): string | null {
  if (!mg) return null;
  if (MUSCLE_GROUPS.includes(mg)) return mg;
  return MUSCLE_GROUP_ALIASES[mg] ?? null;
}

// Muskel-Belastung für Workouts ohne Übungsliste (Cardio, Apple Health Imports).
// Gewichtung wird zusätzlich mit der Trainingsdauer skaliert (45 Min = volle Wirkung).
export const CARDIO_MUSCLE_IMPACT: Record<string, { muscle: string; weight: number }[]> = {
  run: [
    { muscle: 'Quadrizeps', weight: 0.50 },
    { muscle: 'Hamstrings', weight: 0.45 },
    { muscle: 'Waden', weight: 0.60 },
    { muscle: 'Gluteus', weight: 0.35 },
    { muscle: 'Core', weight: 0.20 },
  ],
  judo: [
    { muscle: 'Core', weight: 0.50 },
    { muscle: 'Schultern', weight: 0.40 },
    { muscle: 'Rücken', weight: 0.35 },
    { muscle: 'Bizeps', weight: 0.25 },
    { muscle: 'Trizeps', weight: 0.25 },
    { muscle: 'Quadrizeps', weight: 0.30 },
    { muscle: 'Hamstrings', weight: 0.25 },
  ],
  gym: [
    { muscle: 'Brust', weight: 0.25 },
    { muscle: 'Rücken', weight: 0.25 },
    { muscle: 'Schultern', weight: 0.20 },
    { muscle: 'Quadrizeps', weight: 0.30 },
    { muscle: 'Hamstrings', weight: 0.25 },
    { muscle: 'Core', weight: 0.30 },
  ],
  cardio: [
    { muscle: 'Quadrizeps', weight: 0.30 },
    { muscle: 'Waden', weight: 0.30 },
    { muscle: 'Core', weight: 0.20 },
    { muscle: 'Schultern', weight: 0.10 },
  ],
  manual: [
    { muscle: 'Quadrizeps', weight: 0.25 },
    { muscle: 'Core', weight: 0.20 },
  ],
};

export function calculateMuscleRecovery(workouts: WorkoutForRecovery[]): MuscleMap {
  const cutoff = Date.now() - 7 * 24 * 3600000;
  const hitMap: Record<string, { date: string; fatigue: number }[]> = {};

  workouts
    .filter(w => new Date(w.date).getTime() > cutoff)
    .forEach(w => {
      if (!w.exercises || w.exercises.length === 0) {
        const durationFactor = Math.min(1, (w.duration || 0) / 45);
        if (durationFactor <= 0) return;
        const impacts = CARDIO_MUSCLE_IMPACT[w.type] ?? CARDIO_MUSCLE_IMPACT.cardio;
        impacts.forEach(({ muscle, weight }) => {
          if (!hitMap[muscle]) hitMap[muscle] = [];
          hitMap[muscle].push({ date: w.date, fatigue: Math.min(1, weight * durationFactor) });
        });
        return;
      }

      w.exercises.forEach(ex => {
        const setCount = ex.sets.filter(
          s => parseFloat(s.reps || '0') > 0 && parseFloat(s.weight || '0') > 0
        ).length || ex.sets.length;

        const primaryFatigue = Math.min(1.0, setCount / MAX_SETS_FOR_FULL_FATIGUE);

        const exData = EXERCISE_DB.find(e => e.name === ex.name);
        if (exData) {
          if (!hitMap[exData.muscleGroup]) hitMap[exData.muscleGroup] = [];
          hitMap[exData.muscleGroup].push({ date: w.date, fatigue: primaryFatigue });

          exData.secondary.forEach(sec => {
            const secFatigue = Math.min(1.0, (setCount / MAX_SETS_FOR_FULL_FATIGUE) * sec.weight);
            if (!hitMap[sec.muscle]) hitMap[sec.muscle] = [];
            hitMap[sec.muscle].push({ date: w.date, fatigue: secFatigue });
          });
          return;
        }

        // Exercise picked from ALL_EXERCISES (not in EXERCISE_DB) — fall back
        // to the muscleGroup/category stored on the exercise itself.
        const mg = resolveMuscleGroup(ex.muscleGroup);
        if (mg) {
          if (!hitMap[mg]) hitMap[mg] = [];
          hitMap[mg].push({ date: w.date, fatigue: primaryFatigue });
        }
      });
    });

  const result: MuscleMap = {};

  MUSCLE_GROUPS.forEach(m => {
    const hits = hitMap[m] ?? [];
    if (hits.length === 0) {
      result[m] = { level: 100, lastTrained: null };
      return;
    }

    const recoveryHours = MUSCLE_RECOVERY_HOURS[m] ?? 48;
    const now = Date.now();
    let totalRemainingFatigue = 0;

    hits.forEach(hit => {
      const hoursElapsed = (now - new Date(hit.date).getTime()) / 3600000;
      const recoveredFraction = Math.min(1.0, hoursElapsed / recoveryHours);
      totalRemainingFatigue += hit.fatigue * (1 - recoveredFraction);
    });

    totalRemainingFatigue = Math.min(1.0, totalRemainingFatigue);

    const lastTrained = hits.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0].date;

    result[m] = {
      level: Math.round((1 - totalRemainingFatigue) * 100),
      lastTrained,
    };
  });

  return result;
}
