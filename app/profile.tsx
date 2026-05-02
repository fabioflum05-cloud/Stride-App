import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

type Profile = {
  name: string; age: string; weight: string;
  targetWeight: string; height: string; sport: string; goal: string;
};

const GOALS = ['Masse aufbauen', 'Fett verlieren', 'Performance', 'Gesundheit', 'Wettkampf'];
const SPORTS = ['Judo', 'BJJ', 'Boxing', 'MMA', 'Gym', 'Running', 'Cycling', 'Swimming', 'Football', 'Other'];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>({
    name: '', age: '', weight: '', targetWeight: '', height: '', sport: 'Gym', goal: 'Performance',
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

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
    const raw = await AsyncStorage.getItem('profile');
    if (raw) { setProfile(JSON.parse(raw)); setSaved(true); }
    else setEditing(true);
  }

  async function handleSave() {
    if (!profile.name.trim()) { Alert.alert('Name fehlt', 'Bitte gib deinen Namen ein.'); return; }
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
  const initial = profile.name.charAt(0).toUpperCase() || '?';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <BackButton />

        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>Profil</Text>
          {saved && !editing && (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>Bearbeiten</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Avatar Section */}
        {saved && !editing && (
          <>
            <View style={styles.avatarSection}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{initial}</Text>
              </View>
              <Text style={styles.profileName}>{profile.name}</Text>
              <View style={styles.profileBadge}>
                <Text style={styles.profileBadgeText}>{profile.sport} · {profile.goal}</Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              {[
                { val: profile.weight || '--', lbl: 'kg aktuell', color: theme.blue },
                { val: profile.targetWeight || '--', lbl: 'kg Ziel', color: theme.green },
                { val: bmi || '--', lbl: 'BMI', color: theme.orange },
                { val: weightDiff ? `${parseFloat(weightDiff) > 0 ? '+' : ''}${weightDiff}` : '--', lbl: 'kg bis Ziel', color: parseFloat(weightDiff ?? '0') > 0 ? theme.purple : theme.green },
              ].map(s => (
                <View key={s.lbl} style={styles.statCard}>
                  <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.statLbl}>{s.lbl}</Text>
                </View>
              ))}
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Alter</Text>
                <Text style={styles.infoVal}>{profile.age || '--'} Jahre</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Grösse</Text>
                <Text style={styles.infoVal}>{profile.height || '--'} cm</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sport</Text>
                <Text style={styles.infoVal}>{profile.sport}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>Ziel</Text>
                <Text style={styles.infoVal}>{profile.goal}</Text>
              </View>
            </View>
          </>
        )}

        {/* Edit Form */}
        {editing && (
          <View style={styles.form}>

            <Text style={styles.sectionTitle}>Persönlich</Text>
            <View style={styles.formCard}>
              {[
                { label: 'Name', value: profile.name, setter: (v: string) => setProfile({ ...profile, name: v }), placeholder: 'Dein Name', kb: 'default' as const },
                { label: 'Alter', value: profile.age, setter: (v: string) => setProfile({ ...profile, age: v }), placeholder: 'z.B. 22', kb: 'numeric' as const },
                { label: 'Grösse (cm)', value: profile.height, setter: (v: string) => setProfile({ ...profile, height: v }), placeholder: 'z.B. 175', kb: 'numeric' as const },
              ].map(f => (
                <View key={f.label}>
                  <Text style={styles.inputLabel}>{f.label}</Text>
                  <TextInput style={styles.input} placeholder={f.placeholder} placeholderTextColor={theme.textTertiary}
                    value={f.value} onChangeText={f.setter} keyboardType={f.kb} />
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Körper</Text>
            <View style={styles.formCard}>
              {[
                { label: 'Aktuelles Gewicht (kg)', value: profile.weight, setter: (v: string) => setProfile({ ...profile, weight: v }), placeholder: 'z.B. 70.5' },
                { label: 'Zielgewicht (kg)', value: profile.targetWeight, setter: (v: string) => setProfile({ ...profile, targetWeight: v }), placeholder: 'z.B. 73.0' },
              ].map(f => (
                <View key={f.label}>
                  <Text style={styles.inputLabel}>{f.label}</Text>
                  <TextInput style={styles.input} placeholder={f.placeholder} placeholderTextColor={theme.textTertiary}
                    value={f.value} onChangeText={f.setter} keyboardType="decimal-pad" />
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Sport</Text>
            <View style={styles.formCard}>
              <View style={styles.chipGrid}>
                {SPORTS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, profile.sport === s && { backgroundColor: theme.blueLight, borderColor: theme.blue }]}
                    onPress={() => setProfile({ ...profile, sport: s })}
                  >
                    <Text style={[styles.chipText, profile.sport === s && { color: theme.blue, fontWeight: '600' }]}>{s}</Text>
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
                    style={[styles.chip, profile.goal === g && { backgroundColor: theme.blueLight, borderColor: theme.blue }]}
                    onPress={() => setProfile({ ...profile, goal: g })}
                  >
                    <Text style={[styles.chipText, profile.goal === g && { color: theme.blue, fontWeight: '600' }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Profil speichern</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 80 }} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  editBtn: { backgroundColor: theme.blueLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  editBtnText: { color: theme.blue, fontSize: 12, fontWeight: '500' },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.blueLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarLargeText: { color: theme.blue, fontSize: 32, fontWeight: '600' },
  profileName: { color: theme.textPrimary, fontSize: 24, fontWeight: '600', marginBottom: 6 },
  profileBadge: { backgroundColor: theme.cardSecondary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  profileBadgeText: { color: theme.textSecondary, fontSize: 13 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: { width: '48%', backgroundColor: theme.card, borderRadius: 14, padding: 14, ...theme.shadow },
  statVal: { fontSize: 28, fontWeight: '600' },
  statLbl: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },

  infoCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 20, ...theme.shadow },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight },
  infoLabel: { color: theme.textSecondary, fontSize: 14 },
  infoVal: { color: theme.textPrimary, fontSize: 14, fontWeight: '500' },

  form: { gap: 0 },
  sectionTitle: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginTop: 16 },
  formCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, gap: 12, marginBottom: 4, ...theme.shadow },
  inputLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 12, color: theme.textPrimary, fontSize: 15 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.cardSecondary, borderWidth: 1, borderColor: 'transparent' },
  chipText: { color: theme.textSecondary, fontSize: 13, fontWeight: '500' },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 20, ...theme.shadow },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});