import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Only import on iOS
let AppleHealthKit: any = null;
if (Platform.OS === 'ios') {
  AppleHealthKit = require('react-native-health').default;
}

const PERMISSIONS = {
  permissions: {
    read: [
      'SleepAnalysis',
      'HeartRateVariabilitySDNN',
      'RestingHeartRate',
      'HeartRate',
      'ActiveEnergyBurned',
      'BasalEnergyBurned',
      'StepCount',
      'VO2Max',
    ],
    write: [],
  },
};

export async function initHealthKit(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !AppleHealthKit) return false;
  return new Promise(resolve => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err: any) => {
      resolve(!err);
    });
  });
}

export async function fetchAndImportHealthData(): Promise<{ success: boolean; message: string }> {
  if (Platform.OS !== 'ios' || !AppleHealthKit) {
    return { success: false, message: 'Apple Health nur auf iOS verfügbar.' };
  }

  const initialized = await initHealthKit();
  if (!initialized) {
    return { success: false, message: 'Apple Health Zugriff verweigert.' };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const options = {
    startDate: yesterday.toISOString(),
    endDate: new Date().toISOString(),
  };

  try {
    // Sleep
    const sleep = await new Promise<any>((resolve) => {
      AppleHealthKit.getSleepSamples(options, (err: any, results: any) => {
        resolve(err ? [] : results);
      });
    });

    // HRV
    const hrv = await new Promise<any>((resolve) => {
      AppleHealthKit.getHeartRateVariabilitySamples(options, (err: any, results: any) => {
        resolve(err ? [] : results);
      });
    });

    // Resting Heart Rate
    const restingHR = await new Promise<any>((resolve) => {
      AppleHealthKit.getRestingHeartRate({ date: new Date().toISOString() }, (err: any, result: any) => {
        resolve(err ? null : result);
      });
    });

    // Steps
    const steps = await new Promise<any>((resolve) => {
      AppleHealthKit.getStepCount(options, (err: any, result: any) => {
        resolve(err ? null : result);
      });
    });

    // Active calories
    const calories = await new Promise<any>((resolve) => {
      AppleHealthKit.getActiveEnergyBurned(options, (err: any, results: any) => {
        resolve(err ? [] : results);
      });
    });

    // Process sleep data
    if (sleep && sleep.length > 0) {
      const inBedSamples = sleep.filter((s: any) => s.value === 'INBED' || s.value === 'ASLEEP');
      if (inBedSamples.length > 0) {
        const earliest = inBedSamples.reduce((a: any, b: any) =>
          new Date(a.startDate) < new Date(b.startDate) ? a : b);
        const latest = inBedSamples.reduce((a: any, b: any) =>
          new Date(a.endDate) > new Date(b.endDate) ? a : b);

        const sleepStart = new Date(earliest.startDate);
        const sleepEnd = new Date(latest.endDate);
        const schlafMin = Math.round((sleepEnd.getTime() - sleepStart.getTime()) / 60000);

        const avgHRV = hrv && hrv.length > 0
          ? Math.round(hrv.reduce((s: number, h: any) => s + h.value, 0) / hrv.length)
          : 0;

        const tiefsterPuls = restingHR?.value || 50;

        const sleepScore = Math.min(100, Math.round(
          (Math.min(schlafMin / 480, 1) * 40) +
          (Math.min(avgHRV / 75, 1) * 30) +
          (Math.max(0, (65 - tiefsterPuls) / 25) * 30)
        ));

        const sleepData = {
          bedHour: String(sleepStart.getHours()),
          bedMinute: String(sleepStart.getMinutes()).padStart(2, '0'),
          wakeHour: String(sleepEnd.getHours()),
          wakeMinute: String(sleepEnd.getMinutes()).padStart(2, '0'),
          schlafStunden: Math.round(schlafMin / 60 * 10) / 10,
          schlafMin,
          tiefsterPuls,
          avgPuls: tiefsterPuls,
          hrv: avgHRV,
          sleepScore,
          date: new Date().toISOString(),
          source: 'apple_health',
        };

        await AsyncStorage.setItem('lastSleep', JSON.stringify(sleepData));

        const rawHistory = await AsyncStorage.getItem('sleepHistory');
        const history = rawHistory ? JSON.parse(rawHistory) : [];
        const today = new Date().toDateString();
        const filtered = history.filter((h: any) => new Date(h.date).toDateString() !== today);
        filtered.push(sleepData);
        await AsyncStorage.setItem('sleepHistory', JSON.stringify(filtered));
      }
    }

    // Save activity data
    const totalCalories = calories
      ? calories.reduce((s: number, c: any) => s + c.value, 0)
      : 0;

    const activityData = {
      steps: steps?.value || 0,
      calories: Math.round(totalCalories),
      hrv: hrv && hrv.length > 0
        ? Math.round(hrv.reduce((s: number, h: any) => s + h.value, 0) / hrv.length)
        : 0,
      restingHR: restingHR?.value || 0,
      date: new Date().toISOString(),
      source: 'apple_health',
    };

    await AsyncStorage.setItem('appleHealthData', JSON.stringify(activityData));

    return { success: true, message: 'Schlaf, HRV und Aktivität importiert.' };
  } catch (e) {
    return { success: false, message: String(e) };
  }
}