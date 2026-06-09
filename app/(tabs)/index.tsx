// app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Keyboard, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useLanguage } from '../../constants/LanguageContext';
import { THEMES, useAppTheme } from '../../constants/ThemeContext';

const W = Dimensions.get('window').width;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function isToday(d: string) {
  const t = new Date(), dd = new Date(d);
  return dd.getDate() === t.getDate() && dd.getMonth() === t.getMonth() && dd.getFullYear() === t.getFullYear();
}
function formatTime(raw: string): string {
  if (!raw) return '—';
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return '—'; }
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function calcScore(checkin: any, sleep: any, battery: any): number {
  if (!checkin && !sleep) return 0;
  const s  = sleep?.sleepScore ?? 50;
  const e  = checkin ? checkin.energie * 20 : 50;
  const st = checkin ? (6 - checkin.stress) * 20 : 50;
  const m  = checkin ? checkin.motivation * 20 : 50;
  const b  = battery?.level ?? 50;
  return Math.round(s*0.30 + e*0.20 + st*0.20 + m*0.15 + b*0.15);
}
function scoreColor(s: number, accent: string): string {
  if (s >= 80) return '#4ADE80';
  if (s >= 65) return accent;
  if (s >= 45) return '#FBBF24';
  if (s > 0)   return '#F87171';
  return 'rgba(128,128,128,0.3)';
}

const JOURNAL_PROMPTS_DE = [
  'Wie war das heutige Training? Was hat gut geklappt?',
  'Was nimmst du aus dem heutigen Tag mit?',
  'Wie fühlst du dich mental und körperlich?',
  'Was willst du morgen besser machen?',
  'Beschreibe deine Energie und Motivation heute.',
];
const JOURNAL_PROMPTS_EN = [
  'How was today\'s training? What went well?',
  'What are you taking away from today?',
  'How do you feel mentally and physically?',
  'What do you want to do better tomorrow?',
  'Describe your energy and motivation today.',
];

function Ring({ value, size, stroke, color, track, children }: {
  value: number; size: number; stroke: number; color: string; track: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.min(value, 100) / 100, duration: 1200, useNativeDriver: false }).start();
  }, [value]);
  const dash = anim.interpolate({ inputRange: [0,1], outputRange: [circ, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <AnimatedCircle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash} />
      </Svg>
      {children}
    </View>
  );
}

function SectionLabel({ label, light }: { label: string; light?: boolean }) {
  return (
    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase',
      marginBottom: 10, color: light ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>{label}</Text>
  );
}
function StatPill({ label, value, color, light }: { label: string; value: string; color: string; light?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color, letterSpacing: -0.3 }}>{value}</Text>
      <Text style={{ fontSize: 9, color: light ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        textTransform: 'uppercase', letterSpacing: 1, marginTop: 3, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
function PillDivider({ light }: { light?: boolean }) {
  return <View style={{ width: 1, height: 28, backgroundColor: light ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />;
}

interface JournalEntry { date: string; text: string; mood: number; saved: string; }
const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const MOOD_COLORS = ['#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#34D399'];

function JournalModal({ visible, entry, accent, isDark, onSave, onClose, lang }: {
  visible: boolean; entry: JournalEntry | null; accent: string; isDark: boolean;
  onSave: (e: JournalEntry) => void; onClose: () => void; lang: string;
}) {
  const [text, setText] = useState('');
  const [mood, setMood] = useState(3);
  const prompts = lang === 'en' ? JOURNAL_PROMPTS_EN : JOURNAL_PROMPTS_DE;
  const prompt = useRef(prompts[Math.floor(Math.random() * prompts.length)]).current;
  const moodLabels = lang === 'en'
    ? ['Bad', 'Poor', 'Okay', 'Good', 'Great']
    : ['Schlecht', 'Mäßig', 'Okay', 'Gut', 'Super'];

  const bg = isDark ? '#1C1917' : '#FFFFFF';
  const cardAlt = isDark ? '#242120' : '#F5F0EC';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const txtCol = isDark ? '#F5F0EE' : '#1A1209';
  const mutCol = isDark ? 'rgba(245,240,238,0.45)' : 'rgba(26,18,9,0.45)';
  const dimCol = isDark ? 'rgba(245,240,238,0.22)' : 'rgba(26,18,9,0.22)';

  useEffect(() => {
    if (visible) { setText(entry?.text ?? ''); setMood(entry?.mood ?? 3); }
  }, [visible, entry]);

  function save() {
    if (!text.trim() && mood === 3) { onClose(); return; }
    onSave({ date: todayKey(), text: text.trim(), mood, saved: new Date().toISOString() });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => Keyboard.dismiss()} />
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 20 }} />
          <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: txtCol, letterSpacing: -0.5 }}>
                {lang === 'en' ? 'Daily Note' : 'Tagesnotiz'}
              </Text>
              <TouchableOpacity onPress={onClose} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: cardAlt }}>
                <Text style={{ color: mutCol, fontSize: 13, fontWeight: '600' }}>{lang === 'en' ? 'Close' : 'Schließen'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: dimCol, marginBottom: 20 }}>
              {new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: dimCol, marginBottom: 10 }}>
              {lang === 'en' ? 'How was your day?' : 'Wie war dein Tag?'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {MOODS.map((emoji, i) => (
                <TouchableOpacity key={i} onPress={() => setMood(i + 1)}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center',
                    backgroundColor: mood === i + 1 ? MOOD_COLORS[i] + '25' : cardAlt,
                    borderWidth: 1.5, borderColor: mood === i + 1 ? MOOD_COLORS[i] : border }}>
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '700', marginTop: 4,
                    color: mood === i + 1 ? MOOD_COLORS[i] : dimCol }}>{moodLabels[i]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: dimCol, marginBottom: 10 }}>
              {lang === 'en' ? 'Note' : 'Notiz'}
            </Text>
            <TextInput
              style={{ backgroundColor: cardAlt, borderRadius: 16, padding: 16, color: txtCol,
                fontSize: 15, lineHeight: 24, minHeight: 120, textAlignVertical: 'top',
                borderWidth: 1, borderColor: border }}
              multiline value={text} onChangeText={setText}
              placeholder={prompt} placeholderTextColor={dimCol} autoFocus={false}
            />
            <TouchableOpacity onPress={save}
              style={{ backgroundColor: accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                {text.trim() ? (lang === 'en' ? 'Save' : 'Speichern') : (lang === 'en' ? 'Done' : 'Fertig')}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 16 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function HomeScreen() {
  const { colors, themeIndex, setTheme } = useAppTheme();
  const { lang, setLang, t } = useLanguage();
  const [checkin,   setCheckin]   = useState<any>(null);
  const [sleep,     setSleep]     = useState<any>(null);
  const [battery,   setBattery]   = useState<any>(null);
  const [profile,   setProfile]   = useState<any>(null);
  const [habits,    setHabits]    = useState<any[]>([]);
  const [nutrition, setNutrition] = useState<any>(null);
  const [muscles,   setMuscles]   = useState<any>({});
  const [journal,   setJournal]   = useState<JournalEntry | null>(null);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [themePicker,  setThemePicker]  = useState(false);
  const [journalOpen,  setJournalOpen]  = useState(false);
  const [langPicker,   setLangPicker]   = useState(false);
  const [streak,       setStreak]       = useState(0);

  const fade     = useRef(new Animated.Value(0)).current;
  const menuX    = useRef(new Animated.Value(W)).current;
  const menuFade = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    loadAll();
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []));

  async function loadAll() {
    try {
      const today = todayKey();
      const rawWo = await AsyncStorage.getItem('workouts');
      const allWo = rawWo ? JSON.parse(rawWo) : [];
      const sortedWo = [...allWo].filter(w => w.type === 'gym' || w.type === 'judo' || w.type === 'run')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      let st = 0, checkD = new Date(); checkD.setHours(0,0,0,0);
      for (let i = 0; i < 365; i++) {
        const ds = checkD.toISOString().slice(0,10);
        const prev = new Date(checkD); prev.setDate(prev.getDate()-1);
        if (sortedWo.some(w => w.date.slice(0,10) === ds)) { st++; checkD = prev; }
        else if (i === 0 && sortedWo.some(w => w.date.slice(0,10) === prev.toISOString().slice(0,10))) { checkD = prev; }
        else break;
      }
      setStreak(st);

      const [rc, rs, rb, rp, rh, rn, rj, rm] = await Promise.all([
        AsyncStorage.getItem('lastCheckin'),
        AsyncStorage.getItem('lastSleep'),
        AsyncStorage.getItem('batteryData'),
        AsyncStorage.getItem('profile'),
        AsyncStorage.getItem('habits'),
        AsyncStorage.getItem('nutritionToday'),
        AsyncStorage.getItem(`journal_${today}`),
        AsyncStorage.getItem('muscleRecovery'),
      ]);
      if (rc) { const c = JSON.parse(rc); if (isToday(c.date ?? '')) setCheckin(c); }
      if (rs) { const s = JSON.parse(rs); if (isToday(s.date ?? '')) setSleep(s); }
      if (rb) { const b = JSON.parse(rb); if (isToday(b.date ?? '')) setBattery(b); }
      if (rp) setProfile(JSON.parse(rp));
      if (rn) setNutrition(JSON.parse(rn));
      if (rj) setJournal(JSON.parse(rj));
      if (rm) setMuscles(JSON.parse(rm));
      if (rh) {
        const h = JSON.parse(rh);
        setHabits(h.map((hh: any) => ({ ...hh, completedToday: hh.completedDates?.some(isToday) ?? false })));
      }
    } catch {}
  }

  async function saveJournal(entry: JournalEntry) {
    setJournal(entry);
    await AsyncStorage.setItem(`journal_${entry.date}`, JSON.stringify(entry));
    const raw = await AsyncStorage.getItem('journal_history');
    const hist = raw ? JSON.parse(raw) : [];
    const updated = [entry, ...hist.filter((e: JournalEntry) => e.date !== entry.date)].slice(0, 365);
    await AsyncStorage.setItem('journal_history', JSON.stringify(updated));
  }

  function openMenu() {
    setMenuOpen(true);
    Animated.parallel([
      Animated.spring(menuX, { toValue: 0, useNativeDriver: true, tension: 85, friction: 13 }),
      Animated.timing(menuFade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }
  function closeMenu() {
    Animated.parallel([
      Animated.timing(menuX, { toValue: W, duration: 220, useNativeDriver: true }),
      Animated.timing(menuFade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setMenuOpen(false));
  }

  const score      = calcScore(checkin, sleep, battery);
  const sc         = scoreColor(score, colors.accent);
  const name       = profile?.name?.split(' ')[0] ?? (lang === 'en' ? 'Athlete' : 'Athlet');
  const initial    = name.charAt(0).toUpperCase();
  const sleepScore = sleep?.sleepScore ?? 0;
  const battLevel  = battery?.level ?? 0;
  const habDone    = habits.filter(h => h.completedToday).length;
  const habTotal   = habits.length;
  const isDark     = colors.bg.startsWith('#0') || colors.bg.startsWith('#1') || colors.bg.startsWith('#2') || colors.bg === '#383838';
  const textPrimary = isDark ? '#F5F0EE' : '#1A1209';
  const textMuted   = isDark ? 'rgba(245,240,238,0.45)' : 'rgba(26,18,9,0.45)';
  const textDim     = isDark ? 'rgba(245,240,238,0.22)' : 'rgba(26,18,9,0.22)';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const wakeDisplay = sleep?.wakeTime ? formatTime(sleep.wakeTime) : sleep?.date ? formatTime(sleep.date) : '—';
  const bedDisplay  = sleep?.bedTime ? formatTime(sleep.bedTime) : '—';
  const sleepHours  = sleep?.schlafStunden ?? sleep?.sleepHours ?? 0;
  const battColor   = battLevel >= 65 ? '#4ADE80' : battLevel >= 35 ? '#FBBF24' : battLevel > 0 ? '#F87171' : textDim;
  const kcalGoal    = nutrition?.goal ?? 2500;
  const kcalEaten   = nutrition?.eaten ?? 0;
  const kcalPct     = kcalGoal > 0 ? Math.min(100, Math.round((kcalEaten / kcalGoal) * 100)) : 0;
  const MUSCLES     = ['Brust','Rücken','Schultern','Bizeps','Trizeps','Quadrizeps','Hamstrings','Gluteus','Waden','Core','Abduktoren'];
  const readyCount  = MUSCLES.filter(m => (muscles[m]?.level ?? 100) >= 80).length;
  const journalMoodColor = journal ? MOOD_COLORS[journal.mood - 1] : colors.accent;
  const journalMoodEmoji = journal ? MOODS[journal.mood - 1] : null;
  const moodLabels = lang === 'en'
    ? ['Bad', 'Poor', 'Okay', 'Good', 'Great']
    : ['Schlecht', 'Mäßig', 'Okay', 'Gut', 'Super'];

  function getGreeting() {
    const h = new Date().getHours();
    if (lang === 'en') {
      if (h < 5)  return 'Good Night';
      if (h < 12) return 'Good Morning';
      if (h < 18) return 'Good Day';
      return 'Good Evening';
    }
    if (h < 5)  return 'Gute Nacht';
    if (h < 12) return 'Guten Morgen';
    if (h < 18) return 'Guten Tag';
    return 'Guten Abend';
  }

  function scoreLabel(s: number) {
    if (s >= 80) return t('home_optimal');
    if (s >= 65) return t('home_good');
    if (s >= 45) return t('home_moderate');
    if (s > 0)   return t('home_low');
    return t('home_no_entry');
  }

  const menuItems = [
    { label: t('menu_appearance'), icon: '🎨', onPress: () => { closeMenu(); setTimeout(() => setThemePicker(true), 300); }},
    { label: t('menu_profile'),    icon: '👤', onPress: () => { closeMenu(); router.push('/profile' as any); }},
    { label: t('menu_achievements'), icon: '🏆', onPress: () => { closeMenu(); router.push('/achievements' as any); }},
    { label: t('menu_history'),    icon: '📊', onPress: () => { closeMenu(); router.push('/(tabs)/history' as any); }},
    { label: t('menu_friends'),    icon: '👥', onPress: () => { closeMenu(); router.push('/friends' as any); }},
    { label: t('menu_photos'),     icon: '📸', onPress: () => { closeMenu(); router.push('/progress-photos' as any); }},
    { label: t('menu_language'),   icon: '🌐', onPress: () => { closeMenu(); setTimeout(() => setLangPicker(true), 300); }},
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Animated.View style={{ opacity: fade }}>

          {/* HEADER */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: textDim, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                {new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              <Text style={{ fontSize: 32, fontWeight: '800', color: textPrimary, letterSpacing: -1, lineHeight: 34 }}>
                {getGreeting()}
              </Text>
              <Text style={{ fontSize: 13, color: textMuted, marginTop: 5, fontWeight: '500' }}>
                {t('home_welcome')}, {name} 👋
              </Text>
              {streak > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: streak >= 7 ? 'rgba(249,115,22,0.12)' : 'rgba(251,191,36,0.12)',
                    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 14 }}>🔥</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: streak >= 7 ? '#F97316' : '#FBBF24' }}>
                      {streak} {t('home_streak')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={openMenu} style={[s.iconBtn, { backgroundColor: colors.card, borderColor: cardBorder }]} activeOpacity={0.7}>
              <View style={{ gap: 4, alignItems: 'center' }}>
                <View style={[s.menuLine, { backgroundColor: textPrimary }]} />
                <View style={[s.menuLine, { width: 12, backgroundColor: textPrimary }]} />
                <View style={[s.menuLine, { backgroundColor: textPrimary }]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* PERFORMANCE SCORE */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: cardBorder, marginHorizontal: 16, marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <Ring value={score} size={100} stroke={7} color={sc} track={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: textPrimary, letterSpacing: -1 }}>{score || '—'}</Text>
                  <Text style={{ fontSize: 8, color: textDim, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Score</Text>
                </View>
              </Ring>
              <View style={{ flex: 1 }}>
                <SectionLabel label={t('home_performance')} light={isDark} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sc }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: sc }}>{scoreLabel(score)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <StatPill label={lang === 'en' ? 'Sleep' : 'Schlaf'} value={sleepScore ? `${sleepScore}` : '—'} color={sleepScore >= 70 ? '#4ADE80' : sleepScore >= 50 ? '#FBBF24' : textMuted} light={isDark} />
                  <PillDivider light={isDark} />
                  <StatPill label="Energy" value={battLevel ? `${battLevel}%` : '—'} color={battColor} light={isDark} />
                  <PillDivider light={isDark} />
                  <StatPill label="Habits" value={habTotal > 0 ? `${habDone}/${habTotal}` : '—'} color={habDone === habTotal && habTotal > 0 ? '#4ADE80' : textMuted} light={isDark} />
                </View>
              </View>
            </View>
          </View>

          {/* SLEEP */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: cardBorder, marginHorizontal: 16, marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <SectionLabel label={t('home_sleep_last')} light={isDark} />
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 40, fontWeight: '800', color: textPrimary, letterSpacing: -1.5, lineHeight: 42 }}>
                    {sleepHours > 0 ? sleepHours.toFixed(1) : '—'}
                  </Text>
                  {sleepHours > 0 && <Text style={{ fontSize: 16, color: textMuted, fontWeight: '600' }}>h</Text>}
                </View>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                  <View>
                    <Text style={{ fontSize: 10, color: textDim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>{t('home_fall_asleep')}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: textMuted, marginTop: 2 }}>{bedDisplay}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 10, color: textDim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>{t('home_wake_up')}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: textMuted, marginTop: 2 }}>{wakeDisplay}</Text>
                  </View>
                  {sleep?.deepPct && (
                    <View>
                      <Text style={{ fontSize: 10, color: textDim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>{lang === 'en' ? 'Deep' : 'Tief'}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: textMuted, marginTop: 2 }}>{sleep.deepPct}%</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ring value={sleepScore} size={72} stroke={6} color="#818CF8" track={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary }}>{sleepScore || '—'}</Text>
              </Ring>
            </View>
            {sleepHours > 0 && (
              <View style={{ marginTop: 16 }}>
                <View style={{ height: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: 4, width: `${Math.min(100, (sleepHours / 9) * 100)}%`, backgroundColor: '#818CF8', borderRadius: 2 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 9, color: textDim }}>0h</Text>
                  <Text style={{ fontSize: 9, color: textDim }}>{lang === 'en' ? 'Goal: 8h' : 'Ziel: 8h'}</Text>
                  <Text style={{ fontSize: 9, color: textDim }}>9h</Text>
                </View>
              </View>
            )}
            <TouchableOpacity onPress={() => router.push('/sleep' as any)} style={[s.cardBtn, { borderColor: cardBorder }]} activeOpacity={0.7}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#818CF8' }}>{t('home_sleep_details')}</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke="#818CF8" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* ENERGY */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: cardBorder, marginHorizontal: 16, marginBottom: 12 }]}>
            <SectionLabel label={t('home_energy')} light={isDark} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                  <Text style={{ fontSize: 40, fontWeight: '800', color: battColor, letterSpacing: -1.5, lineHeight: 42 }}>{battLevel || '—'}</Text>
                  {battLevel > 0 && <Text style={{ fontSize: 16, color: textMuted, fontWeight: '600' }}>%</Text>}
                </View>
                <Text style={{ fontSize: 13, color: textMuted, fontWeight: '500', marginBottom: 14 }}>
                  {battLevel >= 65 ? t('home_energy_high') :
                   battLevel >= 35 ? t('home_energy_medium') :
                   battLevel > 0  ? t('home_energy_low') :
                   t('home_energy_none')}
                </Text>
                <View style={{ height: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${battLevel}%`, backgroundColor: battColor, borderRadius: 4 }} />
                </View>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <View style={{ width: 14, height: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', borderRadius: 2 }} />
                <View style={{ width: 36, height: 62, borderRadius: 6, borderWidth: 2, borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)', overflow: 'hidden', justifyContent: 'flex-end' }}>
                  <View style={{ height: `${Math.max(battLevel, 4)}%` as any, backgroundColor: battColor, borderRadius: 2 }} />
                </View>
                <Text style={{ fontSize: 10, color: battColor, fontWeight: '700' }}>{battLevel || 0}%</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/battery' as any)} style={[s.cardBtn, { borderColor: cardBorder }]} activeOpacity={0.7}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: battColor !== textDim ? battColor : colors.accent }}>{t('home_energy_log')}</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={battColor !== textDim ? battColor : colors.accent} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* NUTRITION */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: cardBorder, marginHorizontal: 16, marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <SectionLabel label={t('home_nutrition')} light={isDark} />
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 36, fontWeight: '800', color: textPrimary, letterSpacing: -1, lineHeight: 38 }}>{kcalEaten || '—'}</Text>
                  {kcalEaten > 0 && <Text style={{ fontSize: 14, color: textMuted, fontWeight: '600' }}>kcal</Text>}
                </View>
                <Text style={{ fontSize: 13, color: textMuted, marginBottom: 14 }}>
                  {kcalGoal > 0 ? `${t('home_nutrition_goal')}: ${kcalGoal} kcal · ${kcalPct}% ${t('home_nutrition_reached')}` : (lang === 'en' ? 'No goal set' : 'Kein Ziel gesetzt')}
                </Text>
              </View>
              <Ring value={kcalPct} size={72} stroke={6} color={colors.accent} track={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: textPrimary }}>{kcalPct}%</Text>
              </Ring>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <StatPill label={t('nutrition_protein')} value={nutrition?.protein ? `${nutrition.protein}g` : '—'} color="#4ADE80" light={isDark} />
              <PillDivider light={isDark} />
              <StatPill label="Carbs" value={nutrition?.carbs ? `${nutrition.carbs}g` : '—'} color="#60A5FA" light={isDark} />
              <PillDivider light={isDark} />
              <StatPill label={t('nutrition_fat')} value={nutrition?.fat ? `${nutrition.fat}g` : '—'} color="#FBBF24" light={isDark} />
            </View>
            <TouchableOpacity onPress={() => router.push('/nutrition' as any)} style={[s.cardBtn, { borderColor: cardBorder }]} activeOpacity={0.7}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>{t('home_nutrition_log')}</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* TRAINING READINESS */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: cardBorder, marginHorizontal: 16, marginBottom: 12 }]}>
            <SectionLabel label={t('home_readiness')} light={isDark} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 28, fontWeight: '800', color: textPrimary, letterSpacing: -0.5 }}>
                  {readyCount}<Text style={{ fontSize: 16, color: textMuted, fontWeight: '600' }}>/{MUSCLES.length}</Text>
                </Text>
                <Text style={{ fontSize: 13, color: textMuted, marginTop: 4 }}>{t('home_muscles_ready')}</Text>
              </View>
              <Ring value={(readyCount / MUSCLES.length) * 100} size={72} stroke={6} color="#4ADE80" track={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: textPrimary }}>{Math.round((readyCount / MUSCLES.length) * 100)}%</Text>
              </Ring>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {MUSCLES.map(m => {
                const pct = muscles[m]?.level ?? 100;
                const col = pct >= 80 ? '#4ADE80' : pct >= 50 ? '#FBBF24' : '#F87171';
                return (
                  <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: col }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: textMuted }}>{m}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => router.push('/training' as any)} activeOpacity={0.85}
                style={{ flex: 1.4, backgroundColor: colors.accent, borderRadius: 14, padding: 13, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{t('home_start_training')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/body' as any)} activeOpacity={0.85}
                style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 14, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: cardBorder }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: textMuted }}>{t('home_recovery')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* HABITS */}
          {habTotal > 0 && (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: cardBorder, marginHorizontal: 16, marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View>
                  <SectionLabel label={t('home_habits')} light={isDark} />
                  <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary, letterSpacing: -0.5 }}>
                    {habDone}<Text style={{ fontSize: 14, color: textMuted, fontWeight: '600' }}>/{habTotal}</Text>
                  </Text>
                </View>
                <Ring value={(habDone / habTotal) * 100} size={56} stroke={5} color={habDone === habTotal ? '#4ADE80' : colors.accent} track={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: textPrimary }}>{Math.round((habDone/habTotal)*100)}%</Text>
                </Ring>
              </View>
              <View style={{ height: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
                <View style={{ height: 4, width: `${(habDone/habTotal)*100}%`, backgroundColor: habDone === habTotal ? '#4ADE80' : colors.accent, borderRadius: 2 }} />
              </View>
              {habits.slice(0, 4).map((h, i) => (
                <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
                  borderBottomWidth: i < Math.min(habits.length, 4) - 1 ? 1 : 0,
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11,
                    backgroundColor: h.completedToday ? colors.accent : 'transparent',
                    borderWidth: 1.5, borderColor: h.completedToday ? colors.accent : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                    alignItems: 'center', justifyContent: 'center' }}>
                    {h.completedToday && (
                      <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                        <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
                      </Svg>
                    )}
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: h.completedToday ? textDim : textPrimary,
                    textDecorationLine: h.completedToday ? 'line-through' : 'none' }}>{h.name}</Text>
                  {h.streak > 0 && <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '700' }}>🔥 {h.streak}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* DAILY JOURNAL */}
          <TouchableOpacity onPress={() => setJournalOpen(true)}
            style={[s.card, { marginHorizontal: 16, marginBottom: 12,
              backgroundColor: journal ? colors.card : 'transparent',
              borderColor: journal ? cardBorder : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderStyle: journal ? 'solid' : 'dashed' }]}
            activeOpacity={0.8}>
            {journal ? (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>{journalMoodEmoji}</Text>
                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: journalMoodColor }}>
                        {t('home_journal_title')}
                      </Text>
                      <Text style={{ fontSize: 11, color: textDim, marginTop: 1 }}>
                        {moodLabels[journal.mood - 1]} · {formatTime(journal.saved)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: journalMoodColor + '20' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: journalMoodColor }}>{t('edit')}</Text>
                  </View>
                </View>
                {journal.text
                  ? <Text style={{ fontSize: 14, color: textMuted, lineHeight: 21 }} numberOfLines={3}>{journal.text}</Text>
                  : <Text style={{ fontSize: 14, color: textDim, fontStyle: 'italic' }}>{lang === 'en' ? 'No note — only mood captured.' : 'Keine Notiz — nur Stimmung erfasst.'}</Text>
                }
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>📓</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary, marginBottom: 4 }}>{t('home_journal')}</Text>
                <Text style={{ fontSize: 13, color: textDim, textAlign: 'center' }}>{t('home_journal_subtitle')}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* TODAY'S TASKS */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: cardBorder, marginHorizontal: 16, marginBottom: 24 }]}>
            <SectionLabel label={t('home_todo')} light={isDark} />
            {[
              { label: t('home_todo_sleep'),   done: !!sleep,       route: '/sleep',   icon: '🌙' },
              { label: t('home_todo_checkin'), done: !!checkin,     route: '/checkin', icon: '✅' },
              { label: t('home_todo_battery'), done: battLevel > 0, route: '/battery', icon: '⚡' },
              { label: t('home_todo_journal'), done: !!journal,     route: null,       icon: '📓', onPress: () => setJournalOpen(true) },
            ].map((item, i) => (
              <TouchableOpacity key={item.label}
                onPress={() => { if (item.done) return; if (item.onPress) item.onPress(); else if (item.route) router.push(item.route as any); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
                  borderBottomWidth: i < 3 ? 1 : 0,
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                activeOpacity={item.done ? 1 : 0.7}>
                <Text style={{ fontSize: 18, opacity: item.done ? 0.4 : 1 }}>{item.icon}</Text>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: item.done ? textDim : textPrimary,
                  textDecorationLine: item.done ? 'line-through' : 'none' }}>{item.label}</Text>
                {item.done
                  ? <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>✓</Text>
                    </View>
                  : <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M9 18l6-6-6-6" stroke={textDim} strokeWidth={2} strokeLinecap="round" />
                    </Svg>
                }
              </TouchableOpacity>
            ))}
          </View>

        </Animated.View>
      </ScrollView>

      {/* SIDE MENU */}
      {menuOpen && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: menuFade }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeMenu} activeOpacity={1}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          </TouchableOpacity>
          <Animated.View style={[s.menuPanel, { backgroundColor: colors.card, transform: [{ translateX: menuX }] }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: cardBorder }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent + '25', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: colors.accent }}>{initial}</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: textPrimary }}>{profile?.name ?? (lang === 'en' ? 'Athlete' : 'Athlet')}</Text>
                <Text style={{ fontSize: 13, color: textMuted, marginTop: 3 }}>{profile?.sport ?? 'Performance Athlete'}</Text>
              </View>
              {menuItems.map(item => (
                <TouchableOpacity key={item.label} onPress={item.onPress} activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: cardBorder }}>
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: textPrimary }}>{item.label}</Text>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 18l6-6-6-6" stroke={textDim} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </TouchableOpacity>
              ))}
              <Text style={{ fontSize: 11, color: textDim, textAlign: 'center', marginTop: 32 }}>Stride · v1.0</Text>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}

      {/* THEME PICKER */}
      <Modal visible={themePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setThemePicker(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, marginTop: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: textPrimary }}>{t('menu_appearance')}</Text>
            <TouchableOpacity onPress={() => setThemePicker(false)}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>{t('done')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {THEMES.map((th, i) => (
              <TouchableOpacity key={th.name} onPress={() => setTheme(i)} activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, marginBottom: 8,
                  backgroundColor: colors.card, borderWidth: themeIndex === i ? 2 : 1,
                  borderColor: themeIndex === i ? th.accent : cardBorder }}>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {[th.accent, th.bg, th.card].map((c, j) => (
                    <View key={j} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)' }} />
                  ))}
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: textPrimary }}>{th.name}</Text>
                {themeIndex === i && (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* LANGUAGE PICKER */}
      <Modal visible={langPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLangPicker(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, marginTop: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: textPrimary }}>Sprache / Language</Text>
            <TouchableOpacity onPress={() => setLangPicker(false)}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>{t('done')}</Text>
            </TouchableOpacity>
          </View>
          {[{ code: 'de', label: 'Deutsch', flag: '🇩🇪' }, { code: 'en', label: 'English', flag: '🇬🇧' }].map(l => (
            <TouchableOpacity key={l.code} onPress={() => setLang(l.code as any)} activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, marginBottom: 8,
                backgroundColor: colors.card, borderWidth: lang === l.code ? 2 : 1,
                borderColor: lang === l.code ? colors.accent : cardBorder }}>
              <Text style={{ fontSize: 28 }}>{l.flag}</Text>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: textPrimary }}>{l.label}</Text>
              {lang === l.code && (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* JOURNAL MODAL */}
      <JournalModal
        visible={journalOpen} entry={journal} accent={colors.accent}
        isDark={isDark} lang={lang} onSave={saveJournal} onClose={() => setJournalOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header:    { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  card:      { borderRadius: 20, padding: 20, borderWidth: 1 },
  cardBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  iconBtn:   { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  menuLine:  { width: 16, height: 1.5, borderRadius: 1 },
  menuPanel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '78%', borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.06)' },
});