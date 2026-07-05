import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { theme } from '../constants/theme';
import { useLanguage } from '../constants/LanguageContext';
import { recalcBodyBattery } from '../utils/applehealth';

type CalorieEntry = { id: string; time: string; kcal: number; label: string; };
type BatteryData = { level: number; calorieEntries: CalorieEntry[]; date: string; };

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function BatteryVisual({ level, lang }: { level: number; lang: string }) {
  const color = level >= 70 ? theme.green : level >= 40 ? theme.orange : theme.red;
  const translateY = (1 - level / 100) * 154;
  const status = level >= 70
    ? (lang === 'en' ? 'Well charged' : 'Gut geladen')
    : level >= 40
      ? (lang === 'en' ? 'Moderate' : 'Moderat')
      : (lang === 'en' ? 'Critical' : 'Kritisch');
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={120} height={220} viewBox="0 0 120 220">
        <Defs>
          <LinearGradient id="fillGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </LinearGradient>
          <ClipPath id="battClip">
            <Rect x="8" y="24" width="104" height="188" rx="16" />
          </ClipPath>
        </Defs>
        <Rect x="38" y="4" width="44" height="18" rx="6" fill={theme.cardSecondary} />
        <Rect x="8" y="24" width="104" height="188" rx="16" fill={theme.card} stroke={theme.border} strokeWidth={1.5} />
        <Rect x="8" y={24 + translateY} width="104" height={188 - translateY} rx="4"
          fill="url(#fillGrad)" clipPath="url(#battClip)" />
        <Rect x="8" y="24" width="104" height="188" rx="16" fill="none" stroke={theme.border} strokeWidth={1.5} />
        <SvgText x={60} y={122} textAnchor="middle" fill={theme.textPrimary} fontSize={32} fontWeight="600">{level}</SvgText>
        <SvgText x={60} y={142} textAnchor="middle" fill={theme.textSecondary} fontSize={10} letterSpacing={2}>BATTERY</SvgText>
        {level <= 20 && (
          <Path d="M65 88 L55 110 L62 110 L55 130 L70 106 L63 106 Z" fill={theme.orange} opacity={0.9} />
        )}
      </Svg>
      <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
        <Text style={[styles.statusText, { color }]}>{status}</Text>
      </View>
    </View>
  );
}

export default function BatteryScreen() {
  const { t, lang } = useLanguage();
  const [batteryData, setBatteryData] = useState<BatteryData | null>(null);
  const [sleepScore, setSleepScore] = useState(0);
  const [stress, setStress] = useState<number | null>(null);
  const [activeEnergy, setActiveEnergy] = useState(0);
  const [basalEnergy, setBasalEnergy] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [kcalInput, setKcalInput] = useState('');
  const [labelInput, setLabelInput] = useState('');

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const rawSleep = await AsyncStorage.getItem('lastSleep');
    const rawHealth = await AsyncStorage.getItem('stride_health_history');

    let sleepSc = 0;
    if (rawSleep) { const s = JSON.parse(rawSleep); if (isToday(s.date)) sleepSc = s.sleepScore ?? 0; }
    setSleepScore(sleepSc);

    let stressVal: number | null = null;
    let active = 0, basal = 0;
    if (rawHealth) {
      const hist = JSON.parse(rawHealth);
      const todayKey = new Date().toISOString().slice(0, 10);
      const todayEntry = hist.find((h: any) => h.date === todayKey);
      if (todayEntry) {
        stressVal = todayEntry.stressScore ?? null;
        active = todayEntry.activeEnergy ?? 0;
        basal = todayEntry.basalEnergy ?? 0;
      }
    }
    setStress(stressVal);
    setActiveEnergy(active);
    setBasalEnergy(basal);

    await recalcBodyBattery();
    const rawBattery = await AsyncStorage.getItem('batteryData');
    if (rawBattery) setBatteryData(JSON.parse(rawBattery));
  }

  async function addCalories() {
    const kcal = parseInt(kcalInput);
    if (isNaN(kcal) || kcal <= 0) { Alert.alert(lang === 'en' ? 'Invalid input' : 'Ungültige Eingabe'); return; }
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const entry: CalorieEntry = { id: Date.now().toString(), time: timeStr, kcal, label: labelInput.trim() || (lang === 'en' ? 'Activity' : 'Aktivität') };
    const newEntries = [...(batteryData?.calorieEntries ?? []), entry];
    const newData: BatteryData = { level: batteryData?.level ?? 0, calorieEntries: newEntries, date: new Date().toISOString() };
    await AsyncStorage.setItem('batteryData', JSON.stringify(newData));
    await recalcBodyBattery();
    const raw = await AsyncStorage.getItem('batteryData');
    if (raw) setBatteryData(JSON.parse(raw));
    setKcalInput(''); setLabelInput(''); setShowModal(false);
  }

  async function deleteEntry(id: string) {
    const newEntries = (batteryData?.calorieEntries ?? []).filter(e => e.id !== id);
    const newData: BatteryData = { ...batteryData!, calorieEntries: newEntries, date: new Date().toISOString() };
    await AsyncStorage.setItem('batteryData', JSON.stringify(newData));
    await recalcBodyBattery();
    const raw = await AsyncStorage.getItem('batteryData');
    if (raw) setBatteryData(JSON.parse(raw));
  }

  const level = batteryData?.level ?? 0;
  const entries = batteryData?.calorieEntries ?? [];
  const totalKcal = entries.reduce((sum, e) => sum + e.kcal, 0);
  const stressDrain = stress != null ? Math.round((stress / 20) * 4) : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <BackButton />
        <Text style={styles.headerLabel}>Body Battery</Text>
        <Text style={styles.title}>{lang === 'en' ? 'Your\nEnergy' : 'Deine\nEnergie'}</Text>

        <View style={styles.batteryWrap}>
          <BatteryVisual level={level} lang={lang} />
        </View>

        <View style={styles.statsRow}>
          {[
            { val: sleepScore || '--', lbl: 'Sleep Score', color: theme.purple },
            { val: totalKcal, lbl: lang === 'en' ? 'kcal burned' : 'kcal verbrannt', color: theme.red },
            { val: stress ?? '--', lbl: lang === 'en' ? 'Stress Score' : 'Stress-Score', color: theme.pink },
          ].map(s => (
            <View key={s.lbl} style={styles.statBox}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{lang === 'en' ? 'How is it calculated?' : 'Wie wird berechnet?'}</Text>
          <Text style={styles.infoText}>{lang === 'en' ? 'Sleep recharges your battery in the morning. Calories burned and stress drain it throughout the day.' : 'Schlaf lädt deine Batterie morgens auf. Kalorien verbrannt und Stress entladen sie über den Tag.'}</Text>
        </View>

        <Text style={styles.sectionTitle}>{lang === 'en' ? "Today's Events" : 'Heutige Events'}</Text>

        {sleepScore > 0 && (
          <View style={styles.eventRow}>
            <View style={[styles.eventDot, { backgroundColor: theme.purple }]} />
            <View style={styles.eventContent}>
              <Text style={styles.eventName}>{lang === 'en' ? 'Sleep' : 'Schlaf'}</Text>
              <Text style={styles.eventTime}>{lang === 'en' ? 'Last Night' : 'Heute Nacht'}</Text>
            </View>
            <Text style={[styles.eventDelta, { color: theme.green }]}>+{Math.round(sleepScore * 0.85)}</Text>
          </View>
        )}

        {stressDrain > 0 && (
          <View style={styles.eventRow}>
            <View style={[styles.eventDot, { backgroundColor: theme.pink }]} />
            <View style={styles.eventContent}>
              <Text style={styles.eventName}>Stress</Text>
              <Text style={styles.eventTime}>HRV · {lang === 'en' ? 'Resting HR' : 'Ruhepuls'}</Text>
            </View>
            <Text style={[styles.eventDelta, { color: theme.red }]}>-{stressDrain}</Text>
          </View>
        )}

        {activeEnergy > 0 && (
          <View style={styles.eventRow}>
            <View style={[styles.eventDot, { backgroundColor: theme.orange }]} />
            <View style={styles.eventContent}>
              <Text style={styles.eventName}>{lang === 'en' ? 'Active Energy' : 'Aktive Kalorien'}</Text>
              <Text style={styles.eventTime}>Apple Health · {activeEnergy} kcal</Text>
            </View>
            <Text style={[styles.eventDelta, { color: theme.red }]}>-{Math.round(activeEnergy / 100 * 1.5)}</Text>
          </View>
        )}

        {basalEnergy > 0 && (
          <View style={styles.eventRow}>
            <View style={[styles.eventDot, { backgroundColor: theme.orange }]} />
            <View style={styles.eventContent}>
              <Text style={styles.eventName}>{lang === 'en' ? 'Resting Energy' : 'Grundumsatz'}</Text>
              <Text style={styles.eventTime}>Apple Health · {basalEnergy} kcal</Text>
            </View>
            <Text style={[styles.eventDelta, { color: theme.red }]}>-{Math.round(basalEnergy / 100 * 1.5)}</Text>
          </View>
        )}

        {entries.map((entry, i) => (
          <View key={entry.id ?? i} style={styles.eventRow}>
            <View style={[styles.eventDot, { backgroundColor: theme.orange }]} />
            <View style={styles.eventContent}>
              <Text style={styles.eventName}>{entry.label}</Text>
              <Text style={styles.eventTime}>{entry.time} · {entry.kcal} kcal</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.eventDelta, { color: theme.red }]}>-{Math.round(entry.kcal / 100 * 1.5)}</Text>
              <TouchableOpacity
                onPress={() => Alert.alert(lang === 'en' ? 'Delete?' : 'Löschen?', entry.label, [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('delete'), style: 'destructive', onPress: () => deleteEntry(entry.id) }
                ])}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteIcon}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {entries.length === 0 && sleepScore === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{lang === 'en' ? 'Fill out the Sleep Log first to start your battery.' : 'Füll zuerst den Sleep Log aus um deine Batterie zu starten.'}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>{lang === 'en' ? '+ Log calories burned' : '+ Kalorien verbrannt eintragen'}</Text>
        </TouchableOpacity>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>{lang === 'en' ? 'When to log?' : 'Wann eintragen?'}</Text>
          <Text style={styles.tipText}>{lang === 'en' ? 'Morning, noon and evening. This shows how your energy drops over the day.' : 'Morgens, mittags und abends. So siehst du wie deine Energie über den Tag sinkt.'}</Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{lang === 'en' ? 'Calories Burned' : 'Kalorien verbrannt'}</Text>
            <Text style={styles.inputLabel}>{lang === 'en' ? 'Label' : 'Bezeichnung'}</Text>
            <TextInput style={styles.input} placeholder={lang === 'en' ? 'e.g. Morning, Noon, Workout...' : 'z.B. Morgen, Mittag, Training...'}
              placeholderTextColor={theme.textTertiary} value={labelInput} onChangeText={setLabelInput} />
            <Text style={styles.inputLabel}>{lang === 'en' ? 'Calories (kcal)' : 'Kalorien (kcal)'}</Text>
            <TextInput style={styles.input} placeholder={lang === 'en' ? 'e.g. 800' : 'z.B. 800'}
              placeholderTextColor={theme.textTertiary} value={kcalInput} onChangeText={setKcalInput} keyboardType="numeric" />
            <View style={styles.quickBtns}>
              {[500, 800, 1200, 2000].map(v => (
                <TouchableOpacity key={v} style={styles.quickBtn} onPress={() => setKcalInput(String(v))}>
                  <Text style={styles.quickBtnText}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={addCalories}>
              <Text style={styles.saveBtnText}>{lang === 'en' ? 'Log' : 'Eintragen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 20 },
  batteryWrap: { alignItems: 'center', marginBottom: 20 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 8 },
  statusText: { fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 12, alignItems: 'center', ...theme.shadow },
  statVal: { fontSize: 20, fontWeight: '600' },
  statLbl: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, textAlign: 'center' },
  infoCard: { backgroundColor: theme.blueLight, borderRadius: 14, padding: 14, marginBottom: 20 },
  infoTitle: { color: theme.blue, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: '600' },
  infoText: { color: theme.blue, fontSize: 12, lineHeight: 18, opacity: 0.8 },
  sectionTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight },
  eventDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  eventContent: { flex: 1 },
  eventName: { color: theme.textPrimary, fontSize: 13, fontWeight: '500' },
  eventTime: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  eventDelta: { fontSize: 14, fontWeight: '600' },
  deleteIcon: { color: theme.textTertiary, fontSize: 20 },
  emptyState: { padding: 20, alignItems: 'center' },
  emptyText: { color: theme.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  addBtn: { backgroundColor: theme.blue, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 16, marginBottom: 12, ...theme.shadow },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  tipCard: { backgroundColor: theme.card, borderRadius: 14, padding: 14, marginBottom: 20, ...theme.shadow },
  tipTitle: { color: theme.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  tipText: { color: theme.textSecondary, fontSize: 12, lineHeight: 18 },
  modalCard: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: '600' },
  inputLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 14, color: theme.textPrimary, fontSize: 15 },
  quickBtns: { flexDirection: 'row', gap: 8 },
  quickBtn: { flex: 1, backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 10, alignItems: 'center' },
  quickBtnText: { color: theme.blue, fontSize: 13, fontWeight: '500' },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: theme.textSecondary, fontSize: 14 },
});