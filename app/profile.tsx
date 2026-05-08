import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

type Profile = {
  name: string; username: string; age: string; weight: string;
  targetWeight: string; height: string; sport: string; goal: string;
  trainingType: string; trainingDaysPerWeek: string;
};

type Friend = { id: string; name: string; sport: string; score: number; streak: number; };

const GOALS = ['Masse aufbauen', 'Fett verlieren', 'Stärker werden', 'Performance', 'Gesundheit', 'Wettkampf'];
const SPORTS = ['Judo', 'BJJ', 'Boxing', 'MMA', 'Gym', 'Running', 'Cycling', 'Swimming', 'Football', 'Other'];
const TRAINING_TYPES = [
  { key: 'hypertrophie', label: 'Muskelaufbau', emoji: '💪', desc: '8–12 Wdh., mittleres Gewicht' },
  { key: 'kraft', label: 'Maximalkraft', emoji: '🏋️', desc: '3–5 Wdh., schweres Gewicht' },
  { key: 'ausdauer', label: 'Ausdauer/Kondition', emoji: '🏃', desc: '15–20 Wdh., leichtes Gewicht' },
  { key: 'wettkampf', label: 'Wettkampfvorbereitung', emoji: '🥋', desc: 'Sport-spezifisch' },
  { key: 'abnehmen', label: 'Abnehmen', emoji: '⚡', desc: 'Kalorien verbrennen' },
];
const DAYS_OPTIONS = ['2', '3', '4', '5', '6'];

const DEMO_FRIENDS: Friend[] = [
  { id: '1', name: 'Fabio', sport: 'Gym', score: 84, streak: 12 },
  { id: '2', name: 'Marco', sport: 'BJJ', score: 71, streak: 5 },
  { id: '3', name: 'Lena', sport: 'Running', score: 90, streak: 21 },
];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>({
    name: '', username: '', age: '', weight: '',
    targetWeight: '', height: '', sport: 'Gym', goal: 'Performance',
    trainingType: '', trainingDaysPerWeek: '3',
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [prs, setPRs] = useState<any[]>([]);
  const [friends, setFriends] = useState<Friend[]>(DEMO_FRIENDS);
  const [friendCode, setFriendCode] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'friends'>('overview');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useFocusEffect(useCallback(() => {
    load();
    fadeAnim.setValue(0); slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  }, []));

  async function load() {
    const raw = await AsyncStorage.getItem('profile');
    if (raw) { setProfile({ trainingType: '', trainingDaysPerWeek: '3', ...JSON.parse(raw) }); setSaved(true); }
    else setEditing(true);

    const rawWorkouts = await AsyncStorage.getItem('workouts');
    if (rawWorkouts) setWorkoutCount(JSON.parse(rawWorkouts).length);

    const rawHabits = await AsyncStorage.getItem('habits');
    if (rawHabits) {
      const habits = JSON.parse(rawHabits);
      let s = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const anyDone = habits.some((h: any) => h.completedDates?.some((cd: string) => {
          const dd = new Date(cd);
          return dd.getDate() === d.getDate() && dd.getMonth() === d.getMonth() && dd.getFullYear() === d.getFullYear();
        }));
        if (anyDone) s++; else break;
      }
      setStreak(s);
    }

    const rawCheckinHistory = await AsyncStorage.getItem('checkinHistory');
    if (rawCheckinHistory) {
      const history = JSON.parse(rawCheckinHistory);
      setBestScore(Math.max(...history.map((c: any) => c.score ?? 0)));
    }

    const rawW = await AsyncStorage.getItem('workouts');
    if (rawW) {
      const workouts = JSON.parse(rawW);
      const prMap: Record<string, any> = {};
      workouts.forEach((w: any) => {
        w.exercises?.forEach((ex: any) => {
          ex.sets?.forEach((set: any) => {
            const weight = parseFloat(set.weight || '0'), reps = parseFloat(set.reps || '0');
            if (weight <= 0 || reps <= 0) return;
            const oneRM = reps === 1 ? weight : Math.round(weight * (1 + reps / 30));
            if (!prMap[ex.name] || oneRM > prMap[ex.name].oneRM) prMap[ex.name] = { exercise: ex.name, oneRM, weight, reps };
          });
        });
      });
      setPRs(Object.values(prMap).sort((a, b) => b.oneRM - a.oneRM).slice(0, 3));
    }

    const rawFriends = await AsyncStorage.getItem('friends');
    if (rawFriends) setFriends(JSON.parse(rawFriends));
  }

  async function handleSave() {
    if (!profile.name.trim()) { Alert.alert('Name fehlt'); return; }
    if (!profile.trainingType) { Alert.alert('Trainingstyp fehlt', 'Bitte wähle einen Trainingstyp aus.'); return; }
    await AsyncStorage.setItem('profile', JSON.stringify(profile));
    setSaved(true); setEditing(false);
  }

  async function addFriend() {
    if (!friendCode.trim()) return;
    const newFriend: Friend = { id: Date.now().toString(), name: friendCode.trim(), sport: 'Gym', score: Math.floor(Math.random() * 40 + 60), streak: Math.floor(Math.random() * 15) };
    const updated = [...friends, newFriend];
    setFriends(updated);
    await AsyncStorage.setItem('friends', JSON.stringify(updated));
    setFriendCode('');
  }

  async function removeFriend(id: string) {
    Alert.alert('Freund entfernen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: async () => {
        const updated = friends.filter(f => f.id !== id);
        setFriends(updated); await AsyncStorage.setItem('friends', JSON.stringify(updated));
      }},
    ]);
  }

  const bmi = profile.weight && profile.height ? (parseFloat(profile.weight) / Math.pow(parseFloat(profile.height) / 100, 2)).toFixed(1) : null;
  const weightDiff = profile.weight && profile.targetWeight ? (parseFloat(profile.targetWeight) - parseFloat(profile.weight)).toFixed(1) : null;
  const progress = profile.weight && profile.targetWeight ? Math.min(100, Math.max(0, Math.round((parseFloat(profile.weight) / parseFloat(profile.targetWeight)) * 100))) : 0;
  const initial = profile.name.charAt(0).toUpperCase() || '?';
  const myCode = `STR-${profile.name.slice(0, 3).toUpperCase()}-${(1000 + (profile.name.length * 317) % 9000)}`;
  const trainingTypeInfo = TRAINING_TYPES.find(t => t.key === profile.trainingType);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* Top Nav */}
        <View style={styles.topNav}>
          <BackButton />
          <Text style={styles.topNavTitle}>Profil</Text>
          {saved && !editing
            ? <TouchableOpacity onPress={() => setEditing(true)}><Text style={styles.topNavEdit}>Bearbeiten</Text></TouchableOpacity>
            : <View style={{ width: 70 }} />}
        </View>

        {saved && !editing && (
          <>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
                <View style={styles.avatarOnline} />
              </View>
              <Text style={styles.heroName}>{profile.name}</Text>
              {profile.username && <Text style={styles.heroUsername}>@{profile.username}</Text>}
              <View style={styles.heroTags}>
                {[profile.sport, profile.goal, trainingTypeInfo?.emoji + ' ' + trainingTypeInfo?.label, profile.age ? `${profile.age} J.` : null, profile.height ? `${profile.height} cm` : null]
                  .filter(Boolean).map(tag => (
                    <View key={tag} style={styles.heroTag}><Text style={styles.heroTagText}>{tag}</Text></View>
                  ))}
              </View>
            </View>

            {/* Training Type Banner */}
            {trainingTypeInfo && (
              <View style={styles.trainingBanner}>
                <Text style={styles.trainingBannerEmoji}>{trainingTypeInfo.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trainingBannerTitle}>{trainingTypeInfo.label}</Text>
                  <Text style={styles.trainingBannerDesc}>{trainingTypeInfo.desc} · {profile.trainingDaysPerWeek}×/Woche</Text>
                </View>
                <TouchableOpacity onPress={() => setEditing(true)} style={styles.trainingBannerEdit}>
                  <Text style={styles.trainingBannerEditText}>Ändern</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Tab Bar */}
            <View style={styles.tabBar}>
              {[{ key: 'overview', label: 'Übersicht' }, { key: 'friends', label: `Freunde ${friends.length > 0 ? `(${friends.length})` : ''}` }].map(tab => (
                <TouchableOpacity key={tab.key} style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]} onPress={() => setActiveTab(tab.key as any)} activeOpacity={0.7}>
                  <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {activeTab === 'overview' && (
              <>
                <View style={styles.statsRow}>
                  {[
                    { val: workoutCount || '—', lbl: 'Trainings', color: theme.blue },
                    { val: streak > 0 ? `${streak}🔥` : '—', lbl: 'Streak', color: theme.orange },
                    { val: bestScore || '—', lbl: 'Best Score', color: theme.green },
                    { val: bmi || '—', lbl: 'BMI', color: theme.purple },
                  ].map((s, i) => (
                    <View key={s.lbl} style={[styles.statCard, i < 3 && { borderRightWidth: 0.5, borderRightColor: theme.border }]}>
                      <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                      <Text style={styles.statLbl}>{s.lbl}</Text>
                    </View>
                  ))}
                </View>

                {profile.weight && (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Gewicht</Text>
                      <TouchableOpacity onPress={() => router.push('/weight' as any)}><Text style={styles.cardLink}>Verlauf →</Text></TouchableOpacity>
                    </View>
                    <View style={styles.weightRow}>
                      <View>
                        <Text style={styles.weightNum}>{profile.weight}<Text style={styles.weightUnit}> kg</Text></Text>
                        <Text style={styles.weightSub}>Aktuell</Text>
                      </View>
                      {profile.targetWeight && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.weightGoal}>{profile.targetWeight} kg</Text>
                          <Text style={styles.weightSub}>Ziel</Text>
                          {weightDiff && (
                            <View style={[styles.diffBadge, { backgroundColor: parseFloat(weightDiff) > 0 ? theme.blueLight : theme.greenLight }]}>
                              <Text style={[styles.diffText, { color: parseFloat(weightDiff) > 0 ? theme.blue : theme.green }]}>
                                {parseFloat(weightDiff) > 0 ? '↑' : '↓'} {Math.abs(parseFloat(weightDiff))} kg
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    {profile.targetWeight && (
                      <View style={styles.progressWrap}>
                        <View style={styles.progressMeta}>
                          <Text style={styles.progressMetaText}>Fortschritt</Text>
                          <Text style={styles.progressMetaVal}>{progress}%</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {prs.length > 0 && (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Top Bestleistungen</Text>
                      <TouchableOpacity onPress={() => router.push('/prs' as any)}><Text style={styles.cardLink}>Alle →</Text></TouchableOpacity>
                    </View>
                    {prs.map((pr, i) => (
                      <View key={i} style={[styles.prRow, i < prs.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.borderLight }]}>
                        <View style={[styles.prRank, { backgroundColor: i === 0 ? theme.orangeLight : theme.cardSecondary }]}>
                          <Text style={styles.prRankText}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</Text>
                        </View>
                        <Text style={styles.prName}>{pr.exercise}</Text>
                        <View style={styles.prStats}>
                          <Text style={[styles.prVal, { color: theme.blue }]}>{pr.oneRM} kg</Text>
                          <Text style={styles.prSub}>1RM</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Details</Text>
                  {[
                    { key: 'Sport', val: profile.sport },
                    { key: 'Ziel', val: profile.goal },
                    { key: 'Trainingstyp', val: trainingTypeInfo ? `${trainingTypeInfo.emoji} ${trainingTypeInfo.label}` : '—' },
                    { key: 'Training/Woche', val: profile.trainingDaysPerWeek ? `${profile.trainingDaysPerWeek}×` : '—' },
                    { key: 'Alter', val: profile.age ? `${profile.age} Jahre` : '—' },
                    { key: 'Grösse', val: profile.height ? `${profile.height} cm` : '—' },
                  ].map((row, i, arr) => (
                    <View key={row.key} style={[styles.detailRow, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.borderLight }]}>
                      <Text style={styles.detailKey}>{row.key}</Text>
                      <Text style={styles.detailVal}>{row.val}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.card, { backgroundColor: theme.blueLight }]}>
                  <Text style={[styles.cardTitle, { color: theme.blue }]}>Mein Freundescode</Text>
                  <Text style={styles.myCode}>{myCode}</Text>
                  <Text style={styles.myCodeSub}>Teile diesen Code mit Freunden damit sie dich adden können</Text>
                </View>

                <View style={styles.proCard}>
                  <View>
                    <Text style={styles.proEyebrow}>STRIDE</Text>
                    <Text style={styles.proName}>Pro Mitglied</Text>
                    <Text style={styles.proSub}>KI-Coach · Alle Features</Text>
                  </View>
                  <TouchableOpacity style={styles.proBtn}><Text style={styles.proBtnText}>Upgrade</Text></TouchableOpacity>
                </View>
              </>
            )}

            {activeTab === 'friends' && (
              <>
                <View style={styles.card}>
                  <View style={styles.cardHeader}><Text style={styles.cardTitle}>Freund hinzufügen</Text></View>
                  <View style={styles.addFriendRow}>
                    <TextInput style={styles.friendInput} placeholder="Freundescode eingeben..." placeholderTextColor={theme.textTertiary} value={friendCode} onChangeText={setFriendCode} />
                    <TouchableOpacity style={styles.addFriendBtn} onPress={addFriend}><Text style={styles.addFriendBtnText}>Adden</Text></TouchableOpacity>
                  </View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Rangliste</Text>
                  {[{ id: 'me', name: profile.name || 'Du', sport: profile.sport, score: bestScore || 75, streak }, ...friends]
                    .sort((a, b) => b.score - a.score)
                    .map((f, i) => (
                      <View key={f.id} style={[styles.friendRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.borderLight }]}>
                        <View style={[styles.friendRank, { backgroundColor: i === 0 ? theme.orangeLight : '#F5F5F5' }]}>
                          <Text style={[styles.friendRankText, { color: i === 0 ? theme.orange : theme.textSecondary }]}>{i + 1}</Text>
                        </View>
                        <View style={[styles.friendAvatar, { backgroundColor: f.id === 'me' ? theme.blue : theme.cardSecondary }]}>
                          <Text style={[styles.friendAvatarText, { color: f.id === 'me' ? '#fff' : theme.textSecondary }]}>{f.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.friendName}>{f.id === 'me' ? `${f.name} (Du)` : f.name}</Text>
                          <Text style={styles.friendSport}>{f.sport}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 3 }}>
                          <Text style={[styles.friendScore, { color: theme.blue }]}>{f.score}</Text>
                          {f.streak > 0 && <Text style={styles.friendStreak}>🔥 {f.streak}</Text>}
                        </View>
                        {f.id !== 'me' && (
                          <TouchableOpacity onPress={() => removeFriend(f.id)} style={styles.removeFriendBtn}>
                            <Text style={styles.removeFriendText}>×</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                </View>
              </>
            )}
          </>
        )}

        {/* Edit / Create Form */}
        {editing && (
          <View style={styles.form}>

            <Text style={styles.formSection}>Persönlich</Text>
            <View style={styles.formCard}>
              {[
                { label: 'Name', value: profile.name, setter: (v: string) => setProfile(p => ({ ...p, name: v })), placeholder: 'Dein Name', kb: 'default' as const },
                { label: 'Benutzername', value: profile.username, setter: (v: string) => setProfile(p => ({ ...p, username: v })), placeholder: '@deinname', kb: 'default' as const },
                { label: 'Alter', value: profile.age, setter: (v: string) => setProfile(p => ({ ...p, age: v })), placeholder: '18', kb: 'numeric' as const },
                { label: 'Grösse (cm)', value: profile.height, setter: (v: string) => setProfile(p => ({ ...p, height: v })), placeholder: '174', kb: 'numeric' as const },
              ].map((f, i, arr) => (
                <View key={f.label} style={[styles.formField, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.borderLight }]}>
                  <Text style={styles.formLabel}>{f.label}</Text>
                  <TextInput style={styles.formInput} placeholder={f.placeholder} placeholderTextColor={theme.textTertiary} value={f.value} onChangeText={f.setter} keyboardType={f.kb} />
                </View>
              ))}
            </View>

            <Text style={styles.formSection}>Körper</Text>
            <View style={styles.formCard}>
              {[
                { label: 'Gewicht (kg)', value: profile.weight, setter: (v: string) => setProfile(p => ({ ...p, weight: v })), placeholder: '81.0' },
                { label: 'Zielgewicht (kg)', value: profile.targetWeight, setter: (v: string) => setProfile(p => ({ ...p, targetWeight: v })), placeholder: '84.0' },
              ].map((f, i, arr) => (
                <View key={f.label} style={[styles.formField, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.borderLight }]}>
                  <Text style={styles.formLabel}>{f.label}</Text>
                  <TextInput style={styles.formInput} placeholder={f.placeholder} placeholderTextColor={theme.textTertiary} value={f.value} onChangeText={f.setter} keyboardType="decimal-pad" />
                </View>
              ))}
            </View>

            <Text style={styles.formSection}>Sport</Text>
            <View style={[styles.formCard, { padding: 14 }]}>
              <View style={styles.chipGrid}>
                {SPORTS.map(s => (
                  <TouchableOpacity key={s} style={[styles.chip, profile.sport === s && styles.chipActive]} onPress={() => setProfile(p => ({ ...p, sport: s }))}>
                    <Text style={[styles.chipText, profile.sport === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.formSection}>Ziel</Text>
            <View style={[styles.formCard, { padding: 14 }]}>
              <View style={styles.chipGrid}>
                {GOALS.map(g => (
                  <TouchableOpacity key={g} style={[styles.chip, profile.goal === g && styles.chipActive]} onPress={() => setProfile(p => ({ ...p, goal: g }))}>
                    <Text style={[styles.chipText, profile.goal === g && styles.chipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Trainingstyp – Pflichtfeld */}
            <Text style={styles.formSection}>Trainingstyp <Text style={{ color: theme.orange }}>*</Text></Text>
            <View style={{ gap: 8, marginBottom: 4 }}>
              {TRAINING_TYPES.map(t => (
                <TouchableOpacity key={t.key}
                  style={[styles.trainingTypeCard, profile.trainingType === t.key && styles.trainingTypeCardActive]}
                  onPress={() => setProfile(p => ({ ...p, trainingType: t.key }))}
                  activeOpacity={0.85}>
                  <Text style={styles.trainingTypeEmoji}>{t.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trainingTypeLabel, profile.trainingType === t.key && { color: theme.orange }]}>{t.label}</Text>
                    <Text style={styles.trainingTypeDesc}>{t.desc}</Text>
                  </View>
                  <View style={[styles.trainingTypeCheck, profile.trainingType === t.key && { backgroundColor: theme.orange, borderColor: theme.orange }]}>
                    {profile.trainingType === t.key && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formSection}>Trainingseinheiten pro Woche</Text>
            <View style={[styles.formCard, { padding: 14 }]}>
              <View style={styles.chipGrid}>
                {DAYS_OPTIONS.map(d => (
                  <TouchableOpacity key={d} style={[styles.chip, profile.trainingDaysPerWeek === d && styles.chipActive]} onPress={() => setProfile(p => ({ ...p, trainingDaysPerWeek: d }))}>
                    <Text style={[styles.chipText, profile.trainingDaysPerWeek === d && styles.chipTextActive]}>{d}×</Text>
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
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: theme.border },
  topNavTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  topNavEdit: { fontSize: 15, color: theme.blue, fontWeight: '500', width: 70, textAlign: 'right' },
  hero: { backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: theme.border },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: '200' },
  avatarOnline: { position: 'absolute', bottom: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: '#34C759', borderWidth: 2.5, borderColor: '#fff' },
  heroName: { fontSize: 26, fontWeight: '700', color: '#000', letterSpacing: -0.8, marginBottom: 3 },
  heroUsername: { fontSize: 14, color: theme.blue, marginBottom: 14, fontWeight: '500' },
  heroTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  heroTag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardSecondary },
  heroTagText: { fontSize: 12, fontWeight: '500', color: '#3C3C43' },
  trainingBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.orangeLight, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.orange + '40' },
  trainingBannerEmoji: { fontSize: 24 },
  trainingBannerTitle: { fontSize: 14, fontWeight: '700', color: theme.orange },
  trainingBannerDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  trainingBannerEdit: { backgroundColor: theme.orange, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  trainingBannerEditText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: theme.border, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#000' },
  tabBtnText: { fontSize: 14, fontWeight: '500', color: theme.textSecondary },
  tabBtnTextActive: { color: '#000' },
  statsRow: { flexDirection: 'row', backgroundColor: '#fff', marginBottom: 12 },
  statCard: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '600', letterSpacing: -0.5, marginBottom: 3 },
  statLbl: { fontSize: 10, fontWeight: '500', color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { backgroundColor: '#fff', marginBottom: 12, padding: 18 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#000', letterSpacing: -0.3 },
  cardLink: { fontSize: 13, color: theme.blue, fontWeight: '500' },
  weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  weightNum: { fontSize: 44, fontWeight: '200', color: '#000', letterSpacing: -2 },
  weightUnit: { fontSize: 16, fontWeight: '300', color: theme.textSecondary },
  weightSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  weightGoal: { fontSize: 22, fontWeight: '500', color: '#000', letterSpacing: -0.5 },
  diffBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  diffText: { fontSize: 12, fontWeight: '600' },
  progressWrap: { gap: 6 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  progressMetaText: { fontSize: 12, color: theme.textSecondary },
  progressMetaVal: { fontSize: 12, fontWeight: '600', color: '#000' },
  progressTrack: { height: 2, backgroundColor: theme.border, borderRadius: 1, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#000', borderRadius: 1 },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  prRank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  prRankText: { fontSize: 14 },
  prName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#000' },
  prStats: { alignItems: 'flex-end' },
  prVal: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  prSub: { fontSize: 10, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  detailKey: { flex: 1, fontSize: 15, color: '#000' },
  detailVal: { fontSize: 15, color: theme.textSecondary },
  myCode: { fontSize: 28, fontWeight: '700', color: theme.blue, letterSpacing: 2, marginTop: 8, marginBottom: 6 },
  myCodeSub: { fontSize: 12, color: theme.blue, opacity: 0.7 },
  proCard: { backgroundColor: '#000', marginBottom: 12, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proEyebrow: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  proName: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3, marginBottom: 2 },
  proSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  proBtn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  proBtnText: { fontSize: 14, fontWeight: '600', color: '#000' },
  addFriendRow: { flexDirection: 'row', gap: 10 },
  friendInput: { flex: 1, backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 12, fontSize: 14, color: '#000' },
  addFriendBtn: { backgroundColor: '#000', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  addFriendBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  friendRank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  friendRankText: { fontSize: 13, fontWeight: '700' },
  friendAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { fontSize: 14, fontWeight: '600' },
  friendName: { fontSize: 14, fontWeight: '600', color: '#000' },
  friendSport: { fontSize: 12, color: theme.textSecondary },
  friendScore: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  friendStreak: { fontSize: 11, color: theme.orange },
  removeFriendBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  removeFriendText: { color: theme.red, fontSize: 18 },
  form: { padding: 16 },
  formSection: { fontSize: 11, fontWeight: '600', color: theme.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  formCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  formField: { paddingHorizontal: 16, paddingVertical: 13 },
  formLabel: { fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  formInput: { fontSize: 16, color: '#000' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.cardSecondary },
  chipActive: { backgroundColor: '#000' },
  chipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  trainingTypeCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: 'transparent' },
  trainingTypeCardActive: { borderColor: theme.orange, backgroundColor: theme.orangeLight },
  trainingTypeEmoji: { fontSize: 26 },
  trainingTypeLabel: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 2 },
  trainingTypeDesc: { fontSize: 12, color: theme.textSecondary },
  trainingTypeCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { backgroundColor: '#000', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});