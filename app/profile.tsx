import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getFullPalette, useAppTheme } from '../constants/ThemeContext';
import { useLanguage } from '../constants/LanguageContext';

type Profile = {
  name: string; username: string; age: string; weight: string;
  targetWeight: string; height: string; sport: string; goal: string;
  trainingType: string; trainingDaysPerWeek: string;
};

const GOALS = ['Masse aufbauen', 'Fett verlieren', 'Stärker werden', 'Performance', 'Gesundheit', 'Wettkampf'];
const GOAL_LABELS_EN: Record<string, string> = {
  'Masse aufbauen': 'Build muscle', 'Fett verlieren': 'Lose fat', 'Stärker werden': 'Get stronger',
  'Performance': 'Performance', 'Gesundheit': 'Health', 'Wettkampf': 'Competition',
};
const SPORTS = ['Judo', 'BJJ', 'Boxing', 'MMA', 'Gym', 'Running', 'Cycling', 'Swimming', 'Football', 'Other'];
const TRAINING_TYPES = [
  { key: 'hypertrophie', label: 'Muskelaufbau', labelEn: 'Muscle Building', emoji: '💪', desc: '8–12 Wdh., mittleres Gewicht', descEn: '8–12 reps, medium weight' },
  { key: 'kraft', label: 'Maximalkraft', labelEn: 'Max Strength', emoji: '🏋️', desc: '3–5 Wdh., schweres Gewicht', descEn: '3–5 reps, heavy weight' },
  { key: 'ausdauer', label: 'Ausdauer/Kondition', labelEn: 'Endurance/Conditioning', emoji: '🏃', desc: '15–20 Wdh., leichtes Gewicht', descEn: '15–20 reps, light weight' },
  { key: 'wettkampf', label: 'Wettkampfvorbereitung', labelEn: 'Competition Prep', emoji: '🥋', desc: 'Sport-spezifisch', descEn: 'Sport-specific' },
  { key: 'abnehmen', label: 'Abnehmen', labelEn: 'Weight Loss', emoji: '⚡', desc: 'Kalorien verbrennen', descEn: 'Burn calories' },
];
const DAYS_OPTIONS = ['2', '3', '4', '5', '6'];

export default function ProfileScreen() {
  const { t, lang } = useLanguage();
  const { colors } = useAppTheme();
  const theme = getFullPalette(colors);
  const styles = getStyles(theme);
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
  }

  async function handleSave() {
    if (!profile.name.trim()) { Alert.alert(lang === 'en' ? 'Name missing' : 'Name fehlt'); return; }
    if (!profile.trainingType) {
      Alert.alert(
        lang === 'en' ? 'Training type missing' : 'Trainingstyp fehlt',
        lang === 'en' ? 'Please select a training type.' : 'Bitte wähle einen Trainingstyp aus.'
      );
      return;
    }
    await AsyncStorage.setItem('profile', JSON.stringify(profile));
    setSaved(true); setEditing(false);
  }

  const bmi = profile.weight && profile.height ? (parseFloat(profile.weight) / Math.pow(parseFloat(profile.height) / 100, 2)).toFixed(1) : null;
  const weightDiff = profile.weight && profile.targetWeight ? (parseFloat(profile.targetWeight) - parseFloat(profile.weight)).toFixed(1) : null;
  const progress = profile.weight && profile.targetWeight ? Math.min(100, Math.max(0, Math.round((parseFloat(profile.weight) / parseFloat(profile.targetWeight)) * 100))) : 0;
  const initial = profile.name.charAt(0).toUpperCase() || '?';
  const trainingTypeInfo = TRAINING_TYPES.find(t => t.key === profile.trainingType);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* Top Nav */}
        <View style={styles.topNav}>
          <BackButton />
          <Text style={styles.topNavTitle}>{lang === 'en' ? 'Profile' : 'Profil'}</Text>
          {saved && !editing
            ? <TouchableOpacity onPress={() => setEditing(true)}><Text style={styles.topNavEdit}>{lang === 'en' ? 'Edit' : 'Bearbeiten'}</Text></TouchableOpacity>
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
                {[profile.sport, lang === 'en' ? GOAL_LABELS_EN[profile.goal] ?? profile.goal : profile.goal,
                  trainingTypeInfo ? trainingTypeInfo.emoji + ' ' + (lang === 'en' ? trainingTypeInfo.labelEn : trainingTypeInfo.label) : null,
                  profile.age ? (lang === 'en' ? `${profile.age} y` : `${profile.age} J.`) : null,
                  profile.height ? `${profile.height} cm` : null]
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
                  <Text style={styles.trainingBannerTitle}>{lang === 'en' ? trainingTypeInfo.labelEn : trainingTypeInfo.label}</Text>
                  <Text style={styles.trainingBannerDesc}>
                    {lang === 'en' ? trainingTypeInfo.descEn : trainingTypeInfo.desc} · {profile.trainingDaysPerWeek}×/{lang === 'en' ? 'week' : 'Woche'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setEditing(true)} style={styles.trainingBannerEdit}>
                  <Text style={styles.trainingBannerEditText}>{lang === 'en' ? 'Change' : 'Ändern'}</Text>
                </TouchableOpacity>
              </View>
            )}

                <View style={styles.statsRow}>
                  {[
                    { val: workoutCount || '—', lbl: lang === 'en' ? 'Workouts' : 'Trainings', color: theme.blue },
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
                      <Text style={styles.cardTitle}>{lang === 'en' ? 'Weight' : 'Gewicht'}</Text>
                      <TouchableOpacity onPress={() => router.push('/weight' as any)}><Text style={styles.cardLink}>{lang === 'en' ? 'History →' : 'Verlauf →'}</Text></TouchableOpacity>
                    </View>
                    <View style={styles.weightRow}>
                      <View>
                        <Text style={styles.weightNum}>{profile.weight}<Text style={styles.weightUnit}> kg</Text></Text>
                        <Text style={styles.weightSub}>{lang === 'en' ? 'Current' : 'Aktuell'}</Text>
                      </View>
                      {profile.targetWeight && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.weightGoal}>{profile.targetWeight} kg</Text>
                          <Text style={styles.weightSub}>{lang === 'en' ? 'Goal' : 'Ziel'}</Text>
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
                          <Text style={styles.progressMetaText}>{lang === 'en' ? 'Progress' : 'Fortschritt'}</Text>
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
                      <Text style={styles.cardTitle}>{lang === 'en' ? 'Top PRs' : 'Top Bestleistungen'}</Text>
                      <TouchableOpacity onPress={() => router.push('/prs' as any)}><Text style={styles.cardLink}>{lang === 'en' ? 'All →' : 'Alle →'}</Text></TouchableOpacity>
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
                    { key: lang === 'en' ? 'Goal' : 'Ziel', val: lang === 'en' ? GOAL_LABELS_EN[profile.goal] ?? profile.goal : profile.goal },
                    { key: lang === 'en' ? 'Training Type' : 'Trainingstyp', val: trainingTypeInfo ? `${trainingTypeInfo.emoji} ${lang === 'en' ? trainingTypeInfo.labelEn : trainingTypeInfo.label}` : '—' },
                    { key: lang === 'en' ? 'Workouts/Week' : 'Training/Woche', val: profile.trainingDaysPerWeek ? `${profile.trainingDaysPerWeek}×` : '—' },
                    { key: lang === 'en' ? 'Age' : 'Alter', val: profile.age ? `${profile.age} ${lang === 'en' ? 'years' : 'Jahre'}` : '—' },
                    { key: lang === 'en' ? 'Height' : 'Grösse', val: profile.height ? `${profile.height} cm` : '—' },
                  ].map((row, i, arr) => (
                    <View key={row.key} style={[styles.detailRow, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.borderLight }]}>
                      <Text style={styles.detailKey}>{row.key}</Text>
                      <Text style={styles.detailVal}>{row.val}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{lang === 'en' ? 'Settings' : 'Einstellungen'}</Text>
                  {[
                    { label: t('notif_settings_title'), route: '/notification-settings' },
                    { label: t('widget_settings_title'), route: '/widget-settings' },
                  ].map((row, i, arr) => (
                    <TouchableOpacity key={row.route} onPress={() => router.push(row.route as any)} activeOpacity={0.6}
                      style={[styles.detailRow, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.borderLight }]}>
                      <Text style={styles.detailKey}>{row.label}</Text>
                      <Text style={styles.cardLink}>→</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={[styles.card, { backgroundColor: theme.blueLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => router.push('/friends' as any)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.blue }]}>{lang === 'en' ? 'Friends' : 'Freunde'}</Text>
                    <Text style={[styles.myCodeSub, { marginTop: 2 }]}>{lang === 'en' ? 'View your friend code and leaderboard' : 'Freundescode und Rangliste ansehen'}</Text>
                  </View>
                  <Text style={styles.cardLink}>→</Text>
                </TouchableOpacity>

                <View style={styles.proCard}>
                  <View>
                    <Text style={styles.proEyebrow}>STRIDE</Text>
                    <Text style={styles.proName}>{lang === 'en' ? 'Pro Member' : 'Pro Mitglied'}</Text>
                    <Text style={styles.proSub}>{lang === 'en' ? 'AI Coach · All Features' : 'KI-Coach · Alle Features'}</Text>
                  </View>
                  <TouchableOpacity style={styles.proBtn}><Text style={styles.proBtnText}>Upgrade</Text></TouchableOpacity>
                </View>
          </>
        )}

        {/* Edit / Create Form */}
        {editing && (
          <View style={styles.form}>

            <Text style={styles.formSection}>{lang === 'en' ? 'Personal' : 'Persönlich'}</Text>
            <View style={styles.formCard}>
              {[
                { label: 'Name', value: profile.name, setter: (v: string) => setProfile(p => ({ ...p, name: v })), placeholder: lang === 'en' ? 'Your name' : 'Dein Name', kb: 'default' as const },
                { label: lang === 'en' ? 'Username' : 'Benutzername', value: profile.username, setter: (v: string) => setProfile(p => ({ ...p, username: v })), placeholder: lang === 'en' ? '@yourname' : '@deinname', kb: 'default' as const },
                { label: lang === 'en' ? 'Age' : 'Alter', value: profile.age, setter: (v: string) => setProfile(p => ({ ...p, age: v })), placeholder: '18', kb: 'numeric' as const },
                { label: lang === 'en' ? 'Height (cm)' : 'Grösse (cm)', value: profile.height, setter: (v: string) => setProfile(p => ({ ...p, height: v })), placeholder: '174', kb: 'numeric' as const },
              ].map((f, i, arr) => (
                <View key={f.label} style={[styles.formField, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.borderLight }]}>
                  <Text style={styles.formLabel}>{f.label}</Text>
                  <TextInput style={styles.formInput} placeholder={f.placeholder} placeholderTextColor={theme.textTertiary} value={f.value} onChangeText={f.setter} keyboardType={f.kb} />
                </View>
              ))}
            </View>

            <Text style={styles.formSection}>{lang === 'en' ? 'Body' : 'Körper'}</Text>
            <View style={styles.formCard}>
              {[
                { label: lang === 'en' ? 'Weight (kg)' : 'Gewicht (kg)', value: profile.weight, setter: (v: string) => setProfile(p => ({ ...p, weight: v })), placeholder: '81.0' },
                { label: lang === 'en' ? 'Target weight (kg)' : 'Zielgewicht (kg)', value: profile.targetWeight, setter: (v: string) => setProfile(p => ({ ...p, targetWeight: v })), placeholder: '84.0' },
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

            <Text style={styles.formSection}>{lang === 'en' ? 'Goal' : 'Ziel'}</Text>
            <View style={[styles.formCard, { padding: 14 }]}>
              <View style={styles.chipGrid}>
                {GOALS.map(g => (
                  <TouchableOpacity key={g} style={[styles.chip, profile.goal === g && styles.chipActive]} onPress={() => setProfile(p => ({ ...p, goal: g }))}>
                    <Text style={[styles.chipText, profile.goal === g && styles.chipTextActive]}>{lang === 'en' ? GOAL_LABELS_EN[g] : g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Trainingstyp – Pflichtfeld */}
            <Text style={styles.formSection}>{lang === 'en' ? 'Training Type' : 'Trainingstyp'} <Text style={{ color: theme.orange }}>*</Text></Text>
            <View style={{ gap: 8, marginBottom: 4 }}>
              {TRAINING_TYPES.map(t => (
                <TouchableOpacity key={t.key}
                  style={[styles.trainingTypeCard, profile.trainingType === t.key && styles.trainingTypeCardActive]}
                  onPress={() => setProfile(p => ({ ...p, trainingType: t.key }))}
                  activeOpacity={0.85}>
                  <Text style={styles.trainingTypeEmoji}>{t.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trainingTypeLabel, profile.trainingType === t.key && { color: theme.orange }]}>{lang === 'en' ? t.labelEn : t.label}</Text>
                    <Text style={styles.trainingTypeDesc}>{lang === 'en' ? t.descEn : t.desc}</Text>
                  </View>
                  <View style={[styles.trainingTypeCheck, profile.trainingType === t.key && { backgroundColor: theme.orange, borderColor: theme.orange }]}>
                    {profile.trainingType === t.key && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formSection}>{lang === 'en' ? 'Training sessions per week' : 'Trainingseinheiten pro Woche'}</Text>
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
              <Text style={styles.saveBtnText}>{lang === 'en' ? 'Save profile' : 'Profil speichern'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 80 }} />
      </Animated.View>
    </ScrollView>
  );
}

function getStyles(theme: ReturnType<typeof getFullPalette>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: theme.card, borderBottomWidth: 0.5, borderBottomColor: theme.border },
    topNavTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },
    topNavEdit: { fontSize: 15, color: theme.blue, fontWeight: '500', width: 70, textAlign: 'right' },
    hero: { backgroundColor: theme.card, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: theme.border },
    avatarWrap: { position: 'relative', marginBottom: 14 },
    avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 34, fontWeight: '200' },
    avatarOnline: { position: 'absolute', bottom: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: '#34C759', borderWidth: 2.5, borderColor: theme.card },
    heroName: { fontSize: 26, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.8, marginBottom: 3 },
    heroUsername: { fontSize: 14, color: theme.blue, marginBottom: 14, fontWeight: '500' },
    heroTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
    heroTag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardSecondary },
    heroTagText: { fontSize: 12, fontWeight: '500', color: theme.textPrimary },
    trainingBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.orangeLight, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.orange + '40' },
    trainingBannerEmoji: { fontSize: 24 },
    trainingBannerTitle: { fontSize: 14, fontWeight: '700', color: theme.orange },
    trainingBannerDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    trainingBannerEdit: { backgroundColor: theme.orange, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    trainingBannerEditText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    statsRow: { flexDirection: 'row', backgroundColor: theme.card, marginBottom: 12 },
    statCard: { flex: 1, paddingVertical: 16, alignItems: 'center' },
    statVal: { fontSize: 20, fontWeight: '600', letterSpacing: -0.5, marginBottom: 3 },
    statLbl: { fontSize: 10, fontWeight: '500', color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
    card: { backgroundColor: theme.card, marginBottom: 12, padding: 18 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, letterSpacing: -0.3 },
    cardLink: { fontSize: 13, color: theme.blue, fontWeight: '500' },
    weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
    weightNum: { fontSize: 44, fontWeight: '200', color: theme.textPrimary, letterSpacing: -2 },
    weightUnit: { fontSize: 16, fontWeight: '300', color: theme.textSecondary },
    weightSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    weightGoal: { fontSize: 22, fontWeight: '500', color: theme.textPrimary, letterSpacing: -0.5 },
    diffBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
    diffText: { fontSize: 12, fontWeight: '600' },
    progressWrap: { gap: 6 },
    progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    progressMetaText: { fontSize: 12, color: theme.textSecondary },
    progressMetaVal: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },
    progressTrack: { height: 2, backgroundColor: theme.border, borderRadius: 1, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: theme.blue, borderRadius: 1 },
    prRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    prRank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    prRankText: { fontSize: 14 },
    prName: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.textPrimary },
    prStats: { alignItems: 'flex-end' },
    prVal: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
    prSub: { fontSize: 10, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
    detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    detailKey: { flex: 1, fontSize: 15, color: theme.textPrimary },
    detailVal: { fontSize: 15, color: theme.textSecondary },
    myCodeSub: { fontSize: 12, color: theme.blue, opacity: 0.7 },
    // proCard bleibt bewusst fest dunkel (Premium-/Feature-Karte, wie seasonHero in
    // achievements.tsx) statt dem Theme zu folgen — kein Dark-Mode-Bug, sondern Design-Entscheidung.
    proCard: { backgroundColor: '#000', marginBottom: 12, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    proEyebrow: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    proName: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3, marginBottom: 2 },
    proSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
    proBtn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
    proBtnText: { fontSize: 14, fontWeight: '600', color: '#000' },
    form: { padding: 16 },
    formSection: { fontSize: 11, fontWeight: '600', color: theme.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
    formCard: { backgroundColor: theme.card, borderRadius: 12, overflow: 'hidden' },
    formField: { paddingHorizontal: 16, paddingVertical: 13 },
    formLabel: { fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    formInput: { fontSize: 16, color: theme.textPrimary },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.cardSecondary },
    chipActive: { backgroundColor: theme.blue },
    chipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
    chipTextActive: { color: '#fff' },
    trainingTypeCard: { backgroundColor: theme.card, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: 'transparent' },
    trainingTypeCardActive: { borderColor: theme.orange, backgroundColor: theme.orangeLight },
    trainingTypeEmoji: { fontSize: 26 },
    trainingTypeLabel: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
    trainingTypeDesc: { fontSize: 12, color: theme.textSecondary },
    trainingTypeCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  });
}