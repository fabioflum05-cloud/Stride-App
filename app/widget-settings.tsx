import BackButton from '@/components/BackButton';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../constants/LanguageContext';
import { theme } from '../constants/theme';
import {
    DEFAULT_WIDGET_CONFIG,
    getWidgetConfig,
    saveWidgetConfig,
    WidgetConfig,
    WidgetMetricKey,
    WIDGET_METRICS,
    WIDGET_SLOT_COUNTS,
} from '../utils/widgetData';

const widgetPreview = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E5E5EA',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
};

type SizeKey = keyof WidgetConfig;
const SIZES: { key: SizeKey; titleKey: 'widget_size_small' | 'widget_size_medium' | 'widget_size_large' | 'widget_size_lock'; emoji: string }[] = [
  { key: 'small', titleKey: 'widget_size_small', emoji: '◻️' },
  { key: 'medium', titleKey: 'widget_size_medium', emoji: '▭' },
  { key: 'large', titleKey: 'widget_size_large', emoji: '▢' },
  { key: 'lock', titleKey: 'widget_size_lock', emoji: '🔒' },
];

export default function WidgetSettingsScreen() {
  const { t } = useLanguage();
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_WIDGET_CONFIG);
  const [saved, setSaved] = useState(false);
  const [picker, setPicker] = useState<{ size: SizeKey; slot: number } | null>(null);

  useFocusEffect(useCallback(() => {
    getWidgetConfig().then(setConfig);
    setSaved(false);
  }, []));

  function setSlot(size: SizeKey, slot: number, metric: WidgetMetricKey) {
    setConfig(prev => {
      const arr = [...prev[size]];
      arr[slot] = metric;
      return { ...prev, [size]: arr };
    });
    setSaved(false);
    setPicker(null);
  }

  async function handleSave() {
    await saveWidgetConfig(config);
    setSaved(true);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BackButton />
      <Text style={styles.headerLabel}>{t('widget_settings_subtitle')}</Text>
      <Text style={styles.title}>{t('widget_settings_title')}</Text>
      <Text style={styles.infoText}>{t('widget_info')}</Text>

      {SIZES.map(({ key, titleKey, emoji }) => {
        const slotCount = WIDGET_SLOT_COUNTS[key];
        const slots = config[key] ?? [];
        return (
          <View key={key} style={styles.card}>
            <View style={styles.sizeHeader}>
              <Text style={styles.sizeEmoji}>{emoji}</Text>
              <Text style={styles.sizeTitle}>{t(titleKey)}</Text>
            </View>
            <Text style={styles.chooseLabel}>{t('widget_choose_content')}</Text>
            {Array.from({ length: slotCount }).map((_, i) => {
              const metric = slots[i];
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.slotRow, i < slotCount - 1 && styles.slotRowBorder]}
                  onPress={() => setPicker({ size: key, slot: i })}
                  activeOpacity={0.6}>
                  <Text style={styles.slotLabel}>{t('widget_slot')} {i + 1}</Text>
                  <View style={styles.slotValue}>
                    <Text style={styles.slotValueText}>
                      {metric ? t(`widget_metric_${metric}` as any) : '—'}
                    </Text>
                    <Text style={styles.chevron}>→</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      {/* Preview */}
      <Text style={styles.previewLabel}>{t('widget_preview')}</Text>
      <View style={styles.previewWrap}>
        {SIZES.map(({ key, emoji }) => (
          <View key={key} style={[styles.previewBox, key === 'large' && styles.previewBoxLarge, key === 'medium' && styles.previewBoxMedium]}>
            <Text style={styles.previewEmoji}>{emoji}</Text>
            {(config[key] ?? []).filter(Boolean).slice(0, WIDGET_SLOT_COUNTS[key]).map((m, i) => (
              <View key={i} style={styles.previewRow}>
                <Text style={styles.previewMetricLabel} numberOfLines={1}>{t(`widget_metric_${m}` as any)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
        <Text style={styles.saveBtnText}>{saved ? `✓ ${t('done')}` : t('widget_save')}</Text>
      </TouchableOpacity>

      <View style={{ height: 80 }} />

      {/* Metric picker modal */}
      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('widget_choose_content')}</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {WIDGET_METRICS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={styles.modalOption}
                  onPress={() => picker && setSlot(picker.size, picker.slot, m)}
                  activeOpacity={0.6}>
                  <Text style={styles.modalOptionText}>{t(`widget_metric_${m}` as any)}</Text>
                  {picker && config[picker.size]?.[picker.slot] === m && <Text style={styles.modalCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', marginBottom: 8 },
  infoText: { color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 20 },
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 12, ...theme.shadow },
  sizeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sizeEmoji: { fontSize: 18 },
  sizeTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
  chooseLabel: { color: theme.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  slotRowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.borderLight },
  slotLabel: { color: theme.textSecondary, fontSize: 13, fontWeight: '500' },
  slotValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotValueText: { color: theme.blue, fontSize: 14, fontWeight: '700' },
  chevron: { color: theme.textTertiary, fontSize: 14 },
  previewLabel: { color: theme.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 8, marginBottom: 10 },
  previewWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  previewBox: { backgroundColor: widgetPreview.card, borderRadius: 16, padding: 12, width: 100, minHeight: 100, justifyContent: 'flex-start', borderWidth: 1, borderColor: widgetPreview.border },
  previewBoxMedium: { width: 210 },
  previewBoxLarge: { width: '100%' },
  previewEmoji: { fontSize: 14, marginBottom: 6 },
  previewRow: { paddingVertical: 3 },
  previewMetricLabel: { color: widgetPreview.textSecondary, fontSize: 10, fontWeight: '600' },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: theme.card, borderRadius: 20, padding: 16, maxHeight: '70%' },
  modalTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12, paddingHorizontal: 4 },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight },
  modalOptionText: { color: theme.textPrimary, fontSize: 15, fontWeight: '500' },
  modalCheck: { color: theme.blue, fontSize: 16, fontWeight: '700' },
});
