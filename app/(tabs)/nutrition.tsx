import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated, KeyboardAvoidingView,
    Modal, Platform, ScrollView, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';
import { theme } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────
type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber?: number; };
type Micros = { salt?: number; sugar?: number; saturatedFat?: number; fiber?: number; };
type FoodEntry = {
  id: string; time: string; label: string; amount: number; unit: string;
  macros: Macros; micros?: Micros; source: 'barcode' | 'ai' | 'manual';
};
type DayLog = { date: string; entries: FoodEntry[]; goal: Macros; };

// ─── Constants ────────────────────────────────────────────────
const DEFAULT_GOAL: Macros = { kcal: 2500, protein: 160, carbs: 280, fat: 80 };
const OPEN_FOOD_FACTS = 'https://world.openfoodfacts.org/api/v0/product';
const GEMINI_API_KEY = 'AIzaSyCLGmhg7YDEh2K8ndgJdDWiDrndc84-UvU'; // neuen Key von aistudio.google.com eintragen
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function sumMacros(entries: FoodEntry[]): Macros {
  return entries.reduce((sum, e) => ({
    kcal: sum.kcal + e.macros.kcal,
    protein: sum.protein + e.macros.protein,
    carbs: sum.carbs + e.macros.carbs,
    fat: sum.fat + e.macros.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

// ─── Macro Ring ───────────────────────────────────────────────
function MacroRing({ value, goal, color, label, unit = 'g' }: {
  value: number; goal: number; color: string; label: string; unit?: string;
}) {
  const pct = Math.min(1, goal > 0 ? value / goal : 0);
  const size = 72; const stroke = 6; const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={theme.cardSecondary} strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        </svg>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '700' }}>{Math.round(value)}</Text>
          <Text style={{ color: theme.textTertiary, fontSize: 8 }}>{unit}</Text>
        </View>
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Text>
      <Text style={{ color: theme.textTertiary, fontSize: 9 }}>/ {goal}{unit}</Text>
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────
function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(1, goal > 0 ? value / goal : 0);
  const over = value > goal;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: over ? theme.red : theme.textPrimary, fontSize: 12, fontWeight: '600' }}>
          {Math.round(value)} / {goal}g {over ? '⚠️' : ''}
        </Text>
      </View>
      <View style={{ height: 6, backgroundColor: theme.cardSecondary, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${pct * 100}%` as any, backgroundColor: over ? theme.red : color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

// ─── Barcode Scanner ──────────────────────────────────────────
function BarcodeScanner({ onResult, onClose }: {
  onResult: (food: Partial<FoodEntry>) => void; onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleBarcode({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    setLoading(true);
    try {
      const res = await fetch(`${OPEN_FOOD_FACTS}/${data}.json`);
      const json = await res.json();
      if (json.status !== 1 || !json.product) {
        Alert.alert('Produkt nicht gefunden', 'Versuche es manuell einzugeben.', [
          { text: 'OK', onPress: () => { setScanned(false); setLoading(false); } }
        ]);
        return;
      }
      const p = json.product;
      const n = p.nutriments || {};
      const per100 = (key: string) => parseFloat(n[`${key}_100g`] || n[key] || '0');
      onResult({
        label: p.product_name || p.abbreviated_product_name || 'Unbekannt',
        macros: {
          kcal: per100('energy-kcal'),
          protein: per100('proteins'),
          carbs: per100('carbohydrates'),
          fat: per100('fat'),
        },
        micros: {
          fiber: per100('fiber'),
          sugar: per100('sugars'),
          salt: per100('salt'),
          saturatedFat: per100('saturated-fat'),
        },
        unit: 'g',
        source: 'barcode',
      });
    } catch {
      Alert.alert('Fehler', 'Netzwerkfehler – prüfe deine Verbindung.', [
        { text: 'OK', onPress: () => { setScanned(false); setLoading(false); } }
      ]);
    }
    setLoading(false);
  }

  if (!permission) return <View style={styles.scannerContainer}><ActivityIndicator color={theme.blue} /></View>;
  if (!permission.granted) return (
    <View style={styles.scannerContainer}>
      <Text style={{ color: theme.textSecondary, textAlign: 'center', marginBottom: 16 }}>Kamera-Zugriff benötigt</Text>
      <TouchableOpacity style={styles.saveBtn} onPress={requestPermission}>
        <Text style={styles.saveBtnText}>Erlauben</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
        <Text style={styles.cancelBtnText}>Abbrechen</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.scannerContainer}>
      <CameraView style={styles.camera} facing="back" onBarcodeScanned={scanned ? undefined : handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['ean8', 'ean13', 'upc_a', 'upc_e', 'qr'] }}>
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Barcode in den Rahmen halten</Text>
        </View>
      </CameraView>
      {loading && (
        <View style={styles.scanLoading}>
          <ActivityIndicator size="large" color={theme.blue} />
          <Text style={{ color: '#fff', marginTop: 8 }}>Produkt wird geladen...</Text>
        </View>
      )}
      <TouchableOpacity style={styles.scanCloseBtn} onPress={onClose}>
        <Text style={styles.scanCloseBtnText}>× Schliessen</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── AI Photo Analysis ────────────────────────────────────────
async function analyzeWithAI(base64Image: string): Promise<Partial<FoodEntry> | null> {
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
            { text: `Analysiere diese Mahlzeit und schätze die Makronährstoffe. Antworte NUR mit einem JSON-Objekt, keine Backticks, kein Text davor oder danach: {"label":"Name","amount":300,"unit":"g","kcal":450,"protein":35,"carbs":40,"fat":12}` }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
      })
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      label: parsed.label || 'KI-Analyse',
      amount: parsed.amount || 100,
      unit: parsed.unit || 'g',
      macros: {
        kcal: parsed.kcal || 0,
        protein: parsed.protein || 0,
        carbs: parsed.carbs || 0,
        fat: parsed.fat || 0,
      },
      source: 'ai',
    };
  } catch { return null; }
}

// ─── Add Entry Modal ──────────────────────────────────────────
function AddEntryModal({ prefill, onSave, onClose }: {
  prefill?: Partial<FoodEntry>; onSave: (entry: FoodEntry) => void; onClose: () => void;
}) {
  const [label, setLabel] = useState(prefill?.label || '');
  const [amount, setAmount] = useState(String(prefill?.amount || '100'));
  const [kcal, setKcal] = useState(String(prefill?.macros?.kcal || ''));
  const [protein, setProtein] = useState(String(prefill?.macros?.protein || ''));
  const [carbs, setCarbs] = useState(String(prefill?.macros?.carbs || ''));
  const [fat, setFat] = useState(String(prefill?.macros?.fat || ''));
  const baseAmount = prefill?.amount || 100;

  // Scale macros when amount changes
  function scale(base: number): number {
    const a = parseFloat(amount) || 100;
    return Math.round((base / baseAmount) * a * 10) / 10;
  }

  function save() {
    if (!label.trim()) { Alert.alert('Name fehlt'); return; }
    const amt = parseFloat(amount) || 100;
    // If prefill exists, scale; otherwise use entered values
    const entry: FoodEntry = {
      id: Date.now().toString(),
      time: getTimeStr(),
      label: label.trim(),
      amount: amt,
      unit: prefill?.unit || 'g',
      source: prefill?.source || 'manual',
      macros: {
        kcal: prefill ? scale(prefill.macros?.kcal || 0) : parseFloat(kcal) || 0,
        protein: prefill ? scale(prefill.macros?.protein || 0) : parseFloat(protein) || 0,
        carbs: prefill ? scale(prefill.macros?.carbs || 0) : parseFloat(carbs) || 0,
        fat: prefill ? scale(prefill.macros?.fat || 0) : parseFloat(fat) || 0,
      },
      micros: prefill?.micros,
    };
    onSave(entry);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <ScrollView style={styles.addModal} contentContainerStyle={{ padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.modalTitle}>
          {prefill?.source === 'barcode' ? '🔍 Barcode' : prefill?.source === 'ai' ? '🤖 KI-Analyse' : '✏️ Manuell'} – {prefill?.label || 'Eintrag'}
        </Text>

        <Text style={styles.inputLabel}>Name</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="z.B. Haferflocken" placeholderTextColor={theme.textTertiary} />

        <Text style={styles.inputLabel}>Menge ({prefill?.unit || 'g'})</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="100" placeholderTextColor={theme.textTertiary} />

        {prefill ? (
          // Show scaled preview
          <View style={[styles.previewCard, { backgroundColor: theme.blueLight }]}>
            <Text style={{ color: theme.blue, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: '600' }}>
              Nährstoffe für {amount || 100}{prefill.unit || 'g'}
            </Text>
            <View style={styles.macroPreviewRow}>
              {[
                { l: 'kcal', v: scale(prefill.macros?.kcal || 0), c: theme.orange, u: '' },
                { l: 'Protein', v: scale(prefill.macros?.protein || 0), c: theme.blue, u: 'g' },
                { l: 'Kohlenhydrate', v: scale(prefill.macros?.carbs || 0), c: theme.green, u: 'g' },
                { l: 'Fett', v: scale(prefill.macros?.fat || 0), c: theme.pink, u: 'g' },
              ].map(m => (
                <View key={m.l} style={{ alignItems: 'center' }}>
                  <Text style={{ color: m.c, fontSize: 18, fontWeight: '700' }}>{m.v}{m.u}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase' }}>{m.l}</Text>
                </View>
              ))}
            </View>
            {prefill.source === 'ai' && (
              <Text style={{ color: theme.blue, fontSize: 10, marginTop: 8, opacity: 0.7 }}>
                ⚠️ KI-Schätzung – Werte können ±20% abweichen
              </Text>
            )}
          </View>
        ) : (
          // Manual input
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>kcal</Text>
                <TextInput style={styles.input} value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Protein (g)</Text>
                <TextInput style={styles.input} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Kohlenhydrate (g)</Text>
                <TextInput style={styles.input} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Fett (g)</Text>
                <TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} />
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>Hinzufügen ✓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Abbrechen</Text>
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Goals Modal ──────────────────────────────────────────────
function GoalsModal({ goals, onSave, onClose }: {
  goals: Macros; onSave: (g: Macros) => void; onClose: () => void;
}) {
  const [kcal, setKcal] = useState(String(goals.kcal));
  const [protein, setProtein] = useState(String(goals.protein));
  const [carbs, setCarbs] = useState(String(goals.carbs));
  const [fat, setFat] = useState(String(goals.fat));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={styles.addModal}>
        <View style={{ padding: 24, gap: 12 }}>
          <Text style={styles.modalTitle}>Tagesziele</Text>
          {[
            { l: 'Kalorien (kcal)', v: kcal, s: setKcal },
            { l: 'Protein (g)', v: protein, s: setProtein },
            { l: 'Kohlenhydrate (g)', v: carbs, s: setCarbs },
            { l: 'Fett (g)', v: fat, s: setFat },
          ].map(f => (
            <View key={f.l}>
              <Text style={styles.inputLabel}>{f.l}</Text>
              <TextInput style={styles.input} value={f.v} onChangeText={f.s} keyboardType="numeric" placeholderTextColor={theme.textTertiary} />
            </View>
          ))}
          <TouchableOpacity style={styles.saveBtn} onPress={() => onSave({ kcal: parseFloat(kcal)||2500, protein: parseFloat(protein)||160, carbs: parseFloat(carbs)||280, fat: parseFloat(fat)||80 })}>
            <Text style={styles.saveBtnText}>Speichern</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function NutritionScreen() {
  const [dayLog, setDayLog] = useState<DayLog>({ date: getTodayKey(), entries: [], goal: DEFAULT_GOAL });
  const [showScanner, setShowScanner] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [prefillEntry, setPrefillEntry] = useState<Partial<FoodEntry> | undefined>();
  const [aiLoading, setAiLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    loadDay();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []));

  async function loadDay() {
    const key = getTodayKey();
    const raw = await AsyncStorage.getItem(`nutrition_${key}`);
    const rawGoal = await AsyncStorage.getItem('nutritionGoal');
    const goal = rawGoal ? JSON.parse(rawGoal) : DEFAULT_GOAL;

    // Try to get goal from profile
    const rawProfile = await AsyncStorage.getItem('profile');
    if (rawProfile) {
      const profile = JSON.parse(rawProfile);
      const bw = parseFloat(profile.weight || '70');
      if (profile.goal === 'Masse aufbauen') {
        goal.protein = Math.round(bw * 2.2);
        goal.kcal = Math.round(bw * 40);
      } else if (profile.goal === 'Fett verlieren') {
        goal.protein = Math.round(bw * 2.0);
        goal.kcal = Math.round(bw * 28);
      }
    }

    if (raw) setDayLog({ ...JSON.parse(raw), goal });
    else setDayLog({ date: key, entries: [], goal });
  }

  async function saveDay(entries: FoodEntry[]) {
    const updated = { ...dayLog, entries };
    setDayLog(updated);
    await AsyncStorage.setItem(`nutrition_${updated.date}`, JSON.stringify(updated));
  }

  async function addEntry(entry: FoodEntry) {
    await saveDay([...dayLog.entries, entry]);
    setPrefillEntry(undefined);
    setShowAddModal(false);
    setShowScanner(false);
  }

  async function deleteEntry(id: string) {
    Alert.alert('Eintrag löschen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => await saveDay(dayLog.entries.filter(e => e.id !== id)) }
    ]);
  }

  async function handleAIPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, quality: 0.7,
    });
    if (result.canceled || !result.assets[0].base64) return;
    setAiLoading(true);
    const food = await analyzeWithAI(result.assets[0].base64);
    setAiLoading(false);
    if (!food) { Alert.alert('Analyse fehlgeschlagen', 'Versuche ein klareres Bild.'); return; }
    setPrefillEntry(food);
    setShowAddModal(true);
  }

  async function handleAICamera() {
    const result = await ImagePicker.launchCameraAsync({
      base64: true, quality: 0.7,
    });
    if (result.canceled || !result.assets[0].base64) return;
    setAiLoading(true);
    const food = await analyzeWithAI(result.assets[0].base64);
    setAiLoading(false);
    if (!food) { Alert.alert('Analyse fehlgeschlagen', 'Versuche ein klareres Bild.'); return; }
    setPrefillEntry(food);
    setShowAddModal(true);
  }

  async function saveGoals(g: Macros) {
    await AsyncStorage.setItem('nutritionGoal', JSON.stringify(g));
    setDayLog(prev => ({ ...prev, goal: g }));
    setShowGoals(false);
  }

  const totals = sumMacros(dayLog.entries);
  const kcalLeft = dayLog.goal.kcal - totals.kcal;
  const kcalPct = Math.min(1, totals.kcal / dayLog.goal.kcal);

  const mealGroups = dayLog.entries.reduce((groups, entry) => {
    const hour = parseInt(entry.time.split(':')[0]);
    const meal = hour < 10 ? 'Frühstück' : hour < 14 ? 'Mittagessen' : hour < 18 ? 'Snack' : 'Abendessen';
    if (!groups[meal]) groups[meal] = [];
    groups[meal].push(entry);
    return groups;
  }, {} as Record<string, FoodEntry[]>);

  if (showScanner) return (
    <BarcodeScanner
      onResult={food => { setPrefillEntry(food); setShowScanner(false); setShowAddModal(true); }}
      onClose={() => setShowScanner(false)}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.headerLabel}>Ernährung</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <Text style={styles.title}>Heute</Text>
            <TouchableOpacity onPress={() => setShowGoals(true)} style={styles.goalBtn}>
              <Text style={styles.goalBtnText}>🎯 Ziele</Text>
            </TouchableOpacity>
          </View>

          {/* Kalorie Summary Card */}
          <View style={styles.kcalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.kcalVal}>{Math.round(totals.kcal)}</Text>
                <Text style={styles.kcalLabel}>kcal gegessen</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.kcalVal, { color: kcalLeft >= 0 ? theme.green : theme.red }]}>
                  {Math.abs(Math.round(kcalLeft))}
                </Text>
                <Text style={styles.kcalLabel}>{kcalLeft >= 0 ? 'kcal übrig' : 'kcal darüber'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.kcalVal}>{dayLog.goal.kcal}</Text>
                <Text style={styles.kcalLabel}>kcal Ziel</Text>
              </View>
            </View>
            <View style={{ height: 8, backgroundColor: theme.cardSecondary, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${kcalPct * 100}%` as any, backgroundColor: kcalPct > 1 ? theme.red : kcalPct > 0.85 ? theme.orange : theme.green, borderRadius: 4 }} />
            </View>
          </View>

          {/* Macro Bars */}
          <View style={styles.macroCard}>
            <MacroBar label="Protein" value={totals.protein} goal={dayLog.goal.protein} color={theme.blue} />
            <MacroBar label="Kohlenhydrate" value={totals.carbs} goal={dayLog.goal.carbs} color={theme.orange} />
            <MacroBar label="Fett" value={totals.fat} goal={dayLog.goal.fat} color={theme.pink} />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionGrid}>
            <TouchableOpacity style={[styles.actionBtn, { borderColor: theme.blue }]} onPress={() => setShowScanner(true)}>
              <Text style={styles.actionEmoji}>📷</Text>
              <Text style={[styles.actionLabel, { color: theme.blue }]}>Barcode</Text>
              <Text style={styles.actionSub}>Verpacktes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { borderColor: '#7C3AED' }]} onPress={handleAICamera} disabled={aiLoading}>
              {aiLoading ? <ActivityIndicator color="#7C3AED" /> : <Text style={styles.actionEmoji}>🤖</Text>}
              <Text style={[styles.actionLabel, { color: '#7C3AED' }]}>KI-Foto</Text>
              <Text style={styles.actionSub}>Mahlzeit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { borderColor: theme.green }]} onPress={handleAIPhoto} disabled={aiLoading}>
              <Text style={styles.actionEmoji}>🖼️</Text>
              <Text style={[styles.actionLabel, { color: theme.green }]}>Galerie</Text>
              <Text style={styles.actionSub}>KI-Analyse</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { borderColor: theme.orange }]} onPress={() => { setPrefillEntry(undefined); setShowAddModal(true); }}>
              <Text style={styles.actionEmoji}>✏️</Text>
              <Text style={[styles.actionLabel, { color: theme.orange }]}>Manuell</Text>
              <Text style={styles.actionSub}>Eingabe</Text>
            </TouchableOpacity>
          </View>

          {/* Meal Groups */}
          {Object.entries(mealGroups).map(([meal, entries]) => (
            <View key={meal} style={{ marginBottom: 16 }}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{meal}</Text>
                <Text style={styles.mealKcal}>{Math.round(sumMacros(entries).kcal)} kcal</Text>
              </View>
              {entries.map(entry => (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={[styles.sourceIcon, {
                    backgroundColor: entry.source === 'barcode' ? theme.blueLight : entry.source === 'ai' ? '#7C3AED20' : theme.orangeLight
                  }]}>
                    <Text style={{ fontSize: 12 }}>
                      {entry.source === 'barcode' ? '📷' : entry.source === 'ai' ? '🤖' : '✏️'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryLabel}>{entry.label}</Text>
                    <Text style={styles.entrySub}>{entry.amount}{entry.unit} · {entry.time}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={[styles.entryKcal, { color: theme.orange }]}>{Math.round(entry.macros.kcal)} kcal</Text>
                    <Text style={styles.entryMacros}>
                      P:{Math.round(entry.macros.protein)}g K:{Math.round(entry.macros.carbs)}g F:{Math.round(entry.macros.fat)}g
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteEntry(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: theme.textTertiary, fontSize: 20, marginLeft: 8 }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}

          {dayLog.entries.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>🥗</Text>
              <Text style={styles.emptyTitle}>Noch nichts geloggt</Text>
              <Text style={styles.emptySub}>Scanne einen Barcode, mache ein Foto oder gib manuell ein</Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      {/* Add Entry Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <AddEntryModal prefill={prefillEntry} onSave={addEntry} onClose={() => { setShowAddModal(false); setPrefillEntry(undefined); }} />
        </View>
      </Modal>

      {/* Goals Modal */}
      <Modal visible={showGoals} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <GoalsModal goals={dayLog.goal} onSave={saveGoals} onClose={() => setShowGoals(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600' },
  goalBtn: { backgroundColor: theme.blueLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  goalBtnText: { color: theme.blue, fontSize: 12, fontWeight: '600' },

  kcalCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 12, ...theme.shadow },
  kcalVal: { color: theme.textPrimary, fontSize: 24, fontWeight: '700' },
  kcalLabel: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },

  macroCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 16, ...theme.shadow },

  actionGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  actionBtn: { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, ...theme.shadow },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: 11, fontWeight: '600' },
  actionSub: { color: theme.textTertiary, fontSize: 9 },

  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mealTitle: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600' },
  mealKcal: { color: theme.textSecondary, fontSize: 11 },

  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.card, borderRadius: 12, padding: 12, marginBottom: 6, ...theme.shadow },
  sourceIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  entryLabel: { color: theme.textPrimary, fontSize: 13, fontWeight: '500' },
  entrySub: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
  entryKcal: { fontSize: 13, fontWeight: '600' },
  entryMacros: { color: theme.textTertiary, fontSize: 9 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySub: { color: theme.textSecondary, fontSize: 13, textAlign: 'center' },

  // Scanner
  scannerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  camera: { flex: 1, width: '100%' },
  scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  scanFrame: { width: 250, height: 150, borderWidth: 2, borderColor: '#fff', borderRadius: 12, backgroundColor: 'transparent' },
  scanHint: { color: '#fff', fontSize: 14, fontWeight: '500' },
  scanLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  scanCloseBtn: { position: 'absolute', top: 60, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  scanCloseBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Modals
  addModal: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  inputLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 14, color: theme.textPrimary, fontSize: 15 },
  previewCard: { borderRadius: 14, padding: 14 },
  macroPreviewRow: { flexDirection: 'row', justifyContent: 'space-around' },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: theme.textSecondary, fontSize: 14 },
});