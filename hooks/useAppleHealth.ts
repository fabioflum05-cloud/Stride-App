// hooks/useAppleHealth.ts
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface HealthData {
  hrv: number | null;
  restingHR: number | null;
  heartRate: number | null;
  sleepHours: number | null;
  sleepDeep: number | null;
  sleepREM: number | null;
  sleepAwake: number | null;
  steps: number | null;
  activeCalories: number | null;
  exerciseMinutes: number | null;
  standHours: number | null;
  weight: number | null;
  bodyFat: number | null;
  bmi: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  lastUpdated: Date | null;
  authorized: boolean;
  error: string | null;
}

const DEFAULT: HealthData = {
  hrv: null, restingHR: null, heartRate: null,
  sleepHours: null, sleepDeep: null, sleepREM: null, sleepAwake: null,
  steps: null, activeCalories: null, exerciseMinutes: null, standHours: null,
  weight: null, bodyFat: null, bmi: null,
  respiratoryRate: null, oxygenSaturation: null,
  lastUpdated: null, authorized: false, error: null,
};

function todayRange() {
  const end = new Date();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function yesterdayRange() {
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - 1);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export function useAppleHealth() {
  const [data, setData]       = useState<HealthData>(DEFAULT);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setData(d => ({ ...d, error: 'Nur iOS', authorized: false }));
      return;
    }
    setLoading(true);
    try {
      const AppleHealthKit = (await import('react-native-health')).default;

      const permissions = {
        permissions: {
          read: [
            'HeartRateVariabilitySDNN', 'RestingHeartRate', 'HeartRate',
            'SleepAnalysis', 'StepCount', 'ActiveEnergyBurned',
            'AppleExerciseTime', 'BodyMass', 'BodyFatPercentage',
            'RespiratoryRate', 'OxygenSaturation',
          ],
          write: [] as string[],
        },
      };

      await new Promise<void>((resolve, reject) => {
        AppleHealthKit.initHealthKit(permissions as any, (err: any) => {
          if (err) reject(new Error(String(err)));
          else resolve();
        });
      });

      const today     = todayRange();
      const yesterday = yesterdayRange();

      // Generic promisifier — returns any to avoid type conflicts
      function hk(fn: Function, opts: any): Promise<any> {
        return new Promise((res, rej) => {
          fn(opts, (err: any, result: any) => {
            if (err) rej(err); else res(result);
          });
        });
      }

      const [
        hrvRes, rhrRes, hrRes, sleepRes,
        stepsRes, calRes, weightRes, fatRes,
        respRes, spo2Res, exerciseRes,
      ] = await Promise.allSettled([
        hk(AppleHealthKit.getHeartRateVariabilitySamples.bind(AppleHealthKit), { ...today, limit: 1, ascending: false }),
        hk(AppleHealthKit.getRestingHeartRateSamples.bind(AppleHealthKit),     { ...today, limit: 1, ascending: false }),
        hk(AppleHealthKit.getHeartRateSamples.bind(AppleHealthKit),            { ...today, limit: 1, ascending: false }),
        hk(AppleHealthKit.getSleepSamples.bind(AppleHealthKit),                { ...yesterday, limit: 100 }),
        hk(AppleHealthKit.getStepCount.bind(AppleHealthKit),                   today),
        hk(AppleHealthKit.getActiveEnergyBurned.bind(AppleHealthKit),          { ...today, limit: 1 }),
        hk(AppleHealthKit.getWeightSamples.bind(AppleHealthKit),               { ...today, limit: 1, ascending: false, unit: 'kilogram' }),
        hk(AppleHealthKit.getBodyFatPercentageSamples.bind(AppleHealthKit),    { ...today, limit: 1, ascending: false }),
        hk(AppleHealthKit.getRespiratoryRateSamples.bind(AppleHealthKit),      { ...today, limit: 1, ascending: false }),
        hk(AppleHealthKit.getOxygenSaturationSamples.bind(AppleHealthKit),     { ...today, limit: 1, ascending: false }),
        hk(AppleHealthKit.getAppleExerciseTime.bind(AppleHealthKit),           today),
      ]);

      const val = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? r.value : null;

      const arr = (r: PromiseSettledResult<any>): any[] =>
        r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [];

      // HRV — library returns value in seconds, convert to ms
      const hrvArr = arr(hrvRes);
      const hrv = hrvArr.length > 0 ? Math.round(hrvArr[0].value * 1000) : null;

      const rhrArr = arr(rhrRes);
      const restingHR = rhrArr.length > 0 ? Math.round(rhrArr[0].value) : null;

      const hrArr = arr(hrRes);
      const heartRate = hrArr.length > 0 ? Math.round(hrArr[0].value) : null;

      // Sleep
      let sleepHours: number | null = null;
      let sleepDeep: number | null = null;
      let sleepREM: number | null = null;
      let sleepAwake: number | null = null;
      const sleepArr = arr(sleepRes);
      if (sleepArr.length > 0) {
        let asleepMin = 0, deepMin = 0, remMin = 0, awakeMin = 0;
        sleepArr.forEach((s: any) => {
          const dur = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;
          const v = (s.value ?? '').toLowerCase();
          if (v === 'asleep' || v === 'inbed') asleepMin += dur;
          if (v === 'deep')  { deepMin  += dur; asleepMin += dur; }
          if (v === 'rem')   { remMin   += dur; asleepMin += dur; }
          if (v === 'awake') awakeMin += dur;
        });
        sleepHours = Math.round((asleepMin / 60) * 10) / 10;
        if (deepMin  > 0) sleepDeep  = Math.round((deepMin  / 60) * 10) / 10;
        if (remMin   > 0) sleepREM   = Math.round((remMin   / 60) * 10) / 10;
        if (awakeMin > 0) sleepAwake = Math.round((awakeMin / 60) * 10) / 10;
      }

      const stepsVal       = val(stepsRes);
      const steps          = stepsVal?.value != null ? Math.round(stepsVal.value) : null;

      const calArr         = arr(calRes);
      const activeCalories = calArr.length > 0 ? Math.round(calArr[0].value) : null;

      const weightArr      = arr(weightRes);
      const weight         = weightArr.length > 0 ? Math.round(weightArr[0].value * 10) / 10 : null;

      const fatArr         = arr(fatRes);
      const bodyFat        = fatArr.length > 0 ? Math.round(fatArr[0].value * 10) / 10 : null;

      const respArr        = arr(respRes);
      const respiratoryRate = respArr.length > 0 ? Math.round(respArr[0].value) : null;

      const spo2Arr        = arr(spo2Res);
      const oxygenSaturation = spo2Arr.length > 0 ? Math.round(spo2Arr[0].value * 100) : null;

      const exerciseVal    = val(exerciseRes);
      const exerciseMinutes = exerciseVal?.value != null ? Math.round(exerciseVal.value) : null;

      setData({
        hrv, restingHR, heartRate,
        sleepHours, sleepDeep, sleepREM, sleepAwake,
        steps, activeCalories, exerciseMinutes, standHours: null,
        weight, bodyFat, bmi: null,
        respiratoryRate, oxygenSaturation,
        lastUpdated: new Date(), authorized: true, error: null,
      });

    } catch (e: any) {
      setData(d => ({ ...d, error: e?.message ?? 'Fehler', authorized: false }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  return { data, loading, refresh: fetchAll };
}