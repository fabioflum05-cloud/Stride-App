import BackButton from '@/components/BackButton';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../constants/LanguageContext';
import { theme } from '../constants/theme';
import {
    DEFAULT_NOTIFICATION_SETTINGS,
    getNotificationSettings,
    NotificationSettings,
    requestNotificationPermissions,
    saveNotificationSettings,
} from '../utils/notifications';

const WEEKDAYS = [
  { value: 2, key: 'weekday_mon' },
  { value: 3, key: 'weekday_tue' },
  { value: 4, key: 'weekday_wed' },
  { value: 5, key: 'weekday_thu' },
  { value: 6, key: 'weekday_fri' },
  { value: 7, key: 'weekday_sat' },
  { value: 1, key: 'weekday_sun' },
] as const;

function timeToDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export default function NotificationSettingsScreen() {
  const { t, lang } = useLanguage();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [showHealthPicker, setShowHealthPicker] = useState(false);
  const [showTrainingPicker, setShowTrainingPicker] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(useCallback(() => {
    getNotificationSettings().then(setSettings);
    setSaved(false);
  }, []));

  function update<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (settings.healthReminderEnabled || settings.trainingReminderEnabled || settings.nutritionReminderEnabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(t('error'), t('notif_permission_denied'));
        return;
      }
    }
    await saveNotificationSettings(settings, lang);
    setSaved(true);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BackButton />
      <Text style={styles.headerLabel}>{t('notif_settings_subtitle')}</Text>
      <Text style={styles.title}>{t('notif_settings_title')}</Text>

      {/* Health Reminder */}
      <View style={styles.card}>
        <View style={styles.rowHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t('notif_health_reminder')}</Text>
            <Text style={styles.cardDesc}>{t('notif_health_reminder_desc')}</Text>
          </View>
          <Switch
            value={settings.healthReminderEnabled}
            onValueChange={v => update('healthReminderEnabled', v)}
            trackColor={{ false: theme.border, true: theme.blue }}
          />
        </View>
        {settings.healthReminderEnabled && (
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{t('notif_time')}</Text>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowHealthPicker(true)} activeOpacity={0.7}>
              <Text style={styles.timeBtnText}>
                {String(settings.healthReminderHour).padStart(2, '0')}:{String(settings.healthReminderMinute).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {showHealthPicker && (
          <DateTimePicker
            value={timeToDate(settings.healthReminderHour, settings.healthReminderMinute)}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => {
              if (Platform.OS !== 'ios') setShowHealthPicker(false);
              if (date) {
                update('healthReminderHour', date.getHours());
                update('healthReminderMinute', date.getMinutes());
              }
            }}
          />
        )}
      </View>

      {/* Training Reminder */}
      <View style={styles.card}>
        <View style={styles.rowHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t('notif_training_reminder')}</Text>
            <Text style={styles.cardDesc}>{t('notif_training_reminder_desc')}</Text>
          </View>
          <Switch
            value={settings.trainingReminderEnabled}
            onValueChange={v => update('trainingReminderEnabled', v)}
            trackColor={{ false: theme.border, true: theme.blue }}
          />
        </View>
        {settings.trainingReminderEnabled && (
          <>
            <Text style={[styles.timeLabel, { marginBottom: 8, marginTop: 4 }]}>{t('notif_weekday')}</Text>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map(w => (
                <TouchableOpacity
                  key={w.value}
                  style={[styles.weekdayChip, settings.trainingReminderWeekday === w.value && styles.weekdayChipActive]}
                  onPress={() => update('trainingReminderWeekday', w.value)}
                  activeOpacity={0.7}>
                  <Text style={[styles.weekdayChipText, settings.trainingReminderWeekday === w.value && styles.weekdayChipTextActive]}>
                    {t(w.key as any).slice(0, 2)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>{t('notif_time')}</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTrainingPicker(true)} activeOpacity={0.7}>
                <Text style={styles.timeBtnText}>
                  {String(settings.trainingReminderHour).padStart(2, '0')}:{String(settings.trainingReminderMinute).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {showTrainingPicker && (
          <DateTimePicker
            value={timeToDate(settings.trainingReminderHour, settings.trainingReminderMinute)}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => {
              if (Platform.OS !== 'ios') setShowTrainingPicker(false);
              if (date) {
                update('trainingReminderHour', date.getHours());
                update('trainingReminderMinute', date.getMinutes());
              }
            }}
          />
        )}
      </View>

      {/* Nutrition Reminder */}
      <View style={styles.card}>
        <View style={styles.rowHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t('notif_nutrition_reminder')}</Text>
            <Text style={styles.cardDesc}>{t('notif_nutrition_reminder_desc')}</Text>
          </View>
          <Switch
            value={settings.nutritionReminderEnabled}
            onValueChange={v => update('nutritionReminderEnabled', v)}
            trackColor={{ false: theme.border, true: theme.blue }}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
        <Text style={styles.saveBtnText}>{saved ? `✓ ${t('done')}` : t('save')}</Text>
      </TouchableOpacity>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', marginBottom: 20 },
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 12, ...theme.shadow },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cardDesc: { color: theme.textSecondary, fontSize: 12, lineHeight: 18 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: theme.borderLight },
  timeLabel: { color: theme.textSecondary, fontSize: 13, fontWeight: '500' },
  timeBtn: { backgroundColor: theme.cardSecondary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  timeBtnText: { color: theme.blue, fontSize: 15, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  weekdayChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.cardSecondary, alignItems: 'center' },
  weekdayChipActive: { backgroundColor: theme.blue },
  weekdayChipText: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
  weekdayChipTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
