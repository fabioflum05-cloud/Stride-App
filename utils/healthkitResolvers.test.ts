// utils/healthkitResolvers.test.ts
// Unit-Tests mit den echten Sample-Daten aus dem Debug-Screen (7/17-7/18): eine reale
// Nacht-Session 22:59-9:10 (AsleepCore/Deep/REM) plus ein Mittagsschlaf 13:43-14:52
// (InBed + AsleepUnspecified) am selben Kalendertag. Läuft mit `npm test`, keine
// React-Native/HealthKit-Native-Abhängigkeit nötig (siehe Header-Kommentar in healthkitResolvers.ts).

import {
  CategorySampleLike,
  clusterSleepSessions,
  getFallAsleepTime,
  getWakeTime,
  isGarminSource,
  QuantitySampleLike,
  resolveMainSleepSession,
  resolvePreferredQuantitySample,
  SleepValue,
} from './healthkitResolvers';

// Datums-Strings ohne 'Z'/Offset -> werden von JS als LOKALE Zeit geparst, .getHours() liefert
// also unabhängig von der Zeitzone des Test-Runners den beabsichtigten Wert.
function d(iso: string): Date {
  return new Date(iso);
}

// ─── Reale Debug-Screen-Daten: 7/17-7/18 Nacht-Session + Mittagsschlaf am 7/17 ──────────────

const nightSession: CategorySampleLike[] = [
  { value: SleepValue.asleepCore, startDate: d('2026-07-17T22:59:00'), endDate: d('2026-07-17T23:45:00') },
  { value: SleepValue.asleepDeep, startDate: d('2026-07-17T23:45:00'), endDate: d('2026-07-18T00:30:00') },
  { value: SleepValue.asleepCore, startDate: d('2026-07-18T00:30:00'), endDate: d('2026-07-18T01:15:00') },
  { value: SleepValue.asleepREM, startDate: d('2026-07-18T01:15:00'), endDate: d('2026-07-18T02:00:00') },
  { value: SleepValue.asleepDeep, startDate: d('2026-07-18T02:00:00'), endDate: d('2026-07-18T03:30:00') },
  { value: SleepValue.asleepCore, startDate: d('2026-07-18T03:30:00'), endDate: d('2026-07-18T04:00:00') },
  { value: SleepValue.asleepREM, startDate: d('2026-07-18T04:00:00'), endDate: d('2026-07-18T04:45:00') },
  { value: SleepValue.asleepCore, startDate: d('2026-07-18T04:45:00'), endDate: d('2026-07-18T06:30:00') },
  { value: SleepValue.asleepDeep, startDate: d('2026-07-18T06:30:00'), endDate: d('2026-07-18T07:00:00') },
  { value: SleepValue.asleepCore, startDate: d('2026-07-18T07:00:00'), endDate: d('2026-07-18T09:10:00') },
];

// Mittagsschlaf am 7/17: InBed umklammert die Session, das eigentliche Asleep-Signal ist enger.
const napSamples: CategorySampleLike[] = [
  { value: SleepValue.inBed, startDate: d('2026-07-17T13:43:00'), endDate: d('2026-07-17T14:52:00') },
  { value: SleepValue.asleepUnspecified, startDate: d('2026-07-17T13:50:00'), endDate: d('2026-07-17T14:45:00') },
];

const allDaySamples: CategorySampleLike[] = [...napSamples, ...nightSession];

describe('isGarminSource', () => {
  it('erkennt Garmin über den App-Quellennamen "Garmin Connect"', () => {
    expect(isGarminSource({ sourceRevision: { source: { name: 'Garmin Connect' } } })).toBe(true);
  });

  it('erkennt Garmin über die bundleIdentifier', () => {
    expect(isGarminSource({ sourceRevision: { source: { bundleIdentifier: 'com.garmin.connect.mobile' } } })).toBe(true);
  });

  it('erkennt Garmin über HKDevice.manufacturer, auch wenn der Modellname selbst kein "Garmin" enthält', () => {
    expect(isGarminSource({ device: { manufacturer: 'Garmin', model: 'Forerunner 265', name: 'Forerunner 265' } })).toBe(true);
  });

  it('erkennt Apples eigene Schätzung (generische bundleId) NICHT als Garmin', () => {
    expect(isGarminSource({ sourceRevision: { source: { name: 'Health', bundleIdentifier: 'com.apple.health.71E5DA95-59FA' } } })).toBe(false);
  });

  it('gibt false zurück, wenn weder sourceRevision noch device gesetzt sind', () => {
    expect(isGarminSource({})).toBe(false);
  });
});

describe('resolvePreferredQuantitySample', () => {
  it('gibt null zurück, wenn keine Samples vorhanden sind', () => {
    expect(resolvePreferredQuantitySample([])).toBeNull();
  });

  it('bevorzugt ein Garmin-Sample gegenüber einem neueren Apple-Sample (VO2max-Bug: 48 statt 61)', () => {
    const appleEstimate: QuantitySampleLike = {
      quantity: 48, startDate: d('2026-07-15T08:00:00'), endDate: d('2026-07-15T08:00:00'),
      sourceRevision: { source: { name: 'Health', bundleIdentifier: 'com.apple.health.GUID' } },
    };
    const garminMeasured: QuantitySampleLike = {
      quantity: 61, startDate: d('2026-06-01T08:00:00'), endDate: d('2026-06-01T08:00:00'),
      device: { manufacturer: 'Garmin', model: 'Forerunner 265' },
    };
    // Apple zuerst (neuer, würde ohne Source-Preference gewinnen), Garmin älter aber vorhanden.
    const resolved = resolvePreferredQuantitySample([appleEstimate, garminMeasured]);
    expect(resolved?.quantity).toBe(61);
  });

  it('fällt auf das neueste Sample zurück, wenn gar kein Garmin-Sample existiert', () => {
    const older: QuantitySampleLike = { quantity: 45, startDate: d('2026-06-01T08:00:00'), endDate: d('2026-06-01T08:00:00') };
    const newer: QuantitySampleLike = { quantity: 48, startDate: d('2026-07-15T08:00:00'), endDate: d('2026-07-15T08:00:00') };
    // Absteigend sortiert übergeben (wie die echte Query mit ascending:false).
    const resolved = resolvePreferredQuantitySample([newer, older]);
    expect(resolved?.quantity).toBe(48);
  });

  it('nutzt einen eigenen Pool-Selector (HRV: längste Sample-Dauer statt neuestes Datum)', () => {
    const nightSummary: QuantitySampleLike = {
      // Ganze Nacht abdeckend -> lange Dauer, aber nicht das zuletzt geschriebene Sample.
      quantity: 55, startDate: d('2026-07-17T23:00:00'), endDate: d('2026-07-18T07:00:00'),
      device: { manufacturer: 'Garmin' },
    };
    const daySpotcheck: QuantitySampleLike = {
      // Kurzer Tages-Spotcheck, später geschrieben, würde bei "neuestes Sample" fälschlich gewinnen.
      quantity: 33, startDate: d('2026-07-18T14:00:00'), endDate: d('2026-07-18T14:05:00'),
      device: { manufacturer: 'Garmin' },
    };
    const longestDurationSelector = (pool: readonly QuantitySampleLike[]) =>
      pool.reduce((a, b) => (b.endDate.getTime() - b.startDate.getTime()) > (a.endDate.getTime() - a.startDate.getTime()) ? b : a);

    const resolved = resolvePreferredQuantitySample([daySpotcheck, nightSummary], longestDurationSelector);
    expect(resolved?.quantity).toBe(55);
  });
});

describe('clusterSleepSessions', () => {
  it('gibt eine leere Liste für leere Eingabe zurück', () => {
    expect(clusterSleepSessions([])).toEqual([]);
  });

  it('gruppiert die zusammenhängende Nacht-Session (Lücken < 75 Min) in eine einzige Session', () => {
    const sessions = clusterSleepSessions(nightSession);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].samples).toHaveLength(nightSession.length);
    expect(sessions[0].start).toEqual(d('2026-07-17T22:59:00'));
    expect(sessions[0].end).toEqual(d('2026-07-18T09:10:00'));
  });

  it('trennt Nacht-Session und Mittagsschlaf in zwei Sessions (Lücke 9:10 -> 13:43 ist ~4.5h, weit über 75 Min)', () => {
    const sessions = clusterSleepSessions(allDaySamples);
    expect(sessions).toHaveLength(2);
    const [first, second] = [...sessions].sort((a, b) => a.start.getTime() - b.start.getTime());
    expect(first.start).toEqual(d('2026-07-17T13:43:00'));
    expect(first.end).toEqual(d('2026-07-17T14:52:00'));
    expect(second.start).toEqual(d('2026-07-17T22:59:00'));
    expect(second.end).toEqual(d('2026-07-18T09:10:00'));
  });

  it('behandelt eine Lücke von genau 75 Minuten noch als dieselbe Session (Grenzfall, nicht > 75)', () => {
    const samples: CategorySampleLike[] = [
      { value: SleepValue.asleepCore, startDate: d('2026-07-17T22:00:00'), endDate: d('2026-07-17T22:30:00') },
      { value: SleepValue.asleepCore, startDate: d('2026-07-17T23:45:00'), endDate: d('2026-07-18T00:00:00') }, // exakt 75 Min Lücke
    ];
    expect(clusterSleepSessions(samples)).toHaveLength(1);
  });

  it('trennt bei einer Lücke von 76 Minuten in zwei Sessions', () => {
    const samples: CategorySampleLike[] = [
      { value: SleepValue.asleepCore, startDate: d('2026-07-17T22:00:00'), endDate: d('2026-07-17T22:30:00') },
      { value: SleepValue.asleepCore, startDate: d('2026-07-17T23:46:00'), endDate: d('2026-07-18T00:00:00') }, // 76 Min Lücke
    ];
    expect(clusterSleepSessions(samples)).toHaveLength(2);
  });
});

describe('resolveMainSleepSession', () => {
  it('wählt die echte Nacht-Session und schließt den Mittagsschlaf aus (der Kern-Bug aus dem Debug-Screen)', () => {
    const sessions = clusterSleepSessions(allDaySamples);
    const main = resolveMainSleepSession(sessions);
    expect(main).not.toBeNull();
    expect(main!.start).toEqual(d('2026-07-17T22:59:00'));
    expect(main!.end).toEqual(d('2026-07-18T09:10:00'));
  });

  it('gibt null zurück, wenn NUR ein Mittagsschlaf ohne jede Nachtfenster-Überlappung existiert', () => {
    const sessions = clusterSleepSessions(napSamples);
    expect(resolveMainSleepSession(sessions)).toBeNull();
  });

  it('gibt null für eine leere Session-Liste zurück', () => {
    expect(resolveMainSleepSession([])).toBeNull();
  });

  it('bevorzugt bei zwei nächtlichen Sessions die mit größerer Nachtfenster-Überlappung', () => {
    const shortNight: CategorySampleLike[] = [
      { value: SleepValue.asleepCore, startDate: d('2026-07-17T23:30:00'), endDate: d('2026-07-18T01:00:00') },
    ];
    const longNight: CategorySampleLike[] = [
      { value: SleepValue.asleepCore, startDate: d('2026-07-16T22:00:00'), endDate: d('2026-07-17T07:00:00') },
    ];
    // Zwei separate, weit auseinanderliegende Sessions (verschiedene Nächte) simulieren, indem
    // wir sie einzeln clustern und die Ergebnis-Sessions direkt zusammenführen.
    const sessions = [...clusterSleepSessions(longNight), ...clusterSleepSessions(shortNight)];
    const main = resolveMainSleepSession(sessions);
    expect(main!.start).toEqual(d('2026-07-16T22:00:00'));
  });
});

describe('getFallAsleepTime / getWakeTime', () => {
  it('liefert für die Nacht-Session 22:59 als Einschlafzeit und 9:10 als Aufwachzeit', () => {
    const [session] = clusterSleepSessions(nightSession);
    expect(getFallAsleepTime(session)).toEqual(d('2026-07-17T22:59:00'));
    expect(getWakeTime(session)).toEqual(d('2026-07-18T09:10:00'));
  });

  it('ignoriert einen früheren InBed-Start und nimmt den Start der ersten Asleep*-Stage (Mittagsschlaf-Session)', () => {
    const [session] = clusterSleepSessions(napSamples);
    // InBed beginnt 13:43, die tatsächliche Asleep-Stage aber erst 13:50.
    expect(getFallAsleepTime(session)).toEqual(d('2026-07-17T13:50:00'));
    expect(getWakeTime(session)).toEqual(d('2026-07-17T14:45:00'));
  });

  it('gibt null zurück, wenn die Session ausschließlich InBed/Awake ohne jede Asleep*-Stage enthält', () => {
    const inBedOnly: CategorySampleLike[] = [
      { value: SleepValue.inBed, startDate: d('2026-07-17T22:00:00'), endDate: d('2026-07-17T22:20:00') },
      { value: SleepValue.awake, startDate: d('2026-07-17T22:20:00'), endDate: d('2026-07-17T22:40:00') },
    ];
    const [session] = clusterSleepSessions(inBedOnly);
    expect(getFallAsleepTime(session)).toBeNull();
    expect(getWakeTime(session)).toBeNull();
  });
});

describe('End-to-End: fetchLastNightSleepDetails-Szenario (Nacht + Mittagsschlaf am selben Tag)', () => {
  it('liefert am Ende Einschlafzeit 22:59 und Aufwachzeit 9:10 -- nicht 13:43', () => {
    const sessions = clusterSleepSessions(allDaySamples);
    const main = resolveMainSleepSession(sessions);
    expect(main).not.toBeNull();

    const fallAsleep = getFallAsleepTime(main!);
    const wake = getWakeTime(main!);
    expect(fallAsleep).toEqual(d('2026-07-17T22:59:00'));
    expect(wake).toEqual(d('2026-07-18T09:10:00'));

    // Genau die Validierung, die applehealth.ts danach noch anwendet: 2-16h Dauer, Bettzeit 18:00-06:00.
    const durationHours = (wake!.getTime() - fallAsleep!.getTime()) / 3600000;
    expect(durationHours).toBeGreaterThan(2);
    expect(durationHours).toBeLessThan(16);
    const bedHour = fallAsleep!.getHours();
    expect(bedHour >= 18 || bedHour < 6).toBe(true);
  });
});
