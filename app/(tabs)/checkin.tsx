import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
type RatingRowProps = {
  label: string;
  color: string;
  value: number;
  setValue: (n: number) => void;
};

function RatingRow({ label, color, value, setValue, disabled }: RatingRowProps & { disabled?: boolean }) {
  return (
    <View style={styles.ratingBlock}>
      <Text style={[styles.ratingLabel, { color }]}>{label}</Text>
      <View style={styles.ratingButtons}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            style={[
              styles.ratingBtn,
              value === n && { backgroundColor: color, borderColor: color },
              disabled && { opacity: 0.5 }
            ]}
            onPress={() => !disabled && setValue(n)}
          >
            <Text style={[styles.ratingBtnText, value === n && { color: '#07040F' }]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
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

export default function CheckinScreen() {
  const [energie, setEnergie] = useState(3);
  const [stress, setStress] = useState(3);
  const [motivation, setMotivation] = useState(3);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [editing, setEditing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const raw = await AsyncStorage.getItem('lastCheckin');
        if (raw) {
          const data = JSON.parse(raw);
          setEnergie(data.energie ?? 3);
          setStress(data.stress ?? 3);
          setMotivation(data.motivation ?? 3);
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

  const score = Math.round((energie + (6 - stress) + motivation) / 3 * 20);
  const scoreColor = score >= 70 ? '#A78BFA' : score >= 50 ? '#F472B6' : '#FB7185';
  const scoreText = score >= 70 ? 'Gut – normales Training möglich' : score >= 50 ? 'Moderat – Intensität reduzieren' : 'Erholung empfohlen';

  const isReadOnly = alreadyDone && !editing;

  async function handleSave() {
    const data = {
      energie,
      stress,
      motivation,
      score,
      date: new Date().toISOString(),
    };
    await AsyncStorage.setItem('lastCheckin', JSON.stringify(data));

    if (!alreadyDone) {
      const rawHistory = await AsyncStorage.getItem('checkinHistory');
      const history = rawHistory ? JSON.parse(rawHistory) : [];
      history.push(data);
      await AsyncStorage.setItem('checkinHistory', JSON.stringify(history));
    } else {
      const rawHistory = await AsyncStorage.getItem('checkinHistory');
      if (rawHistory) {
        const history = JSON.parse(rawHistory);
        history[history.length - 1] = data;
        await AsyncStorage.setItem('checkinHistory', JSON.stringify(history));
      }
    }

    setAlreadyDone(true);
    setEditing(false);
    router.push('/score-reveal');
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <BackButton />
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Check-in</Text>
        {alreadyDone && !editing && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>Bearbeiten</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>
        {isReadOnly ? 'Heute erledigt ✓' : 'Wie läuft\ndein Tag?'}
      </Text>
      <Text style={styles.subtitle}>
        {isReadOnly ? 'Tippe Bearbeiten um Werte anzupassen' : 'Dauert unter 1 Minute'}
      </Text>

      <View style={styles.card}>
        <RatingRow label="Energie" color="#67E8F9" value={energie} setValue={setEnergie} disabled={isReadOnly} />
        <RatingRow label="Stress" color="#F472B6" value={stress} setValue={setStress} disabled={isReadOnly} />
        <RatingRow label="Motivation" color="#FB923C" value={motivation} setValue={setMotivation} disabled={isReadOnly} />
      </View>

      <View style={styles.scorePreview}>
        <Text style={styles.scorePreviewLabel}>Heutiger Score</Text>
        <Text style={[styles.scorePreviewNumber, { color: scoreColor }]}>{score}</Text>
        <Text style={[styles.scorePreviewText, { color: scoreColor }]}>{scoreText}</Text>
      </View>

      {!isReadOnly && (
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>
            {editing ? 'Änderungen speichern' : 'Check-in speichern'}
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
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    gap: 20,
    marginBottom: 16,
  },
  ratingBlock: {
    gap: 10,
  },
  ratingLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '500',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  ratingBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ratingBtnText: {
    color: '#3D2E5C',
    fontSize: 13,
    fontWeight: '500',
  },
  scorePreview: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.25)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  scorePreviewLabel: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  scorePreviewNumber: {
    fontSize: 56,
    fontWeight: '500',
    lineHeight: 60,
  },
  scorePreviewText: {
    fontSize: 12,
    marginTop: 6,
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