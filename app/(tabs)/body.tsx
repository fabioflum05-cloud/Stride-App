import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
type MuscleState = {
  level: number;
  lastTrained: string | null;
};

type MuscleMap = Record<string, MuscleState>;

const MUSCLES = [
  'Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps',
  'Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden', 'Core'
];

const MUSCLE_RECOVERY_HOURS: Record<string, number> = {
  'Brust': 48, 'Rücken': 48, 'Schultern': 36,
  'Bizeps': 36, 'Trizeps': 36, 'Quadrizeps': 72,
  'Hamstrings': 72, 'Gluteus': 48, 'Waden': 24, 'Core': 24,
};

function getMuscleColor(level: number) {
  if (level >= 80) return '#A78BFA';
  if (level >= 60) return '#67E8F9';
  if (level >= 40) return '#FB923C';
  if (level >= 20) return '#F472B6';
  return '#FB7185';
}

function getMuscleOpacity(level: number) {
  return 0.3 + (level / 100) * 0.7;
}

function calculateRecovery(lastTrained: string | null, recoveryHours: number): number {
  if (!lastTrained) return 100;
  const hours = (Date.now() - new Date(lastTrained).getTime()) / 3600000;
  return Math.min(100, Math.round((hours / recoveryHours) * 100));
}

function BodyFront({ muscles }: { muscles: MuscleMap }) {
  const c = (name: string) => getMuscleColor(muscles[name]?.level ?? 100);
  const o = (name: string) => getMuscleOpacity(muscles[name]?.level ?? 100);

  return (
    <Svg width={160} height={320} viewBox="0 0 160 320">
      {/* Head */}
      <Circle cx={80} cy={24} r={18} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1.5} />
      {/* Neck */}
      <Rect x={74} y={40} width={12} height={12} rx={3} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />

      {/* Left Shoulder */}
      <Ellipse cx={50} cy={62} rx={14} ry={12}
        fill={c('Schultern')} stroke={c('Schultern')} strokeWidth={1}
        opacity={o('Schultern')} />
      {/* Right Shoulder */}
      <Ellipse cx={110} cy={62} rx={14} ry={12}
        fill={c('Schultern')} stroke={c('Schultern')} strokeWidth={1}
        opacity={o('Schultern')} />

      {/* Chest Left */}
      <Ellipse cx={68} cy={76} rx={16} ry={18}
        fill={c('Brust')} stroke={c('Brust')} strokeWidth={1}
        opacity={o('Brust')} />
      {/* Chest Right */}
      <Ellipse cx={92} cy={76} rx={16} ry={18}
        fill={c('Brust')} stroke={c('Brust')} strokeWidth={1}
        opacity={o('Brust')} />

      {/* Core */}
      <Rect x={64} y={95} width={32} height={40} rx={8}
        fill={c('Core')} stroke={c('Core')} strokeWidth={1}
        opacity={o('Core')} />

      {/* Left Bicep */}
      <Ellipse cx={40} cy={90} rx={9} ry={16}
        fill={c('Bizeps')} stroke={c('Bizeps')} strokeWidth={1}
        opacity={o('Bizeps')} />
      {/* Right Bicep */}
      <Ellipse cx={120} cy={90} rx={9} ry={16}
        fill={c('Bizeps')} stroke={c('Bizeps')} strokeWidth={1}
        opacity={o('Bizeps')} />

      {/* Left Forearm */}
      <Ellipse cx={36} cy={120} rx={7} ry={14}
        fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
      {/* Right Forearm */}
      <Ellipse cx={124} cy={120} rx={7} ry={14}
        fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />

      {/* Hands */}
      <Ellipse cx={34} cy={140} rx={6} ry={8} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
      <Ellipse cx={126} cy={140} rx={6} ry={8} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />

      {/* Hip */}
      <Path d="M60 136 Q80 142 100 136 L104 152 Q80 158 56 152 Z"
        fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />

      {/* Left Quad */}
      <Ellipse cx={68} cy={190} rx={17} ry={34}
        fill={c('Quadrizeps')} stroke={c('Quadrizeps')} strokeWidth={1}
        opacity={o('Quadrizeps')} />
      {/* Right Quad */}
      <Ellipse cx={92} cy={190} rx={17} ry={34}
        fill={c('Quadrizeps')} stroke={c('Quadrizeps')} strokeWidth={1}
        opacity={o('Quadrizeps')} />

      {/* Left Knee */}
      <Ellipse cx={68} cy={228} rx={10} ry={8} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
      {/* Right Knee */}
      <Ellipse cx={92} cy={228} rx={10} ry={8} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />

      {/* Left Calf */}
      <Ellipse cx={68} cy={264} rx={11} ry={24}
        fill={c('Waden')} stroke={c('Waden')} strokeWidth={1}
        opacity={o('Waden')} />
      {/* Right Calf */}
      <Ellipse cx={92} cy={264} rx={11} ry={24}
        fill={c('Waden')} stroke={c('Waden')} strokeWidth={1}
        opacity={o('Waden')} />

      {/* Left Foot */}
      <Ellipse cx={66} cy={308} rx={13} ry={7} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
      {/* Right Foot */}
      <Ellipse cx={94} cy={308} rx={13} ry={7} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
    </Svg>
  );
}

function BodyBack({ muscles }: { muscles: MuscleMap }) {
  const c = (name: string) => getMuscleColor(muscles[name]?.level ?? 100);
  const o = (name: string) => getMuscleOpacity(muscles[name]?.level ?? 100);

  return (
    <Svg width={160} height={320} viewBox="0 0 160 320">
      {/* Head */}
      <Circle cx={80} cy={24} r={18} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1.5} />
      {/* Neck */}
      <Rect x={74} y={40} width={12} height={12} rx={3} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />

      {/* Left Shoulder back */}
      <Ellipse cx={50} cy={62} rx={14} ry={12}
        fill={c('Schultern')} stroke={c('Schultern')} strokeWidth={1}
        opacity={o('Schultern')} />
      {/* Right Shoulder back */}
      <Ellipse cx={110} cy={62} rx={14} ry={12}
        fill={c('Schultern')} stroke={c('Schultern')} strokeWidth={1}
        opacity={o('Schultern')} />

      {/* Upper Back */}
      <Path d="M56 52 Q80 56 104 52 L108 100 Q80 108 52 100 Z"
        fill={c('Rücken')} stroke={c('Rücken')} strokeWidth={1}
        opacity={o('Rücken')} />

      {/* Lower Back */}
      <Rect x={64} y={100} width={32} height={36} rx={6}
        fill={c('Rücken')} stroke={c('Rücken')} strokeWidth={1}
        opacity={o('Rücken') * 0.8} />

      {/* Left Tricep */}
      <Ellipse cx={40} cy={88} rx={9} ry={16}
        fill={c('Trizeps')} stroke={c('Trizeps')} strokeWidth={1}
        opacity={o('Trizeps')} />
      {/* Right Tricep */}
      <Ellipse cx={120} cy={88} rx={9} ry={16}
        fill={c('Trizeps')} stroke={c('Trizeps')} strokeWidth={1}
        opacity={o('Trizeps')} />

      {/* Left Forearm */}
      <Ellipse cx={36} cy={118} rx={7} ry={14} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
      {/* Right Forearm */}
      <Ellipse cx={124} cy={118} rx={7} ry={14} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />

      {/* Hands */}
      <Ellipse cx={34} cy={138} rx={6} ry={8} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
      <Ellipse cx={126} cy={138} rx={6} ry={8} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />

      {/* Gluteus */}
      <Ellipse cx={70} cy={148} rx={18} ry={14}
        fill={c('Gluteus')} stroke={c('Gluteus')} strokeWidth={1}
        opacity={o('Gluteus')} />
      <Ellipse cx={90} cy={148} rx={18} ry={14}
        fill={c('Gluteus')} stroke={c('Gluteus')} strokeWidth={1}
        opacity={o('Gluteus')} />

      {/* Left Hamstring */}
      <Ellipse cx={68} cy={192} rx={16} ry={34}
        fill={c('Hamstrings')} stroke={c('Hamstrings')} strokeWidth={1}
        opacity={o('Hamstrings')} />
      {/* Right Hamstring */}
      <Ellipse cx={92} cy={192} rx={16} ry={34}
        fill={c('Hamstrings')} stroke={c('Hamstrings')} strokeWidth={1}
        opacity={o('Hamstrings')} />

      {/* Left Knee back */}
      <Ellipse cx={68} cy={228} rx={10} ry={8} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
      {/* Right Knee back */}
      <Ellipse cx={92} cy={228} rx={10} ry={8} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />

      {/* Left Calf back */}
      <Ellipse cx={68} cy={264} rx={12} ry={26}
        fill={c('Waden')} stroke={c('Waden')} strokeWidth={1}
        opacity={o('Waden')} />
      {/* Right Calf back */}
      <Ellipse cx={92} cy={264} rx={12} ry={26}
        fill={c('Waden')} stroke={c('Waden')} strokeWidth={1}
        opacity={o('Waden')} />

      {/* Left Foot */}
      <Ellipse cx={66} cy={308} rx={13} ry={7} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
      {/* Right Foot */}
      <Ellipse cx={94} cy={308} rx={13} ry={7} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1} />
    </Svg>
  );
}

export default function BodyScreen() {
  const [muscles, setMuscles] = useState<MuscleMap>({});
  const [view, setView] = useState<'front' | 'back'>('front');

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const rawWorkouts = await AsyncStorage.getItem('workouts');
        if (!rawWorkouts) {
          const defaultMuscles: MuscleMap = {};
          MUSCLES.forEach(m => { defaultMuscles[m] = { level: 100, lastTrained: null }; });
          setMuscles(defaultMuscles);
          return;
        }

        const workouts = JSON.parse(rawWorkouts);
        const lastTrainedMap: Record<string, string> = {};

        workouts.forEach((w: any) => {
          w.exercises?.forEach((ex: any) => {
            const mg = ex.muscleGroup;
            if (!lastTrainedMap[mg] || new Date(w.date) > new Date(lastTrainedMap[mg])) {
              lastTrainedMap[mg] = w.date;
            }
          });
        });

        const newMuscles: MuscleMap = {};
        MUSCLES.forEach(m => {
          const lastTrained = lastTrainedMap[m] ?? null;
          newMuscles[m] = {
            level: calculateRecovery(lastTrained, MUSCLE_RECOVERY_HOURS[m]),
            lastTrained,
          };
        });
        setMuscles(newMuscles);
      }
      load();
    }, [])
  );

  const warnings = MUSCLES.filter(m => (muscles[m]?.level ?? 100) < 40);
  const ready = MUSCLES.filter(m => (muscles[m]?.level ?? 100) >= 80);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <BackButton />
      <Text style={styles.headerLabel}>Körper</Text>
      <Text style={styles.title}>Muskel{'\n'}Recovery</Text>

      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'front' && styles.toggleBtnActive]}
          onPress={() => setView('front')}
        >
          <Text style={[styles.toggleText, view === 'front' && styles.toggleTextActive]}>Vorderseite</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'back' && styles.toggleBtnActive]}
          onPress={() => setView('back')}
        >
          <Text style={[styles.toggleText, view === 'back' && styles.toggleTextActive]}>Rückseite</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bodyWrap}>
        {view === 'front'
          ? <BodyFront muscles={muscles} />
          : <BodyBack muscles={muscles} />
        }
        <View style={styles.legend}>
          {[
            { color: '#A78BFA', label: '80–100%' },
            { color: '#67E8F9', label: '60–79%' },
            { color: '#FB923C', label: '40–59%' },
            { color: '#F472B6', label: '20–39%' },
            { color: '#FB7185', label: '0–19%' },
          ].map(item => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {warnings.length > 0 && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠ Noch nicht erholt</Text>
          <Text style={styles.warningText}>{warnings.join(', ')} – heute schonen.</Text>
        </View>
      )}

      {ready.length > 0 && (
        <View style={styles.readyCard}>
          <Text style={styles.readyTitle}>✓ Bereit</Text>
          <Text style={styles.readyText}>{ready.join(', ')}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Alle Muskelgruppen</Text>
      {MUSCLES.map(m => {
        const muscle = muscles[m];
        if (!muscle) return null;
        const color = getMuscleColor(muscle.level);
        const hoursLeft = muscle.lastTrained
          ? Math.max(0, MUSCLE_RECOVERY_HOURS[m] - (Date.now() - new Date(muscle.lastTrained).getTime()) / 3600000)
          : 0;

        return (
          <View key={m} style={styles.muscleRow}>
            <View style={styles.muscleLeft}>
              <Text style={styles.muscleName}>{m}</Text>
              <Text style={styles.muscleTime}>
                {muscle.lastTrained
                  ? hoursLeft > 0
                    ? `noch ${Math.round(hoursLeft)}h`
                    : 'Erholt ✓'
                  : 'Nie trainiert'}
              </Text>
            </View>
            <View style={styles.muscleBarWrap}>
              <View style={[styles.muscleBar, { width: `${muscle.level}%` as any, backgroundColor: color }]} />
            </View>
            <Text style={[styles.muscleLevel, { color }]}>{muscle.level}%</Text>
          </View>
        );
      })}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07040F',
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  headerLabel: {
    color: '#5B4A8A',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 60,
    marginBottom: 12,
  },
  title: {
    color: '#E2D9F3',
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 36,
    marginBottom: 20,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderColor: 'rgba(124,58,237,0.4)',
  },
  toggleText: {
    color: '#3D2E5C',
    fontSize: 13,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#A78BFA',
  },
  bodyWrap: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  legend: {
    gap: 10,
    paddingTop: 40,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#5B4A8A',
    fontSize: 11,
  },
  warningCard: {
    backgroundColor: 'rgba(251,113,133,0.08)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(251,113,133,0.25)',
    padding: 14,
    marginBottom: 10,
  },
  warningTitle: {
    color: '#FB7185',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  warningText: {
    color: '#5B4A8A',
    fontSize: 12,
  },
  readyCard: {
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.25)',
    padding: 14,
    marginBottom: 20,
  },
  readyTitle: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  readyText: {
    color: '#5B4A8A',
    fontSize: 12,
  },
  sectionTitle: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  muscleLeft: {
    width: 110,
  },
  muscleName: {
    color: '#C4B5D9',
    fontSize: 13,
    fontWeight: '500',
  },
  muscleTime: {
    color: '#3D2E5C',
    fontSize: 10,
    marginTop: 2,
  },
  muscleBarWrap: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  muscleBar: {
    height: '100%',
    borderRadius: 2,
  },
  muscleLevel: {
    fontSize: 12,
    fontWeight: '500',
    width: 36,
    textAlign: 'right',
  },
});