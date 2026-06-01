// hooks/useAppleHealth.ts
// Uses expo-health (compatible with New Architecture + react-native-reanimated)

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
  weight: null, bodyFat: null, respiratoryRate: null, oxygenSaturation: null,
  lastUpdated: null, authorized: false, error: null,
};

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
      const Health = await import('expo-health');

      // Request permissions
      const { granted } = await Health.requestPermissionsAsync([
        Health.HealthDataType.HEART_RATE_VARIABILITY,
        Health.HealthDataType.RESTING_HEART_RATE,
        Health.HealthDataType.HEART_RATE,
        Health.HealthDataType.SLEEP_ANALYSIS,
        Health.HealthDataType.STEPS,
        Health.HealthDataType.ACTIVE_ENERGY_BURNED,
        Health.HealthDataType.EXERCISE_TIME,
        Health.HealthDataType.WEIGHT,
        Health.HealthDataType.BODY_FAT_PERCENTAGE,
        Health.HealthDataType.RESPIRATORY_RATE,
        Health.HealthDataType.OXYGEN_SATURATION,
      ]);

      if (!granted) {
        setData(d => ({ ...d, error: 'Zugriff verweigert', authorized: false }));
        return;
      }

      const now       = new Date();
      const startDay  = new Date(); startDay.setHours(0, 0, 0, 0);
      const yesterday = new Date(startDay); yesterday.setDate(yesterday.getDate() - 1);

      // Helper
      async function query(type: Health.HealthDataType, start: Date, end: Date, limit = 1) {
        try {
          return await Health.getHealthDataAsync({
            type,
            startDate: start,
            endDate: end,
            limit,
            ascending: false,
          });
        } catch { return []; }
      }

      const [
        hrvData, rhrData, hrData, sleepData,
        stepsData, calData, weightData, fatData,
        respData, spo2Data, exerciseData,
      ] = await Promise.all([
        query(Health.HealthDataType.HEART_RATE_VARIABILITY,  startDay,  now),
        query(Health.HealthDataType.RESTING_HEART_RATE,      startDay,  now),
        query(Health.HealthDataType.HEART_RATE,              startDay,  now),
        query(Health.HealthDataType.SLEEP_ANALYSIS,          yesterday, startDay, 100),
        query(Health.HealthDataType.STEPS,                   startDay,  now),
        query(Health.HealthDataType.ACTIVE_ENERGY_BURNED,    startDay,  now),
        query(Health.HealthDataType.WEIGHT,                  startDay,  now),
        query(Health.HealthDataType.BODY_FAT_PERCENTAGE,     startDay,  now),
        query(Health.HealthDataType.RESPIRATORY_RATE,        startDay,  now),
        query(Health.HealthDataType.OXYGEN_SATURATION,       startDay,  now),
        query(Health.HealthDataType.EXERCISE_TIME,           startDay,  now),
      ]);

      // Parse HRV — expo-health returns value in ms directly
      const hrv = hrvData[0]?.quantity ?? null;

      const restingHR = rhrData[0]?.quantity ?? null;
      const heartRate = hrData[0]?.quantity  ?? null;

      // Parse sleep
      let sleepHours: number | null = null;
      let sleepDeep:  number | null = null;
      let sleepREM:   number | null = null;
      let sleepAwake: number | null = null;

      if (sleepData.length > 0) {
        let asleepMin = 0, deepMin = 0, remMin = 0, awakeMin = 0;
        sleepData.forEach((s: any) => {
          const dur = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;
          const v   = (s.value ?? s.sleepStage ?? '').toString().toLowerCase();
          if (v.includes('asleep') || v.includes('inbed') || v === '1' || v === '2') asleepMin += dur;
          if (v.includes('deep')  || v === '3') { deepMin  += dur; asleepMin += dur; }
          if (v.includes('rem')   || v === '4') { remMin   += dur; asleepMin += dur; }
          if (v.includes('awake') || v === '0') awakeMin += dur;
        });
        if (asleepMin > 0) sleepHours = Math.round((asleepMin / 60) * 10) / 10;
        if (deepMin  > 0) sleepDeep  = Math.round((deepMin   / 60) * 10) / 10;
        if (remMin   > 0) sleepREM   = Math.round((remMin    / 60) * 10) / 10;
        if (awakeMin > 0) sleepAwake = Math.round((awakeMin  / 60) * 10) / 10;
      }

      // Steps — sum all samples for today
      const steps = stepsData.length > 0
        ? Math.round(stepsData.reduce((sum: number, s: any) => sum + (s.quantity ?? 0), 0))
        : null;

      const activeCalories = calData.length > 0
        ? Math.round(calData.reduce((sum: number, s: any) => sum + (s.quantity ?? 0), 0))
        : null;

      const weight         = weightData[0]?.quantity  ? Math.round(weightData[0].quantity * 10) / 10 : null;
      const bodyFat        = fatData[0]?.quantity     ? Math.round(fatData[0].quantity * 10) / 10    : null;
      const respiratoryRate = respData[0]?.quantity   ? Math.round(respData[0].quantity)              : null;
      const oxygenSaturation = spo2Data[0]?.quantity  ? Math.round(spo2Data[0].quantity * 100)        : null;
      const exerciseMinutes  = exerciseData[0]?.quantity ? Math.round(exerciseData[0].quantity)        : null;

      setData({
        hrv:              hrv        ? Math.round(hrv)        : null,
        restingHR:        restingHR  ? Math.round(restingHR)  : null,
        heartRate:        heartRate  ? Math.round(heartRate)  : null,
        sleepHours, sleepDeep, sleepREM, sleepAwake,
        steps, activeCalories, exerciseMinutes, standHours: null,
        weight, bodyFat, respiratoryRate, oxygenSaturation,
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