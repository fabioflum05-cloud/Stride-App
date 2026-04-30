import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
type Profile = {
  name: string;
  age: string;
  weight: string;
  targetWeight: string;
  height: string;
  sport: string;
  goal: string;
};

const GOALS = ['Masse aufbauen', 'Fett verlieren', 'Performance', 'Gesundheit', 'Wettkampf'];
const SPORTS = ['Judo', 'BJJ', 'Boxing', 'MMA', 'Gym', 'Running', 'Cycling', 'Swimming', 'Football', 'Other'];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>({
    name: '',
    age: '',
    weight: '',
    targetWeight: '',
    height: '',
    sport: 'Judo',
    goal: 'Performance',
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const raw = await AsyncStorage.getItem('profile');
        if (raw) {
          setProfile(JSON.parse(raw));
          setSaved(true);
        } else {
          setEditing(true);
        }
      }
      load();
    }, [])
  );

  async function handleSave() {
    if (!profile.name.trim()) {
      Alert.alert('Name fehlt', 'Bitte gib deinen Namen ein.');
      return;
    }
    await AsyncStorage.setItem('profile', JSON.stringify(profile));
    setSaved(true);
    setEditing(false);
  }

  const bmi = profile.weight && profile.height
    ? (parseFloat(profile.weight) / Math.pow(parseFloat(profile.height) / 100, 2)).toFixed(1)
    : null;

  const weightDiff = profile.weight && profile.targetWeight
    ? (parseFloat(profile.targetWeight) - parseFloat(profile.weight)).toFixed(1)
    : null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <BackButton />
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Profil</Text>
        {saved && !editing && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>Bearbeiten</Text>
          </TouchableOpacity>
        )}
      </View>

      {saved && !editing && (
        <View style={styles.avatarSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileSub}>{profile.sport} · {profile.goal}</Text>
        </View>
      )}

      {saved && !editing && (
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderColor: 'rgba(167,139,250,0.25)' }]}>
            <Text style={[styles.statVal, { color: '#A78BFA' }]}>{profile.weight || '--'}</Text>
            <Text style={styles.statLbl}>kg aktuell</Text>
          </View>
          <View style={[styles.statCard, { borderColor: 'rgba(103,232,249,0.25)' }]}>
            <Text style={[styles.statVal, { color: '#67E8F9' }]}>{profile.targetWeight || '--'}</Text>
            <Text style={styles.statLbl}>kg Ziel</Text>
          </View>
          <View style={[styles.statCard, { borderColor: 'rgba(251,146,60,0.25)' }]}>
            <Text style={[styles.statVal, { color: '#FB923C' }]}>{bmi || '--'}</Text>
            <Text style={styles.statLbl}>BMI</Text>
          </View>
          <View style={[styles.statCard, { borderColor: 'rgba(244,114,182,0.25)' }]}>
            <Text style={[styles.statVal, { color: weightDiff && parseFloat(weightDiff) > 0 ? '#A78BFA' : '#FB7185' }]}>
              {weightDiff ? `${parseFloat(weightDiff) > 0 ? '+' : ''}${weightDiff}` : '--'}
            </Text>
            <Text style={styles.statLbl}>kg bis Ziel</Text>
          </View>
        </View>
      )}

      {editing && (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Persönlich</Text>
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Dein Name"
              placeholderTextColor="#3D2E5C"
              value={profile.name}
              onChangeText={v => setProfile({ ...profile, name: v })}
            />
            <Text style={styles.inputLabel}>Alter</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. 22"
              placeholderTextColor="#3D2E5C"
              value={profile.age}
              onChangeText={v => setProfile({ ...profile, age: v })}
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Grösse (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. 175"
              placeholderTextColor="#3D2E5C"
              value={profile.height}
              onChangeText={v => setProfile({ ...profile, height: v })}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.sectionTitle}>Körper</Text>
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Aktuelles Gewicht (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. 70.5"
              placeholderTextColor="#3D2E5C"
              value={profile.weight}
              onChangeText={v => setProfile({ ...profile, weight: v })}
              keyboardType="decimal-pad"
            />
            <Text style={styles.inputLabel}>Zielgewicht (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. 73.0"
              placeholderTextColor="#3D2E5C"
              value={profile.targetWeight}
              onChangeText={v => setProfile({ ...profile, targetWeight: v })}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={styles.sectionTitle}>Sport</Text>
          <View style={styles.formCard}>
            <View style={styles.chipGrid}>
              {SPORTS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, profile.sport === s && styles.chipActive]}
                  onPress={() => setProfile({ ...profile, sport: s })}
                >
                  <Text style={[styles.chipText, profile.sport === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Ziel</Text>
          <View style={styles.formCard}>
            <View style={styles.chipGrid}>
              {GOALS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, profile.goal === g && styles.chipActive]}
                  onPress={() => setProfile({ ...profile, goal: g })}
                >
                  <Text style={[styles.chipText, profile.goal === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Profil speichern</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 24,
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarLargeText: {
    color: '#A78BFA',
    fontSize: 32,
    fontWeight: '500',
  },
  profileName: {
    color: '#E2D9F3',
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 4,
  },
  profileSub: {
    color: '#5B4A8A',
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
  },
  statVal: {
    fontSize: 28,
    fontWeight: '500',
  },
  statLbl: {
    color: '#5B4A8A',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  form: {
    gap: 0,
  },
  sectionTitle: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  inputLabel: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    color: '#E2D9F3',
    fontSize: 15,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderColor: 'rgba(124,58,237,0.5)',
  },
  chipText: {
    color: '#3D2E5C',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#A78BFA',
  },
  saveBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 120,
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});