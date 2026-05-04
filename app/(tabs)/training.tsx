import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState, AppStateStatus, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { theme } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────
type Set = { reps: string; weight: string; };
type Exercise = { id: string; name: string; muscleGroup: string; sets: Set[]; };
type Workout = {
  id: string; date: string; name: string; exercises: Exercise[];
  duration: number; intensity: number; type: 'gym' | 'run' | 'manual' | 'judo';
  notes?: string;
};
type RunData = {
  id: string; distance: number; duration: number; pace: string;
  calories: number; heartRate: number; date: string;
};
type JudoSession = {
  id: string; date: string; totalDuration: number; warmupDuration: number;
  randoriRounds: { duration: number }[]; notes: string;
};
type ManualSession = {
  id: string; date: string; name: string; duration: number;
  intensity: number; notes: string; type: string;
};
type PREntry = { date: string; weight: number; reps: number; estimated1RM: number; };
type PRHistory = Record<string, PREntry[]>;
type UserMaxes = Record<string, number>; // exercise name -> 1RM in kg
type Routine = { id: string; name: string; exercises: { name: string; muscleGroup: string; defaultSets: number }[] };
type OnboardingState = 'none' | 'selectExercises' | 'maxTest' | 'done';

// ─── Constants ────────────────────────────────────────────────
const MUSCLE_GROUPS = ['Brust','Rücken','Schultern','Bizeps','Trizeps','Quadrizeps','Hamstrings','Gluteus','Waden','Core','Ganzkörper'];
const MUSCLE_COLORS: Record<string, string> = {
  'Brust':'#EC4899','Rücken':'#7C3AED','Schultern':'#06B6D4','Bizeps':'#10B981',
  'Trizeps':'#F59E0B','Quadrizeps':'#FB7185','Hamstrings':'#A78BFA','Gluteus':'#F472B6',
  'Waden':'#67E8F9','Core':'#FB923C','Ganzkörper':'#1A73E8',
};
const DEFAULT_PRESET_EXERCISES = [
  { name:'Bankdrücken', muscleGroup:'Brust' },{ name:'Schrägbankdrücken', muscleGroup:'Brust' },
  { name:'Butterfly', muscleGroup:'Brust' },{ name:'Klimmzüge', muscleGroup:'Rücken' },
  { name:'Rudern', muscleGroup:'Rücken' },{ name:'Kreuzheben', muscleGroup:'Rücken' },
  { name:'Schulterdrücken', muscleGroup:'Schultern' },{ name:'Seitheben', muscleGroup:'Schultern' },
  { name:'Curls', muscleGroup:'Bizeps' },{ name:'Trizepsdrücken', muscleGroup:'Trizeps' },
  { name:'Kniebeugen', muscleGroup:'Quadrizeps' },{ name:'Beinpresse', muscleGroup:'Quadrizeps' },
  { name:'Romanian Deadlift', muscleGroup:'Hamstrings' },{ name:'Hip Thrust', muscleGroup:'Gluteus' },
  { name:'Plank', muscleGroup:'Core' },{ name:'Crunches', muscleGroup:'Core' },
  { name:'Schulterdrücken (Maschine)', muscleGroup:'Schultern' },
  { name:'Latzug', muscleGroup:'Rücken' },{ name:'Beinstrecker', muscleGroup:'Quadrizeps' },
  { name:'Beinbeuger', muscleGroup:'Hamstrings' },{ name:'Wadenheben', muscleGroup:'Waden' },
  { name:'Dips', muscleGroup:'Trizeps' },{ name:'Hammer Curls', muscleGroup:'Bizeps' },
  { name:'Face Pulls', muscleGroup:'Rücken' },{ name:'Deadlift', muscleGroup:'Rücken' },
];

// ─── Helpers ─────────────────────────────────────────────────
function calculate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  // Epley formula
  return Math.round(weight * (1 + reps / 30));
}
function getBest1RM(sets: Set[]): number {
  return Math.max(0, ...sets.map(s => calculate1RM(parseFloat(s.weight||'0'), parseFloat(s.reps||'0'))));
}
function formatTime(s: number) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h>0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function formatPace(paceSeconds: number) {
  if (!paceSeconds||!isFinite(paceSeconds)||paceSeconds<=0) return '--:--';
  const m=Math.floor(paceSeconds/60), s=Math.round(paceSeconds%60);
  return `${m}:${String(s).padStart(2,'0')}`;
}
function isToday(dateString: string) {
  const d=new Date(dateString), t=new Date();
  return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear();
}
function isThisWeek(dateString: string) {
  const d=new Date(dateString), t=new Date();
  return d>=new Date(t.getTime()-7*24*60*60*1000);
}
function daysSince(dateString: string) {
  return Math.floor((Date.now()-new Date(dateString).getTime())/(1000*60*60*24));
}

// ─── Intensity & Nutrition ────────────────────────────────────
/**
 * Relative intensity = actual load / theoretical max load
 * For each set: load% = (weight/1RM) * reps/maxReps(at that %)
 * We use RPE-based approach: estimate how hard each set was as % of MRV
 */
function calcWorkoutIntensityScore(exercises: Exercise[], userMaxes: UserMaxes): number {
  if (exercises.length === 0) return 0;
  let totalScore = 0, count = 0;
  for (const ex of exercises) {
    const max = userMaxes[ex.name];
    for (const set of ex.sets) {
      const w = parseFloat(set.weight||'0'), r = parseFloat(set.reps||'0');
      if (w<=0||r<=0) continue;
      const est1RM = calculate1RM(w,r);
      const intensity = max ? Math.min(1, est1RM/max) : 0.7; // default 70% if no max
      // Volume load as % of 1RM
      const relativeLoad = max ? (w/max)*Math.min(r,15)/15 : 0.5;
      totalScore += (intensity*0.6 + relativeLoad*0.4);
      count++;
    }
  }
  return count>0 ? totalScore/count : 0;
}

function calcMuscleStress(exercises: Exercise[], userMaxes: UserMaxes): Record<string, number> {
  const stress: Record<string, number> = {};
  for (const ex of exercises) {
    const max = userMaxes[ex.name];
    let exStress = 0;
    for (const set of ex.sets) {
      const w=parseFloat(set.weight||'0'), r=parseFloat(set.reps||'0');
      if (w<=0||r<=0) continue;
      const est1RM = calculate1RM(w,r);
      // Stress = how close to max * volume
      const pctMax = max ? Math.min(1.2, est1RM/max) : 0.7;
      exStress += pctMax * Math.min(r,20)/20;
    }
    const mg = ex.muscleGroup;
    stress[mg] = (stress[mg]||0) + exStress;
  }
  return stress;
}

function getNutritionAdvice(
  workout: {exercises: Exercise[]; duration: number; intensity: number; name: string; type: string},
  userMaxes: UserMaxes,
  bodyWeightKg: number = 70
): { immediate: string; later: string; proteinG: number; carbsG: number; proteinLater: number; carbsLater: number; hours: number } {
  const bw = bodyWeightKg;
  let intensityScore: number;
  let durationMin = workout.duration;

  if (workout.type === 'gym') {
    intensityScore = calcWorkoutIntensityScore(workout.exercises, userMaxes);
  } else if (workout.type === 'judo') {
    intensityScore = 0.85; // judo is high intensity
  } else {
    intensityScore = workout.intensity / 5;
  }

  // Protein: 0.3–0.5g/kg depending on intensity
  const proteinG = Math.round(bw * (0.3 + intensityScore * 0.2));
  // Carbs: 0.5–1.5g/kg depending on intensity and duration
  const carbFactor = Math.min(1.5, 0.5 + (durationMin/60)*0.5 + intensityScore*0.5);
  const carbsG = Math.round(bw * carbFactor);

  // Later meal (2–3h after)
  const hours = intensityScore > 0.7 ? 2 : 3;
  const proteinLater = Math.round(bw * 0.4);
  const carbsLater = Math.round(bw * (intensityScore > 0.7 ? 1.2 : 0.8));

  const immediate = `Jetzt sofort: ${proteinG}g Protein + ${carbsG}g Kohlenhydrate`;
  const later = `In ~${hours}h: ${proteinLater}g Protein + ${carbsLater}g Kohlenhydrate`;

  return { immediate, later, proteinG, carbsG, proteinLater, carbsLater, hours };
}

function getJudoNutrition(totalMin: number, randoriRounds: {duration:number}[], bwKg: number = 70) {
  const randoriMin = randoriRounds.reduce((s,r)=>s+r.duration,0);
  const intensity = Math.min(1, 0.6 + (randoriMin/totalMin)*0.4);
  const proteinG = Math.round(bwKg*(0.35+intensity*0.15));
  const carbsG = Math.round(bwKg*(0.7+intensity*0.5));
  const hours = 2;
  const proteinLater = Math.round(bwKg*0.4);
  const carbsLater = Math.round(bwKg*1.0);
  return { proteinG, carbsG, proteinLater, carbsLater, hours, intensity };
}

// ─── PR Recommendation ────────────────────────────────────────
function shouldRecommendPRTest(exerciseName: string, prHistory: PRHistory): { recommend: boolean; reason: string; daysSince: number } {
  const history = prHistory[exerciseName];
  if (!history || history.length === 0) return { recommend: true, reason: 'Noch kein Max-Test gemacht', daysSince: 999 };
  const last = history[history.length-1];
  const days = Math.floor((Date.now()-new Date(last.date).getTime())/(1000*60*60*24));
  if (days >= 90) return { recommend: true, reason: `Letzter Test vor ${days} Tagen`, daysSince: days };
  if (days >= 60) return { recommend: false, reason: `Test in ${90-days} Tagen empfohlen`, daysSince: days };
  return { recommend: false, reason: `Nächster Test in ${90-days} Tagen`, daysSince: days };
}

// ─── Persistent Timer Hook ────────────────────────────────────
function usePersistentTimer(key: string) {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Restore on mount
    AsyncStorage.getItem(key).then(raw => {
      if (!raw) return;
      const { startedAt, running, elapsed } = JSON.parse(raw);
      if (running && startedAt) {
        const now = Math.floor((Date.now()-startedAt)/1000);
        startTimeRef.current = startedAt;
        setSeconds(now);
        setIsRunning(true);
      } else if (elapsed) {
        setSeconds(elapsed);
      }
    });

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextState.match(/inactive|background/)) {
        // Going to background: save state with timestamp
        if (startTimeRef.current) {
          AsyncStorage.setItem(key, JSON.stringify({ startedAt: startTimeRef.current, running: true }));
        }
      }
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        // Coming back: recalculate elapsed
        AsyncStorage.getItem(key).then(raw => {
          if (!raw) return;
          const { startedAt, running } = JSON.parse(raw);
          if (running && startedAt) {
            const now = Math.floor((Date.now()-startedAt)/1000);
            setSeconds(now);
          }
        });
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [key]);

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) startTimeRef.current = Date.now() - seconds*1000;
      AsyncStorage.setItem(key, JSON.stringify({ startedAt: startTimeRef.current, running: true }));
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now()-startTimeRef.current!)/1000);
        setSeconds(elapsed);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now()-startTimeRef.current)/1000);
        AsyncStorage.setItem(key, JSON.stringify({ startedAt: startTimeRef.current, running: false, elapsed }));
      }
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const reset = useCallback(() => {
    setSeconds(0); setIsRunning(false);
    startTimeRef.current = null;
    AsyncStorage.removeItem(key);
  }, [key]);

  const start = useCallback(() => {
    startTimeRef.current = Date.now() - seconds*1000;
    setIsRunning(true);
  }, [seconds]);

  const pause = useCallback(() => setIsRunning(false), []);

  return { seconds, isRunning, start, pause, reset, setSeconds };
}

// ─── Onboarding Screen ────────────────────────────────────────
function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'select'|'maxTest'|'done'>('select');
  const [allExercises, setAllExercises] = useState(DEFAULT_PRESET_EXERCISES);
  const [selected, setSelected] = useState<string[]>([]);
  const [maxTestIdx, setMaxTestIdx] = useState(0);
  const [maxTestExercises, setMaxTestExercises] = useState<{name:string;muscleGroup:string}[]>([]);
  const [currentWeight, setCurrentWeight] = useState('');
  const [currentReps, setCurrentReps] = useState('');
  const [collectedMaxes, setCollectedMaxes] = useState<UserMaxes>({});
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Brust');
  const [bodyWeight, setBodyWeight] = useState('');

  function toggleExercise(name: string) {
    setSelected(prev => prev.includes(name) ? prev.filter(n=>n!==name) : [...prev,name]);
  }

  function addCustom() {
    if (!customName.trim()) return;
    const ex = { name: customName.trim(), muscleGroup: customMuscle };
    setAllExercises(prev=>[...prev,ex]);
    setSelected(prev=>[...prev,ex.name]);
    setCustomName('');
  }

  function proceedToMaxTest() {
    if (selected.length === 0) { Alert.alert('Bitte mindestens eine Übung auswählen'); return; }
    // Only test exercises where 1RM makes sense (exclude Core, Waden etc. optionally)
    const testable = selected.map(name => allExercises.find(e=>e.name===name)!).filter(Boolean);
    setMaxTestExercises(testable);
    setStep('maxTest');
  }

  async function submitCurrentMax() {
    const ex = maxTestExercises[maxTestIdx];
    const w = parseFloat(currentWeight);
    const r = parseFloat(currentReps);
    if (w>0 && r>0) {
      const est1RM = calculate1RM(w,r);
      setCollectedMaxes(prev=>({...prev,[ex.name]:est1RM}));
    }
    if (maxTestIdx < maxTestExercises.length-1) {
      setMaxTestIdx(i=>i+1);
      setCurrentWeight(''); setCurrentReps('');
    } else {
      // Save everything
      const newMaxes = { ...collectedMaxes };
      const w2 = parseFloat(currentWeight), r2 = parseFloat(currentReps);
      if (w2>0&&r2>0) newMaxes[ex.name] = calculate1RM(w2,r2);

      await AsyncStorage.setItem('userMaxes', JSON.stringify(newMaxes));
      await AsyncStorage.setItem('userExercises', JSON.stringify(allExercises));
      await AsyncStorage.setItem('selectedExercises', JSON.stringify(selected));
      await AsyncStorage.setItem('bodyWeight', bodyWeight||'70');
      await AsyncStorage.setItem('onboardingDone', 'true');

      // Save initial PRs
      const prHistory: PRHistory = {};
      for (const [name, max] of Object.entries(newMaxes)) {
        prHistory[name] = [{ date: new Date().toISOString(), weight: parseFloat(currentWeight)||max, reps: 1, estimated1RM: max }];
      }
      await AsyncStorage.setItem('prHistory', JSON.stringify(prHistory));
      setStep('done');
    }
  }

  function skipMax() {
    if (maxTestIdx < maxTestExercises.length-1) {
      setMaxTestIdx(i=>i+1);
      setCurrentWeight(''); setCurrentReps('');
    } else {
      finishOnboarding();
    }
  }

  async function finishOnboarding() {
    await AsyncStorage.setItem('userMaxes', JSON.stringify(collectedMaxes));
    await AsyncStorage.setItem('userExercises', JSON.stringify(allExercises));
    await AsyncStorage.setItem('selectedExercises', JSON.stringify(selected));
    await AsyncStorage.setItem('bodyWeight', bodyWeight||'70');
    await AsyncStorage.setItem('onboardingDone', 'true');
    onDone();
  }

  if (step==='done') return (
    <View style={ob.center}>
      <Text style={ob.emoji}>💪</Text>
      <Text style={ob.title}>Alles bereit!</Text>
      <Text style={ob.sub}>Deine Maximalwerte sind gespeichert. Die App wird jetzt alle Trainings präzise auswerten.</Text>
      <TouchableOpacity style={ob.btn} onPress={onDone}><Text style={ob.btnText}>Los geht's</Text></TouchableOpacity>
    </View>
  );

  if (step==='maxTest') {
    const ex = maxTestExercises[maxTestIdx];
    return (
      <ScrollView style={ob.scroll} contentContainerStyle={ob.scrollContent}>
        <Text style={ob.progress}>{maxTestIdx+1} / {maxTestExercises.length}</Text>
        <Text style={ob.title}>Max-Test</Text>
        <Text style={ob.subtitle}>{ex.name}</Text>
        <View style={[ob.musclePill,{backgroundColor:(MUSCLE_COLORS[ex.muscleGroup]||'#666')+'30'}]}>
          <Text style={[ob.musclePillText,{color:MUSCLE_COLORS[ex.muscleGroup]||'#666'}]}>{ex.muscleGroup}</Text>
        </View>
        <Text style={ob.hint}>Gib dein bestes Set ein (z.B. 3×80kg). Wir berechnen deinen geschätzten 1RM.</Text>
        <View style={ob.inputRow}>
          <View style={ob.inputBlock}>
            <Text style={ob.inputLabel}>Gewicht (kg)</Text>
            <TextInput style={ob.input} value={currentWeight} onChangeText={setCurrentWeight} keyboardType="decimal-pad" placeholder="80" placeholderTextColor={theme.textTertiary}/>
          </View>
          <View style={ob.inputBlock}>
            <Text style={ob.inputLabel}>Wiederholungen</Text>
            <TextInput style={ob.input} value={currentReps} onChangeText={setCurrentReps} keyboardType="numeric" placeholder="3" placeholderTextColor={theme.textTertiary}/>
          </View>
        </View>
        {currentWeight&&currentReps&&parseFloat(currentWeight)>0&&parseFloat(currentReps)>0&&(
          <View style={ob.estimate}>
            <Text style={ob.estimateLabel}>Geschätzter 1RM</Text>
            <Text style={ob.estimateVal}>{calculate1RM(parseFloat(currentWeight),parseFloat(currentReps))} kg</Text>
          </View>
        )}
        <TouchableOpacity style={ob.btn} onPress={submitCurrentMax}><Text style={ob.btnText}>Weiter →</Text></TouchableOpacity>
        <TouchableOpacity style={ob.skipBtn} onPress={skipMax}><Text style={ob.skipText}>Überspringen</Text></TouchableOpacity>
      </ScrollView>
    );
  }

  // Select step
  return (
    <ScrollView style={ob.scroll} contentContainerStyle={ob.scrollContent}>
      <Text style={ob.title}>Willkommen! 👋</Text>
      <Text style={ob.sub}>Welche Übungen machst du im Gym? Wähle alle aus, damit die App deine Trainings präzise auswerten kann.</Text>

      <Text style={ob.inputLabel}>Dein Körpergewicht (kg)</Text>
      <TextInput style={[ob.input,{marginBottom:16}]} value={bodyWeight} onChangeText={setBodyWeight} keyboardType="decimal-pad" placeholder="70" placeholderTextColor={theme.textTertiary}/>

      {MUSCLE_GROUPS.map(mg=>{
        const exs = allExercises.filter(e=>e.muscleGroup===mg);
        if (exs.length===0) return null;
        return (
          <View key={mg} style={{marginBottom:16}}>
            <Text style={[ob.groupLabel,{color:MUSCLE_COLORS[mg]}]}>{mg}</Text>
            <View style={ob.chips}>
              {exs.map(ex=>{
                const sel = selected.includes(ex.name);
                return (
                  <TouchableOpacity key={ex.name} style={[ob.chip, sel&&{backgroundColor:MUSCLE_COLORS[mg]+'30',borderColor:MUSCLE_COLORS[mg]}]} onPress={()=>toggleExercise(ex.name)}>
                    <Text style={[ob.chipText, sel&&{color:MUSCLE_COLORS[mg],fontWeight:'600'}]}>{ex.name}{sel?' ✓':''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      <Text style={ob.groupLabel}>Eigene Übung hinzufügen</Text>
      <View style={ob.customRow}>
        <TextInput style={[ob.input,{flex:1}]} value={customName} onChangeText={setCustomName} placeholder="Übungsname" placeholderTextColor={theme.textTertiary}/>
      </View>
      <View style={ob.chips}>
        {MUSCLE_GROUPS.map(mg=>(
          <TouchableOpacity key={mg} style={[ob.chip,customMuscle===mg&&{backgroundColor:theme.blueLight,borderColor:theme.blue}]} onPress={()=>setCustomMuscle(mg)}>
            <Text style={[ob.chipText,customMuscle===mg&&{color:theme.blue}]}>{mg}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={[ob.btn,{marginBottom:8,backgroundColor:theme.cardSecondary}]} onPress={addCustom}>
        <Text style={[ob.btnText,{color:theme.textPrimary}]}>+ Hinzufügen</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[ob.btn,{marginTop:16}]} onPress={proceedToMaxTest}>
        <Text style={ob.btnText}>Weiter zum Max-Test →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={ob.skipBtn} onPress={async()=>{
        await AsyncStorage.setItem('userExercises', JSON.stringify(allExercises));
        await AsyncStorage.setItem('selectedExercises', JSON.stringify(selected));
        await AsyncStorage.setItem('bodyWeight', bodyWeight||'70');
        await AsyncStorage.setItem('onboardingDone', 'true');
        onDone();
      }}><Text style={ob.skipText}>Überspringen (später)</Text></TouchableOpacity>
    </ScrollView>
  );
}

// ─── Run Screen ───────────────────────────────────────────────
function RunScreen({ onStop }: { onStop: () => void }) {
  const timer = usePersistentTimer('activeRunTimer');
  const [manualDist, setManualDist] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [calories, setCalories] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    const p=Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{toValue:1.03,duration:1000,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:1,duration:1000,useNativeDriver:true}),
    ]));
    if(timer.isRunning) p.start(); else p.stop();
    return ()=>p.stop();
  },[timer.isRunning]);

  const dist = parseFloat(manualDist)||0;
  const paceSeconds = dist>0 ? timer.seconds/dist : 0;
  const estimatedCalories = parseInt(calories)||Math.round(timer.seconds/60*8);

  async function finishRun() {
    const runData: RunData = {
      id:Date.now().toString(), distance:dist, duration:timer.seconds,
      pace:formatPace(dist>0?timer.seconds/dist:0), calories:estimatedCalories,
      heartRate:parseInt(heartRate)||0, date:new Date().toISOString(),
    };
    const raw = await AsyncStorage.getItem('runs');
    const runs = raw?JSON.parse(raw):[];
    runs.push(runData);
    await AsyncStorage.setItem('runs',JSON.stringify(runs));
    await AsyncStorage.removeItem('activeRunTimer');
    Alert.alert('Lauf abgeschlossen! 🏃',`${dist.toFixed(2)} km · ${formatTime(timer.seconds)} · ${formatPace(dist>0?timer.seconds/dist:0)} /km`,[
      {text:'OK',onPress:onStop}
    ]);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerLabel}>Lauf</Text>
      <Animated.View style={[styles.runTimerCard,timer.isRunning&&{transform:[{scale:pulseAnim}]}]}>
        <Text style={styles.runTimerLabel}>LAUFZEIT</Text>
        <Text style={styles.runTimerDisplay}>{formatTime(timer.seconds)}</Text>
        <TouchableOpacity style={[styles.runControlBtn,timer.isRunning?styles.runPauseBtn:styles.runStartBtn]}
          onPress={()=>timer.isRunning?timer.pause():timer.start()} activeOpacity={0.8}>
          <Text style={[styles.runControlBtnText,{color:timer.isRunning?theme.red:theme.green}]}>
            {timer.isRunning?'⏸  Pause':'▶  Start'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.runStatsGrid}>
        {[
          {val:dist.toFixed(2),lbl:'km',color:theme.green},
          {val:formatPace(paceSeconds),lbl:'/km Pace',color:theme.blue},
          {val:String(estimatedCalories),lbl:'kcal',color:theme.orange},
          {val:heartRate||'--',lbl:'bpm',color:theme.pink},
        ].map(s=>(
          <View key={s.lbl} style={styles.runStatCard}>
            <Text style={[styles.runStatVal,{color:s.color}]}>{s.val}</Text>
            <Text style={styles.runStatLbl}>{s.lbl}</Text>
          </View>
        ))}
      </View>

      <View style={styles.manualCard}>
        <Text style={styles.manualCardTitle}>Daten eingeben</Text>
        <View style={styles.manualRow}>
          {[
            {label:'Distanz (km)',value:manualDist,setter:setManualDist,kb:'decimal-pad' as const,ph:'0.00'},
            {label:'Herzfrequenz',value:heartRate,setter:setHeartRate,kb:'numeric' as const,ph:'bpm'},
            {label:'Kalorien',value:calories,setter:setCalories,kb:'numeric' as const,ph:'kcal'},
          ].map(f=>(
            <View key={f.label} style={styles.manualItem}>
              <Text style={styles.manualLabel}>{f.label}</Text>
              <TextInput style={styles.manualInput} value={f.value} onChangeText={f.setter}
                keyboardType={f.kb} placeholder={f.ph} placeholderTextColor={theme.textTertiary}/>
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity style={styles.finishRunBtn} onPress={finishRun} activeOpacity={0.85}>
        <Text style={styles.finishRunBtnText}>Lauf beenden ✓</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Judo Screen ─────────────────────────────────────────────
function JudoScreen({ onDone }: { onDone: () => void }) {
  const timer = usePersistentTimer('judoTimer');
  const [warmupMin, setWarmupMin] = useState('');
  const [rounds, setRounds] = useState<{duration:string}[]>([{duration:''}]);
  const [notes, setNotes] = useState('');
  const [bodyWeight, setBodyWeight] = useState('70');

  useEffect(()=>{
    AsyncStorage.getItem('bodyWeight').then(bw=>{ if(bw) setBodyWeight(bw); });
  },[]);

  function addRound() { setRounds(r=>[...r,{duration:''}]); }
  function updateRound(i:number,val:string) { setRounds(r=>r.map((rr,ii)=>ii===i?{duration:val}:rr)); }

  async function finish() {
    const totalMin = Math.round(timer.seconds/60);
    const randoriRounds = rounds.filter(r=>parseFloat(r.duration)>0).map(r=>({duration:parseFloat(r.duration)}));
    const session: JudoSession = {
      id:Date.now().toString(), date:new Date().toISOString(),
      totalDuration:totalMin, warmupDuration:parseFloat(warmupMin)||0,
      randoriRounds, notes,
    };
    const raw = await AsyncStorage.getItem('judoSessions');
    const sessions = raw?JSON.parse(raw):[];
    sessions.push(session);
    await AsyncStorage.setItem('judoSessions',JSON.stringify(sessions));
    timer.reset();

    const bw = parseFloat(bodyWeight)||70;
    const nutr = getJudoNutrition(totalMin,randoriRounds,bw);
    Alert.alert(
      'Judo Training abgeschlossen! 🥋',
      `Dauer: ${totalMin} min · ${randoriRounds.length} Randori-Runden\n\nErnährung jetzt:\n${nutr.proteinG}g Protein · ${nutr.carbsG}g Kohlenhydrate\n\nIn ~${nutr.hours}h:\n${nutr.proteinLater}g Protein · ${nutr.carbsLater}g Kohlenhydrate`,
      [{text:'Verstanden',onPress:onDone}]
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerLabel}>Judo Training</Text>
      <View style={[styles.runTimerCard,{borderLeftColor:'#7C3AED'}]}>
        <Text style={styles.runTimerLabel}>TRAININGSZEIT</Text>
        <Text style={styles.runTimerDisplay}>{formatTime(timer.seconds)}</Text>
        <TouchableOpacity style={[styles.runControlBtn,timer.isRunning?styles.runPauseBtn:styles.runStartBtn]}
          onPress={()=>timer.isRunning?timer.pause():timer.start()} activeOpacity={0.8}>
          <Text style={[styles.runControlBtnText,{color:timer.isRunning?theme.red:'#7C3AED'}]}>
            {timer.isRunning?'⏸  Pause':'▶  Start'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.manualCard}>
        <Text style={styles.manualCardTitle}>Details</Text>
        <Text style={styles.manualLabel}>Aufwärmen (Minuten)</Text>
        <TextInput style={styles.manualInput} value={warmupMin} onChangeText={setWarmupMin} keyboardType="numeric" placeholder="15" placeholderTextColor={theme.textTertiary}/>
        <Text style={[styles.manualLabel,{marginTop:12}]}>Dein Körpergewicht (kg)</Text>
        <TextInput style={styles.manualInput} value={bodyWeight} onChangeText={setBodyWeight} keyboardType="decimal-pad" placeholder="70" placeholderTextColor={theme.textTertiary}/>
      </View>

      <View style={styles.manualCard}>
        <Text style={styles.manualCardTitle}>Randori Runden</Text>
        {rounds.map((r,i)=>(
          <View key={i} style={{flexDirection:'row',gap:8,alignItems:'center',marginBottom:8}}>
            <Text style={styles.setNumber}>R{i+1}</Text>
            <TextInput style={[styles.manualInput,{flex:1}]} value={r.duration} onChangeText={v=>updateRound(i,v)}
              keyboardType="numeric" placeholder="Minuten" placeholderTextColor={theme.textTertiary}/>
          </View>
        ))}
        <TouchableOpacity style={styles.addSetBtn} onPress={addRound}>
          <Text style={styles.addSetBtnText}>+ Runde hinzufügen</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.manualCard}>
        <Text style={styles.manualCardTitle}>Notizen</Text>
        <TextInput style={[styles.manualInput,{minHeight:60}]} value={notes} onChangeText={setNotes}
          multiline placeholder="Wie war das Training?" placeholderTextColor={theme.textTertiary}/>
      </View>

      <TouchableOpacity style={[styles.finishBtn,{backgroundColor:'#7C3AED'}]} onPress={finish} activeOpacity={0.85}>
        <Text style={styles.finishBtnText}>Training abschliessen ✓</Text>
      </TouchableOpacity>
      <View style={{height:100}}/>
    </ScrollView>
  );
}

// ─── Manual Session Screen ────────────────────────────────────
function ManualSessionScreen({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [notes, setNotes] = useState('');
  const [bodyWeight, setBodyWeight] = useState('70');

  useEffect(()=>{
    AsyncStorage.getItem('bodyWeight').then(bw=>{ if(bw) setBodyWeight(bw); });
  },[]);

  async function save() {
    if (!name.trim()||!durationMin) { Alert.alert('Bitte Name und Dauer eingeben'); return; }
    const session: ManualSession = {
      id:Date.now().toString(), date:new Date().toISOString(),
      name:name.trim(), duration:parseFloat(durationMin)||0,
      intensity, notes, type:'manual',
    };
    const raw = await AsyncStorage.getItem('manualSessions');
    const sessions = raw?JSON.parse(raw):[];
    sessions.push(session);
    await AsyncStorage.setItem('manualSessions',JSON.stringify(sessions));

    const bw = parseFloat(bodyWeight)||70;
    const iScore = intensity/5;
    const proteinG = Math.round(bw*(0.25+iScore*0.2));
    const carbsG = Math.round(bw*(0.5+iScore*0.5+(parseFloat(durationMin)/60)*0.3));
    Alert.alert(
      `${name} abgeschlossen! ✅`,
      `Dauer: ${durationMin} min\n\nErnährung jetzt:\n${proteinG}g Protein · ${carbsG}g Kohlenhydrate`,
      [{text:'Verstanden',onPress:onDone}]
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerLabel}>Training manuell erfassen</Text>
      <View style={styles.manualCard}>
        <Text style={styles.manualLabel}>Trainingsname</Text>
        <TextInput style={styles.manualInput} value={name} onChangeText={setName} placeholder="z.B. Judo, Schwimmen, BJJ..." placeholderTextColor={theme.textTertiary}/>
        <Text style={[styles.manualLabel,{marginTop:12}]}>Dauer (Minuten)</Text>
        <TextInput style={styles.manualInput} value={durationMin} onChangeText={setDurationMin} keyboardType="numeric" placeholder="90" placeholderTextColor={theme.textTertiary}/>
        <Text style={[styles.manualLabel,{marginTop:12}]}>Körpergewicht (kg)</Text>
        <TextInput style={styles.manualInput} value={bodyWeight} onChangeText={setBodyWeight} keyboardType="decimal-pad" placeholder="70" placeholderTextColor={theme.textTertiary}/>
        <Text style={[styles.manualLabel,{marginTop:12}]}>Intensität</Text>
        <View style={styles.intensityRow}>
          {[1,2,3,4,5].map(n=>(
            <TouchableOpacity key={n} style={[styles.intensityBtn,intensity===n&&styles.intensityBtnActive]} onPress={()=>setIntensity(n)}>
              <Text style={[styles.intensityBtnText,intensity===n&&{color:'#fff'}]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.manualLabel,{marginTop:12}]}>Notizen</Text>
        <TextInput style={[styles.manualInput,{minHeight:60}]} value={notes} onChangeText={setNotes} multiline placeholder="Optional..." placeholderTextColor={theme.textTertiary}/>
      </View>
      <TouchableOpacity style={styles.finishBtn} onPress={save}><Text style={styles.finishBtnText}>Speichern ✓</Text></TouchableOpacity>
      <View style={{height:100}}/>
    </ScrollView>
  );
}

// ─── Workout Detail Screen ────────────────────────────────────
function WorkoutDetailModal({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  return (
    <Modal visible={true} animationType="slide">
      <ScrollView style={[styles.container,{paddingTop:60}]}>
        <TouchableOpacity onPress={onClose} style={{marginBottom:16}}>
          <Text style={{color:theme.blue,fontSize:16}}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{workout.name}</Text>
        <Text style={styles.manualLabel}>{new Date(workout.date).toLocaleDateString('de',{weekday:'long',day:'2-digit',month:'long'})}</Text>
        <View style={styles.liveStats}>
          {[
            {val:workout.exercises?.length??0,lbl:'Übungen',color:theme.blue},
            {val:workout.duration,lbl:'Minuten',color:theme.green},
            {val:workout.intensity,lbl:'Intensität',color:theme.orange},
          ].map(s=>(
            <View key={s.lbl} style={styles.liveStat}>
              <Text style={[styles.liveStatVal,{color:s.color}]}>{s.val}</Text>
              <Text style={styles.liveStatLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>
        {workout.exercises?.map(ex=>(
          <View key={ex.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View style={[styles.muscleBadge,{backgroundColor:(MUSCLE_COLORS[ex.muscleGroup]||'#666')+'20'}]}>
                <Text style={[styles.muscleBadgeText,{color:MUSCLE_COLORS[ex.muscleGroup]||'#666'}]}>{ex.muscleGroup}</Text>
              </View>
              <Text style={styles.exerciseName}>{ex.name}</Text>
            </View>
            <View style={styles.setHeader}>
              {['Set','Wdh.','Gewicht','Est. 1RM'].map(h=><Text key={h} style={styles.setHeaderText}>{h}</Text>)}
            </View>
            {ex.sets.map((s,i)=>(
              <View key={i} style={styles.setRow}>
                <Text style={styles.setNumber}>{i+1}</Text>
                <Text style={[styles.setInput,{flex:1,textAlign:'center',color:theme.textPrimary}]}>{s.reps}</Text>
                <Text style={[styles.setInput,{flex:1,textAlign:'center',color:theme.textPrimary}]}>{s.weight}kg</Text>
                <Text style={[styles.setInput,{flex:1,textAlign:'center',color:theme.blue}]}>{calculate1RM(parseFloat(s.weight||'0'),parseFloat(s.reps||'0'))}kg</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={{height:80}}/>
      </ScrollView>
    </Modal>
  );
}

// ─── PR Progress Screen ───────────────────────────────────────
function PRProgressScreen({ onClose }: { onClose: () => void }) {
  const [prHistory, setPRHistory] = useState<PRHistory>({});
  const [userMaxes, setUserMaxes] = useState<UserMaxes>({});
  const [selectedEx, setSelectedEx] = useState<string|null>(null);
  const [showAddPR, setShowAddPR] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newReps, setNewReps] = useState('');

  useEffect(()=>{
    AsyncStorage.getItem('prHistory').then(r=>r&&setPRHistory(JSON.parse(r)));
    AsyncStorage.getItem('userMaxes').then(r=>r&&setUserMaxes(JSON.parse(r)));
  },[]);

  async function addPR(exName: string) {
    const w=parseFloat(newWeight), r=parseFloat(newReps);
    if (w<=0||r<=0) return;
    const est1RM = calculate1RM(w,r);
    const entry: PREntry = { date:new Date().toISOString(), weight:w, reps:r, estimated1RM:est1RM };
    const updated = { ...prHistory, [exName]: [...(prHistory[exName]||[]), entry] };
    setPRHistory(updated);
    await AsyncStorage.setItem('prHistory',JSON.stringify(updated));
    // Update maxes if new PR
    if (est1RM > (userMaxes[exName]||0)) {
      const newMaxes = {...userMaxes,[exName]:est1RM};
      setUserMaxes(newMaxes);
      await AsyncStorage.setItem('userMaxes',JSON.stringify(newMaxes));
    }
    setShowAddPR(false); setNewWeight(''); setNewReps('');
  }

  const exercises = Object.keys(prHistory);

  return (
    <Modal visible={true} animationType="slide">
      <ScrollView style={[styles.container,{paddingTop:60}]}>
        <TouchableOpacity onPress={onClose} style={{marginBottom:16}}>
          <Text style={{color:theme.blue,fontSize:16}}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>PR Entwicklung 📈</Text>
        {exercises.map(exName=>{
          const history = prHistory[exName]||[];
          const rec = shouldRecommendPRTest(exName,prHistory);
          const latest = history[history.length-1];
          return (
            <TouchableOpacity key={exName} style={styles.exerciseCard} onPress={()=>setSelectedEx(exName===selectedEx?null:exName)}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{exName}</Text>
                {rec.recommend&&<View style={[styles.cardBadge,{backgroundColor:'#FF6B6B20'}]}>
                  <Text style={{color:'#FF6B6B',fontSize:10,fontWeight:'600'}}>Test empfohlen!</Text>
                </View>}
              </View>
              {latest&&<Text style={styles.oneRM}>Aktueller Max: <Text style={{color:theme.blue,fontWeight:'600'}}>{latest.estimated1RM}kg</Text></Text>}
              <Text style={[styles.manualLabel,{fontSize:10}]}>{rec.reason}</Text>

              {selectedEx===exName&&(
                <>
                  {history.map((e,i)=>(
                    <View key={i} style={[styles.historyItem,{paddingVertical:8}]}>
                      <View style={[styles.historyDot,{backgroundColor:theme.blue}]}/>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyName}>{e.weight}kg × {e.reps} Wdh.</Text>
                        <Text style={styles.historyMeta}>Est. 1RM: {e.estimated1RM}kg</Text>
                      </View>
                      <Text style={styles.historyDate}>{new Date(e.date).toLocaleDateString('de',{day:'2-digit',month:'2-digit',year:'2-digit'})}</Text>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addSetBtn} onPress={()=>{setShowAddPR(true);}}>
                    <Text style={styles.addSetBtnText}>+ Neuen PR eintragen</Text>
                  </TouchableOpacity>
                  {showAddPR&&(
                    <View style={{gap:8,marginTop:8}}>
                      <View style={{flexDirection:'row',gap:8}}>
                        <TextInput style={[styles.setInput,{flex:1}]} value={newWeight} onChangeText={setNewWeight} keyboardType="decimal-pad" placeholder="kg" placeholderTextColor={theme.textTertiary}/>
                        <TextInput style={[styles.setInput,{flex:1}]} value={newReps} onChangeText={setNewReps} keyboardType="numeric" placeholder="Wdh." placeholderTextColor={theme.textTertiary}/>
                      </View>
                      <TouchableOpacity style={styles.saveBtn} onPress={()=>addPR(exName)}>
                        <Text style={styles.saveBtnText}>Speichern</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{height:80}}/>
      </ScrollView>
    </Modal>
  );
}

// ─── Routine Manager ──────────────────────────────────────────
function RoutineManagerModal({ routines, onSelect, onSave, onClose }: {
  routines: Routine[]; onSelect:(r:Routine)=>void; onSave:(name:string,exercises:{name:string;muscleGroup:string;defaultSets:number}[])=>void; onClose:()=>void;
}) {
  const [mode, setMode] = useState<'list'|'create'>('list');
  const [newName, setNewName] = useState('');
  const [allExercises, setAllExercises] = useState(DEFAULT_PRESET_EXERCISES);
  const [selected, setSelected] = useState<{name:string;muscleGroup:string;defaultSets:number}[]>([]);

  useEffect(()=>{
    AsyncStorage.getItem('userExercises').then(r=>r&&setAllExercises(JSON.parse(r)));
  },[]);

  function toggleEx(ex:{name:string;muscleGroup:string}) {
    setSelected(prev=>{
      const existing = prev.find(e=>e.name===ex.name);
      if (existing) return prev.filter(e=>e.name!==ex.name);
      return [...prev,{...ex,defaultSets:3}];
    });
  }

  return (
    <Modal visible={true} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <ScrollView>
          <View style={[styles.modalCard,{maxHeight:'90%'}]}>
            <Text style={styles.modalTitle}>Routinen</Text>
            {mode==='list'&&(
              <>
                {routines.length===0&&<Text style={styles.manualLabel}>Noch keine Routinen gespeichert.</Text>}
                {routines.map(r=>(
                  <TouchableOpacity key={r.id} style={styles.historyItem} onPress={()=>onSelect(r)}>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyName}>{r.name}</Text>
                      <Text style={styles.historyMeta}>{r.exercises.length} Übungen</Text>
                    </View>
                    <Text style={{color:theme.blue,fontSize:13}}>Laden →</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.saveBtn,{marginTop:12}]} onPress={()=>setMode('create')}>
                  <Text style={styles.saveBtnText}>+ Neue Routine erstellen</Text>
                </TouchableOpacity>
              </>
            )}
            {mode==='create'&&(
              <>
                <Text style={styles.inputLabel}>Routinen-Name</Text>
                <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="z.B. Oberkörper A" placeholderTextColor={theme.textTertiary}/>
                {MUSCLE_GROUPS.map(mg=>{
                  const exs=allExercises.filter(e=>e.muscleGroup===mg);
                  if (exs.length===0) return null;
                  return (
                    <View key={mg} style={{marginVertical:8}}>
                      <Text style={[ob.groupLabel,{color:MUSCLE_COLORS[mg]}]}>{mg}</Text>
                      <View style={ob.chips}>
                        {exs.map(ex=>{
                          const sel=selected.find(e=>e.name===ex.name);
                          return (
                            <TouchableOpacity key={ex.name} style={[ob.chip,sel&&{backgroundColor:MUSCLE_COLORS[mg]+'30',borderColor:MUSCLE_COLORS[mg]}]} onPress={()=>toggleEx(ex)}>
                              <Text style={[ob.chipText,sel&&{color:MUSCLE_COLORS[mg]}]}>{ex.name}{sel?' ✓':''}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                <TouchableOpacity style={styles.saveBtn} onPress={()=>{
                  if (newName&&selected.length>0) { onSave(newName,selected); onClose(); }
                }}>
                  <Text style={styles.saveBtnText}>Routine speichern</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Schliessen</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Nutrition Modal ──────────────────────────────────────────
function NutritionAdviceModal({ advice, onClose }: {
  advice: ReturnType<typeof getNutritionAdvice>; onClose: () => void;
}) {
  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Ernährung nach Training 🍽️</Text>
          <View style={[styles.exerciseCard,{borderLeftWidth:3,borderLeftColor:theme.green}]}>
            <Text style={[styles.manualCardTitle,{color:theme.green}]}>SOFORT</Text>
            <View style={{flexDirection:'row',gap:20,marginTop:4}}>
              <View style={{alignItems:'center'}}>
                <Text style={[styles.liveStatVal,{color:theme.blue}]}>{advice.proteinG}g</Text>
                <Text style={styles.liveStatLbl}>Protein</Text>
              </View>
              <View style={{alignItems:'center'}}>
                <Text style={[styles.liveStatVal,{color:theme.orange}]}>{advice.carbsG}g</Text>
                <Text style={styles.liveStatLbl}>Kohlenhydrate</Text>
              </View>
            </View>
            <Text style={[styles.manualLabel,{marginTop:8}]}>Quellen: Whey, Magerquark, Hühnerbrust + Reis, Haferflocken, Banane</Text>
          </View>
          <View style={[styles.exerciseCard,{borderLeftWidth:3,borderLeftColor:theme.orange,marginTop:8}]}>
            <Text style={[styles.manualCardTitle,{color:theme.orange}]}>IN ~{advice.hours}H</Text>
            <View style={{flexDirection:'row',gap:20,marginTop:4}}>
              <View style={{alignItems:'center'}}>
                <Text style={[styles.liveStatVal,{color:theme.blue}]}>{advice.proteinLater}g</Text>
                <Text style={styles.liveStatLbl}>Protein</Text>
              </View>
              <View style={{alignItems:'center'}}>
                <Text style={[styles.liveStatVal,{color:theme.orange}]}>{advice.carbsLater}g</Text>
                <Text style={styles.liveStatLbl}>Kohlenhydrate</Text>
              </View>
            </View>
            <Text style={[styles.manualLabel,{marginTop:8}]}>Vollständige Mahlzeit: Fleisch/Fisch + komplexe Kohlenhydrate + Gemüse</Text>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={onClose}>
            <Text style={styles.saveBtnText}>Verstanden 👍</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Training Screen ─────────────────────────────────────
export default function TrainingScreen() {
  const [onboardingDone, setOnboardingDone] = useState<boolean|null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout|null>(null);
  const [activeRun, setActiveRun] = useState(false);
  const [activeJudo, setActiveJudo] = useState(false);
  const [activeManual, setActiveManual] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [showRoutineManager, setShowRoutineManager] = useState(false);
  const [showPRProgress, setShowPRProgress] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [nutritionAdvice, setNutritionAdvice] = useState<ReturnType<typeof getNutritionAdvice>|null>(null);
  const [viewingWorkout, setViewingWorkout] = useState<Workout|null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [customExercise, setCustomExercise] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Brust');
  const [activeTab, setActiveTab] = useState<'gym'|'run'|'judo'|'manual'>('gym');
  const [userMaxes, setUserMaxes] = useState<UserMaxes>({});
  const [allExercises, setAllExercises] = useState(DEFAULT_PRESET_EXERCISES);
  const [lastWorkoutData, setLastWorkoutData] = useState<Record<string, Set[]>>({});
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [bodyWeight, setBodyWeight] = useState(70);
  const [prHistory, setPRHistory] = useState<PRHistory>({});
  const workoutStartRef = useRef(Date.now());

  const gymTimer = usePersistentTimer('gymWorkoutTimer');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(()=>{
    loadAll();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim,{toValue:1,duration:400,useNativeDriver:true}).start();
  },[]));

  async function loadAll() {
    const done = await AsyncStorage.getItem('onboardingDone');
    setOnboardingDone(done==='true');

    const rawW = await AsyncStorage.getItem('workouts');
    if (rawW) {
      const w: Workout[] = JSON.parse(rawW);
      setWorkouts(w);
      const lastData: Record<string,Set[]> = {};
      [...w].reverse().forEach(workout=>{
        workout.exercises?.forEach(ex=>{ if(!lastData[ex.name]) lastData[ex.name]=ex.sets; });
      });
      setLastWorkoutData(lastData);
    }

    const rawActive = await AsyncStorage.getItem('activeWorkout');
    if (rawActive) {
      const w = JSON.parse(rawActive);
      if (isToday(w.date)) {
        if (w.type==='run') { setActiveRun(true); setActiveTab('run'); }
        else if (w.type==='judo') { setActiveJudo(true); setActiveTab('judo'); }
        else if (w.type==='manual') { setActiveManual(true); setActiveTab('manual'); }
        else { setActiveWorkout(w); setActiveTab('gym'); }
      }
    }

    const rawRuns = await AsyncStorage.getItem('runs');
    if (rawRuns) setRuns(JSON.parse(rawRuns));

    const rawMaxes = await AsyncStorage.getItem('userMaxes');
    if (rawMaxes) setUserMaxes(JSON.parse(rawMaxes));

    const rawEx = await AsyncStorage.getItem('userExercises');
    if (rawEx) setAllExercises(JSON.parse(rawEx));

    const rawRoutines = await AsyncStorage.getItem('routines');
    if (rawRoutines) setRoutines(JSON.parse(rawRoutines));

    const rawBW = await AsyncStorage.getItem('bodyWeight');
    if (rawBW) setBodyWeight(parseFloat(rawBW)||70);

    const rawPR = await AsyncStorage.getItem('prHistory');
    if (rawPR) setPRHistory(JSON.parse(rawPR));
  }

  async function startRun() {
    setActiveRun(true); setActiveTab('run');
    await AsyncStorage.setItem('activeWorkout',JSON.stringify({id:Date.now().toString(),date:new Date().toISOString(),name:'Lauf',exercises:[],duration:0,intensity:3,type:'run'}));
  }

  async function startJudo() {
    setActiveJudo(true); setActiveTab('judo');
    await AsyncStorage.setItem('activeWorkout',JSON.stringify({id:Date.now().toString(),date:new Date().toISOString(),name:'Judo',exercises:[],duration:0,intensity:5,type:'judo'}));
  }

  async function startManual() {
    setActiveManual(true); setActiveTab('manual');
    await AsyncStorage.setItem('activeWorkout',JSON.stringify({id:Date.now().toString(),date:new Date().toISOString(),name:'Manuell',exercises:[],duration:0,intensity:3,type:'manual'}));
  }

  async function stopSession() {
    setActiveRun(false); setActiveJudo(false); setActiveManual(false);
    await AsyncStorage.removeItem('activeWorkout');
    await loadAll();
  }

  async function startWorkout(fromRoutine?: Routine) {
    const workout: Workout = {
      id:Date.now().toString(), date:new Date().toISOString(),
      name:workoutName.trim()||fromRoutine?.name||'Training',
      exercises: fromRoutine ? fromRoutine.exercises.map(re=>({
        id:Date.now().toString()+re.name, name:re.name, muscleGroup:re.muscleGroup,
        sets:Array.from({length:re.defaultSets},()=>({reps:'',weight:''})),
      })) : [],
      duration:0, intensity, type:'gym',
    };
    workoutStartRef.current = Date.now();
    setActiveWorkout(workout); setShowNewWorkout(false); setWorkoutName(''); setActiveTab('gym');
    await AsyncStorage.setItem('activeWorkout',JSON.stringify(workout));
    gymTimer.reset();
  }

  async function addExercise(name: string, muscleGroup: string) {
    if (!activeWorkout) return;
    const lastSets = lastWorkoutData[name];
    const defaultSets = lastSets ? lastSets.map(s=>({reps:'',weight:''})) : [{reps:'',weight:''}];
    const exercise: Exercise = { id:Date.now().toString(), name, muscleGroup, sets:defaultSets };
    const updated = {...activeWorkout, exercises:[...activeWorkout.exercises,exercise]};
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout',JSON.stringify(updated));
    setShowExerciseModal(false);

    // Add to user exercises if not already there
    if (!allExercises.find(e=>e.name===name)) {
      const newEx = [...allExercises,{name,muscleGroup}];
      setAllExercises(newEx);
      await AsyncStorage.setItem('userExercises',JSON.stringify(newEx));
    }
  }

  async function addCustomExercise() {
    if (!customExercise.trim()) return;
    await addExercise(customExercise.trim(), customMuscle);
    setCustomExercise('');
  }

  async function updateSet(exerciseId: string, setIndex: number, field: 'reps'|'weight', value: string) {
    if (!activeWorkout) return;
    const updated = {
      ...activeWorkout,
      exercises:activeWorkout.exercises.map(ex=>{
        if (ex.id!==exerciseId) return ex;
        const newSets=[...ex.sets];
        newSets[setIndex]={...newSets[setIndex],[field]:value};
        return {...ex,sets:newSets};
      })
    };
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout',JSON.stringify(updated));
  }

  async function addSet(exerciseId: string) {
    if (!activeWorkout) return;
    const updated = {
      ...activeWorkout,
      exercises:activeWorkout.exercises.map(ex=>{
        if (ex.id!==exerciseId) return ex;
        const prev = ex.sets[ex.sets.length-1];
        return {...ex,sets:[...ex.sets,{reps:'',weight:prev?.weight||''}]};
      })
    };
    setActiveWorkout(updated); await AsyncStorage.setItem('activeWorkout',JSON.stringify(updated));
  }

  async function removeExercise(exerciseId: string) {
    if (!activeWorkout) return;
    const updated = {...activeWorkout,exercises:activeWorkout.exercises.filter(ex=>ex.id!==exerciseId)};
    setActiveWorkout(updated); await AsyncStorage.setItem('activeWorkout',JSON.stringify(updated));
  }

  async function finishWorkout() {
    if (!activeWorkout) return;
    const duration = Math.max(1,Math.round((Date.now()-workoutStartRef.current)/60000));
    const finished = {...activeWorkout,duration};

    // Update PRs
    const newPRHistory = {...prHistory};
    for (const ex of finished.exercises) {
      const best = getBest1RM(ex.sets);
      if (best>0) {
        const current = (newPRHistory[ex.name]||[]);
        const currentMax = current.length>0?current[current.length-1].estimated1RM:0;
        if (best>currentMax) {
          const bestSet = ex.sets.reduce((b,s)=>calculate1RM(parseFloat(s.weight||'0'),parseFloat(s.reps||'0'))>calculate1RM(parseFloat(b.weight||'0'),parseFloat(b.reps||'0'))?s:b,ex.sets[0]);
          newPRHistory[ex.name]=[...(newPRHistory[ex.name]||[]),{
            date:new Date().toISOString(), weight:parseFloat(bestSet.weight||'0'),
            reps:parseFloat(bestSet.reps||'0'), estimated1RM:best
          }];
        }
      }
    }
    await AsyncStorage.setItem('prHistory',JSON.stringify(newPRHistory));
    setPRHistory(newPRHistory);

    // Update maxes
    const newMaxes = {...userMaxes};
    for (const ex of finished.exercises) {
      const best=getBest1RM(ex.sets);
      if (best>(newMaxes[ex.name]||0)) newMaxes[ex.name]=best;
    }
    await AsyncStorage.setItem('userMaxes',JSON.stringify(newMaxes));
    setUserMaxes(newMaxes);

    const raw = await AsyncStorage.getItem('workouts');
    const history = raw?JSON.parse(raw):[];
    history.push(finished);
    await AsyncStorage.setItem('workouts',JSON.stringify(history));
    await AsyncStorage.removeItem('activeWorkout');
    gymTimer.reset();

    // Muskel Battery update
    const stress = calcMuscleStress(finished.exercises,newMaxes);
    const rawBattery = await AsyncStorage.getItem('batteryData');
    if (rawBattery) {
      const battery = JSON.parse(rawBattery);
      const totalStress = Object.values(stress).reduce((a:number,b:number)=>a+b,0);
      const drain = Math.min(30,Math.round(totalStress*10));
      const calories = Math.round(finished.intensity*80+duration*5);
      await AsyncStorage.setItem('batteryData',JSON.stringify({
        ...battery, level:Math.max(0,battery.level-drain),
        calorieEntries:[...(battery.calorieEntries||[]),{
          id:Date.now().toString(), time:new Date().toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'}),
          kcal:calories, label:finished.name,
        }]
      }));
    }

    setWorkouts(prev=>[...prev,finished]);
    setActiveWorkout(null);

    // Show nutrition advice
    const advice = getNutritionAdvice({...finished,type:'gym'},newMaxes,bodyWeight);
    setNutritionAdvice(advice);
    setShowNutrition(true);
  }

  async function saveRoutine(name: string, exercises: {name:string;muscleGroup:string;defaultSets:number}[]) {
    const routine: Routine = { id:Date.now().toString(), name, exercises };
    const updated = [...routines,routine];
    setRoutines(updated);
    await AsyncStorage.setItem('routines',JSON.stringify(updated));
  }

  async function saveCurrentAsRoutine() {
    if (!activeWorkout||activeWorkout.exercises.length===0) { Alert.alert('Keine Übungen zum Speichern'); return; }
    const exercises = activeWorkout.exercises.map(ex=>({name:ex.name,muscleGroup:ex.muscleGroup,defaultSets:ex.sets.length}));
    Alert.prompt('Routine benennen','',async(name)=>{
      if (name) await saveRoutine(name,exercises);
    });
  }

  async function deleteWorkout(id: string) {
    Alert.alert('Training löschen?','',[
      {text:'Abbrechen',style:'cancel'},
      {text:'Löschen',style:'destructive',onPress:async()=>{
        const updated=workouts.filter(w=>w.id!==id);
        setWorkouts(updated);
        await AsyncStorage.setItem('workouts',JSON.stringify(updated));
      }}
    ]);
  }

  async function deleteRun(id: string) {
    Alert.alert('Lauf löschen?','',[
      {text:'Abbrechen',style:'cancel'},
      {text:'Löschen',style:'destructive',onPress:async()=>{
        const updated=runs.filter(r=>r.id!==id);
        setRuns(updated);
        await AsyncStorage.setItem('runs',JSON.stringify(updated));
      }}
    ]);
  }

  // Check for recommended PR tests
  const prRecommendations = Object.keys(userMaxes).filter(name=>{
    const rec=shouldRecommendPRTest(name,prHistory);
    return rec.recommend&&rec.daysSince>=90;
  });

  const isActive = activeWorkout||activeRun||activeJudo||activeManual;
  const totalSets = activeWorkout?.exercises.reduce((s,ex)=>s+ex.sets.length,0)??0;
  const totalVolume = activeWorkout?.exercises.reduce((total,ex)=>
    total+ex.sets.reduce((s,set)=>s+(parseFloat(set.reps||'0')*parseFloat(set.weight||'0')),0),0)??0;
  const weekGyms = workouts.filter(w=>isThisWeek(w.date)&&w.type!=='run');
  const weekRuns = runs.filter(r=>isThisWeek(r.date));
  const weekRunKm = weekRuns.reduce((s,r)=>s+r.distance,0);
  const avgPaceSeconds = weekRuns.length>0
    ? weekRuns.reduce((s,r)=>{ const[m,sec]=r.pace.split(':').map(Number); return s+(m*60+(sec||0)); },0)/weekRuns.length : 0;

  // ─── Render Onboarding ──────────────────────────────────────
  if (onboardingDone===null) return <View style={{flex:1,backgroundColor:theme.bg}}/>;
  if (onboardingDone===false) return <OnboardingScreen onDone={()=>{ setOnboardingDone(true); loadAll(); }}/>;

  return (
    <View style={{flex:1,backgroundColor:theme.bg}}>
      {/* Modals */}
      {viewingWorkout&&<WorkoutDetailModal workout={viewingWorkout} onClose={()=>setViewingWorkout(null)}/>}
      {showPRProgress&&<PRProgressScreen onClose={()=>setShowPRProgress(false)}/>}
      {showNutrition&&nutritionAdvice&&<NutritionAdviceModal advice={nutritionAdvice} onClose={()=>setShowNutrition(false)}/>}
      {showRoutineManager&&<RoutineManagerModal routines={routines} onSelect={(r)=>{setShowRoutineManager(false);startWorkout(r);}} onSave={saveRoutine} onClose={()=>setShowRoutineManager(false)}/>}

      {/* Tab toggle during active session */}
      {isActive&&(
        <View style={styles.modeToggle}>
          {activeWorkout&&<TouchableOpacity style={[styles.modeBtn,activeTab==='gym'&&styles.modeBtnGymActive]} onPress={()=>setActiveTab('gym')} activeOpacity={0.7}>
            <Text style={[styles.modeBtnText,activeTab==='gym'&&{color:theme.blue}]}>🏋️ Gym</Text>
          </TouchableOpacity>}
          {activeRun&&<TouchableOpacity style={[styles.modeBtn,activeTab==='run'&&styles.modeBtnRunActive]} onPress={()=>setActiveTab('run')} activeOpacity={0.7}>
            <Text style={[styles.modeBtnText,activeTab==='run'&&{color:theme.green}]}>🏃 Lauf</Text>
          </TouchableOpacity>}
          {activeJudo&&<TouchableOpacity style={[styles.modeBtn,activeTab==='judo'&&{backgroundColor:'#7C3AED20'}]} onPress={()=>setActiveTab('judo')} activeOpacity={0.7}>
            <Text style={[styles.modeBtnText,activeTab==='judo'&&{color:'#7C3AED'}]}>🥋 Judo</Text>
          </TouchableOpacity>}
          {activeManual&&<TouchableOpacity style={[styles.modeBtn,activeTab==='manual'&&{backgroundColor:theme.orangeLight}]} onPress={()=>setActiveTab('manual')} activeOpacity={0.7}>
            <Text style={[styles.modeBtnText,activeTab==='manual'&&{color:theme.orange}]}>📝 Manuell</Text>
          </TouchableOpacity>}
        </View>
      )}

      {activeRun&&activeTab==='run'&&<RunScreen onStop={stopSession}/>}
      {activeJudo&&activeTab==='judo'&&<JudoScreen onDone={stopSession}/>}
      {activeManual&&activeTab==='manual'&&<ManualSessionScreen onDone={stopSession}/>}

      {(activeTab==='gym'||!isActive)&&(
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <Animated.View style={{opacity:fadeAnim}}>

            {/* ── Home Screen ── */}
            {!isActive&&(
              <>
                <Text style={styles.headerLabel}>Training</Text>
                <Text style={styles.title}>Bereit für{'\n'}heute?</Text>

                {/* PR Recommendations Banner */}
                {prRecommendations.length>0&&(
                  <TouchableOpacity style={styles.prBanner} onPress={()=>setShowPRProgress(true)}>
                    <Text style={styles.prBannerText}>🏆 {prRecommendations.length} Übung{prRecommendations.length>1?'en':''} für PR-Test bereit!</Text>
                    <Text style={styles.prBannerSub}>{prRecommendations.slice(0,2).join(', ')}{prRecommendations.length>2?` +${prRecommendations.length-2}`:''}</Text>
                  </TouchableOpacity>
                )}

                {/* Gym Card */}
                <TouchableOpacity style={styles.gymCard} onPress={()=>setShowNewWorkout(true)} activeOpacity={0.85}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIcon,{backgroundColor:theme.blueLight}]}><Text style={styles.cardEmoji}>🏋️</Text></View>
                    {weekGyms.length>0&&<View style={[styles.cardBadge,{backgroundColor:theme.blueLight}]}><Text style={[styles.cardBadgeText,{color:theme.blue}]}>{weekGyms.length}× diese Woche</Text></View>}
                  </View>
                  <Text style={styles.cardTitle}>Gym Training</Text>
                  <Text style={styles.cardDesc}>Übungen, Sets & Gewichte loggen</Text>
                  {weekGyms.length>0&&(
                    <View style={styles.cardStats}>
                      <View style={styles.cardStat}>
                        <Text style={[styles.cardStatVal,{color:theme.blue}]}>{Math.round(weekGyms.reduce((s,w)=>s+w.exercises.reduce((t,ex)=>t+ex.sets.reduce((ss,set)=>ss+parseFloat(set.reps||'0')*parseFloat(set.weight||'0'),0),0),0)).toLocaleString()}</Text>
                        <Text style={styles.cardStatLbl}>kg Vol.</Text>
                      </View>
                      <View style={styles.cardStat}>
                        <Text style={[styles.cardStatVal,{color:theme.blue}]}>{Math.round(weekGyms.reduce((s,w)=>s+w.duration,0)/weekGyms.length)} min</Text>
                        <Text style={styles.cardStatLbl}>Ø Dauer</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Run Card */}
                <TouchableOpacity style={styles.runCard} onPress={startRun} activeOpacity={0.85}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIcon,{backgroundColor:theme.greenLight}]}><Text style={styles.cardEmoji}>🏃</Text></View>
                    {weekRuns.length>0&&<View style={[styles.cardBadge,{backgroundColor:theme.greenLight}]}><Text style={[styles.cardBadgeText,{color:theme.green}]}>{weekRuns.length}× diese Woche</Text></View>}
                  </View>
                  <Text style={[styles.cardTitle,{color:theme.green}]}>Lauf</Text>
                  <Text style={styles.cardDesc}>Distanz, Pace & Zeit tracken</Text>
                  {weekRuns.length>0&&(
                    <View style={styles.cardStats}>
                      <View style={styles.cardStat}><Text style={[styles.cardStatVal,{color:theme.green}]}>{weekRunKm.toFixed(1)} km</Text><Text style={styles.cardStatLbl}>Total</Text></View>
                      <View style={styles.cardStat}><Text style={[styles.cardStatVal,{color:theme.green}]}>{formatPace(avgPaceSeconds)}</Text><Text style={styles.cardStatLbl}>Ø Pace</Text></View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Judo Card */}
                <TouchableOpacity style={[styles.gymCard,{borderLeftColor:'#7C3AED'}]} onPress={startJudo} activeOpacity={0.85}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIcon,{backgroundColor:'#7C3AED20'}]}><Text style={styles.cardEmoji}>🥋</Text></View>
                  </View>
                  <Text style={[styles.cardTitle,{color:'#7C3AED'}]}>Judo Training</Text>
                  <Text style={styles.cardDesc}>Randori-Runden, Dauer & Ernährung</Text>
                </TouchableOpacity>

                {/* Manual Card */}
                <TouchableOpacity style={[styles.gymCard,{borderLeftColor:theme.orange}]} onPress={startManual} activeOpacity={0.85}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIcon,{backgroundColor:theme.orangeLight}]}><Text style={styles.cardEmoji}>📝</Text></View>
                  </View>
                  <Text style={[styles.cardTitle,{color:theme.orange}]}>Manuell erfassen</Text>
                  <Text style={styles.cardDesc}>Beliebiges Training: Schwimmen, BJJ, etc.</Text>
                </TouchableOpacity>

                {/* Quick Links */}
                <Text style={styles.sectionLabel}>Extras</Text>
                <View style={styles.quickLinksGrid}>
                  {[
                    {icon:'💪',label:'Körper',sub:'Muskel Recovery',color:theme.purple,bg:theme.purpleLight,onPress:()=>router.push('/body' as any)},
                    {icon:'🏆',label:'Ranking',sub:'Dein Level',color:theme.orange,bg:theme.orangeLight,onPress:()=>router.push('/ranking' as any)},
                    {icon:'📈',label:'PR-Entwicklung',sub:'Fortschrittskurven',color:theme.blue,bg:theme.blueLight,onPress:()=>setShowPRProgress(true)},
                    {icon:'📋',label:'Routinen',sub:'Gespeicherte Pläne',color:theme.green,bg:theme.greenLight,onPress:()=>setShowRoutineManager(true)},
                  ].map(item=>(
                    <TouchableOpacity key={item.label} style={[styles.quickLinkCard,{borderLeftColor:item.color}]} onPress={item.onPress} activeOpacity={0.7}>
                      <View style={[styles.quickLinkIcon,{backgroundColor:item.bg}]}><Text style={{fontSize:20}}>{item.icon}</Text></View>
                      <View style={{flex:1}}>
                        <Text style={[styles.quickLinkLabel,{color:item.color}]}>{item.label}</Text>
                        <Text style={styles.quickLinkSub}>{item.sub}</Text>
                      </View>
                      <Text style={[styles.quickLinkArrow,{color:item.color}]}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* History */}
                {(workouts.length>0||runs.length>0)&&(
                  <>
                    <Text style={styles.sectionLabel}>Zuletzt</Text>
                    {[
                      ...workouts.filter(w=>w.type!=='run').slice(-5).map(w=>({...w,_type:'gym' as const})),
                      ...runs.slice(-5).map(r=>({...r,_type:'run' as const})),
                    ]
                      .sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())
                      .slice(0,6)
                      .map((item,i)=>{
                        if (item._type==='run') {
                          const r=item as RunData&{_type:'run'};
                          return (
                            <View key={r.id??i} style={styles.historyItem}>
                              <View style={[styles.historyDot,{backgroundColor:theme.green}]}/>
                              <View style={styles.historyInfo}>
                                <Text style={styles.historyName}>🏃 Lauf</Text>
                                <Text style={styles.historyMeta}>{r.distance.toFixed(2)} km · {formatTime(r.duration)} · {r.pace} /km</Text>
                              </View>
                              <View style={styles.historyRight}>
                                <Text style={styles.historyDate}>{new Date(r.date).toLocaleDateString('de',{day:'2-digit',month:'2-digit'})}</Text>
                                <TouchableOpacity onPress={()=>deleteRun(r.id)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                                  <Text style={styles.deleteIcon}>×</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        } else {
                          const w=item as Workout&{_type:'gym'};
                          return (
                            <TouchableOpacity key={w.id??i} style={styles.historyItem} onPress={()=>setViewingWorkout(w)}>
                              <View style={[styles.historyDot,{backgroundColor:w.type==='judo'?'#7C3AED':w.type==='manual'?theme.orange:theme.blue}]}/>
                              <View style={styles.historyInfo}>
                                <Text style={styles.historyName}>{w.type==='judo'?'🥋':w.type==='manual'?'📝':'🏋️'} {w.name}</Text>
                                <Text style={styles.historyMeta}>{w.exercises?.length??0} Übungen · {w.duration} min</Text>
                              </View>
                              <View style={styles.historyRight}>
                                <Text style={styles.historyDate}>{new Date(w.date).toLocaleDateString('de',{day:'2-digit',month:'2-digit'})}</Text>
                                <TouchableOpacity onPress={()=>deleteWorkout(w.id)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                                  <Text style={styles.deleteIcon}>×</Text>
                                </TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                          );
                        }
                      })}
                  </>
                )}
                <View style={{height:120}}/>
              </>
            )}

            {/* ── Active Gym ── */}
            {activeWorkout&&activeTab==='gym'&&(
              <>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:16,marginBottom:8}}>
                  <Text style={styles.title}>{activeWorkout.name}</Text>
                  <View style={{gap:6}}>
                    <TouchableOpacity style={[styles.cardBadge,{backgroundColor:theme.blueLight}]} onPress={saveCurrentAsRoutine}>
                      <Text style={{color:theme.blue,fontSize:11,fontWeight:'600'}}>💾 Routine</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Live timer */}
                <View style={[styles.liveStat,{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12,paddingHorizontal:16}]}>
                  <Text style={[styles.liveStatVal,{color:theme.green,fontSize:26}]}>{formatTime(gymTimer.seconds)}</Text>
                  <TouchableOpacity onPress={()=>gymTimer.isRunning?gymTimer.pause():gymTimer.start()} style={{padding:8}}>
                    <Text style={{color:gymTimer.isRunning?theme.red:theme.green,fontSize:20}}>{gymTimer.isRunning?'⏸':'▶'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.liveStats}>
                  {[
                    {val:activeWorkout.exercises.length,lbl:'Übungen',color:theme.blue},
                    {val:totalSets,lbl:'Sets',color:theme.green},
                    {val:Math.round(totalVolume),lbl:'kg Vol.',color:theme.orange},
                  ].map(s=>(
                    <View key={s.lbl} style={styles.liveStat}>
                      <Text style={[styles.liveStatVal,{color:s.color}]}>{s.val}</Text>
                      <Text style={styles.liveStatLbl}>{s.lbl}</Text>
                    </View>
                  ))}
                </View>

                {activeWorkout.exercises.map(exercise=>{
                  const best1RM=getBest1RM(exercise.sets);
                  const lastSets=lastWorkoutData[exercise.name];
                  const mc=MUSCLE_COLORS[exercise.muscleGroup]||'#888';
                  const userMax=userMaxes[exercise.name];
                  const pctOfMax=userMax&&best1RM>0?Math.round((best1RM/userMax)*100):null;
                  return (
                    <View key={exercise.id} style={styles.exerciseCard}>
                      <View style={styles.exerciseHeader}>
                        <View style={[styles.muscleBadge,{backgroundColor:mc+'20'}]}>
                          <Text style={[styles.muscleBadgeText,{color:mc}]}>{exercise.muscleGroup}</Text>
                        </View>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <TouchableOpacity onPress={()=>removeExercise(exercise.id)}>
                          <Text style={styles.removeBtn}>×</Text>
                        </TouchableOpacity>
                      </View>
                      {lastSets&&(
                        <View style={styles.lastWorkoutRow}>
                          <Text style={styles.lastWorkoutLabel}>Letztes Mal: </Text>
                          <Text style={styles.lastWorkoutVal}>{lastSets.map(s=>`${s.weight}kg × ${s.reps}`).join(' · ')}</Text>
                        </View>
                      )}
                      {best1RM>0&&(
                        <View style={{flexDirection:'row',gap:12,marginBottom:10}}>
                          <Text style={styles.oneRM}>Est. 1RM: <Text style={{color:theme.blue,fontWeight:'600'}}>{best1RM}kg</Text></Text>
                          {pctOfMax&&<Text style={styles.oneRM}>% von Max: <Text style={{color:pctOfMax>=100?theme.green:pctOfMax>=85?theme.orange:theme.textSecondary,fontWeight:'600'}}>{pctOfMax}%</Text></Text>}
                        </View>
                      )}
                      <View style={styles.setHeader}>
                        {['Set','Wdh.','Gewicht (kg)'].map(h=><Text key={h} style={styles.setHeaderText}>{h}</Text>)}
                      </View>
                      {exercise.sets.map((set,si)=>(
                        <View key={si} style={styles.setRow}>
                          <Text style={styles.setNumber}>{si+1}</Text>
                          <TextInput style={styles.setInput} placeholder={lastSets?.[si]?.reps||'0'} placeholderTextColor={theme.textTertiary}
                            value={set.reps} onChangeText={v=>updateSet(exercise.id,si,'reps',v)} keyboardType="numeric"/>
                          <TextInput style={styles.setInput} placeholder={lastSets?.[si]?.weight||'0'} placeholderTextColor={theme.textTertiary}
                            value={set.weight} onChangeText={v=>updateSet(exercise.id,si,'weight',v)} keyboardType="decimal-pad"/>
                        </View>
                      ))}
                      <TouchableOpacity style={styles.addSetBtn} onPress={()=>addSet(exercise.id)}>
                        <Text style={styles.addSetBtnText}>+ Set hinzufügen</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                <TouchableOpacity style={styles.addExerciseBtn} onPress={()=>setShowExerciseModal(true)}>
                  <Text style={styles.addExerciseBtnText}>+ Übung hinzufügen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
                  <Text style={styles.finishBtnText}>Training abschliessen ✓</Text>
                </TouchableOpacity>
                <View style={{height:120}}/>
              </>
            )}
          </Animated.View>
        </ScrollView>
      )}

      {/* New Gym Workout Modal */}
      <Modal visible={showNewWorkout} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gym Training</Text>
            <TouchableOpacity style={[styles.saveBtn,{backgroundColor:theme.cardSecondary,marginBottom:4}]} onPress={()=>{setShowNewWorkout(false);setShowRoutineManager(true);}}>
              <Text style={[styles.saveBtnText,{color:theme.textPrimary}]}>📋 Routine laden</Text>
            </TouchableOpacity>
            <Text style={styles.inputLabel}>Name (optional)</Text>
            <TextInput style={styles.input} placeholder="z.B. Oberkörper A" placeholderTextColor={theme.textTertiary} value={workoutName} onChangeText={setWorkoutName}/>
            <Text style={styles.inputLabel}>Intensität</Text>
            <View style={styles.intensityRow}>
              {[1,2,3,4,5].map(n=>(
                <TouchableOpacity key={n} style={[styles.intensityBtn,intensity===n&&styles.intensityBtnActive]} onPress={()=>setIntensity(n)}>
                  <Text style={[styles.intensityBtnText,intensity===n&&{color:'#fff'}]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={()=>startWorkout()}>
              <Text style={styles.saveBtnText}>Training starten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={()=>setShowNewWorkout(false)}>
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Exercise Modal */}
      <Modal visible={showExerciseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Übung hinzufügen</Text>
              {MUSCLE_GROUPS.map(mg=>{
                const exs=allExercises.filter(e=>e.muscleGroup===mg);
                if (exs.length===0) return null;
                return (
                  <View key={mg} style={styles.presetGroup}>
                    <Text style={[styles.presetGroupLabel,{color:MUSCLE_COLORS[mg]}]}>{mg}</Text>
                    <View style={styles.presetChips}>
                      {exs.map(ex=>(
                        <TouchableOpacity key={ex.name} style={styles.presetChip} onPress={()=>addExercise(ex.name,ex.muscleGroup)}>
                          <Text style={styles.presetChipText}>{ex.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
              <Text style={styles.inputLabel}>Eigene Übung</Text>
              <TextInput style={styles.input} placeholder="Übungsname" placeholderTextColor={theme.textTertiary} value={customExercise} onChangeText={setCustomExercise}/>
              <View style={styles.chipGrid}>
                {MUSCLE_GROUPS.map(mg=>(
                  <TouchableOpacity key={mg} style={[styles.chip,customMuscle===mg&&{backgroundColor:theme.blueLight,borderColor:theme.blue}]} onPress={()=>setCustomMuscle(mg)}>
                    <Text style={[styles.chipText,customMuscle===mg&&{color:theme.blue}]}>{mg}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={addCustomExercise}>
                <Text style={styles.saveBtnText}>Hinzufügen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={()=>setShowExerciseModal(false)}>
                <Text style={styles.cancelBtnText}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Onboarding Styles ────────────────────────────────────────
const ob = StyleSheet.create({
  scroll:{ flex:1, backgroundColor:theme.bg },
  scrollContent:{ padding:24, paddingTop:60, paddingBottom:80 },
  center:{ flex:1, backgroundColor:theme.bg, alignItems:'center', justifyContent:'center', padding:32 },
  emoji:{ fontSize:64, marginBottom:16 },
  title:{ color:theme.textPrimary, fontSize:26, fontWeight:'700', marginBottom:8 },
  subtitle:{ color:theme.blue, fontSize:22, fontWeight:'600', marginBottom:8 },
  sub:{ color:theme.textSecondary, fontSize:14, lineHeight:22, marginBottom:24 },
  hint:{ color:theme.textSecondary, fontSize:13, lineHeight:20, marginBottom:16, backgroundColor:theme.card, padding:12, borderRadius:12 },
  progress:{ color:theme.blue, fontSize:12, fontWeight:'600', letterSpacing:1, marginBottom:8 },
  groupLabel:{ fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:8, fontWeight:'600' },
  chips:{ flexDirection:'row', flexWrap:'wrap', gap:8 },
  chip:{ paddingHorizontal:12, paddingVertical:7, borderRadius:20, backgroundColor:theme.cardSecondary, borderWidth:1, borderColor:'transparent' },
  chipText:{ color:theme.textSecondary, fontSize:13 },
  inputRow:{ flexDirection:'row', gap:12, marginBottom:16 },
  inputBlock:{ flex:1, gap:6 },
  inputLabel:{ color:theme.textSecondary, fontSize:11, textTransform:'uppercase', letterSpacing:1 },
  input:{ backgroundColor:theme.cardSecondary, borderRadius:12, padding:14, color:theme.textPrimary, fontSize:16 },
  estimate:{ backgroundColor:theme.blueLight, borderRadius:14, padding:16, alignItems:'center', marginBottom:16 },
  estimateLabel:{ color:theme.blue, fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:4 },
  estimateVal:{ color:theme.blue, fontSize:32, fontWeight:'700' },
  btn:{ backgroundColor:theme.blue, borderRadius:16, padding:16, alignItems:'center', marginTop:8 },
  btnText:{ color:'#fff', fontSize:16, fontWeight:'600' },
  skipBtn:{ padding:14, alignItems:'center' },
  skipText:{ color:theme.textSecondary, fontSize:14 },
  musclePill:{ alignSelf:'flex-start', paddingHorizontal:12, paddingVertical:5, borderRadius:20, marginBottom:12 },
  musclePillText:{ fontSize:12, fontWeight:'600' },
  customRow:{ flexDirection:'row', gap:8, marginBottom:8 },
});

// ─── Main Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:theme.bg, paddingHorizontal:20 },
  headerLabel:{ color:theme.textSecondary, fontSize:11, letterSpacing:1.5, textTransform:'uppercase', marginTop:60, marginBottom:12 },
  title:{ color:theme.textPrimary, fontSize:28, fontWeight:'600', lineHeight:36, marginBottom:20 },
  sectionLabel:{ color:theme.textSecondary, fontSize:11, textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, marginTop:4 },

  prBanner:{ backgroundColor:'#FF6B6B15', borderRadius:16, padding:14, marginBottom:14, borderLeftWidth:3, borderLeftColor:'#FF6B6B' },
  prBannerText:{ color:'#FF6B6B', fontSize:14, fontWeight:'600' },
  prBannerSub:{ color:theme.textSecondary, fontSize:12, marginTop:3 },

  modeToggle:{ flexDirection:'row', gap:8, paddingHorizontal:20, paddingTop:56, paddingBottom:12, backgroundColor:theme.bg },
  modeBtn:{ flex:1, padding:11, borderRadius:12, alignItems:'center', backgroundColor:theme.card, ...theme.shadow },
  modeBtnGymActive:{ backgroundColor:theme.blueLight },
  modeBtnRunActive:{ backgroundColor:theme.greenLight },
  modeBtnText:{ color:theme.textSecondary, fontSize:14, fontWeight:'500' },

  gymCard:{ backgroundColor:theme.card, borderRadius:18, padding:16, marginBottom:10, borderLeftWidth:3, borderLeftColor:theme.blue, ...theme.shadow },
  runCard:{ backgroundColor:theme.card, borderRadius:18, padding:16, marginBottom:10, borderLeftWidth:3, borderLeftColor:theme.green, ...theme.shadow },
  cardTopRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 },
  cardIcon:{ width:42, height:42, borderRadius:12, alignItems:'center', justifyContent:'center' },
  cardEmoji:{ fontSize:22 },
  cardBadge:{ borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  cardBadgeText:{ fontSize:11, fontWeight:'500' },
  cardTitle:{ color:theme.textPrimary, fontSize:18, fontWeight:'600', marginBottom:4 },
  cardDesc:{ color:theme.textSecondary, fontSize:12, marginBottom:10 },
  cardStats:{ flexDirection:'row', gap:16 },
  cardStat:{ gap:2 },
  cardStatVal:{ fontSize:16, fontWeight:'600' },
  cardStatLbl:{ color:theme.textSecondary, fontSize:10, textTransform:'uppercase', letterSpacing:0.8 },

  quickLinksGrid:{ gap:8, marginBottom:20 },
  quickLinkCard:{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:theme.card, borderRadius:14, padding:14, borderLeftWidth:3, ...theme.shadow },
  quickLinkIcon:{ width:44, height:44, borderRadius:12, alignItems:'center', justifyContent:'center' },
  quickLinkLabel:{ fontSize:15, fontWeight:'600' },
  quickLinkSub:{ color:theme.textSecondary, fontSize:11, marginTop:2 },
  quickLinkArrow:{ fontSize:22 },

  historyItem:{ flexDirection:'row', alignItems:'flex-start', gap:10, paddingVertical:12, borderBottomWidth:0.5, borderBottomColor:theme.borderLight },
  historyDot:{ width:8, height:8, borderRadius:4, marginTop:4, flexShrink:0 },
  historyInfo:{ flex:1, gap:3 },
  historyName:{ color:theme.textPrimary, fontSize:13, fontWeight:'600' },
  historyMeta:{ color:theme.textSecondary, fontSize:11 },
  historyRight:{ alignItems:'flex-end', gap:8 },
  historyDate:{ color:theme.textSecondary, fontSize:11 },
  deleteIcon:{ color:theme.textTertiary, fontSize:20 },

  liveStats:{ flexDirection:'row', gap:8, marginBottom:16 },
  liveStat:{ flex:1, backgroundColor:theme.card, borderRadius:12, padding:12, alignItems:'center', ...theme.shadow },
  liveStatVal:{ fontSize:22, fontWeight:'600' },
  liveStatLbl:{ color:theme.textSecondary, fontSize:9, textTransform:'uppercase', letterSpacing:0.8, marginTop:2 },

  exerciseCard:{ backgroundColor:theme.card, borderRadius:16, padding:16, marginBottom:10, ...theme.shadow },
  exerciseHeader:{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 },
  muscleBadge:{ paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  muscleBadgeText:{ fontSize:11, fontWeight:'500' },
  exerciseName:{ flex:1, color:theme.textPrimary, fontSize:15, fontWeight:'600' },
  removeBtn:{ color:theme.textTertiary, fontSize:22 },
  lastWorkoutRow:{ flexDirection:'row', alignItems:'center', marginBottom:8, backgroundColor:theme.cardSecondary, borderRadius:8, padding:8 },
  lastWorkoutLabel:{ color:theme.textSecondary, fontSize:11 },
  lastWorkoutVal:{ color:theme.blue, fontSize:11, fontWeight:'500' },
  oneRM:{ color:theme.textSecondary, fontSize:11, marginBottom:10 },
  setHeader:{ flexDirection:'row', gap:8, marginBottom:8 },
  setHeaderText:{ flex:1, color:theme.textTertiary, fontSize:10, textTransform:'uppercase', letterSpacing:0.8, textAlign:'center' },
  setRow:{ flexDirection:'row', gap:8, marginBottom:8, alignItems:'center' },
  setNumber:{ color:theme.textSecondary, fontSize:14, width:20, textAlign:'center' },
  setInput:{ flex:1, backgroundColor:theme.cardSecondary, borderRadius:10, padding:10, color:theme.textPrimary, fontSize:15, textAlign:'center' },
  addSetBtn:{ padding:8, alignItems:'center', marginTop:4 },
  addSetBtnText:{ color:theme.blue, fontSize:13, fontWeight:'500' },
  addExerciseBtn:{ backgroundColor:theme.blueLight, borderRadius:14, padding:16, alignItems:'center', marginBottom:10 },
  addExerciseBtnText:{ color:theme.blue, fontSize:15, fontWeight:'500' },
  finishBtn:{ backgroundColor:theme.blue, borderRadius:16, padding:16, alignItems:'center', marginBottom:20 },
  finishBtnText:{ color:'#fff', fontSize:15, fontWeight:'600' },

  runTimerCard:{ margin:20, marginTop:12, backgroundColor:theme.card, borderRadius:24, padding:28, alignItems:'center', gap:10, borderLeftWidth:3, borderLeftColor:theme.green, ...theme.shadow },
  runTimerLabel:{ color:theme.textSecondary, fontSize:10, textTransform:'uppercase', letterSpacing:2 },
  runTimerDisplay:{ color:theme.textPrimary, fontSize:64, fontWeight:'300', fontVariant:['tabular-nums'], letterSpacing:-2 },
  runControlBtn:{ paddingHorizontal:28, paddingVertical:12, borderRadius:20, marginTop:6 },
  runStartBtn:{ backgroundColor:theme.greenLight },
  runPauseBtn:{ backgroundColor:'#FFEBEE' },
  runControlBtnText:{ fontSize:15, fontWeight:'600' },
  runStatsGrid:{ flexDirection:'row', gap:8, paddingHorizontal:20, marginBottom:14 },
  runStatCard:{ flex:1, backgroundColor:theme.card, borderRadius:14, padding:12, alignItems:'center', ...theme.shadow },
  runStatVal:{ fontSize:16, fontWeight:'600' },
  runStatLbl:{ color:theme.textSecondary, fontSize:8, textTransform:'uppercase', letterSpacing:0.8, marginTop:3, textAlign:'center' },
  manualCard:{ marginHorizontal:0, backgroundColor:theme.card, borderRadius:16, padding:16, marginBottom:14, ...theme.shadow },
  manualCardTitle:{ color:theme.textSecondary, fontSize:10, textTransform:'uppercase', letterSpacing:1.5, marginBottom:12 },
  manualRow:{ flexDirection:'row', gap:10 },
  manualItem:{ flex:1, gap:6 },
  manualLabel:{ color:theme.textSecondary, fontSize:9, textTransform:'uppercase', letterSpacing:0.8 },
  manualInput:{ backgroundColor:theme.cardSecondary, borderRadius:10, padding:10, color:theme.textPrimary, fontSize:15, textAlign:'center' },
  finishRunBtn:{ marginHorizontal:0, backgroundColor:theme.green, borderRadius:16, padding:16, alignItems:'center', marginBottom:40 },
  finishRunBtnText:{ color:'#fff', fontSize:15, fontWeight:'600' },

  modalOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  modalCard:{ backgroundColor:theme.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, gap:12 },
  modalTitle:{ color:theme.textPrimary, fontSize:20, fontWeight:'600' },
  inputLabel:{ color:theme.textSecondary, fontSize:11, textTransform:'uppercase', letterSpacing:1.5 },
  input:{ backgroundColor:theme.cardSecondary, borderRadius:12, padding:14, color:theme.textPrimary, fontSize:15 },
  intensityRow:{ flexDirection:'row', gap:8 },
  intensityBtn:{ flex:1, height:44, borderRadius:10, alignItems:'center', justifyContent:'center', backgroundColor:theme.cardSecondary },
  intensityBtnActive:{ backgroundColor:theme.blue },
  intensityBtnText:{ color:theme.textSecondary, fontSize:15, fontWeight:'500' },
  saveBtn:{ backgroundColor:theme.blue, borderRadius:14, padding:16, alignItems:'center' },
  saveBtnText:{ color:'#fff', fontSize:15, fontWeight:'600' },
  cancelBtn:{ padding:14, alignItems:'center' },
  cancelBtnText:{ color:theme.textSecondary, fontSize:14 },
  presetGroup:{ marginBottom:12 },
  presetGroupLabel:{ fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:8, fontWeight:'500' },
  presetChips:{ flexDirection:'row', flexWrap:'wrap', gap:6 },
  presetChip:{ paddingHorizontal:12, paddingVertical:7, borderRadius:20, backgroundColor:theme.cardSecondary },
  presetChipText:{ color:theme.textPrimary, fontSize:13 },
  chipGrid:{ flexDirection:'row', flexWrap:'wrap', gap:8 },
  chip:{ paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:theme.cardSecondary },
  chipText:{ color:theme.textSecondary, fontSize:13, fontWeight:'500' },
});