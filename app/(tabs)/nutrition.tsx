import { GEMINI_API_KEY, USDA_API_KEY } from '@/constants/keys';
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

type Macros = { kcal: number; protein: number; carbs: number; fat: number; };
type Micros = {
  fiber?: number; sugar?: number; salt?: number; saturatedFat?: number;
  vitaminA?: number; vitaminC?: number; vitaminD?: number; vitaminB12?: number;
  calcium?: number; iron?: number; magnesium?: number; zinc?: number; potassium?: number;
};
type FoodEntry = {
  id: string; time: string; label: string; amount: number; unit: string;
  macros: Macros; micros?: Micros; source: 'barcode' | 'ai' | 'manual';
};
type DayLog = { date: string; entries: FoodEntry[]; goal: Macros; };

const DEFAULT_GOAL: Macros = { kcal: 2500, protein: 160, carbs: 280, fat: 80 };
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ─── USDA Nutrient Lookup ─────────────────────────────────────
// Nutrient IDs: https://fdc.nal.usda.gov/fdc-app.html
const USDA_NUTRIENT_IDS: Record<string, number> = {
  vitaminA: 1106, vitaminC: 1162, vitaminD: 1114, vitaminB12: 1178,
  vitaminB6: 1175, vitaminE: 1109, folate: 1177,
  calcium: 1087, iron: 1089, magnesium: 1090, zinc: 1095,
  potassium: 1092, sodium: 1093, phosphorus: 1091,
  fiber: 1079, sugar: 2000, saturatedFat: 1258,
};

async function lookupUSDAMicros(productName: string): Promise<Partial<Micros>> {
  try {
    // Search for the food
    const searchRes = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(productName)}&dataType=Foundation,SR%20Legacy&pageSize=1&api_key=${USDA_API_KEY}`
    );
    if (!searchRes.ok) return {};
    const searchData = await searchRes.json();
    const food = searchData.foods?.[0];
    if (!food) return {};

    // Extract nutrients
    const micros: Partial<Micros> = {};
    const nutrients: any[] = food.foodNutrients || [];

    for (const [key, id] of Object.entries(USDA_NUTRIENT_IDS)) {
      const nutrient = nutrients.find((n: any) => n.nutrientId === id);
      if (nutrient?.value > 0) {
        (micros as any)[key] = Math.round(nutrient.value * 10) / 10;
      }
    }
    return micros;
  } catch {
    return {};
  }
}

async function estimateMicrosFromIngredients(
  productName: string,
  ingredients: string,
  macros: { kcal: number; protein: number; carbs: number; fat: number }
): Promise<Partial<Micros>> {
  try {
    const ingredientsText = ingredients ? `Zutaten: ${ingredients.substring(0, 500)}` : '';
    const prompt = `Produkt: ${productName}
${ingredientsText}
Makros pro 100g: ${macros.kcal}kcal, ${macros.protein}g Protein, ${macros.carbs}g KH, ${macros.fat}g Fett

Schätze die Mikronährstoffe pro 100g für dieses typische Lebensmittel. Antworte NUR mit diesem JSON ohne Backticks oder Text:
{"vitaminA":0,"vitaminC":0,"vitaminD":0,"vitaminB12":0,"calcium":0,"iron":0,"magnesium":0,"zinc":0,"potassium":0}`;

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
      })
    });
    const data = await res.json();
    console.log('Gemini raw:', JSON.stringify(data).substring(0, 200));
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const p = JSON.parse(clean);
    const result: Partial<Micros> = {};
    for (const [k, val] of Object.entries(p)) {
      if (typeof val === 'number' && val > 0) (result as any)[k] = val;
    }
    return result;
  } catch (e) {
    console.log('Gemini micros error:', String(e));
    return {};
  }
}

function sumMacros(entries: FoodEntry[]): Macros {
  return entries.reduce((s, e) => ({
    kcal: s.kcal + e.macros.kcal,
    protein: s.protein + e.macros.protein,
    carbs: s.carbs + e.macros.carbs,
    fat: s.fat + e.macros.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function sumMicros(entries: FoodEntry[]): Micros {
  const total: Micros = {};
  entries.forEach(e => {
    if (!e.micros) return;
    (Object.keys(e.micros) as (keyof Micros)[]).forEach(key => {
      const val = e.micros![key];
      if (val !== undefined) total[key] = (total[key] || 0) + val;
    });
  });
  return total;
}
function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(1, goal > 0 ? value / goal : 0);
  const over = value > goal;
  const display = `${Math.round(value)} / ${goal}g`;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: over ? theme.red : theme.textPrimary, fontSize: 12, fontWeight: '600' }}>{display}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: theme.cardSecondary, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${pct * 100}%` as any, backgroundColor: over ? theme.red : color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

// ─── Micro Chip ───────────────────────────────────────────────
function MicroChip({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const display = `${value}${unit}`;
  return (
    <View style={{ backgroundColor: theme.cardSecondary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{display}</Text>
      <Text style={{ color: theme.textTertiary, fontSize: 9, textAlign: 'center' }}>{label}</Text>
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

  const scannedRef = useRef(false);

  async function handleBarcode({ data }: { data: string }) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanned(true);
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${data}?fields=product_name,nutriments,brands,ingredients_text`,
        { headers: { 'User-Agent': 'StrideApp/1.0' }, signal: controller.signal }
      );
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status !== 1 || !json.product) {
        Alert.alert('Produkt nicht gefunden', 'Manuell eingeben.', [
          { text: 'OK', onPress: () => { scannedRef.current = false; setScanned(false); setLoading(false); } }
        ]);
        return;
      }
      const p = json.product;
      const n = p.nutriments || {};
      const v = (key: string) => {
        const val = n[`${key}_100g`] ?? n[`${key}_value`] ?? n[key];
        return val !== undefined ? Math.round(parseFloat(String(val)) * 10) / 10 : 0;
      };
      const kcal = v('energy-kcal') || Math.round(v('energy') / 4.184);
      const name = [p.brands, p.product_name, p.product_name_de, p.product_name_en].filter(Boolean).join(' – ') || 'Unbekannt';
      console.log('Product name:', name, '| Ingredients:', p.ingredients_text?.substring(0, 100));

      let micros: Micros = {
        fiber: v('fiber') || undefined, sugar: v('sugars') || undefined,
        salt: v('salt') || undefined, saturatedFat: v('saturated-fat') || undefined,
        calcium: v('calcium') || undefined, iron: v('iron') || undefined,
        magnesium: v('magnesium') || undefined, zinc: v('zinc') || undefined,
        potassium: v('potassium') || undefined, vitaminC: v('vitamin-c') || undefined,
        vitaminD: v('vitamin-d') || undefined, vitaminA: v('vitamin-a') || undefined,
        vitaminB12: v('vitamin-b12') || undefined,
      };

      // Always try USDA for the brand name
      const usdaMicros = await lookupUSDAMicros(p.brands || name);
      console.log('USDA micros:', JSON.stringify(usdaMicros));
      micros = { ...usdaMicros, ...micros };

      // If still no vitamins/minerals, use Gemini to estimate from name + macros
      const stillNoMicros = !micros.vitaminC && !micros.calcium && !micros.iron;
      if (stillNoMicros) {
        const searchTerm = p.ingredients_text || '';
        const geminiMicros = await estimateMicrosFromIngredients(
          name, searchTerm,
          { kcal, protein: v('proteins'), carbs: v('carbohydrates'), fat: v('fat') }
        );
        console.log('Gemini micros:', JSON.stringify(geminiMicros));
        micros = { ...geminiMicros, ...micros };
      }

      onResult({
        label: name, unit: 'g', source: 'barcode',
        macros: { kcal, protein: v('proteins'), carbs: v('carbohydrates'), fat: v('fat') },
        micros,
      });
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'Zeitüberschreitung – prüfe deine Verbindung.' : 'Netzwerkfehler – prüfe deine Verbindung.';
      Alert.alert('Fehler', msg, [
        { text: 'OK', onPress: () => { scannedRef.current = false; setScanned(false); setLoading(false); } }
      ]);
    }
    setLoading(false);
  }

  if (!permission) return <View style={s.center}><ActivityIndicator color={theme.blue} /></View>;
  if (!permission.granted) return (
    <View style={s.center}>
      <Text style={{ color: theme.textSecondary, marginBottom: 16, textAlign: 'center' }}>Kamera-Zugriff benötigt</Text>
      <TouchableOpacity style={s.btn} onPress={requestPermission}><Text style={s.btnText}>Erlauben</Text></TouchableOpacity>
      <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelText}>Abbrechen</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={{ flex: 1 }} facing="back" onBarcodeScanned={scanned ? undefined : handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['ean8', 'ean13', 'upc_a', 'upc_e'] }} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 250, height: 150, borderWidth: 2, borderColor: '#fff', borderRadius: 12 }} />
        <Text style={{ color: '#fff', fontSize: 14, marginTop: 16, fontWeight: '500' }}>Barcode in den Rahmen halten</Text>
      </View>
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.blue} />
          <Text style={{ color: '#fff', marginTop: 8 }}>Produkt wird geladen...</Text>
        </View>
      )}
      <TouchableOpacity
        style={{ position: 'absolute', top: 60, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}
        onPress={onClose}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Schliessen</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── AI Analysis ──────────────────────────────────────────────
async function analyzeWithAI(base64Image: string): Promise<Partial<FoodEntry> | null> {
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
            { text: 'Analysiere diese Mahlzeit. Antworte NUR mit einem JSON-Objekt ohne Backticks: {"label":"Name","amount":300,"unit":"g","kcal":450,"protein":35,"carbs":40,"fat":12,"fiber":4,"sugar":8,"salt":1.2,"saturatedFat":3,"vitaminC":15,"vitaminD":2,"calcium":80,"iron":2.5,"magnesium":35,"zinc":2,"potassium":400}' }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 400 }
      })
    });
    const data = await res.json();
    console.log('Gemini:', JSON.stringify(data).substring(0, 200));
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const p = JSON.parse(clean);
    return {
      label: p.label || 'KI-Analyse', amount: p.amount || 100, unit: p.unit || 'g', source: 'ai',
      macros: { kcal: p.kcal || 0, protein: p.protein || 0, carbs: p.carbs || 0, fat: p.fat || 0 },
      micros: {
        fiber: p.fiber || undefined, sugar: p.sugar || undefined, salt: p.salt || undefined,
        saturatedFat: p.saturatedFat || undefined, vitaminC: p.vitaminC || undefined,
        vitaminD: p.vitaminD || undefined, calcium: p.calcium || undefined,
        iron: p.iron || undefined, magnesium: p.magnesium || undefined,
        zinc: p.zinc || undefined, potassium: p.potassium || undefined,
      },
    };
  } catch (e) {
    console.log('AI error:', String(e));
    return null;
  }
}

// ─── Micros Display ───────────────────────────────────────────
function MicrosDisplay({ micros, source }: { micros?: Micros; source?: string }) {
  if (!micros) return null;
  const basis = [
    { l: 'Ballaststoffe', v: micros.fiber, u: 'g', c: theme.green },
    { l: 'Zucker', v: micros.sugar, u: 'g', c: theme.orange },
    { l: 'Salz', v: micros.salt, u: 'g', c: theme.red },
    { l: 'Ges. Fett', v: micros.saturatedFat, u: 'g', c: theme.pink },
  ].filter(m => m.v !== undefined && m.v > 0);

  const vitamine = [
    { l: 'Vit.A', v: micros.vitaminA, u: 'μg', c: theme.purple },
    { l: 'Vit.C', v: micros.vitaminC, u: 'mg', c: theme.purple },
    { l: 'Vit.D', v: micros.vitaminD, u: 'μg', c: theme.purple },
    { l: 'B12', v: micros.vitaminB12, u: 'μg', c: theme.purple },
  ].filter(m => m.v !== undefined && m.v > 0);

  const mineralien = [
    { l: 'Calcium', v: micros.calcium, u: 'mg', c: theme.orange },
    { l: 'Eisen', v: micros.iron, u: 'mg', c: theme.orange },
    { l: 'Magnesium', v: micros.magnesium, u: 'mg', c: theme.orange },
    { l: 'Zink', v: micros.zinc, u: 'mg', c: theme.orange },
    { l: 'Kalium', v: micros.potassium, u: 'mg', c: theme.orange },
  ].filter(m => m.v !== undefined && m.v > 0);

  if (basis.length === 0 && vitamine.length === 0 && mineralien.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      {basis.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {basis.map(m => <MicroChip key={m.l} label={m.l} value={m.v!} unit={m.u} color={m.c} />)}
        </View>
      )}
      {vitamine.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: theme.textTertiary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Vitamine</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {vitamine.map(m => <MicroChip key={m.l} label={m.l} value={m.v!} unit={m.u} color={m.c} />)}
          </View>
        </View>
      )}
      {mineralien.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: theme.textTertiary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Mineralien</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {mineralien.map(m => <MicroChip key={m.l} label={m.l} value={m.v!} unit={m.u} color={m.c} />)}
          </View>
        </View>
      )}
      {source === 'ai' && (
        <Text style={{ color: theme.textTertiary, fontSize: 10 }}>KI-Schätzung – Werte können abweichen</Text>
      )}
    </View>
  );
}

// ─── Add Entry Modal ──────────────────────────────────────────
function AddEntryModal({ prefill, onSave, onClose }: {
  prefill?: Partial<FoodEntry>; onSave: (e: FoodEntry) => void; onClose: () => void;
}) {
  const [label, setLabel] = useState(prefill?.label || '');
  const [amount, setAmount] = useState(String(prefill?.amount || 100));
  const [kcal, setKcal] = useState(String(Math.round(prefill?.macros?.kcal || 0) || ''));
  const [protein, setProtein] = useState(String(prefill?.macros?.protein || ''));
  const [carbs, setCarbs] = useState(String(prefill?.macros?.carbs || ''));
  const [fat, setFat] = useState(String(prefill?.macros?.fat || ''));
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [salt, setSalt] = useState('');
  const [vitC, setVitC] = useState('');
  const [calcium, setCalcium] = useState('');
  const [iron, setIron] = useState('');
  const [magnesium, setMagnesium] = useState('');
  const [showMicros, setShowMicros] = useState(false);
  const base = prefill?.amount || 100;

  function scale(v: number) {
    const a = parseFloat(amount) || 100;
    return Math.round((v / base) * a * 10) / 10;
  }

  function save() {
    if (!label.trim()) { Alert.alert('Name fehlt'); return; }
    const amt = parseFloat(amount) || 100;
    const entry: FoodEntry = {
      id: Date.now().toString(), time: getTimeStr(),
      label: label.trim(), amount: amt, unit: prefill?.unit || 'g',
      source: prefill?.source || 'manual',
      macros: prefill ? {
        kcal: scale(prefill.macros?.kcal || 0),
        protein: scale(prefill.macros?.protein || 0),
        carbs: scale(prefill.macros?.carbs || 0),
        fat: scale(prefill.macros?.fat || 0),
      } : {
        kcal: parseFloat(kcal) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
      },
      micros: prefill?.micros || (fiber || sugar || salt || vitC || calcium ? {
        fiber: parseFloat(fiber) || undefined,
        sugar: parseFloat(sugar) || undefined,
        salt: parseFloat(salt) || undefined,
        vitaminC: parseFloat(vitC) || undefined,
        calcium: parseFloat(calcium) || undefined,
        iron: parseFloat(iron) || undefined,
        magnesium: parseFloat(magnesium) || undefined,
      } : undefined),
    };
    onSave(entry);
  }

  const srcLabel = prefill?.source === 'barcode' ? '📷 Barcode' : prefill?.source === 'ai' ? '🤖 KI-Analyse' : '✏️ Manuell';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <ScrollView style={s.modal} contentContainerStyle={{ padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={s.modalTitle}>{srcLabel}</Text>

        <Text style={s.label}>Name</Text>
        <TextInput style={s.input} value={label} onChangeText={setLabel} placeholder="z.B. Haferflocken" placeholderTextColor={theme.textTertiary} />

        <Text style={s.label}>{`Menge (${prefill?.unit || 'g'})`}</Text>
        <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="100" placeholderTextColor={theme.textTertiary} />

        {prefill ? (
          <View style={{ backgroundColor: theme.blueLight, borderRadius: 14, padding: 14, gap: 10 }}>
            <Text style={{ color: theme.blue, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>
              {`Nährstoffe für ${amount || 100}${prefill.unit || 'g'}`}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {[
                { l: 'kcal', v: scale(prefill.macros?.kcal || 0), c: theme.orange },
                { l: 'Protein', v: scale(prefill.macros?.protein || 0), c: theme.blue },
                { l: 'Kohlenhydrate', v: scale(prefill.macros?.carbs || 0), c: theme.green },
                { l: 'Fett', v: scale(prefill.macros?.fat || 0), c: theme.pink },
              ].map(m => (
                <View key={m.l} style={{ alignItems: 'center' }}>
                  <Text style={{ color: m.c, fontSize: 18, fontWeight: '700' }}>{String(m.v)}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase' }}>{m.l}</Text>
                </View>
              ))}
            </View>
            <MicrosDisplay micros={prefill.micros} source={prefill.source} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>kcal</Text>
                <TextInput style={s.input} value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Protein (g)</Text>
                <TextInput style={s.input} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Kohlenhydrate (g)</Text>
                <TextInput style={s.input} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Fett (g)</Text>
                <TextInput style={s.input} value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} />
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowMicros(v => !v)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: theme.blue, fontSize: 13, fontWeight: '500' }}>
                {showMicros ? 'Micros ausblenden ▲' : 'Micros hinzufügen ▼'}
              </Text>
            </TouchableOpacity>
            {showMicros && (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Text style={s.label}>Ballaststoffe (g)</Text><TextInput style={s.input} value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} /></View>
                  <View style={{ flex: 1 }}><Text style={s.label}>Zucker (g)</Text><TextInput style={s.input} value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Text style={s.label}>Salz (g)</Text><TextInput style={s.input} value={salt} onChangeText={setSalt} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} /></View>
                  <View style={{ flex: 1 }}><Text style={s.label}>Vit. C (mg)</Text><TextInput style={s.input} value={vitC} onChangeText={setVitC} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Text style={s.label}>Calcium (mg)</Text><TextInput style={s.input} value={calcium} onChangeText={setCalcium} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} /></View>
                  <View style={{ flex: 1 }}><Text style={s.label}>Eisen (mg)</Text><TextInput style={s.input} value={iron} onChangeText={setIron} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} /></View>
                </View>
                <View style={{ flex: 1 }}><Text style={s.label}>Magnesium (mg)</Text><TextInput style={s.input} value={magnesium} onChangeText={setMagnesium} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} /></View>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={s.btn} onPress={save}><Text style={s.btnText}>Hinzufügen</Text></TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelText}>Abbrechen</Text></TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Goals Modal ──────────────────────────────────────────────
function GoalsModal({ goals, onSave, onClose }: { goals: Macros; onSave: (g: Macros) => void; onClose: () => void; }) {
  const [kcal, setKcal] = useState(String(goals.kcal));
  const [protein, setProtein] = useState(String(goals.protein));
  const [carbs, setCarbs] = useState(String(goals.carbs));
  const [fat, setFat] = useState(String(goals.fat));
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={s.modal}>
        <View style={{ padding: 24, gap: 12 }}>
          <Text style={s.modalTitle}>Tagesziele</Text>
          {[
            { l: 'Kalorien (kcal)', v: kcal, set: setKcal },
            { l: 'Protein (g)', v: protein, set: setProtein },
            { l: 'Kohlenhydrate (g)', v: carbs, set: setCarbs },
            { l: 'Fett (g)', v: fat, set: setFat },
          ].map(f => (
            <View key={f.l}>
              <Text style={s.label}>{f.l}</Text>
              <TextInput style={s.input} value={f.v} onChangeText={f.set} keyboardType="numeric" placeholderTextColor={theme.textTertiary} />
            </View>
          ))}
          <TouchableOpacity style={s.btn} onPress={() => onSave({ kcal: parseFloat(kcal)||2500, protein: parseFloat(protein)||160, carbs: parseFloat(carbs)||280, fat: parseFloat(fat)||80 })}>
            <Text style={s.btnText}>Speichern</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelText}>Abbrechen</Text></TouchableOpacity>
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
  const [prefill, setPrefill] = useState<Partial<FoodEntry> | undefined>();
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    load();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []));

  async function load() {
    const key = getTodayKey();
    const raw = await AsyncStorage.getItem(`nutrition_${key}`);
    const rawGoal = await AsyncStorage.getItem('nutritionGoal');
    let goal = rawGoal ? JSON.parse(rawGoal) : DEFAULT_GOAL;
    const rawProfile = await AsyncStorage.getItem('profile');
    if (rawProfile) {
      const prof = JSON.parse(rawProfile);
      const bw = parseFloat(prof.weight || '70');
      if (prof.goal === 'Masse aufbauen') { goal.protein = Math.round(bw * 2.2); goal.kcal = Math.round(bw * 40); }
      else if (prof.goal === 'Fett verlieren') { goal.protein = Math.round(bw * 2.0); goal.kcal = Math.round(bw * 28); }
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
    setPrefill(undefined); setShowAddModal(false); setShowScanner(false);
  }

  async function deleteEntry(id: string) {
    Alert.alert('Löschen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => await saveDay(dayLog.entries.filter(e => e.id !== id)) }
    ]);
  }

  async function handlePhoto(fromCamera: boolean) {
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0].base64) return;
    setAiLoading(true);
    const food = await analyzeWithAI(result.assets[0].base64);
    setAiLoading(false);
    if (!food) { Alert.alert('Analyse fehlgeschlagen', 'Versuche ein klareres Bild oder gib manuell ein.'); return; }
    setPrefill(food); setShowAddModal(true);
  }

  async function saveGoals(g: Macros) {
    await AsyncStorage.setItem('nutritionGoal', JSON.stringify(g));
    setDayLog(prev => ({ ...prev, goal: g }));
    setShowGoals(false);
  }

  const totals = sumMacros(dayLog.entries);
  const microTotals = sumMicros(dayLog.entries);
  const kcalLeft = dayLog.goal.kcal - totals.kcal;
  const kcalPct = Math.min(1, totals.kcal / dayLog.goal.kcal);

  const mealGroups: Record<string, FoodEntry[]> = {};
  dayLog.entries.forEach(entry => {
    const hour = parseInt(entry.time.split(':')[0]);
    const meal = hour < 10 ? 'Frühstück' : hour < 14 ? 'Mittagessen' : hour < 18 ? 'Snack' : 'Abendessen';
    if (!mealGroups[meal]) mealGroups[meal] = [];
    mealGroups[meal].push(entry);
  });

  if (showScanner) return (
    <BarcodeScanner
      onResult={food => { setPrefill(food); setShowScanner(false); setShowAddModal(true); }}
      onClose={() => setShowScanner(false)}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.headerLabel}>Ernährung</Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <Text style={s.title}>Heute</Text>
            <TouchableOpacity onPress={() => setShowGoals(true)} style={{ backgroundColor: theme.blueLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: theme.blue, fontSize: 12, fontWeight: '600' }}>Ziele</Text>
            </TouchableOpacity>
          </View>

          {/* Kalorie Card */}
          <View style={{ backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 12, ...theme.shadow }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <View>
                <Text style={{ color: theme.textPrimary, fontSize: 24, fontWeight: '700' }}>{String(Math.round(totals.kcal))}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase' }}>kcal gegessen</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: kcalLeft >= 0 ? theme.green : theme.red, fontSize: 24, fontWeight: '700' }}>{String(Math.abs(Math.round(kcalLeft)))}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase' }}>{kcalLeft >= 0 ? 'kcal übrig' : 'kcal drüber'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: theme.textPrimary, fontSize: 24, fontWeight: '700' }}>{String(dayLog.goal.kcal)}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase' }}>kcal Ziel</Text>
              </View>
            </View>
            <View style={{ height: 8, backgroundColor: theme.cardSecondary, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${kcalPct * 100}%` as any, backgroundColor: kcalPct > 1 ? theme.red : kcalPct > 0.85 ? theme.orange : theme.green, borderRadius: 4 }} />
            </View>
          </View>

          {/* Macro Bars */}
          <View style={{ backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 16, ...theme.shadow }}>
            <MacroBar label="Protein" value={totals.protein} goal={dayLog.goal.protein} color={theme.blue} />
            <MacroBar label="Kohlenhydrate" value={totals.carbs} goal={dayLog.goal.carbs} color={theme.orange} />
            <MacroBar label="Fett" value={totals.fat} goal={dayLog.goal.fat} color={theme.pink} />
          </View>

          {/* Micros Table */}
          {Object.values(microTotals).some(v => v && v > 0) && (
            <View style={{ backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 16, ...theme.shadow }}>
              <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>Mikronährstoffe</Text>
              {[
                { section: 'Basis', items: [
                  { l: 'Ballaststoffe', v: microTotals.fiber, u: 'g', c: theme.green },
                  { l: 'Zucker', v: microTotals.sugar, u: 'g', c: theme.orange },
                  { l: 'Salz', v: microTotals.salt, u: 'g', c: theme.red },
                  { l: 'Ges. Fettsäuren', v: microTotals.saturatedFat, u: 'g', c: theme.pink },
                ]},
                { section: 'Vitamine', items: [
                  { l: 'Vitamin A', v: microTotals.vitaminA, u: 'μg', c: theme.purple },
                  { l: 'Vitamin C', v: microTotals.vitaminC, u: 'mg', c: theme.purple },
                  { l: 'Vitamin D', v: microTotals.vitaminD, u: 'μg', c: theme.purple },
                  { l: 'Vitamin B12', v: microTotals.vitaminB12, u: 'μg', c: theme.purple },
                ]},
                { section: 'Mineralien', items: [
                  { l: 'Calcium', v: microTotals.calcium, u: 'mg', c: theme.blue },
                  { l: 'Eisen', v: microTotals.iron, u: 'mg', c: theme.blue },
                  { l: 'Magnesium', v: microTotals.magnesium, u: 'mg', c: theme.blue },
                  { l: 'Zink', v: microTotals.zinc, u: 'mg', c: theme.blue },
                  { l: 'Kalium', v: microTotals.potassium, u: 'mg', c: theme.blue },
                ]},
              ].map(({ section, items }) => {
                const visible = items.filter(i => i.v !== undefined && i.v > 0);
                if (visible.length === 0) return null;
                return (
                  <View key={section} style={{ marginBottom: 10 }}>
                    <Text style={{ color: theme.textTertiary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{section}</Text>
                    {visible.map(item => (
                      <View key={item.l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight }}>
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.l}</Text>
                        <Text style={{ color: item.c, fontSize: 12, fontWeight: '600' }}>{`${Math.round((item.v!) * 10) / 10}${item.u}`}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[
              { emoji: '📷', label: 'Barcode', sub: 'Verpacktes', color: theme.blue, onPress: () => setShowScanner(true), disabled: false },
              { emoji: '📸', label: 'Kamera', sub: 'KI-Analyse', color: '#7C3AED', onPress: () => handlePhoto(true), disabled: aiLoading },
              { emoji: '🖼️', label: 'Galerie', sub: 'KI-Analyse', color: theme.green, onPress: () => handlePhoto(false), disabled: aiLoading },
              { emoji: '✏️', label: 'Manuell', sub: 'Eingabe', color: theme.orange, onPress: () => { setPrefill(undefined); setShowAddModal(true); }, disabled: false },
            ].map(btn => (
              <TouchableOpacity key={btn.label}
                style={{ flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: btn.color, ...theme.shadow }}
                onPress={btn.onPress} disabled={btn.disabled} activeOpacity={0.7}>
                {btn.disabled && aiLoading ? <ActivityIndicator size="small" color={btn.color} /> : <Text style={{ fontSize: 22 }}>{btn.emoji}</Text>}
                <Text style={{ color: btn.color, fontSize: 11, fontWeight: '600' }}>{btn.label}</Text>
                <Text style={{ color: theme.textTertiary, fontSize: 9 }}>{btn.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Meal Groups */}
          {Object.entries(mealGroups).map(([meal, entries]) => {
            const mealTotals = sumMacros(entries);
            return (
              <View key={meal} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600' }}>{meal}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{`${Math.round(mealTotals.kcal)} kcal`}</Text>
                </View>
                {entries.map(entry => {
                  const isExpanded = expandedId === entry.id;
                  const srcIcon = entry.source === 'barcode' ? '📷' : entry.source === 'ai' ? '🤖' : '✏️';
                  const amountStr = `${entry.amount}${entry.unit}`;
                  const macroStr = `P:${Math.round(entry.macros.protein)}g K:${Math.round(entry.macros.carbs)}g F:${Math.round(entry.macros.fat)}g`;
                  const kcalStr = `${Math.round(entry.macros.kcal)} kcal`;
                  return (
                    <View key={entry.id} style={{ backgroundColor: theme.card, borderRadius: 12, padding: 12, marginBottom: 6, ...theme.shadow }}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        onPress={() => setExpandedId(isExpanded ? null : entry.id)}
                        activeOpacity={0.7}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 14 }}>{srcIcon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '500' }}>{entry.label}</Text>
                          <Text style={{ color: theme.textSecondary, fontSize: 10 }}>{`${amountStr} · ${entry.time}`}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: theme.orange, fontSize: 13, fontWeight: '600' }}>{kcalStr}</Text>
                          <Text style={{ color: theme.textTertiary, fontSize: 9 }}>{macroStr}</Text>
                        </View>
                        <Text style={{ color: theme.textTertiary, fontSize: 12, marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</Text>
                        <TouchableOpacity onPress={() => deleteEntry(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={{ color: theme.textTertiary, fontSize: 20, marginLeft: 4 }}>×</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                      {isExpanded && entry.micros && (
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: theme.borderLight }}>
                          <MicrosDisplay micros={entry.micros} source={entry.source} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}

          {dayLog.entries.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Text style={{ fontSize: 48 }}>🥗</Text>
              <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '600' }}>Noch nichts geloggt</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>Scanne einen Barcode, mache ein Foto oder gib manuell ein</Text>
            </View>
          )}
          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <AddEntryModal prefill={prefill} onSave={addEntry} onClose={() => { setShowAddModal(false); setPrefill(undefined); }} />
        </View>
      </Modal>

      <Modal visible={showGoals} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <GoalsModal goals={dayLog.goal} onSave={saveGoals} onClose={() => setShowGoals(false)} />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600' },
  modal: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  label: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 14, color: theme.textPrimary, fontSize: 15 },
  btn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelText: { color: theme.textSecondary, fontSize: 14 },
});