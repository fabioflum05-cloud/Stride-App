import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

function calculateSleepScore(data: {
  schlafMin: number; tiefZeit: number; remZeit: number;
  hrv: number; tiefsterPuls: number; avgPuls: number;
}): number {
  const { schlafMin, tiefZeit, remZeit, hrv, tiefsterPuls } = data;
  const deep = Math.min(tiefZeit / (schlafMin * 0.20), 1) * 30;
  const dur = schlafMin < 300 ? (schlafMin / 360) * 25 :
    schlafMin <= 540 ? 25 :
    schlafMin <= 600 ? (1 - (schlafMin - 540) / 120) * 25 : 0;
  const rem = Math.min(remZeit / (schlafMin * 0.22), 1) * 20;
  const hrvScore = Math.min(hrv / 75, 1) * 15;
  const pulse = Math.max(0, Math.min((65 - tiefsterPuls) / 25, 1)) * 10;
  return Math.round(deep + dur + rem + hrvScore + pulse);
}

export default function SleepScreen() {
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
    const tiefZeit = parseFloat(deepZeit || '0') * 60;
    const remMin = parseFloat(remZeit || '0') * 60;
    const hrvVal = parseInt(hrv || '0');
    const pulsVal = parseInt(tiefsterPuls || '50');
    const avgPulsVal = parseInt(avgPuls || '55');
    const score = calculateSleepScore({ schlafMin, tiefZeit, remZeit: remMin, hrv: hrvVal, tiefsterPuls: pulsVal, avgPuls: avgPulsVal });

    const data = {
      bedHour, bedMinute, wakeHour, wakeMinute,
      schlafStunden: Math.round(schlafMin / 60 * 10) / 10,
      schlafMin, tiefsterPuls: pulsVal, avgPuls: avgPulsVal,
      hrv: hrvVal, remZeit: parseFloat(remZeit || '0'), deepZeit: parseFloat(deepZeit || '0'),
      sleepScore: score, date: new Date().toISOString(),
    };

    await AsyncStorage.setItem('lastSleep', JSON.stringify(data));
    const rawHistory = await AsyncStorage.getItem('sleepHistory');
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    const today = new Date().toDateString();
    const filtered = history.filter((h: any) => new Date(h.date).toDateString() !== today);
    filtered.push(data);
    await AsyncStorage.setItem('sleepHistory', JSON.stringify(filtered));
    setLastScore(score);
    setSaved(true);
    router.push('/score-reveal' as any);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <BackButton />
        <Text style={styles.headerLabel}>Schlaf Log</Text>
        <Text style={styles.title}>Wie hast du{'\n'}geschlafen?</Text>

        {saved && lastScore !== null && (
          <View style={styles.savedCard}>
            <Text style={styles.savedEmoji}>✓</Text>
            <Text style={styles.savedTitle}>Heute bereits geloggt</Text>
            <Text style={styles.savedScore}>{lastScore}</Text>
            <Text style={styles.savedScoreLabel}>Sleep Score</Text>
            <TouchableOpacity onPress={() => setSaved(false)} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Bearbeiten</Text>
            </TouchableOpacity>
          </View>
        )}

        {!saved && (
          <>
            {/* Schlafzeiten */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Schlafzeiten</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeGroup}>
                  <Text style={styles.timeLabel}>Eingeschlafen</Text>
                  <View style={styles.timeInputs}>
                    <TextInput style={styles.timeInput} value={bedHour} onChangeText={setBedHour} keyboardType="numeric" maxLength={2} placeholder="22" placeholderTextColor={theme.textTertiary} />
                    <Text style={styles.timeSep}>:</Text>
                    <TextInput style={styles.timeInput} value={bedMinute} onChangeText={setBedMinute} keyboardType="numeric" maxLength={2} placeholder="30" placeholderTextColor={theme.textTertiary} />
                  </View>
                </View>
                <View style={[styles.timeGroup, { alignItems: 'flex-end' }]}>
                  <Text style={styles.timeLabel}>Aufgestanden</Text>
                  <View style={styles.timeInputs}>
                    <TextInput style={styles.timeInput} value={wakeHour} onChangeText={setWakeHour} keyboardType="numeric" maxLength={2} placeholder="06" placeholderTextColor={theme.textTertiary} />
                    <Text style={styles.timeSep}>:</Text>
                    <TextInput style={styles.timeInput} value={wakeMinute} onChangeText={setWakeMinute} keyboardType="numeric" maxLength={2} placeholder="30" placeholderTextColor={theme.textTertiary} />
                  </View>
                </View>
              </View>
            </View>

            {/* Herzfrequenz & HRV */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Herzfrequenz & HRV</Text>
              <Text style={styles.cardSub}>Von deiner Smartwatch / Polar</Text>
              <View style={styles.inputGrid}>
                {[
                  { label: 'Tiefster Puls', value: tiefsterPuls, setter: setTiefsterPuls, placeholder: '48' },
                  { label: 'Ø Puls', value: avgPuls, setter: setAvgPuls, placeholder: '55' },
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

            {/* Schlafphasen */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Schlafphasen</Text>
              <Text style={styles.cardSub}>In Stunden – optional, von Smartwatch</Text>
              <View style={styles.inputGrid}>
                {[
                  { label: 'Tiefschlaf (h)', value: deepZeit, setter: setDeepZeit, placeholder: '1.5' },
                  { label: 'REM (h)', value: remZeit, setter: setRemZeit, placeholder: '2.0' },
                ].map(f => (
                  <View key={f.label} style={styles.inputItem}>
                    <Text style={styles.inputLabel}>{f.label}</Text>
                    <TextInput style={styles.input} value={f.value} onChangeText={f.setter}
                      keyboardType="decimal-pad" placeholder={f.placeholder} placeholderTextColor={theme.textTertiary} />
                  </View>
                ))}
              </View>
            </View>

            {/* Score Formel Info */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Score Formel</Text>
              <Text style={styles.infoText}>Tiefschlaf 30% · Dauer 25% · REM 20% · HRV 15% · Puls 10%</Text>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Schlaf speichern & Score anzeigen</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 80 }} />
      </Animated.View>
    </ScrollView>
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