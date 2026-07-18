import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { useLanguage } from '../constants/LanguageContext';
import { saveManualHRV } from '../utils/applehealth';

type LastSleep = {
  date?: string;
  schlafStunden?: number;
  schlafMin?: number;
  sleepScore?: number;
  deep?: number;
  rem?: number;
  light?: number;
  awake?: number;
  hrv?: number;
  tiefsterPuls?: number;
  avgPuls?: number;
  restingHR?: number;
  bedtime?: string;
  wakeTime?: string;
  source?: string;
};

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
}

function formatTime(raw?: string): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return '—'; }
}

function formatDuration(min: number, lang: string): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m}${lang === 'en' ? 'min' : 'min'}`;
  return `${h}${lang === 'en' ? 'h' : 'h'} ${m}min`;
}

export default function SleepDetailsScreen() {
  const { lang } = useLanguage();
  const [sleep, setSleep] = useState<LastSleep | null>(null);
  const [showHrvModal, setShowHrvModal] = useState(false);
  const [hrvInput, setHrvInput] = useState('');
  const [savingHrv, setSavingHrv] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const raw = await AsyncStorage.getItem('lastSleep');
    if (raw) {
      const s: LastSleep = JSON.parse(raw);
      setSleep(isToday(s.date) ? s : null);
    } else {
      setSleep(null);
    }
  }

  async function saveHrv() {
    const v = parseInt(hrvInput, 10);
    if (isNaN(v) || v <= 0 || v > 300) return;
    setSavingHrv(true);
    try {
      await saveManualHRV(v);
      setShowHrvModal(false);
      setHrvInput('');
      await load();
    } finally {
      setSavingHrv(false);
    }
  }

  if (!sleep) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 }}>
        <BackButton />
        <Text style={styles.headerLabel}>{lang === 'en' ? 'Sleep Details' : 'Schlafdetails'}</Text>
        <Text style={styles.title}>{lang === 'en' ? 'No sleep\ndata yet' : 'Noch keine\nSchlafdaten'}</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {lang === 'en'
              ? 'Sync Apple Health or log your sleep manually to see details here.'
              : 'Synchronisiere Apple Health oder trage deinen Schlaf manuell ein, um hier Details zu sehen.'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/sleep' as any)} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{lang === 'en' ? 'Log sleep' : 'Schlaf eintragen'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const schlafMin = sleep.schlafMin ?? Math.round((sleep.schlafStunden ?? 0) * 60);
  const deepMin = sleep.deep ?? 0;
  const remMin = sleep.rem ?? 0;
  const lightMin = sleep.light ?? Math.max(0, schlafMin - deepMin - remMin);
  const awakeMin = sleep.awake ?? 0;
  const totalForBar = Math.max(1, deepMin + remMin + lightMin + awakeMin);

  const phases = [
    { key: 'deep', label: lang === 'en' ? 'Deep Sleep' : 'Tiefschlaf', min: deepMin, color: theme.purple },
    { key: 'rem', label: 'REM', min: remMin, color: theme.blue },
    { key: 'light', label: lang === 'en' ? 'Light Sleep' : 'Leichtschlaf', min: lightMin, color: '#818CF8' },
    { key: 'awake', label: lang === 'en' ? 'Awake' : 'Wach', min: awakeMin, color: theme.textTertiary },
  ].filter(p => p.min > 0);

  const score = sleep.sleepScore ?? 0;
  const scoreColor = score >= 70 ? theme.green : score >= 50 ? theme.orange : theme.red;

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
      <BackButton />
      <Text style={styles.headerLabel}>{lang === 'en' ? 'Sleep Details' : 'Schlafdetails'}</Text>
      <Text style={styles.title}>{lang === 'en' ? 'Last\nNight' : 'Letzte\nNacht'}</Text>

      <View style={styles.scoreCard}>
        <View>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>{score || '—'}</Text>
          <Text style={styles.scoreLabel}>Sleep Score</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.durationValue}>{formatDuration(schlafMin, lang)}</Text>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(sleep.bedtime)}</Text>
            <Text style={styles.timeSep}>→</Text>
            <Text style={styles.timeText}>{formatTime(sleep.wakeTime)}</Text>
          </View>
        </View>
      </View>

      {phases.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{lang === 'en' ? 'Sleep Phases' : 'Schlafphasen'}</Text>
          <View style={styles.barRow}>
            {phases.map(p => (
              <View key={p.key} style={{ flex: p.min, backgroundColor: p.color, height: '100%' }} />
            ))}
          </View>
          <View style={{ gap: 8, marginTop: 12 }}>
            {phases.map(p => (
              <View key={p.key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                <Text style={styles.legendLabel}>{p.label}</Text>
                <Text style={styles.legendValue}>{formatDuration(p.min, lang)}</Text>
                <Text style={styles.legendPct}>{Math.round((p.min / totalForBar) * 100)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{lang === 'en' ? 'Heart Rate & HRV' : 'Herzfrequenz & HRV'}</Text>
        <View style={styles.statsGrid}>
          {[
            { label: lang === 'en' ? 'Lowest Pulse' : 'Tiefster Puls', val: sleep.tiefsterPuls ?? sleep.restingHR, unit: 'bpm' },
            { label: lang === 'en' ? 'Avg. Pulse' : 'Ø Puls', val: sleep.avgPuls, unit: 'bpm' },
          ].map(stat => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.val ? `${stat.val}` : '—'}{stat.val ? <Text style={styles.statUnit}> {stat.unit}</Text> : null}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
          {sleep.hrv ? (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sleep.hrv}<Text style={styles.statUnit}> ms</Text></Text>
              <Text style={styles.statLabel}>HRV</Text>
            </View>
          ) : (
            <TouchableOpacity style={[styles.statItem, styles.hrvMissingItem]} onPress={() => setShowHrvModal(true)} activeOpacity={0.8}>
              <Text style={styles.hrvMissingIcon}>+</Text>
              <Text style={styles.hrvMissingLabel}>{lang === 'en' ? 'Add HRV' : 'HRV eintragen'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {sleep.source === 'apple_health' && (
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceText}>{lang === 'en' ? 'Synced from Apple Health' : 'Aus Apple Health synchronisiert'}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/sleep' as any)} activeOpacity={0.85}>
        <Text style={styles.editBtnText}>{lang === 'en' ? 'Edit sleep entry' : 'Schlafeintrag bearbeiten'}</Text>
      </TouchableOpacity>

      <View style={{ height: 80 }} />
    </ScrollView>

    <Modal visible={showHrvModal} transparent animationType="slide" onRequestClose={() => setShowHrvModal(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>HRV</Text>
              <TouchableOpacity onPress={() => setShowHrvModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>{lang === 'en' ? 'Cancel' : 'Abbrechen'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              {lang === 'en'
                ? 'Enter the HRV (RMSSD, ms) your smartwatch / Garmin Connect showed for last night.'
                : 'Trage den HRV-Wert (RMSSD, ms) ein, den deine Smartwatch / Garmin Connect für letzte Nacht anzeigt.'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={hrvInput}
              onChangeText={setHrvInput}
              placeholder={lang === 'en' ? 'e.g. 58' : 'z. B. 58'}
              placeholderTextColor={theme.textTertiary}
              keyboardType="numeric"
              autoFocus
            />
            <TouchableOpacity
              onPress={saveHrv}
              disabled={savingHrv || !hrvInput}
              style={[styles.modalSaveBtn, (savingHrv || !hrvInput) && { opacity: 0.5 }]}
            >
              <Text style={styles.modalSaveText}>{savingHrv ? (lang === 'en' ? 'Saving…' : 'Speichere…') : (lang === 'en' ? 'Save' : 'Speichern')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 20 },
  scoreCard: { backgroundColor: theme.card, borderRadius: 16, padding: 18, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...theme.shadow },
  scoreValue: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  scoreLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  durationValue: { color: theme.textPrimary, fontSize: 20, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  timeText: { color: theme.textSecondary, fontSize: 13, fontWeight: '600' },
  timeSep: { color: theme.textTertiary, fontSize: 13 },
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 12, ...theme.shadow },
  cardTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  barRow: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: theme.cardSecondary },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, color: theme.textPrimary, fontSize: 13, fontWeight: '500' },
  legendValue: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
  legendPct: { color: theme.textTertiary, fontSize: 12, width: 40, textAlign: 'right' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: theme.textPrimary, fontSize: 20, fontWeight: '700' },
  statUnit: { fontSize: 11, fontWeight: '500', color: theme.textSecondary },
  statLabel: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, textAlign: 'center' },
  sourceBadge: { alignSelf: 'center', backgroundColor: theme.blueLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16 },
  sourceText: { color: theme.blue, fontSize: 11, fontWeight: '600' },
  editBtn: { backgroundColor: theme.cardSecondary, borderRadius: 16, padding: 16, alignItems: 'center' },
  editBtnText: { color: theme.blue, fontSize: 14, fontWeight: '600' },
  emptyCard: { backgroundColor: theme.card, borderRadius: 16, padding: 20, alignItems: 'center', gap: 16, ...theme.shadow },
  emptyText: { color: theme.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  primaryBtn: { backgroundColor: theme.blue, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  hrvMissingItem: { backgroundColor: theme.orangeLight, borderRadius: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.orange },
  hrvMissingIcon: { fontSize: 18, fontWeight: '800', color: theme.orange },
  hrvMissingLabel: { color: theme.orange, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: theme.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary },
  modalCloseBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.cardSecondary },
  modalCloseText: { color: theme.textSecondary, fontSize: 13, fontWeight: '600' },
  modalHint: { color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 18 },
  modalInput: { backgroundColor: theme.cardSecondary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: theme.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  modalSaveBtn: { backgroundColor: theme.blue, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
