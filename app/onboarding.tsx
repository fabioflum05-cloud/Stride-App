import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Animated, Dimensions, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const SW = Dimensions.get('window').width;

const theme = {
  bg: '#1A1614', card: '#231F1C', cardSecondary: '#2E2825',
  border: 'rgba(255,255,255,0.07)' as string,
  orange: '#E8572A', orangeLight: 'rgba(232,87,42,0.15)' as string,
  orangeBorder: 'rgba(232,87,42,0.25)' as string,
  blue: '#4A9EFF', green: '#34C759',
  textPrimary: '#F5F0EE', textSecondary: 'rgba(245,240,238,0.45)' as string,
  textTertiary: 'rgba(245,240,238,0.22)' as string,
};

const GOALS = [
  { key: 'masse', label: 'Masse aufbauen', emoji: '💪', desc: 'Mehr Muskeln, mehr Gewicht' },
  { key: 'kraft', label: 'Stärker werden', emoji: '🏋️', desc: 'Maximalkraft steigern' },
  { key: 'wettkampf', label: 'Wettkampf', emoji: '🥇', desc: 'Für den nächsten Wettkampf' },
  { key: 'abnehmen', label: 'Gewicht verlieren', emoji: '⚡', desc: 'Fett abbauen' },
  { key: 'gesundheit', label: 'Gesund bleiben', emoji: '❤️', desc: 'Langfristige Fitness' },
  { key: 'performance', label: 'Performance', emoji: '🚀', desc: 'Athletik & Ausdauer' },
];

const SPORTS = [
  { key: 'Judo', emoji: '🥋' }, { key: 'BJJ', emoji: '🤼' }, { key: 'Boxing', emoji: '🥊' },
  { key: 'MMA', emoji: '⚔️' }, { key: 'Gym', emoji: '🏋️' }, { key: 'Running', emoji: '🏃' },
  { key: 'Cycling', emoji: '🚴' }, { key: 'Swimming', emoji: '🏊' }, { key: 'Football', emoji: '⚽' },
  { key: 'Other', emoji: '🎯' },
];

const TRAINING_TYPES = [
  { key: 'hypertrophie', label: 'Muskelaufbau', emoji: '💪', desc: '8–12 Wdh., mittleres Gewicht' },
  { key: 'kraft', label: 'Maximalkraft', emoji: '🏋️', desc: '3–5 Wdh., schweres Gewicht' },
  { key: 'ausdauer', label: 'Ausdauer', emoji: '🏃', desc: '15–20 Wdh., leichtes Gewicht' },
  { key: 'wettkampf', label: 'Wettkampf', emoji: '🥋', desc: 'Sport-spezifisch' },
];

const DEFAULT_EXERCISES = [
  'Bankdrücken', 'Kniebeugen', 'Deadlift', 'Schulterdrücken',
  'Klimmzüge', 'Rudern', 'Curls', 'Trizepsdrücken',
];

// ─── Stride Logo ─────────────────────────────────────────────
function StrideLogo({ size = 80 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF6B35" />
          <Stop offset="1" stopColor="#E8572A" />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} rx={24} fill="url(#lg)" />
      {/* S shape */}
      <Path d="M35 38C35 33 39 30 47 30H62C64 30 65 31 65 33C65 35 64 36 62 36H47C44 36 42 37 42 40C42 43 44 44 50 45C58 46 65 49 65 57C65 63 61 70 50 70H33C31 70 30 69 30 67C30 65 31 64 33 64H50C55 64 58 62 58 58C58 54 55 53 48 52C40 51 35 47 35 38Z"
        fill="white" />
    </Svg>
  );
}

// ─── Progress Dots ────────────────────────────────────────────
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{
          height: 4, borderRadius: 2,
          width: i === current ? 24 : 6,
          backgroundColor: i === current ? theme.orange : theme.cardSecondary,
        }} />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('');
  const [sport, setSport] = useState('');
  const [name, setName] = useState('');
  const [trainingType, setTrainingType] = useState('');
  const [prs, setPRs] = useState<Record<string, string>>({});
  const slideAnim = useRef(new Animated.Value(0)).current;

  function goNext() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -SW, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(s => s + 1);
      slideAnim.setValue(SW);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    });
  }

  function goBack() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: SW, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(s => s - 1);
      slideAnim.setValue(-SW);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    });
  }

  async function finish() {
    const profile = { name, sport, goal, trainingType, trainingDaysPerWeek: '3' };
    await AsyncStorage.setItem('profile', JSON.stringify(profile));
    await AsyncStorage.setItem('onboardingDone', 'true');

    // Save PRs
    const userMaxes: Record<string, number> = {};
    const prHistory: Record<string, any[]> = {};
    for (const [ex, w] of Object.entries(prs)) {
      const weight = parseFloat(w);
      if (weight > 0) {
        userMaxes[ex] = weight;
        prHistory[ex] = [{ date: new Date().toISOString(), weight, reps: 1, estimated1RM: weight }];
      }
    }
    if (Object.keys(userMaxes).length > 0) {
      await AsyncStorage.setItem('userMaxes', JSON.stringify(userMaxes));
      await AsyncStorage.setItem('prHistory', JSON.stringify(prHistory));
    }

    router.replace('/(tabs)' as any);
  }

  const canProceed = [
    !!goal,
    !!sport,
    name.trim().length > 0,
    !!trainingType,
    true, // PRs optional
  ][step];

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { transform: [{ translateX: slideAnim }] }]}>

        {/* Step 0 – Ziel */}
        {step === 0 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.logoRow}>
              <StrideLogo size={64} />
            </View>
            <Text style={styles.stepEyebrow}>Willkommen bei Stride</Text>
            <Text style={styles.stepTitle}>Was ist dein{'\n'}Ziel?</Text>
            <Text style={styles.stepSub}>Dein Ziel bestimmt wie die App dich unterstützt.</Text>
            <View style={styles.optionGrid}>
              {GOALS.map(g => (
                <TouchableOpacity key={g.key}
                  style={[styles.optionCard, goal === g.key && styles.optionCardActive]}
                  onPress={() => setGoal(g.key)} activeOpacity={0.85}>
                  <Text style={styles.optionEmoji}>{g.emoji}</Text>
                  <Text style={[styles.optionLabel, goal === g.key && { color: theme.orange }]}>{g.label}</Text>
                  <Text style={styles.optionDesc}>{g.desc}</Text>
                  {goal === g.key && (
                    <View style={styles.optionCheck}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text></View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 120 }} />
          </ScrollView>
        )}

        {/* Step 1 – Sport */}
        {step === 1 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepEyebrow}>Schritt 2 von 5</Text>
            <Text style={styles.stepTitle}>Dein{'\n'}Hauptsport</Text>
            <Text style={styles.stepSub}>Wir optimieren Empfehlungen für deinen Sport.</Text>
            <View style={styles.sportGrid}>
              {SPORTS.map(s => (
                <TouchableOpacity key={s.key}
                  style={[styles.sportCard, sport === s.key && styles.sportCardActive]}
                  onPress={() => setSport(s.key)} activeOpacity={0.85}>
                  <Text style={styles.sportEmoji}>{s.emoji}</Text>
                  <Text style={[styles.sportLabel, sport === s.key && { color: theme.orange }]}>{s.key}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 120 }} />
          </ScrollView>
        )}

        {/* Step 2 – Name */}
        {step === 2 && (
          <View style={styles.scrollContent}>
            <Text style={styles.stepEyebrow}>Schritt 3 von 5</Text>
            <Text style={styles.stepTitle}>Wie heisst{'\n'}du?</Text>
            <Text style={styles.stepSub}>Damit können wir dich persönlich ansprechen.</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Dein Name"
              placeholderTextColor={theme.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus
              autoCapitalize="words"
            />
            {name.trim().length > 0 && (
              <View style={styles.namePreview}>
                <Text style={styles.namePreviewText}>Hallo, {name.trim()}! 👋</Text>
              </View>
            )}
          </View>
        )}

        {/* Step 3 – Trainingstyp */}
        {step === 3 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepEyebrow}>Schritt 4 von 5</Text>
            <Text style={styles.stepTitle}>Wie trainierst{'\n'}du?</Text>
            <Text style={styles.stepSub}>Bestimmt deine Gewichtsempfehlungen im Plan.</Text>
            <View style={styles.typeList}>
              {TRAINING_TYPES.map(t => (
                <TouchableOpacity key={t.key}
                  style={[styles.typeCard, trainingType === t.key && styles.typeCardActive]}
                  onPress={() => setTrainingType(t.key)} activeOpacity={0.85}>
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeLabel, trainingType === t.key && { color: theme.orange }]}>{t.label}</Text>
                    <Text style={styles.typeDesc}>{t.desc}</Text>
                  </View>
                  {trainingType === t.key && (
                    <View style={styles.typeCheck}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text></View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 120 }} />
          </ScrollView>
        )}

        {/* Step 4 – PRs */}
        {step === 4 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepEyebrow}>Schritt 5 von 5</Text>
            <Text style={styles.stepTitle}>Deine{'\n'}1RM Maximalwerte</Text>
            <Text style={styles.stepSub}>Optional – macht Empfehlungen viel genauer. Du kannst das auch später eintragen.</Text>
            <View style={styles.prList}>
              {DEFAULT_EXERCISES.map(ex => (
                <View key={ex} style={styles.prRow}>
                  <Text style={styles.prName}>{ex}</Text>
                  <View style={styles.prInputWrap}>
                    <TextInput
                      style={styles.prInput}
                      placeholder="kg"
                      placeholderTextColor={theme.textTertiary}
                      value={prs[ex] || ''}
                      onChangeText={v => setPRs(p => ({ ...p, [ex]: v }))}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              ))}
            </View>
            <View style={{ height: 120 }} />
          </ScrollView>
        )}

      </Animated.View>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <ProgressDots total={5} current={step} />
        <View style={styles.bottomBtns}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
              <Text style={styles.backBtnText}>← Zurück</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled, { flex: step > 0 ? 2 : 1 }]}
            onPress={step === 4 ? finish : goNext}
            activeOpacity={0.85}
            disabled={!canProceed}>
            <Text style={[styles.nextBtnText, !canProceed && { color: theme.textTertiary }]}>
              {step === 4 ? 'Loslegen 🚀' : step === 0 ? 'Starten →' : 'Weiter →'}
            </Text>
          </TouchableOpacity>
        </View>
        {step === 4 && (
          <TouchableOpacity onPress={finish} style={{ paddingTop: 12, alignItems: 'center' }}>
            <Text style={{ color: theme.textTertiary, fontSize: 13 }}>Überspringen – später eintragen</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 70 },

  logoRow: { alignItems: 'center', marginBottom: 32 },
  stepEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: theme.orange, marginBottom: 10 },
  stepTitle: { fontSize: 36, fontWeight: '800', color: theme.textPrimary, letterSpacing: -1, lineHeight: 42, marginBottom: 10 },
  stepSub: { fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 28 },

  optionGrid: { gap: 10 },
  optionCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  optionCardActive: { borderColor: theme.orange, backgroundColor: theme.orangeLight },
  optionEmoji: { fontSize: 26 },
  optionLabel: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, flex: 1 },
  optionDesc: { fontSize: 12, color: theme.textSecondary },
  optionCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.orange, alignItems: 'center', justifyContent: 'center' },

  sportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportCard: { width: (SW - 68) / 3, backgroundColor: theme.card, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: theme.border },
  sportCardActive: { borderColor: theme.orange, backgroundColor: theme.orangeLight },
  sportEmoji: { fontSize: 28 },
  sportLabel: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },

  nameInput: { backgroundColor: theme.card, borderRadius: 16, padding: 20, fontSize: 24, color: theme.textPrimary, borderWidth: 1.5, borderColor: theme.orangeBorder, marginBottom: 16 },
  namePreview: { backgroundColor: 'rgba(52,199,89,0.15)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' },
  namePreviewText: { color: '#34C759', fontSize: 16, fontWeight: '600', textAlign: 'center' },

  typeList: { gap: 10 },
  typeCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  typeCardActive: { borderColor: theme.orange, backgroundColor: theme.orangeLight },
  typeEmoji: { fontSize: 26 },
  typeLabel: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  typeDesc: { fontSize: 12, color: theme.textSecondary },
  typeCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.orange, alignItems: 'center', justifyContent: 'center' },

  prList: { gap: 10 },
  prRow: { backgroundColor: theme.card, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  prName: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  prInputWrap: { backgroundColor: theme.cardSecondary, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
  prInput: { width: 72, padding: 10, fontSize: 16, color: theme.textPrimary, textAlign: 'center' },

  bottomBar: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16, backgroundColor: theme.bg, borderTopWidth: 0.5, borderTopColor: theme.border },
  bottomBtns: { flexDirection: 'row', gap: 10 },
  backBtn: { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  backBtnText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  nextBtn: { backgroundColor: theme.orange, borderRadius: 14, padding: 15, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: theme.cardSecondary },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});