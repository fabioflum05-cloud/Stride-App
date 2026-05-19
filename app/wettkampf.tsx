// ─────────────────────────────────────────────────────────────────────────────
// JUDO WETTKAMPF SCREEN  (als Erweiterung von judo-tracking.tsx)
// Kopiere diesen Block in judo-tracking.tsx und integriere den Aufruf
// im bestehenden Wettkampf-Tab via:  setActiveModal('wettkampf')
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// ─── Colours (lokal) ─────────────────────────────────────────────────────────
const C = {
  bg:        '#1A1614',
  card:      '#231F1C',
  cardAlt:   '#2A2522',
  orange:    '#E8572A',
  blue:      '#4A9EFF',
  green:     '#34C759',
  red:       '#FF3B30',
  yellow:    '#FFD60A',
  text:      '#F5F0EE',
  textMuted: '#8A8078',
  textDim:   '#5A5450',
  border:    '#3A3430',
};

const STORAGE_KEY = 'stride_judo_wettkampf_sessions';

// ─── Types ───────────────────────────────────────────────────────────────────
type WettkampfArt = 'Regional' | 'National' | 'International' | 'Vereinsturnier' | 'Sonstiges';
type AgeCategory  = 'U10' | 'U12' | 'U14' | 'U16' | 'U18' | 'U21' | 'Senior' | 'Master';
type WeightClass  = '-46' | '-50' | '-55' | '-60' | '-66' | '-73' | '-81' | '-90' | '-100' | '+100';
type Entscheidung = 'Ippon' | 'Waza-ari' | 'Yuko' | 'Shido (Gegner)' | 'Disqualifikation' | 'Golden Score' | 'Kampfrichterentscheid';
type KampfResult  = 'Sieg' | 'Niederlage' | 'Unentschieden';
type Runde        = 'Vorrunde' | 'Achtelfinale' | 'Viertelfinale' | 'Halbfinale' | 'Finale' | 'Trostrunde' | 'Hoffnungsrunde' | 'Einzel';

interface Kampf {
  id:          string;
  runde:       Runde;
  gegner:      string;
  verein:      string;
  result:      KampfResult;
  entscheidung: Entscheidung;
  dauer:       number;           // Sekunden
  technik:     string;           // eigene Technik oder Gegner-Technik bei Niederlage
  gutLief:     string;
  schlechtLief: string;
  notizen:     string;
}

interface WettkampfSession {
  id:            string;
  date:          string;
  name:          string;           // Turnierbezeichnung
  ort:           string;
  art:           WettkampfArt;
  ageCategory:   AgeCategory;
  weightClass:   WeightClass;
  kaempfe:       Kampf[];
  placement:     string;           // "1.", "2.", "3.", "5.", "DNP", …
  fazit:         string;
  stimmung:      number;           // 1–5
  koerperGefuehl: number;          // 1–5
}

// ─── Konstanten ──────────────────────────────────────────────────────────────
const WETTKAMPF_ARTEN: WettkampfArt[]  = ['Regional','National','International','Vereinsturnier','Sonstiges'];
const AGE_CATEGORIES: AgeCategory[]   = ['U10','U12','U14','U16','U18','U21','Senior','Master'];
const WEIGHT_CLASSES: WeightClass[]   = ['-46','-50','-55','-60','-66','-73','-81','-90','-100','+100'];
const ENTSCHEIDUNGEN: Entscheidung[]  = ['Ippon','Waza-ari','Yuko','Shido (Gegner)','Disqualifikation','Golden Score','Kampfrichterentscheid'];
const RUNDEN: Runde[]                 = ['Vorrunde','Achtelfinale','Viertelfinale','Halbfinale','Finale','Trostrunde','Hoffnungsrunde','Einzel'];

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatDauer(sek: number): string {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Kampf Editor Modal ───────────────────────────────────────────────────────
interface KampfEditorProps {
  visible:  boolean;
  kampf:    Partial<Kampf> | null;
  index:    number;
  onSave:   (k: Kampf) => void;
  onClose:  () => void;
}

const KampfEditor: React.FC<KampfEditorProps> = ({ visible, kampf, index, onSave, onClose }) => {
  const empty: Kampf = {
    id:           uuid(),
    runde:        'Vorrunde',
    gegner:       '',
    verein:       '',
    result:       'Sieg',
    entscheidung: 'Ippon',
    dauer:        180,
    technik:      '',
    gutLief:      '',
    schlechtLief: '',
    notizen:      '',
  };

  const [local, setLocal] = useState<Kampf>({ ...empty, ...kampf } as Kampf);

  React.useEffect(() => {
    if (visible) setLocal({ ...empty, ...kampf } as Kampf);
  }, [visible, kampf]);

  const set = <K extends keyof Kampf>(key: K, val: Kampf[K]) =>
    setLocal(p => ({ ...p, [key]: val }));

  const resultColors: Record<KampfResult, string> = {
    Sieg:         C.green,
    Niederlage:   C.red,
    Unentschieden: C.yellow,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={ms.overlay}>
          <ScrollView style={ms.sheet} contentContainerStyle={{ paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={ms.title}>Kampf {index + 1}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ color: C.textMuted, fontSize: 15 }}>Abbrechen</Text>
              </TouchableOpacity>
            </View>

            {/* Runde */}
            <Text style={ms.label}>Runde</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                {RUNDEN.map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => set('runde', r)}
                    style={[ms.chip, local.runde === r && { backgroundColor: C.orange, borderColor: C.orange }]}
                  >
                    <Text style={{ color: local.runde === r ? C.text : C.textMuted, fontSize: 13 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Gegner */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={ms.label}>Gegner Name</Text>
                <TextInput
                  style={ms.input}
                  value={local.gegner}
                  onChangeText={t => set('gegner', t)}
                  placeholder="Name (optional)"
                  placeholderTextColor={C.textDim}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ms.label}>Verein / Land</Text>
                <TextInput
                  style={ms.input}
                  value={local.verein}
                  onChangeText={t => set('verein', t)}
                  placeholder="z. B. JC Nürnberg"
                  placeholderTextColor={C.textDim}
                />
              </View>
            </View>

            {/* Ergebnis */}
            <Text style={ms.label}>Ergebnis</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {(['Sieg', 'Niederlage', 'Unentschieden'] as KampfResult[]).map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => set('result', r)}
                  style={[ms.resultBtn, local.result === r && { backgroundColor: resultColors[r] + '30', borderColor: resultColors[r] }]}
                >
                  <Text style={{ color: local.result === r ? resultColors[r] : C.textMuted, fontWeight: '600', fontSize: 14 }}>
                    {r === 'Sieg' ? '🏆 Sieg' : r === 'Niederlage' ? '❌ Niederlage' : '🤝 Unent.'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Entscheidung */}
            <Text style={ms.label}>{local.result === 'Sieg' ? 'Eigene Technik / Entscheidung' : 'Gegner-Technik / Entscheidung'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                {ENTSCHEIDUNGEN.map(e => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => set('entscheidung', e)}
                    style={[ms.chip, local.entscheidung === e && {
                      backgroundColor: local.result === 'Sieg' ? C.green + '30' : C.red + '30',
                      borderColor:     local.result === 'Sieg' ? C.green : C.red,
                    }]}
                  >
                    <Text style={{
                      color: local.entscheidung === e ? (local.result === 'Sieg' ? C.green : C.red) : C.textMuted,
                      fontSize: 13,
                    }}>
                      {e}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Technik (Wurfname etc.) */}
            <Text style={ms.label}>{local.result === 'Sieg' ? 'Verwendete Technik' : 'Technik des Gegners'}</Text>
            <TextInput
              style={[ms.input, { marginBottom: 14 }]}
              value={local.technik}
              onChangeText={t => set('technik', t)}
              placeholder="z. B. Uchi-mata, O-goshi, Juji-gatame…"
              placeholderTextColor={C.textDim}
            />

            {/* Kampfdauer */}
            <Text style={ms.label}>Kampfdauer: {formatDauer(local.dauer)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {[30, 60, 90, 120, 150, 180, 210, 240, 300].map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => set('dauer', s)}
                  style={[ms.chip, local.dauer === s && { backgroundColor: C.blue + '30', borderColor: C.blue }]}
                >
                  <Text style={{ color: local.dauer === s ? C.blue : C.textMuted, fontSize: 12 }}>{formatDauer(s)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Was gut lief */}
            <Text style={ms.label}>✅ Was gut lief</Text>
            <TextInput
              style={[ms.input, ms.multiline, { marginBottom: 12 }]}
              value={local.gutLief}
              onChangeText={t => set('gutLief', t)}
              placeholder="Gute Griffkämpfe, Newaza-Situation, Timing…"
              placeholderTextColor={C.textDim}
              multiline
            />

            {/* Was schlecht lief */}
            <Text style={ms.label}>❌ Was verbessert werden muss</Text>
            <TextInput
              style={[ms.input, ms.multiline, { marginBottom: 12 }]}
              value={local.schlechtLief}
              onChangeText={t => set('schlechtLief', t)}
              placeholder="Reaktion auf Griff, Kumi-kata, Kondition…"
              placeholderTextColor={C.textDim}
              multiline
            />

            {/* Notizen */}
            <Text style={ms.label}>Weitere Notizen</Text>
            <TextInput
              style={[ms.input, ms.multiline, { marginBottom: 24 }]}
              value={local.notizen}
              onChangeText={t => set('notizen', t)}
              placeholder="Taktik, Stimmung, besondere Momente…"
              placeholderTextColor={C.textDim}
              multiline
            />

            <TouchableOpacity
              style={[ms.saveBtn, { backgroundColor: local.result === 'Sieg' ? C.green : local.result === 'Niederlage' ? C.red : C.yellow }]}
              onPress={() => onSave(local)}
            >
              <Text style={{ color: C.bg, fontWeight: '700', fontSize: 16 }}>Kampf speichern</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Haupt-Wettkampf-Modal ───────────────────────────────────────────────────
interface WettkampfModalProps {
  visible:  boolean;
  existing?: WettkampfSession | null;
  onSave:   (s: WettkampfSession) => void;
  onClose:  () => void;
}

const WettkampfModal: React.FC<WettkampfModalProps> = ({ visible, existing, onSave, onClose }) => {
  const today = new Date().toISOString().slice(0, 10);
  const emptySession: WettkampfSession = {
    id:             uuid(),
    date:           today,
    name:           '',
    ort:            '',
    art:            'Regional',
    ageCategory:    'Senior',
    weightClass:    '-66',
    kaempfe:        [],
    placement:      '',
    fazit:          '',
    stimmung:       3,
    koerperGefuehl: 3,
  };

  const [session,       setSession]      = useState<WettkampfSession>(existing ?? emptySession);
  const [activeKampf,   setActiveKampf]  = useState<{ kampf: Partial<Kampf>; index: number } | null>(null);
  const [page,          setPage]         = useState<'meta' | 'kaempfe' | 'fazit'>('meta');

  React.useEffect(() => {
    if (visible) {
      setSession(existing ?? emptySession);
      setPage('meta');
    }
  }, [visible, existing]);

  const setS = <K extends keyof WettkampfSession>(key: K, val: WettkampfSession[K]) =>
    setSession(p => ({ ...p, [key]: val }));

  const addKampf = () => setActiveKampf({ kampf: {}, index: session.kaempfe.length });
  const editKampf = (k: Kampf, i: number) => setActiveKampf({ kampf: k, index: i });

  const saveKampf = (k: Kampf) => {
    setSession(p => {
      const list = [...p.kaempfe];
      const idx  = activeKampf?.index ?? list.length;
      if (idx < list.length) list[idx] = k; else list.push(k);
      return { ...p, kaempfe: list };
    });
    setActiveKampf(null);
  };

  const deleteKampf = (i: number) => {
    Alert.alert('Kampf löschen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () =>
        setSession(p => ({ ...p, kaempfe: p.kaempfe.filter((_, idx) => idx !== i) }))
      },
    ]);
  };

  const wins  = session.kaempfe.filter(k => k.result === 'Sieg').length;
  const total = session.kaempfe.length;

  const moodEmojis = ['😞','😕','😐','🙂','😄'];

  const canSave = session.name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.fullSheet}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: C.textMuted, fontSize: 15 }}>Schließen</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>Wettkampf</Text>
            <TouchableOpacity
              onPress={() => canSave && onSave(session)}
              disabled={!canSave}
            >
              <Text style={{ color: canSave ? C.orange : C.textDim, fontSize: 15, fontWeight: '600' }}>Speichern</Text>
            </TouchableOpacity>
          </View>

          {/* Page tabs */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 8, marginBottom: 4 }}>
            {(['meta', 'kaempfe', 'fazit'] as const).map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPage(p)}
                style={[ms.pageTab, page === p && { backgroundColor: C.orange }]}
              >
                <Text style={{ color: page === p ? C.text : C.textMuted, fontSize: 13, fontWeight: '600' }}>
                  {p === 'meta' ? 'Info' : p === 'kaempfe' ? `Kämpfe (${total})` : 'Fazit'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

              {/* ── PAGE: META ── */}
              {page === 'meta' && (
                <View>
                  {/* Turnierbezeichnung */}
                  <Text style={ms.label}>Turnierbezeichnung *</Text>
                  <TextInput
                    style={ms.input}
                    value={session.name}
                    onChangeText={t => setS('name', t)}
                    placeholder="z. B. Offene Stadtmeisterschaft München"
                    placeholderTextColor={C.textDim}
                  />

                  {/* Ort + Datum */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <View style={{ flex: 2 }}>
                      <Text style={ms.label}>Ort / Halle</Text>
                      <TextInput
                        style={ms.input}
                        value={session.ort}
                        onChangeText={t => setS('ort', t)}
                        placeholder="Stadt, Sporthalle…"
                        placeholderTextColor={C.textDim}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ms.label}>Datum</Text>
                      <TextInput
                        style={ms.input}
                        value={session.date}
                        onChangeText={t => setS('date', t)}
                        placeholder="JJJJ-MM-TT"
                        placeholderTextColor={C.textDim}
                      />
                    </View>
                  </View>

                  {/* Art */}
                  <Text style={[ms.label, { marginTop: 16 }]}>Wettkampfart</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                      {WETTKAMPF_ARTEN.map(a => (
                        <TouchableOpacity
                          key={a}
                          onPress={() => setS('art', a)}
                          style={[ms.chip, session.art === a && { backgroundColor: C.orange + '30', borderColor: C.orange }]}
                        >
                          <Text style={{ color: session.art === a ? C.orange : C.textMuted, fontSize: 13 }}>{a}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Alterskategorie */}
                  <Text style={[ms.label, { marginTop: 16 }]}>Alterskategorie</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                      {AGE_CATEGORIES.map(a => (
                        <TouchableOpacity
                          key={a}
                          onPress={() => setS('ageCategory', a)}
                          style={[ms.chip, session.ageCategory === a && { backgroundColor: C.blue + '30', borderColor: C.blue }]}
                        >
                          <Text style={{ color: session.ageCategory === a ? C.blue : C.textMuted, fontSize: 13 }}>{a}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Gewichtsklasse */}
                  <Text style={[ms.label, { marginTop: 16 }]}>Gewichtsklasse</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                      {WEIGHT_CLASSES.map(w => (
                        <TouchableOpacity
                          key={w}
                          onPress={() => setS('weightClass', w)}
                          style={[ms.chip, session.weightClass === w && { backgroundColor: C.orange + '30', borderColor: C.orange }]}
                        >
                          <Text style={{ color: session.weightClass === w ? C.orange : C.textMuted, fontWeight: '600', fontSize: 14 }}>
                            {w}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Placement */}
                  <Text style={[ms.label, { marginTop: 16 }]}>Platzierung</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {['1.','2.','3.','5.','7.','DNP','DNF'].map(pl => (
                      <TouchableOpacity
                        key={pl}
                        onPress={() => setS('placement', pl)}
                        style={[ms.chip, session.placement === pl && {
                          backgroundColor: pl === '1.' ? C.yellow + '30' : pl === '2.' ? '#C0C0C030' : C.orange + '30',
                          borderColor:     pl === '1.' ? C.yellow  : pl === '2.' ? '#C0C0C0'  : C.orange,
                        }]}
                      >
                        <Text style={{
                          color: session.placement === pl ? (pl === '1.' ? C.yellow : pl === '2.' ? '#C0C0C0' : C.orange) : C.textMuted,
                          fontWeight: '700', fontSize: 14,
                        }}>
                          {pl === '1.' ? '🥇' : pl === '2.' ? '🥈' : pl === '3.' ? '🥉' : ''} {pl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[ms.input, { marginTop: 8 }]}
                    value={!['1.','2.','3.','5.','7.','DNP','DNF'].includes(session.placement) ? session.placement : ''}
                    onChangeText={t => setS('placement', t)}
                    placeholder="Andere Platzierung eingeben…"
                    placeholderTextColor={C.textDim}
                  />
                </View>
              )}

              {/* ── PAGE: KÄMPFE ── */}
              {page === 'kaempfe' && (
                <View>
                  {/* Summary bar */}
                  {total > 0 && (
                    <View style={ms.summaryBar}>
                      <SummaryPill label="Kämpfe" value={`${total}`}       color={C.blue} />
                      <SummaryPill label="Siege"  value={`${wins}`}        color={C.green} />
                      <SummaryPill label="Nied."  value={`${total - wins}`} color={C.red} />
                      <SummaryPill label="Quote"  value={total > 0 ? `${Math.round((wins/total)*100)}%` : '—'} color={wins > total/2 ? C.green : C.red} />
                    </View>
                  )}

                  {session.kaempfe.map((k, i) => (
                    <KampfCard
                      key={k.id}
                      kampf={k}
                      index={i}
                      onEdit={() => editKampf(k, i)}
                      onDelete={() => deleteKampf(i)}
                    />
                  ))}

                  <TouchableOpacity style={ms.addKampfBtn} onPress={addKampf}>
                    <Text style={{ color: C.orange, fontSize: 22, marginRight: 8 }}>+</Text>
                    <Text style={{ color: C.orange, fontWeight: '600', fontSize: 15 }}>Kampf hinzufügen</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── PAGE: FAZIT ── */}
              {page === 'fazit' && (
                <View>
                  {/* Stimmung */}
                  <Text style={ms.label}>Stimmung / Mentaler Zustand</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    {[1,2,3,4,5].map(v => (
                      <TouchableOpacity
                        key={v}
                        onPress={() => setS('stimmung', v)}
                        style={[ms.emojiBtn, session.stimmung === v && { borderColor: C.blue, backgroundColor: C.blue + '20' }]}
                      >
                        <Text style={{ fontSize: 24 }}>{moodEmojis[v-1]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Körpergefühl */}
                  <Text style={ms.label}>Körpergefühl / Fitness</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    {[1,2,3,4,5].map(v => (
                      <TouchableOpacity
                        key={v}
                        onPress={() => setS('koerperGefuehl', v)}
                        style={[ms.emojiBtn, session.koerperGefuehl === v && { borderColor: C.green, backgroundColor: C.green + '20' }]}
                      >
                        <Text style={{ fontSize: 24 }}>{['💀','😩','😐','💪','🔥'][v-1]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Gesamtfazit */}
                  <Text style={ms.label}>Gesamtfazit</Text>
                  <TextInput
                    style={[ms.input, { minHeight: 160, textAlignVertical: 'top', lineHeight: 22, marginBottom: 12 }]}
                    value={session.fazit}
                    onChangeText={t => setS('fazit', t)}
                    multiline
                    placeholder={`Was war das wichtigste Lernfeld heute?\nWas habe ich taktisch gut gemacht?\nWas muss bis zum nächsten Wettkampf verbessert werden?\nWie fühlt sich das Ergebnis an?`}
                    placeholderTextColor={C.textDim}
                  />

                  {/* Quick Stats recap */}
                  {total > 0 && (
                    <View style={ms.recapCard}>
                      <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 10 }}>ZUSAMMENFASSUNG</Text>
                      <Text style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>
                        {session.name}{session.art ? ` (${session.art})` : ''}{'\n'}
                        {session.ageCategory} · {session.weightClass} kg{'\n'}
                        {wins}/{total} Siege
                        {session.placement ? ` · Platz ${session.placement}` : ''}{'\n'}
                        {session.ort ? session.ort + ' · ' : ''}{session.date}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>

      {/* Kampf-Editor */}
      <KampfEditor
        visible={activeKampf !== null}
        kampf={activeKampf?.kampf ?? null}
        index={activeKampf?.index ?? 0}
        onSave={saveKampf}
        onClose={() => setActiveKampf(null)}
      />
    </Modal>
  );
};

// ─── Kampf Card (in der Liste) ────────────────────────────────────────────────
const KampfCard: React.FC<{
  kampf:    Kampf;
  index:    number;
  onEdit:   () => void;
  onDelete: () => void;
}> = ({ kampf, index, onEdit, onDelete }) => {
  const resultColor = kampf.result === 'Sieg' ? C.green : kampf.result === 'Niederlage' ? C.red : C.yellow;
  const resultIcon  = kampf.result === 'Sieg' ? '🏆' : kampf.result === 'Niederlage' ? '❌' : '🤝';

  return (
    <View style={[ms.kampfCard, { borderLeftColor: resultColor }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16 }}>{resultIcon}</Text>
            <Text style={{ color: resultColor, fontWeight: '700', fontSize: 15 }}>
              {kampf.runde}
            </Text>
            <Text style={{ color: C.textDim, fontSize: 12 }}>· {formatDauer(kampf.dauer)}</Text>
          </View>
          {kampf.gegner ? (
            <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
              vs. {kampf.gegner}{kampf.verein ? ` (${kampf.verein})` : ''}
            </Text>
          ) : null}
          <Text style={{ color: C.text, fontSize: 13, marginTop: 4 }}>
            {kampf.entscheidung}{kampf.technik ? ` · ${kampf.technik}` : ''}
          </Text>
          {kampf.gutLief ? (
            <Text style={{ color: C.green, fontSize: 12, marginTop: 4 }} numberOfLines={1}>✅ {kampf.gutLief}</Text>
          ) : null}
          {kampf.schlechtLief ? (
            <Text style={{ color: C.red, fontSize: 12, marginTop: 2 }} numberOfLines={1}>❌ {kampf.schlechtLief}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginLeft: 8 }}>
          <TouchableOpacity onPress={onEdit}>
            <Text style={{ color: C.blue, fontSize: 13 }}>Bearbeiten</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Text style={{ color: C.red, fontSize: 13 }}>Löschen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Summary pill
const SummaryPill: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <View style={{ flex: 1, alignItems: 'center', backgroundColor: color + '18', borderRadius: 10, paddingVertical: 10 }}>
    <Text style={{ color, fontSize: 18, fontWeight: '700' }}>{value}</Text>
    <Text style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{label}</Text>
  </View>
);

// ─── Session History List (für judo-tracking.tsx Wettkampf-Tab) ──────────────
export const WettkampfHistoryItem: React.FC<{
  session:  WettkampfSession;
  onPress:  () => void;
  onDelete: () => void;
}> = ({ session, onPress, onDelete }) => {
  const wins  = session.kaempfe.filter(k => k.result === 'Sieg').length;
  const total = session.kaempfe.length;
  const win   = total > 0 && wins / total >= 0.5;

  return (
    <TouchableOpacity style={ms.historyItem} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{session.name}</Text>
          <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 3 }}>
            {session.art} · {session.ageCategory} · {session.weightClass} kg
          </Text>
          <Text style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>
            {session.ort ? `${session.ort} · ` : ''}{session.date}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {session.placement ? (
            <Text style={{ color: C.yellow, fontSize: 14, fontWeight: '700' }}>Platz {session.placement}</Text>
          ) : null}
          {total > 0 ? (
            <Text style={{ color: win ? C.green : C.red, fontSize: 13, fontWeight: '600' }}>
              {wins}/{total} Siege
            </Text>
          ) : (
            <Text style={{ color: C.textDim, fontSize: 12 }}>Keine Kämpfe</Text>
          )}
          <TouchableOpacity onPress={onDelete}>
            <Text style={{ color: C.textDim, fontSize: 12 }}>Löschen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main export: hook for session management ─────────────────────────────────
// Usage in judo-tracking.tsx:
//   const { sessions, showModal, setShowModal, selectedSession,
//           openNew, openEdit, saveSession, deleteSession } = useWettkampfSessions();

export function useWettkampfSessions() {
  const [sessions, setSessions]             = useState<WettkampfSession[]>([]);
  const [showModal, setShowModal]           = useState(false);
  const [selectedSession, setSelectedSession] = useState<WettkampfSession | null>(null);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setSessions(JSON.parse(raw));
    } catch {}
  }, []);

  React.useEffect(() => { load(); }, []);

  const persist = async (updated: WettkampfSession[]) => {
    setSessions(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const openNew  = ()                          => { setSelectedSession(null); setShowModal(true); };
  const openEdit = (s: WettkampfSession)       => { setSelectedSession(s);   setShowModal(true); };

  const saveSession = async (s: WettkampfSession) => {
    const updated = sessions.some(x => x.id === s.id)
      ? sessions.map(x => x.id === s.id ? s : x)
      : [s, ...sessions];
    await persist(updated);
    setShowModal(false);
  };

  const deleteSession = async (id: string) => {
    Alert.alert('Wettkampf löschen?', 'Alle Kämpfe und Notizen werden entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        await persist(sessions.filter(s => s.id !== id));
      }},
    ]);
  };

  return { sessions, showModal, setShowModal, selectedSession, openNew, openEdit, saveSession, deleteSession };
}

// Re-export modal for direct use
export { WettkampfModal };

// ─── Styles ───────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  fullSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    marginTop: 60,
  },
  title: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: C.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cardAlt,
  },
  resultBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    backgroundColor: C.cardAlt,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  pageTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: C.card,
  },
  kampfCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  historyItem: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  summaryBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addKampfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.orange,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  emojiBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cardAlt,
  },
  recapCard: {
    backgroundColor: C.cardAlt,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
});