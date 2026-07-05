// utils/notifications.ts
// Local push notification scheduling: daily health check-in reminder,
// weekly training reminder, and a one-off post-workout nutrition reminder.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const SETTINGS_KEY = 'notificationSettings';
const HEALTH_NOTIF_ID_KEY = 'notif_health_id';
const TRAINING_NOTIF_ID_KEY = 'notif_training_id';

export type Lang = 'de' | 'en';

export interface NotificationSettings {
  healthReminderEnabled: boolean;
  healthReminderHour: number;
  healthReminderMinute: number;
  trainingReminderEnabled: boolean;
  /** 1 = Sunday … 7 = Saturday (expo-notifications weekly trigger convention) */
  trainingReminderWeekday: number;
  trainingReminderHour: number;
  trainingReminderMinute: number;
  nutritionReminderEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  healthReminderEnabled: false,
  healthReminderHour: 21,
  healthReminderMinute: 0,
  trainingReminderEnabled: false,
  trainingReminderWeekday: 2, // Monday
  trainingReminderHour: 18,
  trainingReminderMinute: 0,
  nutritionReminderEnabled: true,
};

const TEXTS: Record<Lang, Record<string, string>> = {
  de: {
    health_title: 'Zeit für deinen Check-in',
    health_body: 'Trage Schlaf, HRV und Stimmung ein, um deine Trainingsbereitschaft aktuell zu halten.',
    training_title: 'Trainingszeit 💪',
    training_body: 'Heute steht dein Training an — bereit?',
    nutrition_title: 'Ernährung nicht vergessen 🍗',
    nutrition_body: 'Zeit für eine proteinreiche Mahlzeit, um die Erholung zu unterstützen.',
  },
  en: {
    health_title: 'Time for your check-in',
    health_body: 'Log sleep, HRV and mood to keep your training readiness up to date.',
    training_title: 'Training time 💪',
    training_body: 'Your training session is coming up — ready?',
    nutrition_title: "Don't forget nutrition 🍗",
    nutrition_body: 'Time for a protein-rich meal to support recovery.',
  },
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_SETTINGS;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelStored(key: string) {
  const id = await AsyncStorage.getItem(key);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(key);
  }
}

/** Persists settings and (re)schedules the recurring local notifications. */
export async function saveNotificationSettings(settings: NotificationSettings, lang: Lang): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  if (Platform.OS === 'web') return;
  const texts = TEXTS[lang] ?? TEXTS.de;

  await cancelStored(HEALTH_NOTIF_ID_KEY);
  if (settings.healthReminderEnabled) {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: texts.health_title, body: texts.health_body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.healthReminderHour,
        minute: settings.healthReminderMinute,
      },
    });
    await AsyncStorage.setItem(HEALTH_NOTIF_ID_KEY, id);
  }

  await cancelStored(TRAINING_NOTIF_ID_KEY);
  if (settings.trainingReminderEnabled) {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: texts.training_title, body: texts.training_body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: settings.trainingReminderWeekday,
        hour: settings.trainingReminderHour,
        minute: settings.trainingReminderMinute,
      },
    });
    await AsyncStorage.setItem(TRAINING_NOTIF_ID_KEY, id);
  }
}

/** Schedules a one-off reminder 30 minutes after a workout ends. */
export async function scheduleNutritionReminder(lang: Lang): Promise<void> {
  if (Platform.OS === 'web') return;
  const settings = await getNotificationSettings();
  if (!settings.nutritionReminderEnabled) return;

  const texts = TEXTS[lang] ?? TEXTS.de;
  await Notifications.scheduleNotificationAsync({
    content: { title: texts.nutrition_title, body: texts.nutrition_body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 30 * 60,
      repeats: false,
    },
  });
}
