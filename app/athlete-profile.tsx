// app/athlete-profile.tsx
import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useLanguage } from '../constants/LanguageContext';
import { useAppTheme } from '../constants/ThemeContext';
import { fetchAndImportHealthData, getLastHealthSync, isHealthKitAvailable } from '../utils/applehealth';

const screenWidth = Dimensions.get('window').width - 40;
const HEALTH_KEY = 'stride_health_history';
const VO2_KEY = 'vo2maxData';

type Profile = { name: string; age: string; weight: string; targetWeight: string; height: string };
type WeightEntry = { date: string; weight: number; note?: string };
interface DayHealth {
  date: string; hrv: number | null; restingHR: number | null;
  sleepHours: number; sleepQuality: number; recoveryScore: number;
  bodyweight: number | null; notes: string;
}
type Vo2Data = { value: number; source: 'manual' | 'cooper' | 'apple_health'; updatedAt: string };
type PR = { exercise: string; oneRM: number; weight: number; reps: number };

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function vo2Label(v: number, lang: string): { label: string; color: string } {
  if (v >= 55) return { label: lang === 'en' ? 'Excellent' : 'Exzellent', color: '#4ADE80' };
  if (v >= 45) return { label: lang === 'en' ? 'Good' : 'Gut', color: '#818CF8' };
  if (v >= 35) return { label: lang === 'en' ? 'Average' : 'Durchschnitt', color: '#FBBF24' };
  return { label: lang === 'en' ? 'Below average' : 'Unterdurchschnitt', color: '#F87171' };
}

function cooperVo2max(distanceMeters: number): number {
  return Math.round(((distanceMeters - 504.9) / 44.73) * 10) / 10;
}

export default function AthleteProfileScreen() {
  const { colors } = useAppTheme();
  const { lang } = useLanguage();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [healthHistory, setHealthHistory] = useState<DayHealth[]>([]);
  const [vo2, setVo2] = useState<Vo2Data | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [prs, setPrs] = useState<PR[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [showVo2Modal, setShowVo2Modal] = useState(false);
  const [vo2Tab, setVo2Tab] = useState<'manual' | 'cooper'>('manual');
  const [vo2Input, setVo2Input] = useState('');
  const [cooperInput, setCooperInput] = useState('');

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  const isDark = colors.bg.startsWith('#0') || colors.bg.startsWith('#1') || colors.bg.startsWith('#2') || colors.bg === '#383838';
  const bg = isDark ? '#0F0E0D' : colors.bg;
  const card = isDark ? '#1C1917' : colors.card;
  const cardAlt = isDark ? '#242120' : colors.cardSecondary;
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const text = isDark ? '#F5F0EE' : '#1A1209';
  const textMuted = isDark ? 'rgba(245,240,238,0.45)' : 'rgba(26,18,9,0.45)';
  const textDim = isDark ? 'rgba(245,240,238,0.22)' : 'rgba(26,18,9,0.22)';

  const load = useCallback(async () => {
    try {
      const [rawProfile, rawWeight, rawHealth, rawWorkouts, rawVo2] = await Promise.all([
        AsyncStorage.getItem('profile'),
        AsyncStorage.getItem('weightHistory'),
        AsyncStorage.getItem(HEALTH_KEY),
        AsyncStorage.getItem('workouts'),
        AsyncStorage.getItem(VO2_KEY),
      ]);

      if (rawProfile) setProfile(JSON.parse(rawProfile));
      if (rawWeight) setWeightEntries(JSON.parse(rawWeight));
      if (rawHealth) setHealthHistory(JSON.parse(rawHealth));
      if (rawVo2) setVo2(JSON.parse(rawVo2));

      if (rawWorkouts) {
        const workouts = JSON.parse(rawWorkouts);
        setTotalSessions(workouts.length);

        const prMap: Record<string, PR> = {};
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
        setPrs(Object.values(prMap).sort((a, b) => b.oneRM - a.oneRM).slice(0, 5));
      }

      setLastSync(await getLastHealthSync());
    } catch {}
    setLoaded(true);
  }, []);

  const syncAppleHealth = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetchAndImportHealthData();
      if (res.success) await load();
    } finally {
      setSyncing(false);
    }
  }, [load]);

  useFocusEffect(useCallback(() => {
    load();
    fade.setValue(0); slide.setValue(20);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  }, [load]));

  async function saveVo2Manual() {
    const v = parseFloat(vo2Input);
    if (isNaN(v) || v <= 0 || v > 100) return;
    const data: Vo2Data = { value: Math.round(v * 10) / 10, source: 'manual', updatedAt: new Date().toISOString() };
    setVo2(data);
    await AsyncStorage.setItem(VO2_KEY, JSON.stringify(data));
    setShowVo2Modal(false); setVo2Input('');
  }

  async function saveVo2Cooper() {
    const dist = parseFloat(cooperInput);
    if (isNaN(dist) || dist <= 0 || dist > 10000) return;
    const v = Math.max(0, cooperVo2max(dist));
    const data: Vo2Data = { value: v, source: 'cooper', updatedAt: new Date().toISOString() };
    setVo2(data);
    await AsyncStorage.setItem(VO2_KEY, JSON.stringify(data));
    setShowVo2Modal(false); setCooperInput('');
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const validHRV = healthHistory.filter(h => h.hrv !== null).map(h => h.hrv as number);
  const avgHRV = validHRV.length ? Math.round(validHRV.reduce((a, b) => a + b, 0) / validHRV.length) : null;
  const validHR = healthHistory.filter(h => h.restingHR !== null).map(h => h.restingHR as number);
  const avgRestingHR = validHR.length ? Math.round(validHR.reduce((a, b) => a + b, 0) / validHR.length) : null;

  const last30Weight = weightEntries.slice(-30);
  const targetWeight = parseFloat(profile?.targetWeight ?? '0');
  const chartData = last30Weight.length >= 2 ? last30Weight.map(e => e.weight) : null;
  const chartLabels = last30Weight.length >= 2 ? last30Weight.map(e => formatDate(e.date)) : [];

  const cardStyle = { backgroundColor: card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: border, marginBottom: 12 };
  const sectionTitleStyle = { color: text, fontSize: 16, fontWeight: '700' as const, marginBottom: 14 };
  const labelStyle = { color: textDim, fontSize: 10, fontWeight: '700' as const, letterSpacing: 1, textTransform: 'uppercase' as const };
  const inputStyle = { backgroundColor: cardAlt, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: text, fontSize: 16, borderWidth: 1, borderColor: border, marginTop: 8 };

  if (!loaded) return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: textMuted }}>{lang === 'en' ? 'Loading...' : 'Laden...'}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <BackButton />

          <Text style={{ color: textDim, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            {lang === 'en' ? 'Athlete' : 'Athlet'}
          </Text>
          <Text style={{ color: text, fontSize: 30, fontWeight: '800', marginBottom: 20, letterSpacing: -0.8 }}>
            {profile?.name || (lang === 'en' ? 'Athlete Profile' : 'Athleten-Profil')}
          </Text>

          {/* Personal Data */}
          <View style={cardStyle}>
            <Text style={sectionTitleStyle}>{lang === 'en' ? 'Personal Data' : 'Persönliche Daten'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                { label: lang === 'en' ? 'Name' : 'Name', value: profile?.name || '—' },
                { label: lang === 'en' ? 'Age' : 'Alter', value: profile?.age ? `${profile.age} ${lang === 'en' ? 'yrs' : 'Jahre'}` : '—' },
                { label: lang === 'en' ? 'Height' : 'Größe', value: profile?.height ? `${profile.height} cm` : '—' },
                { label: lang === 'en' ? 'Weight' : 'Gewicht', value: profile?.weight ? `${profile.weight} kg` : '—' },
              ].map(item => (
                <View key={item.label} style={{ width: '47%', backgroundColor: cardAlt, borderRadius: 14, padding: 14 }}>
                  <Text style={labelStyle}>{item.label}</Text>
                  <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 6 }}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Fitness Metrics */}
          <View style={cardStyle}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[sectionTitleStyle, { marginBottom: 0 }]}>{lang === 'en' ? 'Fitness Metrics' : 'Fitness Metriken'}</Text>
              {isHealthKitAvailable() && (
                <TouchableOpacity onPress={syncAppleHealth} disabled={syncing}
                  style={{ backgroundColor: colors.accent + '18', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.accent + '40' }}>
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
                    {syncing ? (lang === 'en' ? 'Syncing…' : 'Synchronisiere…') : `🍎 ${lang === 'en' ? 'Sync' : 'Sync'}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {lastSync && (
              <Text style={{ color: textDim, fontSize: 10, marginTop: -8, marginBottom: 14 }}>
                {lang === 'en' ? 'Last Apple Health sync' : 'Letzter Apple-Health-Sync'}: {new Date(lastSync).toLocaleString(lang === 'en' ? 'en-US' : 'de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setVo2Tab('manual'); setVo2Input(vo2?.value ? String(vo2.value) : ''); setShowVo2Modal(true); }}
                activeOpacity={0.8}
                style={{ width: '47%', backgroundColor: cardAlt, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.accent + '30' }}
              >
                <Text style={labelStyle}>VO2max</Text>
                {vo2 ? (
                  <>
                    <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 6 }}>
                      {vo2.value} <Text style={{ fontSize: 11, fontWeight: '600', color: textMuted }}>ml/kg/min</Text>
                    </Text>
                    <Text style={{ color: vo2Label(vo2.value, lang).color, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                      {vo2Label(vo2.value, lang).label}{vo2.source === 'apple_health' ? ' · 🍎' : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 6 }}>{lang === 'en' ? '+ Add' : '+ Hinzufügen'}</Text>
                )}
              </TouchableOpacity>
              <View style={{ width: '47%', backgroundColor: cardAlt, borderRadius: 14, padding: 14 }}>
                <Text style={labelStyle}>{lang === 'en' ? 'Avg Resting HR' : 'Ø Ruhepuls'}</Text>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 6 }}>{avgRestingHR ? `${avgRestingHR} bpm` : '—'}</Text>
              </View>
              <View style={{ width: '47%', backgroundColor: cardAlt, borderRadius: 14, padding: 14 }}>
                <Text style={labelStyle}>{lang === 'en' ? 'Avg HRV' : 'Ø HRV'}</Text>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 6 }}>{avgHRV ? `${avgHRV} ms` : '—'}</Text>
              </View>
            </View>
          </View>

          {/* Weight history graph */}
          <View style={cardStyle}>
            <Text style={sectionTitleStyle}>{lang === 'en' ? 'Weight History' : 'Gewichtsverlauf'}</Text>
            {chartData ? (
              <>
                <LineChart
                  data={{
                    labels: chartLabels.filter((_, i) => i % Math.ceil(chartLabels.length / 6) === 0),
                    datasets: [
                      { data: chartData, color: () => colors.accent },
                      ...(targetWeight > 0 ? [{ data: chartData.map(() => targetWeight), color: () => '#4ADE80B0', strokeDashArray: [5, 5] }] : []),
                    ],
                  }}
                  width={screenWidth - 32}
                  height={180}
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: card,
                    backgroundGradientTo: card,
                    decimalPlaces: 1,
                    color: (opacity = 1) => hexToRgba(colors.accent, opacity),
                    labelColor: () => textMuted,
                    propsForDots: { r: '4', strokeWidth: '2', stroke: colors.accent, fill: colors.accent },
                    propsForBackgroundLines: { stroke: border },
                  }}
                  bezier
                  style={{ borderRadius: 12, marginLeft: -16 }}
                  withInnerLines
                  withOuterLines={false}
                  fromZero={false}
                />
                {targetWeight > 0 && (
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
                      <Text style={{ color: textMuted, fontSize: 11 }}>{lang === 'en' ? 'Weight' : 'Gewicht'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
                      <Text style={{ color: textMuted, fontSize: 11 }}>{lang === 'en' ? 'Competition Weight' : 'Wettkampfgewicht'} ({targetWeight} kg)</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <Text style={{ color: textMuted, fontSize: 13 }}>
                {lang === 'en' ? 'Not enough data yet — log your weight to see a graph.' : 'Noch nicht genug Daten — trage dein Gewicht ein, um einen Graphen zu sehen.'}
              </Text>
            )}
          </View>

          {/* Training Stats */}
          <View style={cardStyle}>
            <Text style={sectionTitleStyle}>{lang === 'en' ? 'Training Stats' : 'Trainings-Stats'}</Text>
            <View style={{ flexDirection: 'row', marginBottom: prs.length ? 18 : 0 }}>
              {[
                { label: lang === 'en' ? 'Total Sessions' : 'Gesamte Sessions', value: String(totalSessions) },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <View style={{ width: 1, backgroundColor: border }} />}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: colors.accent }}>{s.value}</Text>
                    <Text style={{ fontSize: 10, color: textDim, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4, fontWeight: '600' }}>{s.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {prs.length > 0 && (
              <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: border }}>
                <Text style={{ color: textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  {lang === 'en' ? 'Top PRs' : 'Top PRs'}
                </Text>
                {prs.map((pr, i) => (
                  <View key={pr.exercise} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < prs.length - 1 ? 1 : 0, borderBottomColor: border }}>
                    <Text style={{ color: text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{pr.exercise}</Text>
                    <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800' }}>{pr.weight} kg × {pr.reps}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

        </Animated.View>
      </ScrollView>

      {/* VO2max Modal */}
      <Modal visible={showVo2Modal} transparent animationType="slide" onRequestClose={() => setShowVo2Modal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: text }}>VO2max</Text>
                <TouchableOpacity onPress={() => setShowVo2Modal(false)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: cardAlt }}>
                  <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600' }}>{lang === 'en' ? 'Cancel' : 'Abbrechen'}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 24, backgroundColor: cardAlt, borderRadius: 16, padding: 4 }}>
                {(['manual', 'cooper'] as const).map(tabKey => (
                  <TouchableOpacity key={tabKey} onPress={() => setVo2Tab(tabKey)}
                    style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center', backgroundColor: vo2Tab === tabKey ? colors.accent : 'transparent' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: vo2Tab === tabKey ? '#fff' : textMuted }}>
                      {tabKey === 'manual' ? (lang === 'en' ? 'Manual' : 'Manuell') : 'Cooper-Test'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {vo2Tab === 'manual' ? (
                <View style={{ gap: 16 }}>
                  <View>
                    <Text style={labelStyle}>VO2max (ml/kg/min)</Text>
                    <TextInput
                      style={inputStyle}
                      value={vo2Input} onChangeText={setVo2Input} placeholder={lang === 'en' ? 'e.g. 48' : 'z. B. 48'} placeholderTextColor={textDim} keyboardType="decimal-pad"
                    />
                  </View>
                  <TouchableOpacity onPress={saveVo2Manual} style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{lang === 'en' ? 'Save' : 'Speichern'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  <View style={{ backgroundColor: cardAlt, borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: '#818CF8' }}>
                    <Text style={{ color: textMuted, fontSize: 12, lineHeight: 18 }}>
                      {lang === 'en' ? '💡 Run as far as possible in 12 minutes, then enter the distance covered.' : '💡 Laufe 12 Minuten lang so weit wie möglich und trage die zurückgelegte Distanz ein.'}
                    </Text>
                  </View>
                  <View>
                    <Text style={labelStyle}>{lang === 'en' ? 'Distance in 12 min (meters)' : 'Distanz in 12 Min. (Meter)'}</Text>
                    <TextInput
                      style={inputStyle}
                      value={cooperInput} onChangeText={setCooperInput} placeholder={lang === 'en' ? 'e.g. 2400' : 'z. B. 2400'} placeholderTextColor={textDim} keyboardType="numeric"
                    />
                    {!!cooperInput && !isNaN(parseFloat(cooperInput)) && (
                      <Text style={{ color: colors.accent, fontSize: 13, marginTop: 8, fontWeight: '700' }}>
                        VO2max ≈ {Math.max(0, cooperVo2max(parseFloat(cooperInput)))} ml/kg/min
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={saveVo2Cooper} style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{lang === 'en' ? 'Save' : 'Speichern'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
