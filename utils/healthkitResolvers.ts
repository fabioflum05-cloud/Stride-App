// utils/healthkitResolvers.ts
// Reusable, source-aware resolvers for HealthKit quantity/category samples.
// Shared between utils/applehealth.ts (real data fetch) and the debug screen
// (app/(tabs)/health.tsx), so both always apply the exact same selection logic.
//
// Deliberately has ZERO import from '@kingstinct/react-native-healthkit' (or any other native
// module) — this file is pure data-transformation logic operating on plain {value, startDate,
// endDate} shapes. That keeps it trivially unit-testable with plain Jest/Node, no RN/native
// mocking required, and decouples the business logic from whichever HealthKit wrapper the app
// happens to use. The sleep category raw values below mirror Apple's own public
// HKCategoryValueSleepAnalysis constants (stable since introduction, part of the documented
// HealthKit API): inBed=0, asleepUnspecified=1, awake=2, asleepCore=3, asleepDeep=4, asleepREM=5.

/** Wie weit die Debug-Ansicht und die VO2max-Query zurückschauen, um seltener geschriebene
 * Garmin-Werte nicht durch Apples häufigere Auto-Schätzungen aus dem Fenster zu verdrängen. */
export const DEBUG_LOOKBACK_DAYS = 90;

// ─── Source preference (Garmin > alles andere) ────────────────────────────────

export interface SourcedSample {
  sourceRevision?: { source?: { name?: string; bundleIdentifier?: string } };
  device?: { name?: string; manufacturer?: string; model?: string };
}

/**
 * Apple Health führt für dieselbe Metrik oft mehrere Quellen (Garmin Connect, iPhone,
 * Apple Watch, andere Apps). Garmin-Werte sind die verlässlichsten (Chest-Strap/Watch-
 * Sensorik, echte nächtliche HRV-Summaries statt kurzer Spotchecks, gemessenes statt
 * geschätztes VO2max), daher bevorzugen wir explizit Garmin-Samples. Garmin kann je nach
 * Sync-Pfad entweder als App-Quelle ("Garmin Connect", bundleIdentifier "com.garmin.connect...")
 * ODER über das gekoppelte Gerät (HKDevice.manufacturer "Garmin", model z.B. "Forerunner 265")
 * auftauchen — daher prüfen wir alle diese Felder statt uns auf eines zu verlassen.
 */
export function isGarminSource(sample: SourcedSample): boolean {
  const haystack = [
    sample.sourceRevision?.source?.name,
    sample.sourceRevision?.source?.bundleIdentifier,
    sample.device?.manufacturer,
    sample.device?.name,
    sample.device?.model,
  ].filter(Boolean).join(' | ').toLowerCase();
  return haystack.includes('garmin');
}

export interface QuantitySampleLike extends SourcedSample {
  quantity: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Zentrale Quellen-Auflösung für alle HealthKit-Quantity-Metriken mit Source-Priority-Bedarf
 * (HRV, VO2max, Ruhepuls, …). Bevorzugt Garmin-Samples; fällt nur auf andere Quellen zurück,
 * wenn KEINE Garmin-Samples existieren. Gibt explizit `null` zurück, wenn gar keine Samples
 * vorhanden sind — kein Fallback-Wert, der Aufrufer muss einen "keine Daten"-Zustand behandeln.
 *
 * `pickFromPool` wählt aus dem (Garmin- oder Gesamt-)Pool das konkrete Sample. Default: das
 * erste Element (setzt absteigend sortierte Eingabe voraus, also "das neueste"). Für Metriken
 * mit anderer Auswahllogik (z.B. HRV: längste Sample-Dauer statt neuestes Datum) kann ein
 * eigener Selector übergeben werden.
 */
export function resolvePreferredQuantitySample<T extends QuantitySampleLike>(
  samples: readonly T[],
  pickFromPool: (pool: readonly T[]) => T = (pool) => pool[0]
): T | null {
  if (samples.length === 0) return null;
  const garmin = samples.filter(isGarminSource);
  const pool = garmin.length > 0 ? garmin : samples;
  return pool.length > 0 ? pickFromPool(pool) : null;
}

// ─── Sleep session clustering ──────────────────────────────────────────────────

export interface CategorySampleLike {
  value: number;
  startDate: Date;
  endDate: Date;
}

export interface SleepSession {
  samples: readonly CategorySampleLike[];
  start: Date;
  end: Date;
}

/** Mirrors HKCategoryValueSleepAnalysis raw values — see file header comment. */
export const SleepValue = {
  inBed: 0,
  asleepUnspecified: 1,
  awake: 2,
  asleepCore: 3,
  asleepDeep: 4,
  asleepREM: 5,
} as const;

const ASLEEP_VALUES = new Set<number>([
  SleepValue.asleepDeep,
  SleepValue.asleepREM,
  SleepValue.asleepCore,
  SleepValue.asleepUnspecified,
]);

const SESSION_GAP_MS = 75 * 60 * 1000;

/**
 * Gruppiert rohe Sleep-Category-Samples (InBed, Asleep-Varianten, Awake) in zusammenhängende Sessions.
 * Eine neue Session beginnt, sobald die Lücke zwischen dem Ende des vorherigen Samples und dem
 * Start des nächsten Samples 75 Minuten überschreitet. Das trennt z.B. einen kurzen
 * Mittagsschlaf sauber von der eigentlichen Nacht-Session, ohne dass wir "Nacht" anhand einer
 * festen Uhrzeit raten müssen.
 */
export function clusterSleepSessions(samples: readonly CategorySampleLike[]): SleepSession[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const groups: CategorySampleLike[][] = [[sorted[0]]];
  let lastEnd = sorted[0].endDate.getTime();

  for (let i = 1; i < sorted.length; i++) {
    const sample = sorted[i];
    const gap = sample.startDate.getTime() - lastEnd;
    if (gap > SESSION_GAP_MS) {
      groups.push([sample]);
    } else {
      groups[groups.length - 1].push(sample);
    }
    lastEnd = Math.max(lastEnd, sample.endDate.getTime());
  }

  return groups.map(group => ({
    samples: group,
    start: new Date(Math.min(...group.map(s => s.startDate.getTime()))),
    end: new Date(Math.max(...group.map(s => s.endDate.getTime()))),
  }));
}

function nightWindowFor(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  // Samples vor Mittag gehören zum Nachtfenster, das am Vorabend begonnen hat.
  if (date.getHours() < 12) start.setDate(start.getDate() - 1);
  start.setHours(22, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(10, 0, 0, 0);
  return { start, end };
}

function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

/**
 * Wählt aus mehreren Sessions einer Nacht diejenige mit der größten Überlappung zum
 * Nachtfenster (22:00–10:00) als Hauptschlaf-Session. Bei mehreren Sessions mit ähnlicher
 * Überlappung entscheidet zusätzlich die Dauer. Sessions OHNE jede Überlappung zum Nachtfenster
 * (z.B. ein Mittagsschlaf von 13:43–14:52) werden explizit ausgeschlossen, selbst wenn sie die
 * einzige vorhandene Session wären — dann gibt es schlicht keine Hauptschlaf-Session.
 */
export function resolveMainSleepSession(sessions: readonly SleepSession[]): SleepSession | null {
  let best: SleepSession | null = null;
  let bestOverlap = 0;
  let bestDuration = 0;

  for (const session of sessions) {
    const window = nightWindowFor(session.start);
    const overlap = overlapMs(session.start, session.end, window.start, window.end);
    if (overlap <= 0) continue;
    const duration = session.end.getTime() - session.start.getTime();
    if (overlap > bestOverlap || (overlap === bestOverlap && duration > bestDuration)) {
      best = session;
      bestOverlap = overlap;
      bestDuration = duration;
    }
  }

  return best;
}

/** Start der ersten "Asleep*"-Stage innerhalb der Session — nicht der InBed-Start. */
export function getFallAsleepTime(session: SleepSession): Date | null {
  const asleep = session.samples.filter(s => ASLEEP_VALUES.has(s.value));
  if (asleep.length === 0) return null;
  return new Date(Math.min(...asleep.map(s => s.startDate.getTime())));
}

/** Ende der letzten "Asleep*"-Stage innerhalb der Session — nicht ein nachgelagertes InBed/Awake. */
export function getWakeTime(session: SleepSession): Date | null {
  const asleep = session.samples.filter(s => ASLEEP_VALUES.has(s.value));
  if (asleep.length === 0) return null;
  return new Date(Math.max(...asleep.map(s => s.endDate.getTime())));
}
