import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

  useFocusEffect(
    useCallback(() => {
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
      load();
    }, [])
  );

  async function save() {
    const bedH = parseInt(bedHour); const bedM = parseInt(bedMinute);
    const wakeH = parseInt(wakeHour); const wakeM = parseInt(wakeMinute);
    let schlafMin = (wakeH * 60 + wakeM) - (bedH * 60 + bedM);
    if (schlafMin < 0) schlafMin += 24 * 60;
    const schlafStunden = Math.round(schlafMin / 60 * 10) / 10;
    const tiefZeit = parseInt(deepZeit || '0') * 60;
    const remMin = parseInt(remZeit || '0') * 60;
    const hrvVal = parseInt(hrv || '0');
    const pulsVal = parseInt(tiefsterPuls || '50');
    const avgPulsVal = parseInt(avgPuls || '55');
    const score = calculateSleepScore({ schlafMin, tiefZeit, remZeit: remMin, hrv: hrvVal, tiefsterPuls: pulsVal, avgPuls: avgPulsVal });

    const data = {
      bedHour, bedMinute, wakeHour, wakeMinute,
      schlafStunden, schlafMin, tiefsterPuls: pulsVal, avgPuls: avgPulsVal,
      hrv: hrvVal, remZeit: parseInt(remZeit || '0'), deepZeit: parseInt(deepZeit || '0'),
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
      <BackButton />
      <Text style={styles.headerLabel}>Schlaf Log</Text>
      <Text style={styles.title}>Wie hast du{'\n'}geschlafen?</Text>

      {saved && lastScore !== null && (
        <View style={styles.savedCard}>
          <Text style={styles.savedTitle}>Heute bereits geloggt ✓</Text>
          <Text style={styles.savedScore}>Sleep Score: {lastScore}</Text>
          <TouchableOpacity onPress={() => setSaved(false)}>
            <Text style={styles.editLink}>Bearbeiten</Text>
          </TouchableOpacity>
        </View>
      )}

      {!saved && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Schlafzeiten</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeGroup}>
                <Text style={styles.timeLabel}>Schlafen gegangen</Text>
                <View style={styles.timeInputs}>
                  <TextInput style={styles.timeInput} value={bedHour} onChangeText={setBedHour} keyboardType="numeric" maxLength={2} placeholder="22" placeholderTextColor="#3D2E5C" />
                  <Text style={styles.timeSep}>:</Text>
                  <TextInput style={styles.timeInput} value={bedMinute} onChangeText={setBedMinute} keyboardType="numeric" maxLength={2} placeholder="30" placeholderTextColor="#3D2E5C" />
                </View>
              </View>
              <View style={styles.timeGroup}>
                <Text style={styles.timeLabel}>Aufgestanden</Text>
                <View style={styles.timeInputs}>
                  <TextInput style={styles.timeInput} value={wakeHour} onChangeText={setWakeHour} keyboardType="numeric" maxLength={2} placeholder="06" placeholderTextColor="#3D2E5C" />
                  <Text style={styles.timeSep}>:</Text>
                  <TextInput style={styles.timeInput} value={wakeMinute} onChangeText={setWakeMinute} keyboardType="numeric" maxLength={2} placeholder="30" placeholderTextColor="#3D2E5C" />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Herzfrequenz & HRV</Text>
            <Text style={styles.cardSub}>Von deiner Smartwatch / Polar</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Tiefster Puls</Text>
                <TextInput style={styles.input} value={tiefsterPuls} onChangeText={setTiefsterPuls} keyboardType="numeric" placeholder="z.B. 48" placeholderTextColor="#3D2E5C" />
              </View>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Ø Puls</Text>
                <TextInput style={styles.input} value={avgPuls} onChangeText={setAvgPuls} keyboardType="numeric" placeholder="z.B. 55" placeholderTextColor="#3D2E5C" />
              </View>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>HRV (ms)</Text>
                <TextInput style={styles.input} value={hrv} onChangeText={setHrv} keyboardType="numeric" placeholder="z.B. 65" placeholderTextColor="#3D2E5C" />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Schlafphasen</Text>
            <Text style={styles.cardSub}>In Stunden (optional, von Smartwatch)</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Tiefschlaf (h)</Text>
                <TextInput style={styles.input} value={deepZeit} onChangeText={setDeepZeit} keyboardType="decimal-pad" placeholder="z.B. 1.5" placeholderTextColor="#3D2E5C" />
              </View>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>REM (h)</Text>
                <TextInput style={styles.input} value={remZeit} onChangeText={setRemZeit} keyboardType="decimal-pad" placeholder="z.B. 2.0" placeholderTextColor="#3D2E5C" />
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Score Formel</Text>
            <Text style={styles.infoText}>Tiefschlaf 30% · Dauer 25% · REM 20% · HRV 15% · Puls 10%</Text>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveBtnText}>Schlaf speichern & Score anzeigen</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 24 },
  savedCard: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.3)', padding: 20, marginBottom: 20, alignItems: 'center', gap: 8 },
  savedTitle: { color: '#A78BFA', fontSize: 16, fontWeight: '500' },
  savedScore: { color: '#E2D9F3', fontSize: 28, fontWeight: '500' },
  editLink: { color: '#5B4A8A', fontSize: 13, marginTop: 4 },
  card: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 12, gap: 12 },
  cardTitle: { color: '#E2D9F3', fontSize: 15, fontWeight: '500' },
  cardSub: { color: '#5B4A8A', fontSize: 12, marginTop: -8 },
  timeRow: { flexDirection: 'row', gap: 16 },
  timeGroup: { flex: 1, gap: 8 },
  timeLabel: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 12, color: '#E2D9F3', fontSize: 20, textAlign: 'center', fontWeight: '500' },
  timeSep: { color: '#5B4A8A', fontSize: 20, fontWeight: '500' },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  inputItem: { width: '48%', gap: 6 },
  inputLabel: { color: '#5B4A8A', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 12, color: '#E2D9F3', fontSize: 16, textAlign: 'center' },
  infoCard: { backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.15)', padding: 14, marginBottom: 16 },
  infoTitle: { color: '#7C3AED', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  infoText: { color: '#5B4A8A', fontSize: 12, lineHeight: 18 },
  saveBtn: { backgroundColor: '#7C3AED', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 40 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});