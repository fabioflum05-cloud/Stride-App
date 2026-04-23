import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function MetricRow({ label, unit, value, setValue, min, max, step, color, disabled }: {
  label: string, unit: string, value: number, setValue: (n: number) => void,
  min: number, max: number, step: number, color: string, disabled?: boolean
}) {
  return (
    <View style={[styles.metricBlock, disabled && { opacity: 0.5 }]}>
      <View style={styles.metricHeader}>
        <Text style={[styles.metricLabel, { color }]}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>{value}{unit}</Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={v => !disabled && setValue(v)}
        minimumTrackTintColor={color}
        maximumTrackTintColor="rgba(255,255,255,0.06)"
        thumbTintColor={color}
        disabled={disabled}
      />
      <View style={styles.metricFooter}>
        <Text style={styles.metricEnd}>{min}{unit}</Text>
        <Text style={styles.metricEnd}>{max}{unit}</Text>
      </View>
    </View>
  );
}

function TimeRow({ label, color, hour, minute, setHour, setMinute, disabled }: {
  label: string, color: string,
  hour: number, minute: number,
  setHour: (n: number) => void,
  setMinute: (n: number) => void,
  disabled?: boolean
}) {
  return (
    <View style={[styles.metricBlock, disabled && { opacity: 0.5 }]}>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
      <View style={styles.timeRow}>
        <View style={styles.timeBox}>
          <Text style={styles.timeBoxLabel}>Stunde</Text>
          <View style={styles.timeButtons}>
            <TouchableOpacity style={styles.timeBtn} onPress={() => !disabled && setHour(Math.max(0, hour - 1))}>
              <Text style={styles.timeBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.timeValue, { color }]}>{String(hour).padStart(2, '0')}</Text>
            <TouchableOpacity style={styles.timeBtn} onPress={() => !disabled && setHour(Math.min(23, hour + 1))}>
              <Text style={styles.timeBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.timeSeparator}>:</Text>
        <View style={styles.timeBox}>
          <Text style={styles.timeBoxLabel}>Minute</Text>
          <View style={styles.timeButtons}>
            <TouchableOpacity style={styles.timeBtn} onPress={() => !disabled && setMinute(minute === 0 ? 45 : minute - 15)}>
              <Text style={styles.timeBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.timeValue, { color }]}>{String(minute).padStart(2, '0')}</Text>
            <TouchableOpacity style={styles.timeBtn} onPress={() => !disabled && setMinute(minute === 45 ? 0 : minute + 15)}>
              <Text style={styles.timeBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

export default function SleepScreen() {
  const [bedHour, setBedHour] = useState(23);
  const [bedMinute, setBedMinute] = useState(0);
  const [wakeHour, setWakeHour] = useState(7);
  const [wakeMinute, setWakeMinute] = useState(0);
  const [tiefsterPuls, setTiefsterPuls] = useState(48);
  const [avgPuls, setAvgPuls] = useState(58);
  const [hrv, setHrv] = useState(55);
  const [remZeit, setRemZeit] = useState(90);
  const [deepZeit, setDeepZeit] = useState(60);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [editing, setEditing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const raw = await AsyncStorage.getItem('lastSleep');
        if (raw) {
          const data = JSON.parse(raw);
          setBedHour(data.bedHour ?? 23);
          setBedMinute(data.bedMinute ?? 0);
          setWakeHour(data.wakeHour ?? 7);
          setWakeMinute(data.wakeMinute ?? 0);
          setTiefsterPuls(data.tiefsterPuls ?? 48);
          setAvgPuls(data.avgPuls ?? 58);
          setHrv(data.hrv ?? 55);
          setRemZeit(data.remZeit ?? 90);
          setDeepZeit(data.deepZeit ?? 60);
          if (isToday(data.date)) {
            setAlreadyDone(true);
            setEditing(false);
          } else {
            setAlreadyDone(false);
          }
        }
      }
      load();
    }, [])
  );

  const schlafMinuten = (() => {
    const bedTotal = bedHour * 60 + bedMinute;
    const wakeTotal = wakeHour * 60 + wakeMinute;
    return wakeTotal > bedTotal ? wakeTotal - bedTotal : (1440 - bedTotal) + wakeTotal;
  })();
  const schlafStunden = parseFloat((schlafMinuten / 60).toFixed(1));

  const sleepScore = Math.round(
    (schlafMinuten < 360
      ? (schlafMinuten / 360) * 0.5
      : schlafMinuten <= 540
        ? 0.5 + ((schlafMinuten - 360) / 180) * 0.5
        : Math.max(0.85, 1 - ((schlafMinuten - 540) / 120) * 0.15)
    ) * 25 +
    (Math.min(deepZeit / (schlafMinuten * 0.20), 1) * 30) +
    (Math.min(remZeit / (schlafMinuten * 0.22), 1) * 20) +
    (Math.min(hrv / 75, 1) * 15) +
    (Math.max(0, Math.min((65 - tiefsterPuls) / 25, 1)) * 10)
  );

  const scoreColor = sleepScore >= 70 ? '#A78BFA' : sleepScore >= 50 ? '#F472B6' : '#FB7185';
  const scoreText = sleepScore >= 70 ? 'Erholsam' : sleepScore >= 50 ? 'Moderat' : 'Schlecht';
  const isReadOnly = alreadyDone && !editing;

  async function handleSave() {
    const data = {
      bedHour, bedMinute, wakeHour, wakeMinute,
      schlafStunden,
      tiefsterPuls, avgPuls, hrv,
      remZeit, deepZeit, sleepScore,
      date: new Date().toISOString(),
    };
    await AsyncStorage.setItem('lastSleep', JSON.stringify(data));

    const rawHistory = await AsyncStorage.getItem('sleepHistory');
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    if (!alreadyDone) {
      history.push(data);
    } else {
      history[history.length - 1] = data;
    }
    await AsyncStorage.setItem('sleepHistory', JSON.stringify(history));

    setAlreadyDone(true);
    setEditing(false);
    Alert.alert('Gespeichert! ✓', `Dein Sleep Score: ${sleepScore}`);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <BackButton />
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Sleep Log</Text>
        {alreadyDone && !editing && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>Bearbeiten</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>
        {isReadOnly ? 'Heute geloggt ✓' : 'Wie hast du\ngeschlafen?'}
      </Text>
      <Text style={styles.subtitle}>
        {isReadOnly ? 'Tippe Bearbeiten um Werte anzupassen' : 'Trag deine Nacht ein'}
      </Text>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Sleep Score</Text>
        <Text style={[styles.scoreNumber, { color: scoreColor }]}>{sleepScore}</Text>
        <Text style={[styles.scoreText, { color: scoreColor }]}>{scoreText}</Text>
        <View style={styles.scoreMeta}>
          <View style={styles.scoreMetaItem}>
            <Text style={styles.scoreMetaVal}>{schlafStunden}h</Text>
            <Text style={styles.scoreMetaLbl}>Schlafdauer</Text>
          </View>
          <View style={styles.scoreMetaDivider} />
          <View style={styles.scoreMetaItem}>
            <Text style={styles.scoreMetaVal}>{hrv}</Text>
            <Text style={styles.scoreMetaLbl}>HRV</Text>
          </View>
          <View style={styles.scoreMetaDivider} />
          <View style={styles.scoreMetaItem}>
            <Text style={styles.scoreMetaVal}>{deepZeit}m</Text>
            <Text style={styles.scoreMetaLbl}>Tiefschlaf</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Zeiten</Text>
      <View style={styles.card}>
        <TimeRow label="Einschlafen" color="#7C3AED"
          hour={bedHour} minute={bedMinute}
          setHour={setBedHour} setMinute={setBedMinute}
          disabled={isReadOnly} />
        <TimeRow label="Aufwachen" color="#A78BFA"
          hour={wakeHour} minute={wakeMinute}
          setHour={setWakeHour} setMinute={setWakeMinute}
          disabled={isReadOnly} />
      </View>

      <Text style={styles.sectionTitle}>Herzfrequenz & HRV</Text>
      <View style={styles.card}>
        <MetricRow label="Tiefster Puls" unit=" bpm" value={tiefsterPuls}
          setValue={setTiefsterPuls} min={35} max={70} step={1} color="#EC4899" disabled={isReadOnly} />
        <MetricRow label="Durchschnittspuls" unit=" bpm" value={avgPuls}
          setValue={setAvgPuls} min={40} max={90} step={1} color="#F472B6" disabled={isReadOnly} />
        <MetricRow label="HRV" unit=" ms" value={hrv}
          setValue={setHrv} min={20} max={120} step={1} color="#67E8F9" disabled={isReadOnly} />
      </View>

      <Text style={styles.sectionTitle}>Schlafphasen</Text>
      <View style={styles.card}>
        <MetricRow label="REM-Schlaf" unit=" min" value={remZeit}
          setValue={setRemZeit} min={0} max={180} step={5} color="#A78BFA" disabled={isReadOnly} />
        <MetricRow label="Tiefschlaf" unit=" min" value={deepZeit}
          setValue={setDeepZeit} min={0} max={180} step={5} color="#7C3AED" disabled={isReadOnly} />
      </View>

      {!isReadOnly && (
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>
            {editing ? 'Änderungen speichern' : 'Sleep Log speichern'}
          </Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07040F',
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 12,
  },
  headerLabel: {
    color: '#5B4A8A',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  editBtn: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.4)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editBtnText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '500',
  },
  title: {
    color: '#E2D9F3',
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 36,
    marginBottom: 6,
  },
  subtitle: {
    color: '#5B4A8A',
    fontSize: 13,
    marginBottom: 24,
  },
  scoreCard: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.2)',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreLabel: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 72,
    fontWeight: '500',
    lineHeight: 76,
  },
  scoreText: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
  },
  scoreMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreMetaItem: {
    alignItems: 'center',
  },
  scoreMetaVal: {
    color: '#E2D9F3',
    fontSize: 16,
    fontWeight: '500',
  },
  scoreMetaLbl: {
    color: '#5B4A8A',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  scoreMetaDivider: {
    width: 0.5,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    gap: 20,
    marginBottom: 20,
  },
  metricBlock: {
    gap: 6,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricEnd: {
    color: '#3D2E5C',
    fontSize: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  timeBox: {
    alignItems: 'center',
    gap: 6,
  },
  timeBoxLabel: {
    color: '#3D2E5C',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timeButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBtnText: {
    color: '#A78BFA',
    fontSize: 18,
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'center',
  },
  timeSeparator: {
    color: '#3D2E5C',
    fontSize: 32,
    fontWeight: '500',
    marginTop: 20,
  },
  saveBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: '#7C3AED',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});