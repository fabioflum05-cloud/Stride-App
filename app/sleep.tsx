import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { useLanguage } from '../constants/LanguageContext';
import { calculateSleepScore, recalcBodyBattery } from '../utils/applehealth';

export default function SleepScreen() {
  const { lang } = useLanguage();
  const [bedHour, setBedHour] = useState('22');
  const [bedMinute, setBedMinute] = useState('30');
  const [wakeHour, setWakeHour] = useState('06');
  const [wakeMinute, setWakeMinute] = useState('30');
  const [tiefsterPuls, setTiefsterPuls] = useState('');
  const [avgPuls, setAvgPuls] = useState('');
  const [hrv, setHrv] = useState('');
  const [remZeit, setRemZeit] = useState('');
  const [deepZeit, setDeepZeit] = useState('');
  const [saved, setSaved] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useFocusEffect(
    useCallback(() => {
      load();
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      ]).start();
    }, [])
  );

  async function load() {
    const raw = await AsyncStorage.getItem('lastSleep');
    if (raw) {
      const s = JSON.parse(raw);
      const today = new Date();
      const date = new Date(s.date);
      if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth()) {
        setLastScore(s.sleepScore);
        setSaved(true);
      }
    }
  }

  async function save() {
  const bedH = parseInt(bedHour); const bedM = parseInt(bedMinute);
  const wakeH = parseInt(wakeHour); const wakeM = parseInt(wakeMinute);
  let schlafMin = (wakeH * 60 + wakeM) - (bedH * 60 + bedM);
  if (schlafMin < 0) schlafMin += 24 * 60;

  const tiefZeit = parseFloat(deepZeit || '0');
  const remMin = parseFloat(remZeit || '0');
  const hrvVal = parseInt(hrv || '0');
  const pulsVal = parseInt(tiefsterPuls || '50');
  const avgPulsVal = parseInt(avgPuls || '55');
  const score = calculateSleepScore({ schlafMin, tiefZeit, remZeit: remMin, hrv: hrvVal, tiefsterPuls: pulsVal, avgPuls: avgPulsVal });

  // Einschlaf- und Aufwachzeit als ISO-Strings berechnen
  const now = new Date();
  const bedtime = new Date(now);
  bedtime.setHours(bedH, bedM, 0, 0);
  if (bedH >= 18) bedtime.setDate(bedtime.getDate() - 1); // gestern Abend eingeschlafen
  const wakeTime = new Date(now);
  wakeTime.setHours(wakeH, wakeM, 0, 0);

  // Leichtschlaf = Gesamtschlaf - Tief - REM
  const lightMin = Math.max(0, schlafMin - tiefZeit - remMin);

  const data = {
    bedHour, bedMinute, wakeHour, wakeMinute,
    schlafStunden: Math.round(schlafMin / 60 * 10) / 10,
    schlafMin,
    tiefsterPuls: pulsVal,
    avgPuls: avgPulsVal,
    hrv: hrvVal,
    remZeit: remMin / 60,
    deepZeit: tiefZeit / 60,
    sleepScore: score,
    date: new Date().toISOString(),
    // NEU – für Health Screen Detail Card
    deep: tiefZeit,           // Minuten Tiefschlaf
    rem: remMin,              // Minuten REM
    light: lightMin,          // Minuten Leichtschlaf (berechnet)
    bedtime: bedtime.toISOString(),
    wakeTime: wakeTime.toISOString(),
    restingHR: pulsVal,       // tiefster Puls = Ruhepuls
  };

  await AsyncStorage.setItem('lastSleep', JSON.stringify(data));

  // sleepHistory updaten
  const rawHistory = await AsyncStorage.getItem('sleepHistory');
  const history = rawHistory ? JSON.parse(rawHistory) : [];
  const today = new Date().toDateString();
  const filtered = history.filter((h: any) => new Date(h.date).toDateString() !== today);
  filtered.push(data);
  await AsyncStorage.setItem('sleepHistory', JSON.stringify(filtered));

  // NEU – hrvHistory updaten (HRV kommt aus Sleep-Log)
  if (hrvVal > 0) {
    const rawHRV = await AsyncStorage.getItem('hrvHistory');
    const hrvHistory = rawHRV ? JSON.parse(rawHRV) : [];
    const filteredHRV = hrvHistory.filter((h: any) => new Date(h.date).toDateString() !== today);
    filteredHRV.push({ date: new Date().toISOString(), value: hrvVal });
    await AsyncStorage.setItem('hrvHistory', JSON.stringify(filteredHRV));
  }

  await recalcBodyBattery();

  setLastScore(score);
  setSaved(true);
  router.push('/score-reveal' as any);
}
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <BackButton />
          <Text style={styles.headerLabel}>{lang === 'en' ? 'Sleep Log' : 'Schlaf Log'}</Text>
          <Text style={styles.title}>{lang === 'en' ? 'How did you' : 'Wie hast du'}{'\n'}{lang === 'en' ? 'sleep?' : 'geschlafen?'}</Text>

          {saved && lastScore !== null && (
            <View style={styles.savedCard}>
              <Text style={styles.savedEmoji}>✓</Text>
              <Text style={styles.savedTitle}>{lang === 'en' ? 'Already logged today' : 'Heute bereits geloggt'}</Text>
              <Text style={styles.savedScore}>{lastScore}</Text>
              <Text style={styles.savedScoreLabel}>Sleep Score</Text>
              <TouchableOpacity onPress={() => setSaved(false)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>{lang === 'en' ? 'Edit' : 'Bearbeiten'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!saved && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{lang === 'en' ? 'Sleep Times' : 'Schlafzeiten'}</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeGroup}>
                    <Text style={styles.timeLabel}>{lang === 'en' ? 'Fell asleep' : 'Eingeschlafen'}</Text>
                    <View style={styles.timeInputs}>
                      <TextInput style={styles.timeInput} value={bedHour} onChangeText={setBedHour} keyboardType="numeric" maxLength={2} placeholder="22" placeholderTextColor={theme.textTertiary} />
                      <Text style={styles.timeSep}>:</Text>
                      <TextInput style={styles.timeInput} value={bedMinute} onChangeText={setBedMinute} keyboardType="numeric" maxLength={2} placeholder="30" placeholderTextColor={theme.textTertiary} />
                    </View>
                  </View>
                  <View style={[styles.timeGroup, { alignItems: 'flex-end' }]}>
                    <Text style={styles.timeLabel}>{lang === 'en' ? 'Woke up' : 'Aufgestanden'}</Text>
                    <View style={styles.timeInputs}>
                      <TextInput style={styles.timeInput} value={wakeHour} onChangeText={setWakeHour} keyboardType="numeric" maxLength={2} placeholder="06" placeholderTextColor={theme.textTertiary} />
                      <Text style={styles.timeSep}>:</Text>
                      <TextInput style={styles.timeInput} value={wakeMinute} onChangeText={setWakeMinute} keyboardType="numeric" maxLength={2} placeholder="30" placeholderTextColor={theme.textTertiary} />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{lang === 'en' ? 'Heart Rate & HRV' : 'Herzfrequenz & HRV'}</Text>
                <Text style={styles.cardSub}>{lang === 'en' ? 'From your smartwatch / Polar' : 'Von deiner Smartwatch / Polar'}</Text>
                <View style={styles.inputGrid}>
                  {[
                    { label: lang === 'en' ? 'Lowest Pulse' : 'Tiefster Puls', value: tiefsterPuls, setter: setTiefsterPuls, placeholder: '48' },
                    { label: lang === 'en' ? 'Avg. Pulse' : 'Ø Puls', value: avgPuls, setter: setAvgPuls, placeholder: '55' },
                    { label: 'HRV (ms)', value: hrv, setter: setHrv, placeholder: '65' },
                  ].map(f => (
                    <View key={f.label} style={styles.inputItem}>
                      <Text style={styles.inputLabel}>{f.label}</Text>
                      <TextInput style={styles.input} value={f.value} onChangeText={f.setter}
                        keyboardType="numeric" placeholder={f.placeholder} placeholderTextColor={theme.textTertiary} />
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{lang === 'en' ? 'Sleep Phases' : 'Schlafphasen'}</Text>
                <Text style={styles.cardSub}>{lang === 'en' ? 'In minutes – optional, from smartwatch' : 'In Minuten – optional, von Smartwatch'}</Text>
                <View style={styles.inputGrid}>
                  {[
                    { label: lang === 'en' ? 'Deep sleep (min)' : 'Tiefschlaf (min)', value: deepZeit, setter: setDeepZeit, placeholder: '90' },
                    { label: 'REM (min)', value: remZeit, setter: setRemZeit, placeholder: '120' },
                  ].map(f => (
                    <View key={f.label} style={styles.inputItem}>
                      <Text style={styles.inputLabel}>{f.label}</Text>
                      <TextInput style={styles.input} value={f.value} onChangeText={f.setter}
                        keyboardType="numeric" placeholder={f.placeholder} placeholderTextColor={theme.textTertiary} />
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>{lang === 'en' ? 'Score Formula' : 'Score Formel'}</Text>
                <Text style={styles.infoText}>{lang === 'en' ? 'Deep sleep 30% · Duration 25% · REM 20% · HRV 15% · Pulse 10%' : 'Tiefschlaf 30% · Dauer 25% · REM 20% · HRV 15% · Puls 10%'}</Text>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
                <Text style={styles.saveBtnText}>{lang === 'en' ? 'Save sleep & show score' : 'Schlaf speichern & Score anzeigen'}</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 80 }} />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 24 },
  savedCard: { backgroundColor: theme.card, borderRadius: 20, padding: 28, alignItems: 'center', gap: 6, ...theme.shadow, marginBottom: 20 },
  savedEmoji: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.greenLight, textAlign: 'center', lineHeight: 52, fontSize: 22, color: theme.green, fontWeight: '700', overflow: 'hidden' },
  savedTitle: { color: theme.textSecondary, fontSize: 14, marginTop: 8 },
  savedScore: { color: theme.textPrimary, fontSize: 56, fontWeight: '300', letterSpacing: -2 },
  savedScoreLabel: { color: theme.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: -8 },
  editBtn: { marginTop: 8, backgroundColor: theme.cardSecondary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  editBtnText: { color: theme.blue, fontSize: 13, fontWeight: '500' },
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 12, gap: 12, ...theme.shadow },
  cardTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
  cardSub: { color: theme.textSecondary, fontSize: 12, marginTop: -8 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeGroup: { gap: 8 },
  timeLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: { width: 56, backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 12, color: theme.textPrimary, fontSize: 22, textAlign: 'center', fontWeight: '500' },
  timeSep: { color: theme.textSecondary, fontSize: 22, fontWeight: '500' },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  inputItem: { width: '48%', gap: 6 },
  inputLabel: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 12, color: theme.textPrimary, fontSize: 16, textAlign: 'center' },
  infoCard: { backgroundColor: theme.blueLight, borderRadius: 12, padding: 14, marginBottom: 16 },
  infoTitle: { color: theme.blue, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: '600' },
  infoText: { color: theme.blue, fontSize: 12, lineHeight: 18, opacity: 0.8 },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 16, padding: 16, alignItems: 'center', ...theme.shadow },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});