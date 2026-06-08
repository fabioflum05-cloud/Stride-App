// app/progress-photos.tsx
// Fortschrittsfotos — lokal gespeichert, Vorder/Seite/Rücken, monatlicher Vergleich

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert, Animated, Dimensions, Image, Modal,
    ScrollView,
    Text, TouchableOpacity, View
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from '../constants/ThemeContext';

const W = Dimensions.get('window').width;
const STORAGE_KEY = 'progress_photos';

// ─── Types ────────────────────────────────────────────────────────────────────
type PhotoAngle = 'Vorne' | 'Seite' | 'Rücken';
type PhotoEntry = {
  id:     string;
  date:   string; // ISO
  angle:  PhotoAngle;
  uri:    string;
  weight?: number;
  note?:  string;
};

const ANGLES: PhotoAngle[] = ['Vorne', 'Seite', 'Rücken'];
const ANGLE_ICONS: Record<PhotoAngle, string> = { 'Vorne': '⬆️', 'Seite': '➡️', 'Rücken': '⬇️' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  const d = new Date(parseInt(year), parseInt(month)-1, 1);
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProgressPhotosScreen() {
  const { colors } = useAppTheme();
  const isDark     = colors.bg.startsWith('#0') || colors.bg.startsWith('#1') || colors.bg.startsWith('#2') || colors.bg === '#383838';
  const bg         = colors.bg;
  const card       = colors.card;
  const cardAlt    = colors.cardSecondary;
  const border     = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const text       = isDark ? '#F5F0EE' : '#1A1209';
  const textMuted  = isDark ? 'rgba(245,240,238,0.45)' : 'rgba(26,18,9,0.45)';
  const textDim    = isDark ? 'rgba(245,240,238,0.22)' : 'rgba(26,18,9,0.22)';

  const [photos,     setPhotos]     = useState<PhotoEntry[]>([]);
  const [selAngle,   setSelAngle]   = useState<PhotoAngle>('Vorne');
  const [viewPhoto,  setViewPhoto]  = useState<PhotoEntry | null>(null);
  const [comparing,  setComparing]  = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    load();
    fade.setValue(0);
    Animated.timing(fade, { toValue:1, duration:400, useNativeDriver:true }).start();
  }, []));

  async function load() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) setPhotos(JSON.parse(raw));
  }

  async function save(updated: PhotoEntry[]) {
    setPhotos(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function addPhoto(angle: PhotoAngle) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      // try camera
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert('Zugriff benötigt', 'Bitte erlaube Kamera- oder Foto-Zugriff.');
        return;
      }
    }

    Alert.alert('Foto hinzufügen', `${angle} — Woher?`, [
      {
        text: 'Kamera', onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [3,4] });
          if (!result.canceled && result.assets[0]) {
            const entry: PhotoEntry = {
              id:    Date.now().toString(),
              date:  new Date().toISOString(),
              angle,
              uri:   result.assets[0].uri,
            };
            await save([entry, ...photos]);
          }
        }
      },
      {
        text: 'Galerie', onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'] as any, quality: 0.8, allowsEditing: true, aspect: [3,4],
          });
          if (!result.canceled && result.assets[0]) {
            const entry: PhotoEntry = {
              id:    Date.now().toString(),
              date:  new Date().toISOString(),
              angle,
              uri:   result.assets[0].uri,
            };
            await save([entry, ...photos]);
          }
        }
      },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  }

  async function deletePhoto(id: string) {
    Alert.alert('Foto löschen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        await save(photos.filter(p => p.id !== id));
        setViewPhoto(null);
      }},
    ]);
  }

  // Group by month
  const byAngle   = photos.filter(p => p.angle === selAngle);
  const months    = [...new Set(byAngle.map(p => monthKey(p.date)))].sort((a,b) => b.localeCompare(a));

  // Latest per angle for overview
  const latestPerAngle = ANGLES.reduce<Record<PhotoAngle, PhotoEntry | null>>((acc, a) => {
    acc[a] = photos.filter(p => p.angle === a)[0] ?? null;
    return acc;
  }, { Vorne: null, Seite: null, Rücken: null });

  // Compare: latest vs one month ago
  const comparePhotos = ANGLES.map(a => {
    const all = photos.filter(p => p.angle === a).sort((x,y) => new Date(y.date).getTime() - new Date(x.date).getTime());
    const latest = all[0] ?? null;
    const older  = all.slice(1).find(p => {
      const diff = (new Date(latest?.date ?? '').getTime() - new Date(p.date).getTime()) / (1000*60*60*24);
      return diff >= 14;
    }) ?? all[1] ?? null;
    return { angle: a, latest, older };
  });

  const cardStyle = { backgroundColor: card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: border, marginBottom: 12 };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 120 }}>
        <Animated.View style={{ opacity: fade }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <View>
              <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 18l-6-6 6-6" stroke={textMuted} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: textDim, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
                Körper
              </Text>
              <Text style={{ fontSize: 30, fontWeight: '800', color: text, letterSpacing: -0.8 }}>
                Fortschrittsfotos
              </Text>
            </View>
            <TouchableOpacity onPress={() => setComparing(!comparing)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                backgroundColor: comparing ? colors.accent : cardAlt,
                borderWidth: 1, borderColor: comparing ? colors.accent : border, marginTop: 28 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: comparing ? '#fff' : textMuted }}>
                Vergleich
              </Text>
            </TouchableOpacity>
          </View>

          {/* Overview — latest per angle */}
          {!comparing && (
            <View style={[cardStyle, { marginBottom: 16 }]}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 14 }}>
                Aktuell
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {ANGLES.map(angle => {
                  const latest = latestPerAngle[angle];
                  return (
                    <TouchableOpacity key={angle}
                      onPress={() => latest ? setViewPhoto(latest) : addPhoto(angle)}
                      style={{ flex: 1, alignItems: 'center', gap: 8 }}
                      activeOpacity={0.8}>
                      {latest ? (
                        <Image source={{ uri: latest.uri }}
                          style={{ width: (W - 80) / 3, height: (W - 80) / 3 * 1.3, borderRadius: 12 }}
                          resizeMode="cover" />
                      ) : (
                        <View style={{ width: (W - 80) / 3, height: (W - 80) / 3 * 1.3, borderRadius: 12,
                          backgroundColor: cardAlt, borderWidth: 1.5, borderColor: border, borderStyle: 'dashed',
                          alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 24 }}>📷</Text>
                          <Text style={{ fontSize: 10, color: textDim, fontWeight: '600' }}>Hinzufügen</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 11, fontWeight: '600', color: textMuted }}>{angle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Compare View */}
          {comparing && (
            <View style={[cardStyle, { marginBottom: 16 }]}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 14 }}>
                Vorher / Nachher
              </Text>
              {comparePhotos.map(({ angle, latest, older }) => (
                <View key={angle} style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: textMuted, marginBottom: 10 }}>
                    {ANGLE_ICONS[angle]} {angle}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[{ label: 'Vorher', photo: older }, { label: 'Jetzt', photo: latest }].map(({ label, photo }) => (
                      <View key={label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                        {photo ? (
                          <TouchableOpacity onPress={() => setViewPhoto(photo)}>
                            <Image source={{ uri: photo.uri }}
                              style={{ width: '100%', aspectRatio: 0.75, borderRadius: 12 }}
                              resizeMode="cover" />
                          </TouchableOpacity>
                        ) : (
                          <View style={{ width: '100%', aspectRatio: 0.75, borderRadius: 12,
                            backgroundColor: cardAlt, borderWidth: 1, borderColor: border,
                            alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: textDim, fontSize: 12 }}>Kein Foto</Text>
                          </View>
                        )}
                        <Text style={{ fontSize: 11, color: textDim }}>
                          {label}{photo ? ` · ${new Date(photo.date).toLocaleDateString('de-DE', { day:'numeric', month:'short' })}` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Angle Selector */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {ANGLES.map(angle => (
              <TouchableOpacity key={angle} onPress={() => setSelAngle(angle)}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center',
                  backgroundColor: selAngle === angle ? colors.accent : card,
                  borderWidth: 1, borderColor: selAngle === angle ? colors.accent : border }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: selAngle === angle ? '#fff' : textMuted }}>
                  {ANGLE_ICONS[angle]} {angle}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Add Button */}
          <TouchableOpacity onPress={() => addPhoto(selAngle)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 20 }}>📷</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{selAngle} Foto hinzufügen</Text>
          </TouchableOpacity>

          {/* Photos by Month */}
          {months.length === 0 && (
            <View style={[cardStyle, { alignItems: 'center', paddingVertical: 48, borderStyle: 'dashed' }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📸</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 6 }}>Noch keine Fotos</Text>
              <Text style={{ fontSize: 13, color: textMuted, textAlign: 'center' }}>
                Füge dein erstes Fortschrittsfoto hinzu.
              </Text>
            </View>
          )}

          {months.map(month => {
            const monthPhotos = byAngle.filter(p => monthKey(p.date) === month);
            return (
              <View key={month} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase',
                  color: textDim, marginBottom: 12 }}>{monthLabel(month)}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {monthPhotos.map(photo => (
                    <TouchableOpacity key={photo.id} onPress={() => setViewPhoto(photo)} activeOpacity={0.85}>
                      <Image source={{ uri: photo.uri }}
                        style={{ width: (W - 56) / 3, height: (W - 56) / 3 * 1.3, borderRadius: 12 }}
                        resizeMode="cover" />
                      <Text style={{ fontSize: 9, color: textDim, textAlign: 'center', marginTop: 4 }}>
                        {new Date(photo.date).toLocaleDateString('de-DE', { day:'numeric', month:'short' })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}

        </Animated.View>
      </ScrollView>

      {/* Full Screen Photo Viewer */}
      {viewPhoto && (
        <Modal visible animationType="fade" onRequestClose={() => setViewPhoto(null)}>
          <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
            <Image source={{ uri: viewPhoto.uri }}
              style={{ width: W, height: W * 1.4 }} resizeMode="contain" />

            {/* Info */}
            <View style={{ position: 'absolute', bottom: 60, left: 20, right: 20,
              backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 16, padding: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                {viewPhoto.angle}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                {new Date(viewPhoto.date).toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </Text>
            </View>

            {/* Controls */}
            <TouchableOpacity onPress={() => setViewPhoto(null)}
              style={{ position: 'absolute', top: 60, right: 20, width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => deletePhoto(viewPhoto.id)}
              style={{ position: 'absolute', top: 60, left: 20, width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(248,113,113,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16 }}>🗑</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}