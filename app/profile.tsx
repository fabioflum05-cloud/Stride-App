import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

type Profile = {
  name: string; age: string; weight: string;
  targetWeight: string; height: string; sport: string; goal: string;
  username?: string;
};

const GOALS = ['Masse aufbauen', 'Fett verlieren', 'Performance', 'Gesundheit', 'Wettkampf'];
const SPORTS = ['Judo', 'BJJ', 'Boxing', 'MMA', 'Gym', 'Running', 'Cycling', 'Swimming', 'Football', 'Other'];

const API_KEY = 'AIzaSyCv8NhB9ozbKcrGJccOPUmGxMed6IfD-D0';
const PROJECT_ID = 'strideapp-e1d8c';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function doRefreshToken(refreshTok: string): Promise<string | null> {
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshTok }),
    });
    const data = await res.json();
    return data.id_token || null;
  } catch { return null; }
}

async function fsPatch(path: string, fields: Record<string, any>, token: string): Promise<boolean> {
  try {
    const fsFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'string') fsFields[k] = { stringValue: v };
    }
    const res = await fetch(`${FIRESTORE_URL}/${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: fsFields }),
    });
    return res.ok;
  } catch { return false; }
}

async function fsCheckUsername(username: string, myUid: string, token: string): Promise<boolean> {
  // Returns true if username is available
  try {
    const res = await fetch(`${FIRESTORE_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return true; // assume available if can't check
    const data = await res.json();
    if (!data.documents) return true;
    for (const doc of data.documents) {
      const uid = doc.name?.split('/').pop();
      if (uid === myUid) continue;
      const usernameField = doc.fields?.username?.stringValue;
      if (usernameField === username.toLowerCase()) return false;
    }
    return true;
  } catch { return true; }
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>({
    name: '', age: '', weight: '', targetWeight: '', height: '', sport: 'Gym', goal: 'Performance', username: '',
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncingUsername, setSyncingUsername] = useState(false);

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
    if (raw) {
      const p = JSON.parse(raw);
      // Also try to load username from Firebase auth user
      const rawAuth = await AsyncStorage.getItem('authUser');
      if (rawAuth && !p.username) {
        // username might be stored separately
      }
      setProfile(p);
      setSaved(true);
    } else {
      setEditing(true);
    }
  }

  async function handleSave() {
    if (!profile.name.trim()) { Alert.alert('Name fehlt', 'Bitte gib deinen Namen ein.'); return; }

    // Sync username to Firebase if logged in
    if (profile.username?.trim()) {
      const cleanUsername = profile.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUsername !== profile.username) {
        Alert.alert('Ungültiger Username', 'Nur Buchstaben, Zahlen und _ erlaubt.'); return;
      }
      if (cleanUsername.length < 3) { Alert.alert('Username zu kurz', 'Mindestens 3 Zeichen.'); return; }

      const rawAuth = await AsyncStorage.getItem('authUser');
      if (rawAuth) {
        setSyncingUsername(true);
        try {
          let authUser = JSON.parse(rawAuth);
          const newToken = await doRefreshToken(authUser.refreshToken);
          if (newToken) {
            authUser = { ...authUser, idToken: newToken };
            await AsyncStorage.setItem('authUser', JSON.stringify(authUser));
          }
          const available = await fsCheckUsername(cleanUsername, authUser.uid, authUser.idToken);
          if (!available) {
            Alert.alert('Username vergeben', 'Dieser Username ist bereits in Verwendung.');
            setSyncingUsername(false);
            return;
          }
          await fsPatch(`users/${authUser.uid}`, {
            username: cleanUsername,
            displayName: profile.name,
          }, authUser.idToken);
        } catch { /* silent – save locally anyway */ }
        setSyncingUsername(false);
      }
    }

    const finalProfile = { ...profile, username: profile.username?.toLowerCase().trim() || '' };
    await AsyncStorage.setItem('profile', JSON.stringify(finalProfile));
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
              {profile.username ? (
                <View style={[styles.profileBadge, { backgroundColor: theme.blueLight, marginBottom: 6 }]}>
                  <Text style={[styles.profileBadgeText, { color: theme.blue }]}>@{profile.username}</Text>
                </View>
              ) : null}
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
              {profile.username ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Username</Text>
                  <Text style={[styles.infoVal, { color: theme.blue }]}>@{profile.username}</Text>
                </View>
              ) : null}
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

              {/* Username field */}
              <View>
                <Text style={styles.inputLabel}>Username (für Freunde-Tab)</Text>
                <View style={styles.usernameRow}>
                  <View style={styles.usernamePrefix}>
                    <Text style={styles.usernamePrefixText}>@</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                    placeholder="z.B. fabio_judo"
                    placeholderTextColor={theme.textTertiary}
                    value={profile.username || ''}
                    onChangeText={v => setProfile({ ...profile, username: v.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text style={styles.usernameHint}>
                  Nur Buchstaben, Zahlen und _ · Wird im Freunde-Tab angezeigt
                </Text>
              </View>
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
                  <TouchableOpacity key={s} style={[styles.chip, profile.sport === s && { backgroundColor: theme.blueLight, borderColor: theme.blue }]}
                    onPress={() => setProfile({ ...profile, sport: s })}>
                    <Text style={[styles.chipText, profile.sport === s && { color: theme.blue, fontWeight: '600' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.sectionTitle}>Ziel</Text>
            <View style={styles.formCard}>
              <View style={styles.chipGrid}>
                {GOALS.map(g => (
                  <TouchableOpacity key={g} style={[styles.chip, profile.goal === g && { backgroundColor: theme.blueLight, borderColor: theme.blue }]}
                    onPress={() => setProfile({ ...profile, goal: g })}>
                    <Text style={[styles.chipText, profile.goal === g && { color: theme.blue, fontWeight: '600' }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, syncingUsername && { opacity: 0.7 }]} onPress={handleSave} activeOpacity={0.85} disabled={syncingUsername}>
              <Text style={styles.saveBtnText}>{syncingUsername ? 'Wird gespeichert...' : 'Profil speichern'}</Text>
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
  profileBadge: { backgroundColor: theme.cardSecondary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 4 },
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
  usernameRow: { flexDirection: 'row', alignItems: 'center' },
  usernamePrefix: { backgroundColor: theme.blue, paddingHorizontal: 12, paddingVertical: 12, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  usernamePrefixText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  usernameHint: { color: theme.textTertiary, fontSize: 10, marginTop: 6 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.cardSecondary, borderWidth: 1, borderColor: 'transparent' },
  chipText: { color: theme.textSecondary, fontSize: 13, fontWeight: '500' },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 20, ...theme.shadow },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});