// app/(tabs)/health.tsx
// Health Screen — Theme-aware, Line Chart statt Sparkline-Balken, Daten-Sync-Fix

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform,
  ScrollView,
  Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useLanguage } from '../../constants/LanguageContext';
import { useAppTheme } from '../../constants/ThemeContext';
import { fetchAndImportHealthData, getLastHealthSync, getStressHistory, isHealthKitAvailable } from '../../utils/applehealth';

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const HEALTH_KEY = 'stride_health_history';
const SLEEP_KEY  = 'lastSleep';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayHealth {
  date:          string;
  hrv:           number | null;
  restingHR:     number | null;
  sleepHours:    number;
  sleepQuality:  number;
  recoveryScore: number;
  bodyweight:    number | null;
  notes:         string;
}

function todayKey(): string { return new Date().toISOString().slice(0, 10); }

// ─── Calculations ─────────────────────────────────────────────────────────────
function calcRecovery(d: DayHealth, avgHRV: number | null): number {
  let score = 0; let w = 0;
  if (d.hrv !== null) {
    const base = avgHRV ?? 55;
    score += Math.min(100, Math.max(0, (d.hrv / base) * 80)) * 0.40; w += 0.40;
  }
  if (d.restingHR !== null) {
    score += Math.min(100, Math.max(0, ((80 - d.restingHR) / 30) * 100)) * 0.25; w += 0.25;
  }
  const hp = Math.min(100, (d.sleepHours / 8) * 100);
  const qp = ((d.sleepQuality - 1) / 4) * 100;
  score += (hp * 0.6 + qp * 0.4) * 0.35; w += 0.35;
  return w > 0 ? Math.round(score / w) : 0;
}

function recColor(s: number, colors: any): string {
  if (s >= 75) return '#4ADE80';
  if (s >= 50) return '#818CF8';
  if (s >= 30) return '#FBBF24';
  return '#F87171';
}
function recLabel(s: number, lang: string): string {
  if (lang === 'en') {
    if (s >= 80) return 'Optimal';
    if (s >= 65) return 'Well rested';
    if (s >= 50) return 'Moderate';
    if (s >= 35) return 'Limited';
    return 'Not recovered';
  }
  if (s >= 80) return 'Optimal';
  if (s >= 65) return 'Gut erholt';
  if (s >= 50) return 'Moderat';
  if (s >= 35) return 'Eingeschränkt';
  return 'Nicht erholt';
}
function recAdvice(s: number, lang: string): string {
  if (lang === 'en') {
    if (s >= 80) return 'Intense training & competition possible today.';
    if (s >= 65) return 'Normal training recommended.';
    if (s >= 50) return 'Moderate training. No PR attempts.';
    if (s >= 35) return 'Light workout or active recovery.';
    return 'Rest Day — Recovery is the priority.';
  }
  if (s >= 80) return 'Intensives Training & Wettkampf heute möglich.';
  if (s >= 65) return 'Normales Training empfohlen.';
  if (s >= 50) return 'Moderates Training. Keine PR-Versuche.';
  if (s >= 35) return 'Leichte Einheit oder aktive Erholung.';
  return 'Rest Day — Regeneration hat Priorität.';
}
function hrvZone(v: number, lang: string) {
  if (lang === 'en') {
    if (v >= 80) return { label: 'Very good', color: '#4ADE80' };
    if (v >= 60) return { label: 'Normal',    color: '#818CF8' };
    if (v >= 40) return { label: 'Low',       color: '#FBBF24' };
    return             { label: 'Critical',  color: '#F87171' };
  }
  if (v >= 80) return { label: 'Sehr gut',   color: '#4ADE80' };
  if (v >= 60) return { label: 'Normal',     color: '#818CF8' };
  if (v >= 40) return { label: 'Niedrig',    color: '#FBBF24' };
  return             { label: 'Kritisch',   color: '#F87171' };
}
function stressColor(s: number): string {
  if (s <= 25) return '#4ADE80';
  if (s <= 50) return '#818CF8';
  if (s <= 75) return '#FBBF24';
  return '#F87171';
}
function stressLabel(s: number, lang: string): string {
  if (lang === 'en') {
    if (s <= 25) return 'Low';
    if (s <= 50) return 'Moderate';
    if (s <= 75) return 'Elevated';
    return 'High';
  }
  if (s <= 25) return 'Niedrig';
  if (s <= 50) return 'Moderat';
  if (s <= 75) return 'Erhöht';
  return 'Hoch';
}
function hrZone(v: number, lang: string) {
  if (lang === 'en') {
    if (v <= 45) return { label: 'Athletic',  color: '#4ADE80' };
    if (v <= 55) return { label: 'Very good', color: '#818CF8' };
    if (v <= 65) return { label: 'Normal',    color: '#FBBF24' };
    return             { label: 'Elevated',  color: '#F87171' };
  }
  if (v <= 45) return { label: 'Athletisch', color: '#4ADE80' };
  if (v <= 55) return { label: 'Sehr gut',   color: '#818CF8' };
  if (v <= 65) return { label: 'Normal',     color: '#FBBF24' };
  return             { label: 'Erhöht',     color: '#F87171' };
}

// ─── Animated Ring ────────────────────────────────────────────────────────────
const AnimCircle = Animated.createAnimatedComponent(Circle);
function Ring({ value, size, stroke, color, trackColor, children }: {
  value: number; size: number; stroke: number; color: string; trackColor: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.min(value,100)/100, duration: 1200, useNativeDriver: false }).start();
  }, [value]);
  const dash = anim.interpolate({ inputRange:[0,1], outputRange:[circ,0] });
  return (
    <View style={{ width:size, height:size, alignItems:'center', justifyContent:'center' }}>
      <Svg width={size} height={size} style={{ position:'absolute', transform:[{rotate:'-90deg'}] }}>
        <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <AnimCircle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash} />
      </Svg>
      {children}
    </View>
  );
}

// ─── Line Chart (replaces Sparkline bars) ────────────────────────────────────
function LineChart({ data, color, minVal, maxVal, isDark }: {
  data: (number | null)[];
  color: string;
  minVal: number;
  maxVal: number;
  isDark: boolean;
}) {
  const W = 320;
  const H = 60;
  const PAD = 8;

  const points = data.map((v, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2),
    y: v !== null ? H - PAD - ((v - minVal) / (maxVal - minVal || 1)) * (H - PAD * 2) : null,
    v,
  }));

  // Build polyline string from non-null points
  const validPoints = points.filter(p => p.y !== null);
  const polyStr = validPoints.map(p => `${p.x.toFixed(1)},${p.y!.toFixed(1)}`).join(' ');

  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={{ height: H + 8 }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <Line key={f} x1={PAD} y1={H * f} x2={W - PAD} y2={H * f}
            stroke={gridColor} strokeWidth={1} strokeDasharray="4 4" />
        ))}
        {/* Line */}
        {validPoints.length > 1 && (
          <Polyline points={polyStr} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Dots */}
        {points.map((p, i) => p.y !== null ? (
          <Circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 5 : 3}
            fill={i === points.length - 1 ? color : isDark ? '#1C1917' : '#fff'}
            stroke={color} strokeWidth={2} />
        ) : null)}
      </Svg>
    </View>
  );
}

// ─── Input Modal ──────────────────────────────────────────────────────────────
const InputModal: React.FC<{
  visible: boolean; data: DayHealth; isDark: boolean; colors: any;
  onSave: (d: DayHealth) => void; onClose: () => void;
}> = ({ visible, data, isDark, colors, onSave, onClose }) => {
  const { t, lang } = useLanguage();
  const [local, setLocal] = useState<DayHealth>(data);
  const [tab, setTab]     = useState<'hrv'|'sleep'|'body'>('hrv');

  const bg      = isDark ? '#1C1917' : colors.bg;
  const card    = isDark ? '#242120' : colors.card;
  const cardAlt = isDark ? '#2E2B29' : colors.cardSecondary;
  const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const text    = isDark ? '#F5F0EE' : '#1A1209';
  const textMuted = isDark ? 'rgba(245,240,238,0.5)' : 'rgba(26,18,9,0.5)';
  const textDim   = isDark ? 'rgba(245,240,238,0.25)' : 'rgba(26,18,9,0.25)';

  useEffect(() => { if (visible) { setLocal(data); setTab('hrv'); } }, [visible, data]);
  const set = <K extends keyof DayHealth>(k: K, v: DayHealth[K]) => setLocal(p => ({ ...p, [k]: v }));

  const inputStyle = {
    backgroundColor: cardAlt, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: text, fontSize: 16, borderWidth: 1, borderColor: border,
  };
  const labelStyle = {
    color: textMuted, fontSize: 11, fontWeight: '700' as const, letterSpacing: 1,
    textTransform: 'uppercase' as const, marginBottom: 8,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor: card, borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, paddingBottom:48, maxHeight:'90%' }}>

            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <Text style={{ fontSize:22, fontWeight:'800', color:text }}>{lang === 'en' ? 'Log Values' : 'Werte erfassen'}</Text>
              <TouchableOpacity onPress={onClose} style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:20, backgroundColor:cardAlt }}>
                <Text style={{ color:textMuted, fontSize:13, fontWeight:'600' }}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={{ flexDirection:'row', gap:6, marginBottom:24, backgroundColor:cardAlt, borderRadius:16, padding:4 }}>
              {(['hrv','sleep','body'] as const).map(tabKey => (
                <TouchableOpacity key={tabKey} onPress={() => setTab(tabKey)}
                  style={{ flex:1, paddingVertical:9, borderRadius:12, alignItems:'center',
                    backgroundColor: tab===tabKey ? colors.accent : 'transparent' }}>
                  <Text style={{ fontSize:12, fontWeight:'700', color: tab===tabKey ? '#fff' : textMuted }}>
                    {tabKey==='hrv' ? '❤️ HRV' : tabKey==='sleep' ? (lang === 'en' ? '🌙 Sleep' : '🌙 Schlaf') : (lang === 'en' ? '⚖️ Body' : '⚖️ Körper')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {tab==='hrv' && (
                <View style={{ gap:16 }}>
                  <View style={{ backgroundColor:cardAlt, borderRadius:14, padding:14, borderLeftWidth:3, borderLeftColor:'#818CF8' }}>
                    <Text style={{ color:textMuted, fontSize:12, lineHeight:18 }}>
                      {lang === 'en' ? '💡 Measure in the morning: right after waking up, while lying down. Read value from Garmin Connect.' : '💡 Morgens messen: direkt nach dem Aufwachen, liegend. Wert aus Garmin Connect ablesen.'}
                    </Text>
                  </View>
                  <View>
                    <Text style={labelStyle}>HRV (RMSSD, ms)</Text>
                    <TextInput style={inputStyle} value={local.hrv?.toString()??''} onChangeText={v=>set('hrv',v?Number(v):null)} placeholder="z. B. 58" placeholderTextColor={textDim} keyboardType="numeric" />
                    {local.hrv!==null && <Text style={{ color:hrvZone(local.hrv, lang).color, fontSize:13, marginTop:6, fontWeight:'600' }}>{hrvZone(local.hrv, lang).label} · {local.hrv} ms</Text>}
                  </View>
                  <View>
                    <Text style={labelStyle}>{lang === 'en' ? 'Resting Pulse (bpm)' : 'Ruhepuls (bpm)'}</Text>
                    <TextInput style={inputStyle} value={local.restingHR?.toString()??''} onChangeText={v=>set('restingHR',v?Number(v):null)} placeholder="z. B. 52" placeholderTextColor={textDim} keyboardType="numeric" />
                    {local.restingHR!==null && <Text style={{ color:hrZone(local.restingHR, lang).color, fontSize:13, marginTop:6, fontWeight:'600' }}>{hrZone(local.restingHR, lang).label} · {local.restingHR} bpm</Text>}
                  </View>
                  <View>
                    <Text style={labelStyle}>{lang === 'en' ? 'Notes (optional)' : 'Notizen (optional)'}</Text>
                    <TextInput style={[inputStyle,{minHeight:70,textAlignVertical:'top'}]} value={local.notes} onChangeText={v=>set('notes',v)} placeholder={lang === 'en' ? 'Sick, travel, stress…' : 'Krank, Reise, Stress…'} placeholderTextColor={textDim} multiline />
                  </View>
                </View>
              )}

              {tab==='sleep' && (
                <View style={{ gap:16 }}>
                  <View>
                    <Text style={labelStyle}>{lang === 'en' ? 'Sleep Duration (hours)' : 'Schlafdauer (Stunden)'}</Text>
                    <TextInput style={inputStyle} value={local.sleepHours?.toString()??''} onChangeText={v=>set('sleepHours',parseFloat(v)||0)} placeholder="z. B. 7.5" placeholderTextColor={textDim} keyboardType="decimal-pad" />
                  </View>
                  <View>
                    <Text style={labelStyle}>{lang === 'en' ? 'Sleep Quality' : 'Schlafqualität'}</Text>
                    <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
                      {[1,2,3,4,5].map(q => (
                        <TouchableOpacity key={q} onPress={()=>set('sleepQuality',q)}
                          style={{ flex:1, paddingVertical:12, borderRadius:14, alignItems:'center',
                            backgroundColor: local.sleepQuality===q ? colors.accent+'30' : cardAlt,
                            borderWidth:1, borderColor: local.sleepQuality===q ? colors.accent : border }}>
                          <Text style={{ fontSize:22 }}>{['😣','😕','😐','🙂','😄'][q-1]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={{ color:textMuted, fontSize:12, textAlign:'center', marginTop:8 }}>
                      {(lang === 'en' ? ['Very bad','Bad','Okay','Good','Very good'] : ['Sehr schlecht','Schlecht','Okay','Gut','Sehr gut'])[local.sleepQuality-1]}
                    </Text>
                  </View>
                </View>
              )}

              {tab==='body' && (
                <View style={{ gap:16 }}>
                  <View>
                    <Text style={labelStyle}>{lang === 'en' ? 'Bodyweight (kg)' : 'Körpergewicht (kg)'}</Text>
                    <TextInput style={inputStyle} value={local.bodyweight?.toString()??''} onChangeText={v=>set('bodyweight',v?parseFloat(v):null)} placeholder="z. B. 65.4" placeholderTextColor={textDim} keyboardType="decimal-pad" />
                    {local.bodyweight!==null && (
                      <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:10, backgroundColor:cardAlt, borderRadius:12, padding:12 }}>
                        <Text style={{ color:textMuted, fontSize:13 }}>{lang === 'en' ? 'Competition weight -66 kg' : 'Wettkampfgewicht -66 kg'}</Text>
                        <Text style={{ color:local.bodyweight<=66?'#4ADE80':local.bodyweight<=68?'#FBBF24':'#F87171', fontSize:13, fontWeight:'700' }}>
                          {local.bodyweight<=66?(lang === 'en' ? '✅ In range' : '✅ Im Limit'):`+${(local.bodyweight-66).toFixed(1)} kg`}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ backgroundColor:cardAlt, borderRadius:14, padding:14, borderLeftWidth:3, borderLeftColor:'#FB923C' }}>
                    <Text style={{ color:textMuted, fontSize:12, lineHeight:18 }}>{lang === 'en' ? '💡 Measure daily in the morning on an empty stomach — before breakfast.' : '💡 Täglich morgens nüchtern messen — vor dem Frühstück.'}</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity onPress={()=>{onSave(local);onClose();}}
                style={{ backgroundColor:colors.accent, borderRadius:16, paddingVertical:16, alignItems:'center', marginTop:24 }}>
                <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>{t('save')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HealthScreen() {
  const { colors } = useAppTheme();
  const { t, lang } = useLanguage();
  const today = todayKey();
  const [history,   setHistory]   = useState<DayHealth[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [todayData, setTodayData] = useState<DayHealth | null>(null);
  const [loaded,    setLoaded]    = useState(false);
  const [lastSync,  setLastSync]  = useState<string | null>(null);
  const [syncing,   setSyncing]   = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  // Detect dark/light theme
  const isDark = colors.bg.startsWith('#0') || colors.bg.startsWith('#1') || colors.bg.startsWith('#2') || colors.bg === '#383838';
  const bg       = isDark ? '#0F0E0D' : colors.bg;
  const card     = isDark ? '#1C1917' : colors.card;
  const cardAlt  = isDark ? '#242120' : colors.cardSecondary;
  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const text     = isDark ? '#F5F0EE' : '#1A1209';
  const textMuted = isDark ? 'rgba(245,240,238,0.45)' : 'rgba(26,18,9,0.45)';
  const textDim   = isDark ? 'rgba(245,240,238,0.22)' : 'rgba(26,18,9,0.22)';

  const load = useCallback(async () => {
    try {
      const [rawHistory, rawSleep] = await Promise.all([
        AsyncStorage.getItem(HEALTH_KEY),
        AsyncStorage.getItem(SLEEP_KEY),
      ]);

      let hist: DayHealth[] = rawHistory ? JSON.parse(rawHistory) : [];

      if (rawSleep) {
        const sl = JSON.parse(rawSleep);
        const slDate = sl.date ? new Date(sl.date).toISOString().slice(0,10) : today;
        const existing = hist.find(h => h.date === slDate);
        if (existing) {
          if (!existing.sleepHours && sl.schlafStunden) {
            const updated = { ...existing, sleepHours: sl.schlafStunden };
            hist = hist.map(h => h.date === slDate ? updated : h);
            await AsyncStorage.setItem(HEALTH_KEY, JSON.stringify(hist));
          }
        } else if (sl.schlafStunden && slDate === today) {
          const newEntry: DayHealth = {
            date: today, hrv: sl.hrv||null, restingHR: sl.tiefsterPuls||null,
            sleepHours: sl.schlafStunden, sleepQuality: 3, recoveryScore: 0,
            bodyweight: null, notes: '',
          };
          const hrvVals = hist.filter(x=>x.hrv!==null).map(x=>x.hrv as number);
          const avg = hrvVals.length ? hrvVals.reduce((a,b)=>a+b)/hrvVals.length : null;
          newEntry.recoveryScore = calcRecovery(newEntry, avg);
          hist = [newEntry, ...hist];
          await AsyncStorage.setItem(HEALTH_KEY, JSON.stringify(hist));
        }
      }

      setHistory(hist);
      setTodayData(hist.find(h => h.date === today) ?? null);
      setLastSync(await getLastHealthSync());
    } catch {}
    setLoaded(true);
  }, [today]);

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
    fade.setValue(0);
    Animated.timing(fade, { toValue:1, duration:400, useNativeDriver:true }).start();
  }, [load]));

  const saveDay = async (d: DayHealth) => {
    const hrvVals = history.filter(x=>x.hrv!==null).map(x=>x.hrv as number);
    const avg = hrvVals.length ? hrvVals.reduce((a,b)=>a+b)/hrvVals.length : null;
    const updated = { ...d, date:today, recoveryScore:calcRecovery(d,avg) };
    const newHist = history.some(x=>x.date===today)
      ? history.map(x=>x.date===today?updated:x)
      : [updated,...history];
    setHistory(newHist);
    setTodayData(updated);
    await AsyncStorage.setItem(HEALTH_KEY, JSON.stringify(newHist));
  };

  const empty: DayHealth = { date:today, hrv:null, restingHR:null, sleepHours:0, sleepQuality:3, recoveryScore:0, bodyweight:null, notes:'' };
  const last14 = [...history].sort((a,b)=>a.date.localeCompare(b.date)).slice(-14);
  const avgHRV7 = (() => { const v=last14.slice(-7).map(d=>d.hrv).filter(Boolean) as number[]; return v.length?Math.round(v.reduce((a,b)=>a+b)/v.length):null; })();
  const avgHR7  = (() => { const v=last14.slice(-7).map(d=>d.restingHR).filter(Boolean) as number[]; return v.length?Math.round(v.reduce((a,b)=>a+b)/v.length):null; })();
  const last14Stress = getStressHistory(history).slice(-14);
  const todayStress = last14Stress.length ? last14Stress[last14Stress.length - 1].stress : null;
  const recovery = todayData?.recoveryScore ?? 0;
  const rc = recColor(recovery, colors);
  const dateLabel = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', { weekday:'long', day:'numeric', month:'long' });

  // Card style helper
  const cardStyle = { backgroundColor:card, borderRadius:20, padding:20, borderWidth:1, borderColor:border, marginBottom:12 };

  if (!loaded) return (
    <View style={{ flex:1, backgroundColor:bg, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ color:textMuted }}>{t('loading')}</Text>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:bg }}>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ paddingHorizontal:16, paddingTop:60, paddingBottom:100 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity:fade }}>

          {/* Header */}
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
            <View>
              <Text style={{ color:textDim, fontSize:11, fontWeight:'700', letterSpacing:2, textTransform:'uppercase' }}>{dateLabel}</Text>
              <Text style={{ color:text, fontSize:30, fontWeight:'800', marginTop:6, letterSpacing:-0.8 }}>{lang === 'en' ? 'Health' : 'Gesundheit'}</Text>
            </View>
            <TouchableOpacity onPress={()=>setShowModal(true)}
              style={{ width:44, height:44, borderRadius:22, backgroundColor:colors.accent, alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:'#fff', fontSize:24, lineHeight:26, marginTop:-1 }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Recovery Score */}
          <View style={cardStyle}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:20 }}>
              <Ring value={recovery} size={100} stroke={7} color={rc} trackColor={border}>
                <View style={{ alignItems:'center' }}>
                  <Text style={{ fontSize:26, fontWeight:'800', color:text, letterSpacing:-1 }}>{todayData?recovery:'—'}</Text>
                  <Text style={{ fontSize:8, color:textDim, fontWeight:'700', letterSpacing:1, textTransform:'uppercase' }}>Score</Text>
                </View>
              </Ring>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:10, fontWeight:'700', letterSpacing:2, textTransform:'uppercase', color:textDim, marginBottom:8 }}>{lang === 'en' ? 'Recovery Score' : 'Erholungs-Score'}</Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 }}>
                  <View style={{ width:8, height:8, borderRadius:4, backgroundColor:rc }} />
                  <Text style={{ fontSize:16, fontWeight:'700', color:rc }}>{todayData?recLabel(recovery, lang):(lang === 'en' ? 'Not logged yet' : 'Noch nicht erfasst')}</Text>
                </View>
                <Text style={{ fontSize:12, color:textMuted, lineHeight:18 }}>
                  {todayData?recAdvice(recovery, lang):(lang === 'en' ? 'Tap + to log today\'s values.' : 'Tippe + um heutige Werte einzutragen.')}
                </Text>
              </View>
            </View>

            {todayData && (
              <View style={{ flexDirection:'row', marginTop:18, paddingTop:16, borderTopWidth:1, borderTopColor:border }}>
                {[
                  { label:'HRV ms', value:todayData.hrv??'—', color:todayData.hrv?hrvZone(todayData.hrv).color:textDim },
                  { label:lang === 'en' ? 'Resting HR' : 'Ruhepuls', value:todayData.restingHR?`${todayData.restingHR}`:'—', color:todayData.restingHR?hrZone(todayData.restingHR, lang).color:textDim },
                  { label:lang === 'en' ? 'Sleep' : 'Schlaf', value:todayData.sleepHours>0?`${todayData.sleepHours}h`:'—', color:'#818CF8' },
                ].map((s,i) => (
                  <React.Fragment key={s.label}>
                    {i>0 && <View style={{ width:1, backgroundColor:border }} />}
                    <View style={{ flex:1, alignItems:'center' }}>
                      <Text style={{ fontSize:18, fontWeight:'800', color:s.color }}>{s.value}</Text>
                      <Text style={{ fontSize:9, color:textDim, textTransform:'uppercase', letterSpacing:1, marginTop:3, fontWeight:'600' }}>{s.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
                {todayData.bodyweight && (
                  <>
                    <View style={{ width:1, backgroundColor:border }} />
                    <View style={{ flex:1, alignItems:'center' }}>
                      <Text style={{ fontSize:18, fontWeight:'800', color:todayData.bodyweight<=66?'#4ADE80':'#FBBF24' }}>{todayData.bodyweight}</Text>
                      <Text style={{ fontSize:9, color:textDim, textTransform:'uppercase', letterSpacing:1, marginTop:3, fontWeight:'600' }}>kg</Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Empty state */}
          {!todayData && (
            <TouchableOpacity onPress={()=>setShowModal(true)} style={[cardStyle,{ alignItems:'center', paddingVertical:32, borderStyle:'dashed' }]}>
              <Text style={{ fontSize:36, marginBottom:12 }}>🩺</Text>
              <Text style={{ color:text, fontSize:17, fontWeight:'700', marginBottom:6 }}>{lang === 'en' ? 'Log today\'s values' : 'Heutige Werte erfassen'}</Text>
              <Text style={{ color:textMuted, fontSize:13 }}>{lang === 'en' ? 'HRV · Resting HR · Sleep · Weight' : 'HRV · Ruhepuls · Schlaf · Gewicht'}</Text>
            </TouchableOpacity>
          )}

          {/* Stress Score */}
          {last14Stress.length > 0 && (
            <View style={cardStyle}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:20, marginBottom:16 }}>
                <Ring value={todayStress ?? 0} size={100} stroke={7} color={todayStress!==null?stressColor(todayStress):textDim} trackColor={border}>
                  <View style={{ alignItems:'center' }}>
                    <Text style={{ fontSize:26, fontWeight:'800', color:text, letterSpacing:-1 }}>{todayStress ?? '—'}</Text>
                    <Text style={{ fontSize:8, color:textDim, fontWeight:'700', letterSpacing:1, textTransform:'uppercase' }}>Score</Text>
                  </View>
                </Ring>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:10, fontWeight:'700', letterSpacing:2, textTransform:'uppercase', color:textDim, marginBottom:8 }}>{lang === 'en' ? 'Stress Score' : 'Stress-Score'}</Text>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 }}>
                    <View style={{ width:8, height:8, borderRadius:4, backgroundColor: todayStress!==null?stressColor(todayStress):textDim }} />
                    <Text style={{ fontSize:16, fontWeight:'700', color: todayStress!==null?stressColor(todayStress):textDim }}>
                      {todayStress!==null ? stressLabel(todayStress, lang) : (lang === 'en' ? 'Not enough data' : 'Nicht genug Daten')}
                    </Text>
                  </View>
                  <Text style={{ fontSize:12, color:textMuted, lineHeight:18 }}>
                    {lang === 'en' ? 'Based on HRV and resting HR vs. your 7-day baseline.' : 'Basierend auf HRV und Ruhepuls im Vergleich zum 7-Tage-Schnitt.'}
                  </Text>
                </View>
              </View>
              <LineChart
                data={last14Stress.map(d=>d.stress)}
                color="#FBBF24"
                minVal={0}
                maxVal={100}
                isDark={isDark}
              />
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:4 }}>
                <Text style={{ color:textDim, fontSize:10 }}>{last14[0]?.date.slice(5) ?? ''}</Text>
                <Text style={{ color:textDim, fontSize:10 }}>{t('today')}</Text>
              </View>
            </View>
          )}

          {/* HRV Chart */}
          {last14.length > 0 && (
            <View style={cardStyle}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <View>
                  <Text style={{ color:text, fontSize:16, fontWeight:'700' }}>{lang === 'en' ? 'HRV History' : 'HRV-Verlauf'}</Text>
                  <Text style={{ color:textMuted, fontSize:12, marginTop:4 }}>
                    {lang === 'en' ? '7-Day Avg' : '7-Tage-Ø'}: {avgHRV7?`${avgHRV7} ms`:'—'}
                    {todayData?.hrv ? `  ·  ${t('today')}: ${todayData.hrv} ms` : ''}
                  </Text>
                </View>
                {todayData?.hrv && (
                  <View style={{ backgroundColor:hrvZone(todayData.hrv, lang).color+'20', paddingHorizontal:12, paddingVertical:6, borderRadius:20 }}>
                    <Text style={{ color:hrvZone(todayData.hrv, lang).color, fontWeight:'700', fontSize:12 }}>{hrvZone(todayData.hrv, lang).label}</Text>
                  </View>
                )}
              </View>
              <LineChart
                data={last14.map(d=>d.hrv)}
                color="#4ADE80"
                minVal={30}
                maxVal={100}
                isDark={isDark}
              />
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:4, marginBottom:14 }}>
                <Text style={{ color:textDim, fontSize:10 }}>{last14[0]?.date.slice(5) ?? ''}</Text>
                <Text style={{ color:textDim, fontSize:10 }}>{t('today')}</Text>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-around', paddingTop:12, borderTopWidth:1, borderTopColor:border }}>
                {(lang === 'en'
                  ? [{r:'< 40',l:'Critical',c:'#F87171'},{r:'40–59',l:'Low',c:'#FBBF24'},{r:'60–79',l:'Normal',c:'#818CF8'},{r:'≥ 80',l:'Very good',c:'#4ADE80'}]
                  : [{r:'< 40',l:'Kritisch',c:'#F87171'},{r:'40–59',l:'Niedrig',c:'#FBBF24'},{r:'60–79',l:'Normal',c:'#818CF8'},{r:'≥ 80',l:'Sehr gut',c:'#4ADE80'}]
                ).map(x=>(
                  <View key={x.r} style={{ alignItems:'center', gap:2 }}>
                    <Text style={{ color:x.c, fontSize:11, fontWeight:'800' }}>{x.r}</Text>
                    <Text style={{ color:textDim, fontSize:10 }}>{x.l}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Ruhepuls Chart */}
          {last14.length > 0 && (
            <View style={cardStyle}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <View>
                  <Text style={{ color:text, fontSize:16, fontWeight:'700' }}>{t('health_pulse')}</Text>
                  <Text style={{ color:textMuted, fontSize:12, marginTop:4 }}>
                    {lang === 'en' ? '7-Day Avg' : '7-Tage-Ø'}: {avgHR7?`${avgHR7} bpm`:'—'}
                    {todayData?.restingHR ? `  ·  ${t('today')}: ${todayData.restingHR} bpm` : ''}
                  </Text>
                </View>
                {todayData?.restingHR && (
                  <View style={{ backgroundColor:hrZone(todayData.restingHR, lang).color+'20', paddingHorizontal:12, paddingVertical:6, borderRadius:20 }}>
                    <Text style={{ color:hrZone(todayData.restingHR, lang).color, fontWeight:'700', fontSize:12 }}>{hrZone(todayData.restingHR, lang).label}</Text>
                  </View>
                )}
              </View>
              <LineChart
                data={last14.map(d=>d.restingHR)}
                color="#F87171"
                minVal={35}
                maxVal={80}
                isDark={isDark}
              />
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:4, marginBottom:14 }}>
                <Text style={{ color:textDim, fontSize:10 }}>{last14[0]?.date.slice(5) ?? ''}</Text>
                <Text style={{ color:textDim, fontSize:10 }}>{t('today')}</Text>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-around', paddingTop:12, borderTopWidth:1, borderTopColor:border }}>
                {(lang === 'en'
                  ? [{r:'≤ 45',l:'Athletic',c:'#4ADE80'},{r:'46–55',l:'Very good',c:'#818CF8'},{r:'56–65',l:'Normal',c:'#FBBF24'},{r:'> 65',l:'Elevated',c:'#F87171'}]
                  : [{r:'≤ 45',l:'Athletisch',c:'#4ADE80'},{r:'46–55',l:'Sehr gut',c:'#818CF8'},{r:'56–65',l:'Normal',c:'#FBBF24'},{r:'> 65',l:'Erhöht',c:'#F87171'}]
                ).map(x=>(
                  <View key={x.r} style={{ alignItems:'center', gap:2 }}>
                    <Text style={{ color:x.c, fontSize:11, fontWeight:'800' }}>{x.r}</Text>
                    <Text style={{ color:textDim, fontSize:10 }}>{x.l}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Erholungs-Verlauf Chart */}
          {last14.length > 0 && (
            <View style={cardStyle}>
              <Text style={{ color:text, fontSize:16, fontWeight:'700', marginBottom:6 }}>{lang === 'en' ? 'Recovery History' : 'Erholungs-Verlauf'}</Text>
              <Text style={{ color:textMuted, fontSize:12, marginBottom:16 }}>
                {lang === 'en' ? 'Combined from HRV, resting HR, and sleep' : 'Kombiniert aus HRV, Ruhepuls und Schlaf'}
              </Text>
              <LineChart
                data={last14.map(d=>d.recoveryScore)}
                color={colors.accent}
                minVal={0}
                maxVal={100}
                isDark={isDark}
              />
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:4 }}>
                <Text style={{ color:textDim, fontSize:10 }}>{last14[0]?.date.slice(5) ?? ''}</Text>
                <Text style={{ color:textDim, fontSize:10 }}>{t('today')}</Text>
              </View>
            </View>
          )}

          {/* Letzte Einträge */}
          {last14.length > 0 && (
            <View style={cardStyle}>
              <Text style={{ color:text, fontSize:16, fontWeight:'700', marginBottom:16 }}>{lang === 'en' ? 'Recent Entries' : 'Letzte Einträge'}</Text>
              {[...last14].reverse().slice(0,7).map((d,i,arr) => (
                <View key={d.date} style={{ flexDirection:'row', alignItems:'center', paddingVertical:10,
                  borderBottomWidth:i<arr.length-1?1:0, borderBottomColor:border }}>
                  <Text style={{ color:textMuted, fontSize:12, width:50 }}>{d.date.slice(5)}</Text>
                  <View style={{ flex:1, flexDirection:'row', gap:10, flexWrap:'wrap' }}>
                    {d.hrv!==null && <Text style={{ fontSize:12, color:hrvZone(d.hrv).color, fontWeight:'600' }}>HRV {d.hrv}</Text>}
                    {d.restingHR!==null && <Text style={{ fontSize:12, color:hrZone(d.restingHR).color, fontWeight:'600' }}>{d.restingHR} bpm</Text>}
                    {d.sleepHours>0 && <Text style={{ fontSize:12, color:'#818CF8', fontWeight:'600' }}>{d.sleepHours}h</Text>}
                    {d.bodyweight && <Text style={{ fontSize:12, color:textMuted, fontWeight:'600' }}>{d.bodyweight} kg</Text>}
                  </View>
                  <View style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:20, backgroundColor:recColor(d.recoveryScore,colors)+'20' }}>
                    <Text style={{ color:recColor(d.recoveryScore,colors), fontSize:12, fontWeight:'800' }}>{d.recoveryScore}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Apple Health Card */}
          <View style={[cardStyle,{ alignItems:'center', paddingVertical:28, borderColor:colors.accent+'30' }]}>
            <Text style={{ fontSize:32, marginBottom:12 }}>🍎</Text>
            <Text style={{ color:text, fontSize:16, fontWeight:'700', marginBottom:6 }}>Apple Health</Text>
            <Text style={{ color:textMuted, fontSize:13, textAlign:'center', lineHeight:20, marginBottom:14 }}>
              {isHealthKitAvailable()
                ? (lang === 'en' ? 'Resting HR, HRV, VO2max and sleep are synced from Apple Health.' : 'Ruhepuls, HRV, VO2max und Schlaf werden aus Apple Health synchronisiert.')
                : (lang === 'en' ? 'Apple Health sync requires the iOS app build with HealthKit enabled.' : 'Apple Health Sync erfordert den iOS-Build mit aktiviertem HealthKit.')}
            </Text>
            <TouchableOpacity onPress={syncAppleHealth} disabled={syncing || !isHealthKitAvailable()}
              style={{ backgroundColor:colors.accent+'18', paddingHorizontal:16, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:colors.accent+'40', opacity: !isHealthKitAvailable() ? 0.5 : 1 }}>
              <Text style={{ color:colors.accent, fontSize:12, fontWeight:'700' }}>
                {syncing
                  ? (lang === 'en' ? 'Syncing…' : 'Synchronisiere…')
                  : lastSync
                    ? `${lang === 'en' ? 'Last sync' : 'Letzter Sync'}: ${new Date(lastSync).toLocaleTimeString(lang === 'en' ? 'en-US' : 'de-DE', { hour:'2-digit', minute:'2-digit' })}`
                    : (lang === 'en' ? 'Sync now' : 'Jetzt synchronisieren')}
              </Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      <InputModal visible={showModal} data={todayData??empty} isDark={isDark} colors={colors} onSave={saveDay} onClose={()=>setShowModal(false)} />
    </View>
  );
}