// app/(tabs)/nutrition.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

const W = Dimensions.get('window').width;

const t = {
  bg:        '#EEE8E0',
  card:      '#FFFFFF',
  cardSec:   '#F8F5F1',
  border:    'rgba(0,0,0,0.07)',
  borderMed: 'rgba(0,0,0,0.1)',
  text:      '#1A1209',
  textSec:   '#B0A89E',
  textTer:   '#D8D0C6',
  protein:   '#3A7AC0',
  carbs:     '#D97706',
  fat:       '#BE185D',
  green:     '#22C55E',
  greenDark: '#4A8C5C',
  orange:    '#F97316',
  red:       '#C0392B',
  blue:      '#3A7AC0',
};

type Macros = { kcal: number; protein: number; carbs: number; fat: number };
type Micros = {
  fiber?: number; sugar?: number; salt?: number; saturatedFat?: number;
  vitaminA?: number; vitaminB6?: number; vitaminC?: number; vitaminD?: number;
  vitaminB12?: number; vitaminE?: number; folate?: number;
  calcium?: number; iron?: number; magnesium?: number; zinc?: number;
  potassium?: number; phosphorus?: number; sodium?: number;
};
type FoodEntry = {
  id: string; time: string; label: string; amount: number; unit: string;
  macros: Macros; micros?: Micros; source: 'barcode' | 'ai' | 'manual';
};
type DayLog = { date: string; entries: FoodEntry[]; goal: Macros; burned: number };

const DEFAULT_GOAL: Macros = { kcal: 2000, protein: 150, carbs: 250, fat: 70 };
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

function getDateKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function formatDateLabel(offset: number) {
  if (offset === 0) return 'Heute';
  if (offset === -1) return 'Gestern';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}
function formatDateSub(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}
function getMealSlot(timeStr: string): MealSlot {
  const h = parseInt(timeStr.split(':')[0]);
  if (h < 10) return 'Frühstück';
  if (h < 14) return 'Mittagessen';
  if (h < 18) return 'Snacks';
  return 'Abendessen';
}
function sumMacros(entries: FoodEntry[]): Macros {
  return entries.reduce((s, e) => ({
    kcal: s.kcal + e.macros.kcal, protein: s.protein + e.macros.protein,
    carbs: s.carbs + e.macros.carbs, fat: s.fat + e.macros.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}
function sumMicros(entries: FoodEntry[]): Micros {
  const total: Micros = {};
  entries.forEach(e => {
    if (!e.micros) return;
    (Object.keys(e.micros) as (keyof Micros)[]).forEach(k => {
      const v = e.micros![k];
      if (v !== undefined) total[k] = (total[k] || 0) + v;
    });
  });
  return total;
}

const MICRO_REFS: Record<string, number> = {
  fiber:30, sugar:50, salt:6, saturatedFat:20, vitaminA:800,
  vitaminB6:1.4, vitaminB12:2.4, vitaminC:80, vitaminD:20, vitaminE:12,
  folate:200, calcium:1000, iron:14, magnesium:375, zinc:10,
  potassium:2000, phosphorus:700, sodium:2300,
};
function calcMacroScore(entries: FoodEntry[], goal: Macros): number {
  if (entries.length === 0) return 0;
  const tot = sumMacros(entries);
  const prot = Math.min(100, (tot.protein / goal.protein) * 100);
  const carb = Math.min(100, (tot.carbs / goal.carbs) * 100);
  const fat  = Math.min(100, (tot.fat / goal.fat) * 100);
  return Math.round(prot * 0.5 + carb * 0.25 + fat * 0.25);
}
function calcMicroScore(entries: FoodEntry[]): number {
  if (entries.length === 0) return 0;
  const micros = sumMicros(entries);
  const keys = Object.keys(MICRO_REFS);
  const scores = keys.map(k => {
    const v = (micros as any)[k] || 0;
    return Math.min(100, (v / MICRO_REFS[k]) * 100);
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
function calcKcalScore(entries: FoodEntry[], adjustedGoal: number): number {
  if (entries.length === 0 || adjustedGoal === 0) return 0;
  const tot = sumMacros(entries);
  const dev = Math.abs(tot.kcal - adjustedGoal) / adjustedGoal * 100;
  return Math.max(0, Math.round(100 - dev * 2));
}
function calcNutritionScore(entries: FoodEntry[], goal: Macros, burned: number): number {
  const adjustedGoal = goal.kcal + burned;
  const kcal  = calcKcalScore(entries, adjustedGoal);
  const macro = calcMacroScore(entries, goal);
  const micro = calcMicroScore(entries);
  return Math.round(kcal * 0.30 + macro * 0.40 + micro * 0.30);
}
function scoreColor(score: number): string {
  if (score >= 80) return '#3B82F6';
  if (score >= 60) return t.green;
  if (score >= 40) return t.orange;
  return t.red;
}

// ─── AI Analysis ──────────────────────────────────────────────
async function analyzeWithAI(base64: string): Promise<Partial<FoodEntry> | null> {
  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            { text: `Du bist ein Ernährungsexperte. Analysiere diese Mahlzeit genau.
Identifiziere alle sichtbaren Zutaten und schätze die Nährwerte so genau wie möglich.
Antworte NUR mit validem JSON, kein Markdown:
{
  "label": "Name der Mahlzeit auf Deutsch",
  "ingredients": "alle sichtbaren Zutaten",
  "amount": 400,
  "unit": "g",
  "kcal": 650,
  "protein": 35,
  "carbs": 70,
  "fat": 18,
  "fiber": 4,
  "sugar": 8,
  "salt": 1.5,
  "saturatedFat": 5,
  "vitaminA": 120,
  "vitaminB6": 0.4,
  "vitaminB12": 1.2,
  "vitaminC": 15,
  "vitaminD": 1.5,
  "vitaminE": 2,
  "folate": 40,
  "calcium": 80,
  "iron": 3,
  "magnesium": 45,
  "zinc": 3,
  "potassium": 450,
  "phosphorus": 200,
  "sodium": 600
}` }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      return null;
    }

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const p = JSON.parse(cleaned);

    return {
      label:   p.label       || 'KI-Analyse',
      amount:  p.amount      || 100,
      unit:    p.unit        || 'g',
      source:  'ai',
      macros: {
        kcal:    p.kcal    || 0,
        protein: p.protein || 0,
        carbs:   p.carbs   || 0,
        fat:     p.fat     || 0,
      },
      micros: {
        fiber:        p.fiber        || undefined,
        sugar:        p.sugar        || undefined,
        salt:         p.salt         || undefined,
        saturatedFat: p.saturatedFat || undefined,
        vitaminA:     p.vitaminA     || undefined,
        vitaminB6:    p.vitaminB6    || undefined,
        vitaminB12:   p.vitaminB12   || undefined,
        vitaminC:     p.vitaminC     || undefined,
        vitaminD:     p.vitaminD     || undefined,
        vitaminE:     p.vitaminE     || undefined,
        folate:       p.folate       || undefined,
        calcium:      p.calcium      || undefined,
        iron:         p.iron         || undefined,
        magnesium:    p.magnesium    || undefined,
        zinc:         p.zinc         || undefined,
        potassium:    p.potassium    || undefined,
        phosphorus:   p.phosphorus   || undefined,
        sodium:       p.sodium       || undefined,
      },
    };
  } catch (e: any) {
    Alert.alert('Analyse fehlgeschlagen', e?.message ?? String(e));
    return null;
  }
}
async function generateDayReport(entries: FoodEntry[], goal: Macros): Promise<string | null> {
  try {
    const totals = sumMacros(entries);
    const micros = sumMicros(entries);
    
    const prompt = `Du bist ein Ernährungscoach. Analysiere diesen Ernährungstag und schreibe einen kurzen, motivierenden Report auf Deutsch.

Gegessen heute:
${entries.map(e => `- ${e.label}: ${e.macros.kcal} kcal, ${e.macros.protein}g Protein`).join('\n')}

Gesamte Makros: ${Math.round(totals.kcal)} kcal, ${Math.round(totals.protein)}g Protein, ${Math.round(totals.carbs)}g KH, ${Math.round(totals.fat)}g Fett
Ziel: ${goal.kcal} kcal, ${goal.protein}g Protein

Mikronährstoffe (% des Tagesbedarfs):
- Magnesium: ${Math.round(((micros.magnesium||0)/375)*100)}%
- Vitamin C: ${Math.round(((micros.vitaminC||0)/80)*100)}%
- Calcium: ${Math.round(((micros.calcium||0)/1000)*100)}%
- Eisen: ${Math.round(((micros.iron||0)/14)*100)}%
- Vitamin D: ${Math.round(((micros.vitaminD||0)/20)*100)}%
- Zink: ${Math.round(((micros.zinc||0)/10)*100)}%

Schreibe einen Report mit:
1. Kurze Bewertung des Tages (1-2 Sätze)
2. Was gut war
3. Was fehlt — mit konkreten Lebensmittelempfehlungen und warum es wichtig ist
4. Ein motivierender Abschlusssatz

Halte es kurz, direkt und hilfreich. Maximal 200 Wörter.`;

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
      })
    });

    const data = await response.json();
    if (!response.ok) return null;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

// ─── Barcode Scanner ──────────────────────────────────────────
function BarcodeScanner({ onResult, onClose }: { onResult:(f:Partial<FoodEntry>)=>void; onClose:()=>void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(false);

  async function handleBarcode({ data }: { data: string }) {
    if (ref.current) return;
    ref.current = true; setScanned(true); setLoading(true);
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${data}?fields=product_name,nutriments,brands,ingredients_text`, { headers:{'User-Agent':'StrideApp/1.0'}, signal:ctrl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (json.status !== 1 || !json.product) {
        Alert.alert('Nicht gefunden','Manuell eingeben.',[{text:'OK',onPress:()=>{ref.current=false;setScanned(false);setLoading(false);}}]);
        return;
      }
      const p = json.product, n = p.nutriments||{};
      const v = (k:string) => { const val=n[`${k}_100g`]??n[`${k}_value`]??n[k]; return val!==undefined?Math.round(parseFloat(String(val))*10)/10:0; };
      const kcal = v('energy-kcal')||Math.round(v('energy')/4.184);
      const name = [p.brands,p.product_name].filter(Boolean).join(' – ')||'Unbekannt';
      const micros: Micros = {
        fiber: v('fiber')||undefined, sugar: v('sugars')||undefined,
        salt: v('salt')||undefined, saturatedFat: v('saturated-fat')||undefined,
        calcium: v('calcium')||undefined, iron: v('iron')||undefined,
        magnesium: v('magnesium')||undefined, zinc: v('zinc')||undefined,
        potassium: v('potassium')||undefined, sodium: v('sodium')||undefined,
        vitaminC: v('vitamin-c')||undefined, vitaminD: v('vitamin-d')||undefined,
      };
      onResult({ label:name, unit:'g', source:'barcode', macros:{kcal,protein:v('proteins'),carbs:v('carbohydrates'),fat:v('fat')}, micros });
    } catch (e:any) {
      Alert.alert('Fehler', e?.name==='AbortError'?'Zeitüberschreitung.':'Netzwerkfehler.',[{text:'OK',onPress:()=>{ref.current=false;setScanned(false);setLoading(false);}}]);
    }
    setLoading(false);
  }

  if (!permission) return <View style={s.center}><ActivityIndicator color={t.greenDark}/></View>;
  if (!permission.granted) return (
    <View style={s.center}>
      <Text style={{color:t.textSec,marginBottom:16,textAlign:'center'}}>Kamera-Zugriff benötigt</Text>
      <TouchableOpacity style={s.darkBtn} onPress={requestPermission}><Text style={s.darkBtnTxt}>Erlauben</Text></TouchableOpacity>
      <TouchableOpacity onPress={onClose} style={{padding:14}}><Text style={{color:t.textSec}}>Abbrechen</Text></TouchableOpacity>
    </View>
  );
  return (
    <View style={{flex:1,backgroundColor:'#000'}}>
      <CameraView style={{flex:1}} facing="back" onBarcodeScanned={scanned?undefined:handleBarcode} barcodeScannerSettings={{barcodeTypes:['ean8','ean13','upc_a','upc_e']}}/>
      <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,alignItems:'center',justifyContent:'center'}}>
        <View style={{width:250,height:150,borderWidth:2,borderColor:'#fff',borderRadius:12}}/>
        <Text style={{color:'#fff',fontSize:14,marginTop:16}}>Barcode in den Rahmen halten</Text>
      </View>
      {loading&&<View style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.7)',alignItems:'center',justifyContent:'center'}}><ActivityIndicator size="large" color="#fff"/><Text style={{color:'#fff',marginTop:8}}>Wird geladen...</Text></View>}
      <TouchableOpacity style={{position:'absolute',top:60,right:20,backgroundColor:'rgba(0,0,0,0.6)',borderRadius:20,paddingHorizontal:16,paddingVertical:8}} onPress={onClose}>
        <Text style={{color:'#fff',fontSize:14,fontWeight:'600'}}>Schliessen</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Options Sheet ────────────────────────────────────────
function AddOptionsSheet({ onBarcode, onCamera, onGallery, onManual, onClose, loading }: {
  onBarcode:()=>void; onCamera:()=>void; onGallery:()=>void; onManual:()=>void; onClose:()=>void; loading:boolean;
}) {
  const opts = [
    { label:'Barcode scannen', sub:'Verpacktes Produkt', onPress:onBarcode },
    { label:'Manuell',         sub:'Selbst eintragen', onPress:onManual },
    { label:'KI-Foto', sub:'Mahlzeit fotografieren', onPress: onCamera, ai:true },
{ label:'Aus Galerie', sub:'Foto aus Bibliothek', onPress: () => { Alert.alert('Galerie getippt'); onGallery(); }, ai:true },
  ];
  return (
    <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.3)'}}>
      <TouchableOpacity style={{flex:1}} onPress={onClose} activeOpacity={1}/>
      <View style={{backgroundColor:t.bg,borderTopLeftRadius:28,borderTopRightRadius:28,padding:24,gap:10}}>
        <Text style={{fontSize:18,fontWeight:'800',color:t.text,letterSpacing:-0.4,marginBottom:4}}>Kalorien eintragen</Text>
        {opts.map(o => (
          <TouchableOpacity key={o.label}
            style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:14,borderBottomWidth:0.5,borderBottomColor:t.border}}
            onPress={o.onPress} disabled={loading&&!!o.ai} activeOpacity={0.7}>
            <View>
              <Text style={{fontSize:15,fontWeight:'700',color:t.text,marginBottom:2}}>{o.label}</Text>
              <Text style={{fontSize:11,color:t.textSec}}>{o.sub}</Text>
            </View>
            {loading && o.ai
              ? <ActivityIndicator size="small" color={t.textSec}/>
              : <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke={t.textSec} strokeWidth={2.2} strokeLinecap="round"/></Svg>
            }
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={onClose} style={{paddingVertical:12,alignItems:'center'}}>
          <Text style={{fontSize:14,color:t.textSec,fontWeight:'600'}}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Add Entry Modal ──────────────────────────────────────────
function AddEntryModal({ prefill, onSave, onClose }: { prefill?:Partial<FoodEntry>; onSave:(e:FoodEntry)=>void; onClose:()=>void }) {
  const [label, setLabel]     = useState(prefill?.label||'');
  const [amount, setAmount]   = useState(String(prefill?.amount||100));
  const [kcal, setKcal]       = useState(String(Math.round(prefill?.macros?.kcal||0)||''));
  const [protein, setProtein] = useState(String(prefill?.macros?.protein||''));
  const [carbs, setCarbs]     = useState(String(prefill?.macros?.carbs||''));
  const [fat, setFat]         = useState(String(prefill?.macros?.fat||''));
  const [showMicros, setShowMicros] = useState(false);
  const [fiber, setFiber]     = useState('');
  const [sugar, setSugar]     = useState('');
  const [salt, setSalt]       = useState('');
  const [vitC, setVitC]       = useState('');
  const [calcium, setCalcium] = useState('');
  const [iron, setIron]       = useState('');
  const [magnesium, setMagnesium] = useState('');
  const base = prefill?.amount||100;

  function scale(v:number) {
    const a = parseFloat(amount)||100;
    return Math.round((v/base)*a*10)/10;
  }
  function save() {
    if (!label.trim()) { Alert.alert('Name fehlt'); return; }
    const amt = parseFloat(amount)||100;
    const entry: FoodEntry = {
      id: Date.now().toString(), time: getTimeStr(), label: label.trim(), amount: amt,
      unit: prefill?.unit||'g', source: prefill?.source||'manual',
      macros: prefill
        ? { kcal:scale(prefill.macros?.kcal||0), protein:scale(prefill.macros?.protein||0), carbs:scale(prefill.macros?.carbs||0), fat:scale(prefill.macros?.fat||0) }
        : { kcal:parseFloat(kcal)||0, protein:parseFloat(protein)||0, carbs:parseFloat(carbs)||0, fat:parseFloat(fat)||0 },
      micros: prefill?.micros || (fiber||sugar||salt||vitC||calcium
        ? { fiber:parseFloat(fiber)||undefined, sugar:parseFloat(sugar)||undefined, salt:parseFloat(salt)||undefined, vitaminC:parseFloat(vitC)||undefined, calcium:parseFloat(calcium)||undefined, iron:parseFloat(iron)||undefined, magnesium:parseFloat(magnesium)||undefined }
        : undefined),
    };
    onSave(entry);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,justifyContent:'flex-end'}}>
      <ScrollView style={{backgroundColor:t.bg,borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'92%'}} contentContainerStyle={{padding:24,gap:12}} keyboardShouldPersistTaps="handled">
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <Text style={{fontSize:18,fontWeight:'800',color:t.text,letterSpacing:-0.4}}>
            {prefill?.source==='barcode'?'Barcode':prefill?.source==='ai'?'KI-Analyse':'Manuell'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M18 6L6 18M6 6L18 18" stroke={t.text} strokeWidth={2} strokeLinecap="round"/></Svg>
          </TouchableOpacity>
        </View>

        <Text style={s.lbl}>Name</Text>
        <TextInput style={s.inp} value={label} onChangeText={setLabel} placeholder="z.B. Haferflocken" placeholderTextColor={t.textTer}/>

        <Text style={s.lbl}>{`Menge (${prefill?.unit||'g'})`}</Text>
        <TextInput style={s.inp} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholderTextColor={t.textTer}/>

        {prefill ? (
          <View style={{backgroundColor:'rgba(58,122,192,0.08)',borderRadius:14,padding:14,gap:10}}>
            <Text style={{color:t.blue,fontSize:11,fontWeight:'700',textTransform:'uppercase'}}>Nährwerte für {amount||100}{prefill.unit||'g'}</Text>
            <View style={{flexDirection:'row',justifyContent:'space-around'}}>
              {[
                {l:'kcal',v:scale(prefill.macros?.kcal||0),c:'#D97706'},
                {l:'Protein',v:scale(prefill.macros?.protein||0),c:t.blue},
                {l:'KH',v:scale(prefill.macros?.carbs||0),c:t.green},
                {l:'Fett',v:scale(prefill.macros?.fat||0),c:t.fat},
              ].map(m=>(
                <View key={m.l} style={{alignItems:'center'}}>
                  <Text style={{color:m.c,fontSize:18,fontWeight:'800'}}>{m.v}</Text>
                  <Text style={{color:t.textSec,fontSize:9,textTransform:'uppercase'}}>{m.l}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={{gap:8}}>
            <View style={{flexDirection:'row',gap:8}}>
              <View style={{flex:1}}><Text style={s.lbl}>kcal</Text><TextInput style={s.inp} value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholder="0" placeholderTextColor={t.textTer}/></View>
              <View style={{flex:1}}><Text style={s.lbl}>Protein (g)</Text><TextInput style={s.inp} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/></View>
            </View>
            <View style={{flexDirection:'row',gap:8}}>
              <View style={{flex:1}}><Text style={s.lbl}>Kohlenhydrate (g)</Text><TextInput style={s.inp} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/></View>
              <View style={{flex:1}}><Text style={s.lbl}>Fett (g)</Text><TextInput style={s.inp} value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/></View>
            </View>
            <TouchableOpacity onPress={()=>setShowMicros(v=>!v)} style={{paddingVertical:8}}>
              <Text style={{color:t.blue,fontSize:13,fontWeight:'600'}}>{showMicros?'Micros ausblenden ▲':'Micros hinzufügen ▼'}</Text>
            </TouchableOpacity>
            {showMicros&&(
              <View style={{gap:8}}>
                <View style={{flexDirection:'row',gap:8}}>
                  <View style={{flex:1}}><Text style={s.lbl}>Ballaststoffe (g)</Text><TextInput style={s.inp} value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/></View>
                  <View style={{flex:1}}><Text style={s.lbl}>Zucker (g)</Text><TextInput style={s.inp} value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/></View>
                </View>
                <View style={{flexDirection:'row',gap:8}}>
                  <View style={{flex:1}}><Text style={s.lbl}>Salz (g)</Text><TextInput style={s.inp} value={salt} onChangeText={setSalt} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/></View>
                  <View style={{flex:1}}><Text style={s.lbl}>Vit. C (mg)</Text><TextInput style={s.inp} value={vitC} onChangeText={setVitC} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/></View>
                </View>
                <View style={{flexDirection:'row',gap:8}}>
                  <View style={{flex:1}}><Text style={s.lbl}>Calcium (mg)</Text><TextInput style={s.inp} value={calcium} onChangeText={setCalcium} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/></View>
                  <View style={{flex:1}}><Text style={s.lbl}>Eisen (mg)</Text><TextInput style={s.inp} value={iron} onChangeText={setIron} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/></View>
                </View>
                <Text style={s.lbl}>Magnesium (mg)</Text>
                <TextInput style={s.inp} value={magnesium} onChangeText={setMagnesium} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.textTer}/>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={s.darkBtn} onPress={save}><Text style={s.darkBtnTxt}>Hinzufügen</Text></TouchableOpacity>
        <TouchableOpacity style={{padding:14,alignItems:'center'}} onPress={onClose}><Text style={{color:t.textSec}}>Abbrechen</Text></TouchableOpacity>
        <View style={{height:20}}/>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Goals Modal ──────────────────────────────────────────────
function GoalsModal({ goals, onSave, onClose }: { goals:Macros; onSave:(g:Macros)=>void; onClose:()=>void }) {
  const [kcal,setKcal]       = useState(String(goals.kcal));
  const [protein,setProtein] = useState(String(goals.protein));
  const [carbs,setCarbs]     = useState(String(goals.carbs));
  const [fat,setFat]         = useState(String(goals.fat));
  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,justifyContent:'flex-end'}}>
      <View style={{backgroundColor:t.bg,borderTopLeftRadius:28,borderTopRightRadius:28,padding:24,gap:12}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <Text style={{fontSize:18,fontWeight:'800',color:t.text}}>Tagesziele</Text>
          <TouchableOpacity onPress={onClose}><Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M18 6L6 18M6 6L18 18" stroke={t.text} strokeWidth={2} strokeLinecap="round"/></Svg></TouchableOpacity>
        </View>
        {[{l:'Kalorien (kcal)',v:kcal,set:setKcal},{l:'Protein (g)',v:protein,set:setProtein},{l:'Kohlenhydrate (g)',v:carbs,set:setCarbs},{l:'Fett (g)',v:fat,set:setFat}].map(f=>(
          <View key={f.l}><Text style={s.lbl}>{f.l}</Text><TextInput style={s.inp} value={f.v} onChangeText={f.set} keyboardType="numeric" placeholderTextColor={t.textTer}/></View>
        ))}
        <TouchableOpacity style={s.darkBtn} onPress={()=>onSave({kcal:parseFloat(kcal)||2000,protein:parseFloat(protein)||150,carbs:parseFloat(carbs)||250,fat:parseFloat(fat)||70})}>
          <Text style={s.darkBtnTxt}>Speichern</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Meal Detail Modal ────────────────────────────────────────
function MealDetailModal({ meal, entries, onDelete, onClose, onAdd }: {
  meal: MealSlot; entries: FoodEntry[]; onDelete:(id:string)=>void; onClose:()=>void; onAdd:()=>void;
}) {
  const totals = sumMacros(entries);
  return (
    <Modal visible animationType="slide">
      <View style={{flex:1,backgroundColor:t.bg}}>
        <View style={{paddingTop:56,paddingHorizontal:20,paddingBottom:16,borderBottomWidth:0.5,borderBottomColor:t.border}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:8}}>
            <TouchableOpacity style={s.navBtn} onPress={onClose}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"><Path d="M15 18l-6-6 6-6" stroke={t.text} strokeWidth={2.2} strokeLinecap="round"/></Svg>
            </TouchableOpacity>
            <View style={{flex:1}}>
              <Text style={{fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:t.textSec,marginBottom:2}}>Mahlzeit</Text>
              <Text style={{fontSize:20,fontWeight:'800',color:t.text,letterSpacing:-0.5}}>{meal}</Text>
            </View>
            <TouchableOpacity onPress={onAdd} style={{width:34,height:34,borderRadius:17,backgroundColor:t.text,alignItems:'center',justifyContent:'center'}}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.4} strokeLinecap="round"/></Svg>
            </TouchableOpacity>
          </View>
          {entries.length > 0 && (
            <View style={{flexDirection:'row',gap:16,paddingTop:8}}>
              {[{l:'kcal',v:Math.round(totals.kcal),c:t.text},{l:'Protein',v:`${Math.round(totals.protein)}g`,c:t.blue},{l:'KH',v:`${Math.round(totals.carbs)}g`,c:t.carbs},{l:'Fett',v:`${Math.round(totals.fat)}g`,c:t.fat}].map(m=>(
                <View key={m.l} style={{alignItems:'center'}}>
                  <Text style={{fontSize:15,fontWeight:'800',color:m.c}}>{m.v}</Text>
                  <Text style={{fontSize:8,color:t.textSec,textTransform:'uppercase',letterSpacing:0.5}}>{m.l}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <ScrollView contentContainerStyle={{padding:16}}>
          {entries.length === 0 ? (
            <View style={{alignItems:'center',paddingVertical:60,gap:12}}>
              <Text style={{fontSize:16,fontWeight:'700',color:t.textSec}}>Noch nichts eingetragen</Text>
              <TouchableOpacity style={s.darkBtn} onPress={onAdd}><Text style={s.darkBtnTxt}>Eintrag hinzufügen</Text></TouchableOpacity>
            </View>
          ) : entries.map(entry=>(
            <View key={entry.id} style={{paddingVertical:14,borderBottomWidth:0.5,borderBottomColor:t.border,flexDirection:'row',alignItems:'center',gap:12}}>
              <View style={{flex:1}}>
                <Text style={{fontSize:14,fontWeight:'700',color:t.text,marginBottom:2}}>{entry.label}</Text>
                <Text style={{fontSize:10,color:t.textSec}}>{entry.amount}{entry.unit} · {entry.time}</Text>
              </View>
              <Text style={{fontSize:14,fontWeight:'800',color:t.text,marginRight:8}}>{Math.round(entry.macros.kcal)} <Text style={{fontSize:9,fontWeight:'500',color:t.textSec}}>kcal</Text></Text>
              <TouchableOpacity onPress={()=>onDelete(entry.id)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M18 6L6 18M6 6L18 18" stroke={t.textSec} strokeWidth={2} strokeLinecap="round"/></Svg>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{height:60}}/>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Macro Detail Modal ───────────────────────────────────────
function MacroDetailModal({ entries, goal, onClose }: { entries:FoodEntry[]; goal:Macros; onClose:()=>void }) {
  const tot = sumMacros(entries);
  return (
    <Modal visible animationType="slide">
      <View style={{flex:1,backgroundColor:t.bg}}>
        <View style={{paddingTop:56,paddingHorizontal:20,paddingBottom:16,borderBottomWidth:0.5,borderBottomColor:t.border,flexDirection:'row',alignItems:'center',gap:12}}>
          <TouchableOpacity style={s.navBtn} onPress={onClose}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"><Path d="M15 18l-6-6 6-6" stroke={t.text} strokeWidth={2.2} strokeLinecap="round"/></Svg>
          </TouchableOpacity>
          <View>
            <Text style={{fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:t.textSec,marginBottom:2}}>Details</Text>
            <Text style={{fontSize:20,fontWeight:'800',color:t.text,letterSpacing:-0.5}}>Makros</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{padding:20}}>
          {[{l:'Protein',v:tot.protein,g:goal.protein,c:t.blue},{l:'Kohlenhydrate',v:tot.carbs,g:goal.carbs,c:t.carbs},{l:'Fett',v:tot.fat,g:goal.fat,c:t.fat}].map(item=>{
            const pct = Math.min(100, item.g > 0 ? (item.v/item.g)*100 : 0);
            return (
              <View key={item.l} style={{marginBottom:24}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
                  <Text style={{fontSize:16,fontWeight:'700',color:t.text}}>{item.l}</Text>
                  <Text style={{fontSize:16,fontWeight:'800',color:item.c}}>{Math.round(item.v)}g <Text style={{fontSize:12,color:t.textSec}}>/ {item.g}g</Text></Text>
                </View>
                <View style={{height:8,backgroundColor:t.border,borderRadius:4,overflow:'hidden'}}>
                  <View style={{width:`${pct}%` as any,height:8,backgroundColor:item.c,borderRadius:4}}/>
                </View>
                <Text style={{fontSize:10,color:t.textSec,marginTop:4}}>{Math.round(pct)}% erreicht</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Micro Detail Modal ───────────────────────────────────────
const MICROS_TABLE = [
  { section:'Basis', items:[{l:'Ballaststoffe',k:'fiber',u:'g',ref:30},{l:'Zucker',k:'sugar',u:'g',ref:50},{l:'Salz',k:'salt',u:'g',ref:6},{l:'Ges. Fett',k:'saturatedFat',u:'g',ref:20}] },
  { section:'Vitamine', items:[{l:'Vitamin A',k:'vitaminA',u:'μg',ref:800},{l:'Vitamin B6',k:'vitaminB6',u:'mg',ref:1.4},{l:'Vitamin B12',k:'vitaminB12',u:'μg',ref:2.4},{l:'Vitamin C',k:'vitaminC',u:'mg',ref:80},{l:'Vitamin D',k:'vitaminD',u:'μg',ref:20},{l:'Vitamin E',k:'vitaminE',u:'mg',ref:12},{l:'Folsäure',k:'folate',u:'μg',ref:200}] },
  { section:'Mineralien', items:[{l:'Calcium',k:'calcium',u:'mg',ref:1000},{l:'Eisen',k:'iron',u:'mg',ref:14},{l:'Magnesium',k:'magnesium',u:'mg',ref:375},{l:'Zink',k:'zinc',u:'mg',ref:10},{l:'Kalium',k:'potassium',u:'mg',ref:2000},{l:'Phosphor',k:'phosphorus',u:'mg',ref:700},{l:'Natrium',k:'sodium',u:'mg',ref:2300}] },
];
function MicroDetailModal({ entries, onClose }: { entries:FoodEntry[]; onClose:()=>void }) {
  const micros = sumMicros(entries);
  return (
    <Modal visible animationType="slide">
      <View style={{flex:1,backgroundColor:t.bg}}>
        <View style={{paddingTop:56,paddingHorizontal:20,paddingBottom:16,borderBottomWidth:0.5,borderBottomColor:t.border,flexDirection:'row',alignItems:'center',gap:12}}>
          <TouchableOpacity style={s.navBtn} onPress={onClose}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"><Path d="M15 18l-6-6 6-6" stroke={t.text} strokeWidth={2.2} strokeLinecap="round"/></Svg>
          </TouchableOpacity>
          <View>
            <Text style={{fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:t.textSec,marginBottom:2}}>Details</Text>
            <Text style={{fontSize:20,fontWeight:'800',color:t.text,letterSpacing:-0.5}}>Mikronährstoffe</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{padding:20}}>
          {MICROS_TABLE.map(({section,items})=>(
            <View key={section} style={{marginBottom:24}}>
              <Text style={{fontSize:9,fontWeight:'700',letterSpacing:1.5,textTransform:'uppercase',color:t.textSec,marginBottom:14}}>{section}</Text>
              {items.map(item=>{
                const val=(micros as any)[item.k]||0;
                const pct=Math.min(1,val/item.ref);
                const col=pct>=1?t.green:pct>=0.5?t.blue:pct>0?t.orange:t.textTer;
                return (
                  <View key={item.l} style={{marginBottom:14}}>
                    <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:5}}>
                      <Text style={{fontSize:13,color:t.text,fontWeight:'600'}}>{item.l}</Text>
                      <Text style={{fontSize:13,fontWeight:'700',color:col}}>{Math.round(val*10)/10}{item.u} <Text style={{fontSize:10,color:t.textSec}}>/ {item.ref}{item.u}</Text></Text>
                    </View>
                    <View style={{height:5,backgroundColor:t.border,borderRadius:3,overflow:'hidden'}}>
                      <View style={{width:`${pct*100}%` as any,height:5,backgroundColor:col,borderRadius:3}}/>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
          <View style={{height:60}}/>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Nutrition Score Verlauf ──────────────────────────────────
type Range = '1W'|'2W'|'1M'|'2M'|'6M'|'1J'|'2J'|'Alles';
const RANGES: Range[] = ['1W','2W','1M','2M','6M','1J','2J','Alles'];

function NutriVerlaufScreen({ onClose, allLogs }: { onClose:()=>void; allLogs: Record<string,DayLog> }) {
  const [range, setRange] = useState<Range>('1W');
  function buildData() {
    const today = new Date();
    let days = 7;
    if (range==='2W') days=14; else if (range==='1M') days=30; else if (range==='2M') days=60;
    else if (range==='6M') days=180; else if (range==='1J') days=365; else days=730;
    const result = [];
    for (let i = days-1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const log = allLogs[key];
      const entries = log?.entries || [];
      const goal = log?.goal || DEFAULT_GOAL;
      const burned = log?.burned || 0;
      const lbl = days <= 14 ? ['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()] : days <= 60 ? `${d.getDate()}.${d.getMonth()+1}` : `${d.getMonth()+1}.${String(d.getFullYear()).slice(2)}`;
      result.push({ label:lbl, score:calcNutritionScore(entries,goal,burned), kcal:calcKcalScore(entries,goal.kcal+burned), macro:calcMacroScore(entries,goal), micro:calcMicroScore(entries) });
    }
    return result;
  }
  const data = buildData();
  const scores = data.map(d => d.score);
  const avgScore = data.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
  const chartW = W - 64, chartH = 120, padL = 28, padB = 18, padT = 16;
  const plotW = chartW - padL, plotH = chartH - padB - padT;
  const step = data.length > 30 ? Math.ceil(data.length/8) : data.length > 14 ? 2 : 1;
  const points = data.map((d,i) => ({ x: padL + (i/(data.length-1||1))*plotW, y: padT + plotH - ((d.score/100)*plotH), ...d }));
  const polyline = points.map(p=>`${p.x},${p.y}`).join(' ');
  const col = scoreColor(avgScore);
  let bestIdx = 0, worstIdx = 0;
  scores.forEach((s,i) => { if(s>scores[bestIdx]) bestIdx=i; if(s<scores[worstIdx]) worstIdx=i; });
  const thisAvg = Math.round(data.slice(-7).reduce((a,d)=>a+d.score,0)/Math.min(7,data.length));
  const lastAvg = Math.round(data.slice(0,7).reduce((a,d)=>a+d.score,0)/Math.min(7,data.length));
  const delta = thisAvg - lastAvg;

  return (
    <View style={{flex:1,backgroundColor:t.bg}}>
      <View style={{paddingTop:56,paddingHorizontal:20,paddingBottom:14,borderBottomWidth:0.5,borderBottomColor:t.border,flexDirection:'row',alignItems:'center',gap:12}}>
        <TouchableOpacity style={s.navBtn} onPress={onClose}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"><Path d="M15 18l-6-6 6-6" stroke={t.text} strokeWidth={2.2} strokeLinecap="round"/></Svg>
        </TouchableOpacity>
        <View>
          <Text style={{fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:t.textSec,marginBottom:2}}>Nutrition</Text>
          <Text style={{fontSize:20,fontWeight:'800',color:t.text,letterSpacing:-0.5}}>Performance</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingHorizontal:16,paddingVertical:14,flexDirection:'row'}}>
          {RANGES.map(r=>(
            <TouchableOpacity key={r} style={{backgroundColor:range===r?t.text:'rgba(0,0,0,0.06)',borderRadius:20,paddingHorizontal:14,paddingVertical:6}} onPress={()=>setRange(r)}>
              <Text style={{fontSize:11,fontWeight:'700',color:range===r?'#fff':t.textSec}}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{paddingHorizontal:20,paddingBottom:16}}>
          <View style={{flexDirection:'row',alignItems:'baseline',gap:5,marginBottom:4}}>
            <Text style={{fontSize:52,fontWeight:'800',color:col,letterSpacing:-3,lineHeight:52}}>{avgScore||'—'}</Text>
            <Text style={{fontSize:15,color:t.textSec,fontWeight:'600'}}>/100</Text>
          </View>
          {delta !== 0 && (
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={{fontSize:11,color:t.textSec}}>Ø {range}</Text>
              <View style={{backgroundColor:delta>0?'rgba(34,197,94,0.1)':'rgba(192,57,43,0.1)',borderRadius:20,paddingHorizontal:8,paddingVertical:3}}>
                <Text style={{fontSize:10,fontWeight:'700',color:delta>0?t.green:t.red}}>{delta>0?'↑':'↓'} {delta>0?'+':''}{delta} vs. vorher</Text>
              </View>
            </View>
          )}
        </View>
        <View style={{height:0.5,backgroundColor:t.border,marginHorizontal:20,marginBottom:16}}/>
        <View style={{paddingHorizontal:20,marginBottom:16}}>
          <Text style={{fontSize:9,fontWeight:'700',letterSpacing:1.5,textTransform:'uppercase',color:t.textSec,marginBottom:12}}>Nutrition Score · {range}</Text>
          <Svg width={chartW} height={chartH}>
            {[20,40,60,80,100].map(v=>{ const y = padT + plotH - ((v/100)*plotH); return <Line key={v} x1={padL} y1={y} x2={chartW} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth={0.5}/>; })}
            {[20,60,100].map(v=>{ const y = padT + plotH - ((v/100)*plotH); return <SvgText key={v} x={0} y={y+3} fontSize={8} fill={t.textSec}>{v}</SvgText>; })}
            {points.length > 1 && <Path d={`M${points[0].x},${padT+plotH} L${points.map(p=>`${p.x},${p.y}`).join(' L')} L${points[points.length-1].x},${padT+plotH} Z`} fill={`${col}15`}/>}
            {points.length > 1 && <Polyline points={polyline} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>}
            {points.map((p,i)=>{
              const isT = i===points.length-1;
              return (
                <>
                  {isT ? (<><Circle key={`oc${i}`} cx={p.x} cy={p.y} r={5} fill={col}/><Circle key={`ic${i}`} cx={p.x} cy={p.y} r={2.5} fill={t.bg}/></>) : (<Circle key={`c${i}`} cx={p.x} cy={p.y} r={2.5} fill={col}/>)}
                  {(i%step===0||isT) && <SvgText key={`xl${i}`} x={p.x} y={chartH} fontSize={8} fill={isT?t.text:t.textSec} textAnchor="middle" fontWeight={isT?'700':'400'}>{p.label}</SvgText>}
                </>
              );
            })}
          </Svg>
        </View>
        <View style={{height:0.5,backgroundColor:t.border,marginHorizontal:20,marginBottom:16}}/>
        <View style={{paddingHorizontal:20,marginBottom:16}}>
          <Text style={{fontSize:9,fontWeight:'700',letterSpacing:1.5,textTransform:'uppercase',color:t.textSec,marginBottom:14}}>Aufschlüsselung</Text>
          {[{l:'Kalorien',val:Math.round(data.reduce((a,d)=>a+d.kcal,0)/(data.length||1)),c:t.greenDark},{l:'Makros',val:Math.round(data.reduce((a,d)=>a+d.macro,0)/(data.length||1)),c:t.blue},{l:'Mikros',val:Math.round(data.reduce((a,d)=>a+d.micro,0)/(data.length||1)),c:t.orange}].map(item=>(
            <View key={item.l} style={{marginBottom:14}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                <Text style={{fontSize:13,fontWeight:'600',color:t.text}}>{item.l}</Text>
                <Text style={{fontSize:13,fontWeight:'800',color:item.c}}>Ø {item.val}/100</Text>
              </View>
              <View style={{height:6,backgroundColor:t.border,borderRadius:3,overflow:'hidden'}}>
                <View style={{width:`${item.val}%` as any,height:6,backgroundColor:item.c,borderRadius:3}}/>
              </View>
            </View>
          ))}
        </View>
        <View style={{height:0.5,backgroundColor:t.border,marginHorizontal:20,marginBottom:16}}/>
        <View style={{paddingHorizontal:20,marginBottom:40}}>
          <Text style={{fontSize:9,fontWeight:'700',letterSpacing:1.5,textTransform:'uppercase',color:t.textSec,marginBottom:12}}>Highlights</Text>
          <View style={{flexDirection:'row',gap:10}}>
            <View style={{flex:1,padding:14,backgroundColor:'rgba(34,197,94,0.06)',borderRadius:16,borderWidth:0.5,borderColor:'rgba(34,197,94,0.15)'}}>
              <Text style={{fontSize:8,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.8,color:t.green,marginBottom:4}}>Bester Tag</Text>
              <Text style={{fontSize:17,fontWeight:'800',color:t.text,letterSpacing:-0.5,marginBottom:2}}>{data[bestIdx]?.label||'—'}</Text>
              <Text style={{fontSize:13,fontWeight:'700',color:t.green}}>{scores[bestIdx]||0} Pkt</Text>
            </View>
            <View style={{flex:1,padding:14,backgroundColor:'rgba(0,0,0,0.03)',borderRadius:16,borderWidth:0.5,borderColor:t.border}}>
              <Text style={{fontSize:8,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.8,color:t.textSec,marginBottom:4}}>Schwächster</Text>
              <Text style={{fontSize:17,fontWeight:'800',color:t.text,letterSpacing:-0.5,marginBottom:2}}>{data[worstIdx]?.label||'—'}</Text>
              <Text style={{fontSize:13,fontWeight:'700',color:t.textSec}}>{scores[worstIdx]||0} Pkt</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
type MealSlot = 'Frühstück'|'Mittagessen'|'Abendessen'|'Snacks';
const MEAL_SLOTS: MealSlot[] = ['Frühstück','Mittagessen','Abendessen','Snacks'];

export default function NutritionScreen() {
  const [dayOffset, setDayOffset] = useState(0);
  const [dayLog, setDayLog]       = useState<DayLog>({ date:getDateKey(0), entries:[], goal:DEFAULT_GOAL, burned:0 });
  const [allLogs, setAllLogs]     = useState<Record<string,DayLog>>({});
  const [showScanner, setShowScanner]         = useState(false);
  const [showAddSheet, setShowAddSheet]       = useState(false);
  const [showAddModal, setShowAddModal]       = useState(false);
  const [showGoals, setShowGoals]             = useState(false);
  const [showVerlauf, setShowVerlauf]         = useState(false);
  const [showMacroDetail, setShowMacroDetail] = useState(false);
  const [showMicroDetail, setShowMicroDetail] = useState(false);
  const [activeMeal, setActiveMeal]           = useState<MealSlot|null>(null);
  const [prefill, setPrefill]                 = useState<Partial<FoodEntry>|undefined>();
  const [aiLoading, setAiLoading]             = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showReport, setShowReport]   = useState(false);
const [reportText, setReportText]   = useState('');
const [reportLoading, setReportLoading] = useState(false);
async function handleDayReport() {
  if (dayLog.entries.length === 0) {
    Alert.alert('Keine Einträge', 'Trage zuerst Mahlzeiten ein.');
    return;
  }
  setReportLoading(true);
  setShowReport(true);
  const report = await generateDayReport(dayLog.entries, dayLog.goal);
  setReportText(report || 'Konnte keinen Report generieren.');
  setReportLoading(false);
} 

  useFocusEffect(useCallback(() => {
    loadAll();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim,{toValue:1,duration:400,useNativeDriver:true}).start();
  },[]));

  async function loadAll() {
    const logs: Record<string,DayLog> = {};
    for (let i = 0; i < 730; i++) {
      const key = getDateKey(-i);
      const raw = await AsyncStorage.getItem(`nutrition_${key}`);
      if (raw) logs[key] = JSON.parse(raw);
    }
    setAllLogs(logs);
    await loadDay(dayOffset);
  }

  async function loadDay(offset: number) {
    const key = getDateKey(offset);
    const raw = await AsyncStorage.getItem(`nutrition_${key}`);
    const rawGoal = await AsyncStorage.getItem('nutritionGoal');
    let goal = rawGoal ? JSON.parse(rawGoal) : DEFAULT_GOAL;
    const rawProfile = await AsyncStorage.getItem('profile');
    if (rawProfile) {
      const prof = JSON.parse(rawProfile);
      const bw = parseFloat(prof.weight||'70');
      if (prof.goal==='Masse aufbauen') { goal.protein=Math.round(bw*2.2); goal.kcal=Math.round(bw*40); }
      else if (prof.goal==='Fett verlieren') { goal.protein=Math.round(bw*2.0); goal.kcal=Math.round(bw*28); }
    }
    const rawWorkouts = await AsyncStorage.getItem('workouts');
    let burned = 0;
    if (rawWorkouts) {
      const ws = JSON.parse(rawWorkouts);
      const dayKey = getDateKey(offset);
      ws.forEach((w:any) => { if (w.date?.startsWith(dayKey) && w.caloriesBurned) burned += w.caloriesBurned; });
    }
    if (raw) setDayLog({...JSON.parse(raw), goal, burned});
    else setDayLog({date:key, entries:[], goal, burned});
  }

  async function changeDay(newOffset: number) {
    if (newOffset > 0) return;
    setDayOffset(newOffset);
    await loadDay(newOffset);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim,{toValue:1,duration:300,useNativeDriver:true}).start();
  }

  async function saveDay(entries: FoodEntry[]) {
    const updated = {...dayLog, entries};
    setDayLog(updated);
    await AsyncStorage.setItem(`nutrition_${updated.date}`, JSON.stringify(updated));
    setAllLogs(prev => ({...prev, [updated.date]: updated}));
  }

  async function addEntry(entry: FoodEntry) {
    await saveDay([...dayLog.entries, entry]);
    setPrefill(undefined);
    setShowAddModal(false);
    setShowScanner(false);
    setShowAddSheet(false);
  }

  async function deleteEntry(id: string) {
    Alert.alert('Löschen?','',[
      {text:'Abbrechen',style:'cancel'},
      {text:'Löschen',style:'destructive',onPress:async()=>await saveDay(dayLog.entries.filter(e=>e.id!==id))},
    ]);
  }

async function handlePhoto(fromCamera: boolean) {
  setShowAddSheet(false);
  await new Promise(resolve => setTimeout(resolve, 600));

  try {
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.4 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'] as any,
          base64: true,
          quality: 0.4,
        });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    setAiLoading(true);
    const food = await analyzeWithAI(result.assets[0].base64);
    if (!food) { Alert.alert('Fehler', 'KI Analyse fehlgeschlagen.'); return; }
    setPrefill(food);
    setShowAddModal(true);
  } catch (e: any) {
    Alert.alert('Fehler', e?.message ?? 'Unbekannt');
  } finally {
    setAiLoading(false);
  }
}

  async function saveGoals(g: Macros) {
    await AsyncStorage.setItem('nutritionGoal', JSON.stringify(g));
    setDayLog(prev => ({...prev, goal:g}));
    setShowGoals(false);
  }

  const totals       = sumMacros(dayLog.entries);
  const adjustedGoal = dayLog.goal.kcal + dayLog.burned;
  const kcalLeft     = adjustedGoal - totals.kcal;
  const nutScore     = calcNutritionScore(dayLog.entries, dayLog.goal, dayLog.burned);
  const macScore     = calcMacroScore(dayLog.entries, dayLog.goal);
  const micScore     = calcMicroScore(dayLog.entries);
  const nutCol       = scoreColor(nutScore);
  const macCol       = scoreColor(macScore);
  const micCol       = scoreColor(micScore);

  const mealGroups: Record<MealSlot,FoodEntry[]> = { Frühstück:[], Mittagessen:[], Abendessen:[], Snacks:[] };
  dayLog.entries.forEach(e => { const slot=getMealSlot(e.time); mealGroups[slot].push(e); });

  const micros = sumMicros(dayLog.entries);
  const microKeys = ['vitaminC','vitaminD','calcium','iron','magnesium','zinc'];
  const microDots = microKeys.map(k => {
    const v = (micros as any)[k]||0;
    const ref = MICRO_REFS[k]||1;
    const pct = v/ref;
    return pct>=1?t.green:pct>=0.5?t.orange:pct>0?t.red:'rgba(0,0,0,0.1)';
  });
  const microOk = microDots.filter(c=>c===t.green).length;

  if (showScanner) return <BarcodeScanner onResult={food=>{setPrefill(food);setShowScanner(false);setShowAddModal(true);}} onClose={()=>setShowScanner(false)}/>;
  if (showVerlauf) return <NutriVerlaufScreen onClose={()=>setShowVerlauf(false)} allLogs={allLogs}/>;

  return (
    <View style={{flex:1,backgroundColor:t.bg}}>
      <ScrollView style={{flex:1,paddingHorizontal:16}} showsVerticalScrollIndicator={false}>
        <Animated.View style={{opacity:fadeAnim}}>

          {/* HEADER */}
          <View style={{paddingTop:60,paddingBottom:14,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'}}>
            <View>
              <Text style={s.ey}>Ernährung</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:10,marginTop:6}}>
                <TouchableOpacity style={s.navBtn} onPress={()=>changeDay(dayOffset-1)}>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"><Path d="M15 18l-6-6 6-6" stroke={t.text} strokeWidth={2.5} strokeLinecap="round"/></Svg>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>changeDay(0)}>
                  <Text style={{fontSize:22,fontWeight:'800',color:t.text,letterSpacing:-0.8}}>{formatDateLabel(dayOffset)}</Text>
                  <Text style={{fontSize:9,color:t.textSec,marginTop:1,textAlign:'center'}}>{formatDateSub(dayOffset)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.navBtn,dayOffset===0&&{opacity:0.2}]} onPress={()=>changeDay(dayOffset+1)} disabled={dayOffset===0}>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke={t.text} strokeWidth={2.5} strokeLinecap="round"/></Svg>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{flexDirection:'row',gap:8,marginTop:4}}>
              <TouchableOpacity style={s.navBtn} onPress={()=>setShowGoals(true)}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke={t.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>
              </TouchableOpacity>
              <TouchableOpacity style={{width:36,height:36,borderRadius:18,backgroundColor:t.text,alignItems:'center',justifyContent:'center'}} onPress={()=>setShowAddSheet(true)}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.5} strokeLinecap="round"/></Svg>
              </TouchableOpacity>
            </View>
          </View>

          {/* NUTRITION SCORE */}
          <View style={{marginBottom:18}}>
            <View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginBottom:6}}>
              <View style={{flexDirection:'row',alignItems:'baseline',gap:5}}>
                <Text style={{fontSize:48,fontWeight:'800',color:nutCol,letterSpacing:-3,lineHeight:48}}>{nutScore||'—'}</Text>
                <Text style={{fontSize:14,color:t.textSec,fontWeight:'600'}}>/100</Text>
                <Text style={{fontSize:12,color:t.textSec,marginLeft:4}}>Nutrition Score</Text>
              </View>
              <View style={{flexDirection:'row',gap:6}}>
  <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(0,0,0,0.05)',borderRadius:20,paddingHorizontal:10,paddingVertical:5}} onPress={()=>setShowVerlauf(true)}>
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none"><Path d="M3 3V21M3 17L9 11L13 15L21 7" stroke={t.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></Svg>
    <Text style={{fontSize:10,fontWeight:'600',color:t.text}}>Verlauf</Text>
  </TouchableOpacity>
  <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(0,0,0,0.05)',borderRadius:20,paddingHorizontal:10,paddingVertical:5}} onPress={handleDayReport}>
    <Text style={{fontSize:10,fontWeight:'600',color:t.text}}>📊 Report</Text>
  </TouchableOpacity>
</View>
            </View>
            <View style={{height:4,backgroundColor:'rgba(0,0,0,0.08)',borderRadius:2,overflow:'hidden'}}>
              <View style={{width:`${nutScore}%` as any,height:4,backgroundColor:nutCol,borderRadius:2}}/>
            </View>
          </View>

          <View style={{height:0.5,backgroundColor:t.border,marginBottom:20}}/>

          {/* KALORIENRING */}
          <View style={{alignItems:'center',marginBottom:16}}>
            <View style={{position:'relative',width:210,height:210,marginBottom:14}}>
              <Svg width={210} height={210} viewBox="0 0 210 210">
                <Circle cx={105} cy={105} r={88} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={16}/>
                {totals.kcal > 0 && (
                  <Circle cx={105} cy={105} r={88} fill="none" stroke={t.greenDark} strokeWidth={16}
                    strokeDasharray={`${Math.min(0.98, adjustedGoal > 0 ? totals.kcal/adjustedGoal : 0) * 2 * Math.PI * 88} ${2 * Math.PI * 88}`}
                    strokeDashoffset={2 * Math.PI * 88 * 0.25} strokeLinecap="butt"
                    transform="rotate(-90 105 105)"/>
                )}
              </Svg>
              <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,alignItems:'center',justifyContent:'center',gap:3}}>
                <Text style={{fontSize:44,fontWeight:'800',color:t.text,letterSpacing:-2.5,lineHeight:44}}>{Math.round(totals.kcal)||'—'}</Text>
                <Text style={{fontSize:10,color:t.textSec,fontWeight:'500'}}>von {adjustedGoal} kcal</Text>
                {dayLog.burned > 0 && (
                  <View style={{backgroundColor:'rgba(0,0,0,0.06)',borderRadius:20,paddingHorizontal:10,paddingVertical:3,marginTop:2}}>
                    <Text style={{fontSize:9,fontWeight:'700',color:t.textSec}}>+{dayLog.burned} verbrannt</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{flexDirection:'row',width:'100%'}}>
              <View style={{flex:1,alignItems:'center',borderRightWidth:0.5,borderRightColor:t.border}}>
                <Text style={{fontSize:17,fontWeight:'800',color:t.greenDark,letterSpacing:-0.5,marginBottom:2}}>{Math.round(Math.max(0,kcalLeft))}</Text>
                <Text style={{fontSize:8,color:t.textSec,textTransform:'uppercase',letterSpacing:0.8}}>Übrig</Text>
              </View>
              <View style={{flex:1,alignItems:'center',borderRightWidth:0.5,borderRightColor:t.border}}>
                <Text style={{fontSize:17,fontWeight:'800',color:t.text,letterSpacing:-0.5,marginBottom:2}}>{dayLog.goal.kcal}</Text>
                <Text style={{fontSize:8,color:t.textSec,textTransform:'uppercase',letterSpacing:0.8}}>Basis-Ziel</Text>
              </View>
              <View style={{flex:1,alignItems:'center'}}>
                <Text style={{fontSize:17,fontWeight:'800',color:dayLog.burned>0?t.red:t.textTer,letterSpacing:-0.5,marginBottom:2}}>{dayLog.burned||'—'}</Text>
                <Text style={{fontSize:8,color:t.textSec,textTransform:'uppercase',letterSpacing:0.8}}>Verbrannt</Text>
              </View>
            </View>
          </View>

          {/* MAKROS */}
          <View style={{flexDirection:'row',marginBottom:20}}>
            {[
              {l:'Protein',v:Math.round(totals.protein),g:dayLog.goal.protein,c:t.blue},
              {l:'Carbs',v:Math.round(totals.carbs),g:dayLog.goal.carbs,c:t.carbs},
              {l:'Fett',v:Math.round(totals.fat),g:dayLog.goal.fat,c:t.fat},
            ].map((m,i)=>(
              <View key={m.l} style={{flex:1,borderRightWidth:i<2?0.5:0,borderRightColor:t.border,paddingRight:i<2?12:0,paddingLeft:i>0?12:0}}>
                <Text style={{fontSize:14,fontWeight:'800',color:m.c,marginBottom:2}}>{m.v}g</Text>
                <View style={{height:2,backgroundColor:`${m.c}20`,borderRadius:1,overflow:'hidden',marginBottom:3}}>
                  <View style={{width:`${Math.min(100,(m.v/m.g)*100)}%` as any,height:2,backgroundColor:m.c,borderRadius:1}}/>
                </View>
                <Text style={{fontSize:8,color:t.textSec,textTransform:'uppercase',letterSpacing:0.5}}>{m.l}</Text>
              </View>
            ))}
          </View>

          <View style={{height:0.5,backgroundColor:t.border,marginBottom:16}}/>

          {/* MACRO SCORE */}
          <TouchableOpacity style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:4,marginBottom:16}} onPress={()=>setShowMacroDetail(true)} activeOpacity={0.7}>
            <View>
              <Text style={{fontSize:13,fontWeight:'700',color:t.text,marginBottom:3}}>Makros</Text>
              <View style={{flexDirection:'row',gap:8}}>
                {[{l:'P',c:t.blue},{l:'C',c:t.carbs},{l:'F',c:t.fat}].map(m=>(
                  <View key={m.l} style={{flexDirection:'row',alignItems:'center',gap:3}}>
                    <View style={{width:6,height:6,borderRadius:3,backgroundColor:m.c}}/>
                    <Text style={{fontSize:9,color:t.textSec}}>{m.l}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
              <View style={{alignItems:'flex-end'}}>
                <Text style={{fontSize:22,fontWeight:'800',color:macCol,letterSpacing:-1,lineHeight:22}}>{macScore||'—'}</Text>
                <Text style={{fontSize:8,color:t.textSec}}>/100</Text>
              </View>
              <View style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(0,0,0,0.05)',borderRadius:20,paddingHorizontal:10,paddingVertical:6}}>
                <Text style={{fontSize:10,fontWeight:'600',color:t.text}}>Details</Text>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke={t.text} strokeWidth={2.5} strokeLinecap="round"/></Svg>
              </View>
            </View>
          </TouchableOpacity>

          <View style={{height:0.5,backgroundColor:t.border,marginBottom:16}}/>

          {/* MICRO SCORE */}
          <TouchableOpacity style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:4,marginBottom:20}} onPress={()=>setShowMicroDetail(true)} activeOpacity={0.7}>
            <View>
              <Text style={{fontSize:13,fontWeight:'700',color:t.text,marginBottom:3}}>Mikros</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
                {microDots.map((c,i)=><View key={i} style={{width:5,height:5,borderRadius:3,backgroundColor:c}}/>)}
                <Text style={{fontSize:9,color:t.textSec,marginLeft:4}}>{microOk} von {microKeys.length} ok</Text>
              </View>
            </View>
            <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
              <View style={{alignItems:'flex-end'}}>
                <Text style={{fontSize:22,fontWeight:'800',color:micCol,letterSpacing:-1,lineHeight:22}}>{micScore||'—'}</Text>
                <Text style={{fontSize:8,color:t.textSec}}>/100</Text>
              </View>
              <View style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(0,0,0,0.05)',borderRadius:20,paddingHorizontal:10,paddingVertical:6}}>
                <Text style={{fontSize:10,fontWeight:'600',color:t.text}}>Details</Text>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke={t.text} strokeWidth={2.5} strokeLinecap="round"/></Svg>
              </View>
            </View>
          </TouchableOpacity>

          <View style={{height:0.5,backgroundColor:t.border,marginBottom:16}}/>

          {/* MAHLZEITEN */}
          <Text style={[s.ey,{marginBottom:10}]}>Mahlzeiten</Text>
          {MEAL_SLOTS.map((meal,i)=>{
            const entries = mealGroups[meal];
            const tot = sumMacros(entries);
            const has = entries.length > 0;
            return (
              <TouchableOpacity key={meal} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13,borderBottomWidth:i<MEAL_SLOTS.length-1?0.5:0,borderBottomColor:t.border}} onPress={()=>setActiveMeal(meal)} activeOpacity={0.7}>
                <View style={{width:3,height:40,borderRadius:2,backgroundColor:has?t.greenDark:'rgba(0,0,0,0.08)',flexShrink:0}}/>
                <View style={{flex:1,minWidth:0}}>
                  <Text style={{fontSize:14,fontWeight:'700',color:has?t.text:t.textSec,marginBottom:2}}>{meal}</Text>
                  <Text style={{fontSize:9,color:t.textTer}}>{has?`${entries.length} Eintr${entries.length===1?'ag':'äge'}`:'Noch nichts'}</Text>
                </View>
                <Text style={{fontSize:14,fontWeight:'800',color:has?t.text:t.textTer,marginRight:8}}>
                  {has?Math.round(tot.kcal):'—'}{has&&<Text style={{fontSize:9,fontWeight:'500',color:t.textSec}}> kcal</Text>}
                </Text>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke={has?t.textSec:t.textTer} strokeWidth={2.2} strokeLinecap="round"/></Svg>
              </TouchableOpacity>
            );
          })}

          <View style={{height:100}}/>
        </Animated.View>
      </ScrollView>

      {/* AI Loading Overlay */}
      {aiLoading && (
        <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.6)',alignItems:'center',justifyContent:'center'}}>
          <View style={{backgroundColor:t.card,borderRadius:20,padding:28,alignItems:'center',gap:14,minWidth:200}}>
            <ActivityIndicator size="large" color={t.greenDark}/>
            <Text style={{fontSize:15,fontWeight:'700',color:t.text}}>KI analysiert Mahlzeit…</Text>
            <Text style={{fontSize:12,color:t.textSec,textAlign:'center'}}>Das dauert ein paar Sekunden</Text>
          </View>
        </View>
      )}

      {/* ADD SHEET */}
      <Modal visible={showAddSheet} transparent animationType="slide">
        <AddOptionsSheet loading={aiLoading}
          onBarcode={()=>{setShowAddSheet(false);setShowScanner(true);}}
          onCamera={()=>handlePhoto(true)}
          onGallery={()=>handlePhoto(false)}
          onManual={()=>{setShowAddSheet(false);setPrefill(undefined);setShowAddModal(true);}}
          onClose={()=>setShowAddSheet(false)}
        />
      </Modal>

      {/* ADD MODAL */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.3)'}}>
          <AddEntryModal prefill={prefill} onSave={addEntry} onClose={()=>{setShowAddModal(false);setPrefill(undefined);}}/>
        </View>
      </Modal>

      {/* GOALS */}
      <Modal visible={showGoals} transparent animationType="slide">
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.3)'}}>
          <GoalsModal goals={dayLog.goal} onSave={saveGoals} onClose={()=>setShowGoals(false)}/>
        </View>
      </Modal>

      {/* MEAL DETAIL */}
      {activeMeal && (
        <MealDetailModal
          meal={activeMeal} entries={mealGroups[activeMeal]}
          onDelete={deleteEntry}
          onAdd={()=>{setActiveMeal(null);setShowAddSheet(true);}}
          onClose={()=>setActiveMeal(null)}
        />
      )}

      {showMacroDetail && <MacroDetailModal entries={dayLog.entries} goal={dayLog.goal} onClose={()=>setShowMacroDetail(false)}/>}
      {showMicroDetail && <MicroDetailModal entries={dayLog.entries} onClose={()=>setShowMicroDetail(false)}/>}
        <Modal visible={showReport} transparent animationType="slide">
  <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'}}>
    <View style={{backgroundColor:t.bg,borderTopLeftRadius:28,borderTopRightRadius:28,padding:24,maxHeight:'80%'}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <Text style={{fontSize:20,fontWeight:'800',color:t.text}}>📊 Tagesreport</Text>
        <TouchableOpacity onPress={()=>setShowReport(false)}
          style={{paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:'rgba(0,0,0,0.06)'}}>
          <Text style={{color:t.textSec,fontWeight:'600'}}>Schliessen</Text>
        </TouchableOpacity>
      </View>
      {reportLoading ? (
        <View style={{alignItems:'center',paddingVertical:40,gap:14}}>
          <ActivityIndicator size="large" color={t.greenDark}/>
          <Text style={{color:t.textSec,fontSize:14}}>KI analysiert deinen Tag…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={{fontSize:15,color:t.text,lineHeight:24}}>{reportText}</Text>
          <View style={{height:40}}/>
        </ScrollView>
      )}
    </View>
  </View>
</Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:     { flex:1, backgroundColor:t.bg, alignItems:'center', justifyContent:'center', padding:24 },
  ey:         { fontSize:9, fontWeight:'700', letterSpacing:2, textTransform:'uppercase', color:t.textSec },
  navBtn:     { width:34, height:34, borderRadius:17, backgroundColor:'rgba(0,0,0,0.06)', alignItems:'center', justifyContent:'center' },
  lbl:        { fontSize:10, fontWeight:'700', color:t.textSec, textTransform:'uppercase', letterSpacing:1.2, marginBottom:6 },
  inp:        { backgroundColor:'rgba(0,0,0,0.05)', borderRadius:12, padding:14, color:t.text, fontSize:15, borderWidth:0.5, borderColor:t.border },
  darkBtn:    { backgroundColor:t.text, borderRadius:14, padding:16, alignItems:'center' },
  darkBtnTxt: { color:'#fff', fontSize:15, fontWeight:'700' },
});