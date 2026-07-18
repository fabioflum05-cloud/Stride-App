// components/EditHomeCardsModal.tsx
// Edit-mode sheet for the Home tab: toggle card visibility and drag to reorder.

import { useEffect, useState } from 'react';
import { Modal, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { HomeCardConfig, HomeCardId } from '../utils/homeLayout';

const ROW_H = 60;

function Row({ config, index, total, label, accent, isDark, onToggle, onReorder, onDragEnd }: {
  config: HomeCardConfig; index: number; total: number; label: string; accent: string; isDark: boolean;
  onToggle: (id: HomeCardId) => void;
  onReorder: (id: HomeCardId, newIndex: number) => void;
  onDragEnd: () => void;
}) {
  const topY = useSharedValue(index * ROW_H);
  const dragging = useSharedValue(false);
  const startTop = useSharedValue(0);
  const lastIndex = useSharedValue(index);

  useEffect(() => {
    lastIndex.value = index;
    if (!dragging.value) topY.value = withSpring(index * ROW_H, { damping: 22, stiffness: 220 });
  }, [index]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragging.value = true;
      startTop.value = topY.value;
    })
    .onUpdate(e => {
      topY.value = startTop.value + e.translationY;
      const newIndex = Math.max(0, Math.min(total - 1, Math.round(topY.value / ROW_H)));
      if (newIndex !== lastIndex.value) {
        lastIndex.value = newIndex;
        runOnJS(onReorder)(config.id, newIndex);
      }
    })
    .onFinalize(() => {
      dragging.value = false;
      topY.value = withSpring(lastIndex.value * ROW_H, { damping: 22, stiffness: 220 });
      runOnJS(onDragEnd)();
    });

  const rowStyle = useAnimatedStyle(() => ({
    position: 'absolute', left: 0, right: 0, top: topY.value,
    zIndex: dragging.value ? 10 : 1,
    shadowOpacity: dragging.value ? 0.18 : 0,
    transform: [{ scale: withSpring(dragging.value ? 1.02 : 1) }],
  }));

  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const card = isDark ? '#242120' : '#FFFFFF';
  const text = isDark ? '#F5F0EE' : '#1A1209';
  const dim = isDark ? 'rgba(245,240,238,0.3)' : 'rgba(26,18,9,0.3)';

  return (
    <Animated.View style={[rowStyle, {
      height: ROW_H - 8, marginTop: 4, borderRadius: 14, backgroundColor: card,
      borderWidth: 1, borderColor: border, flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 14, gap: 12, shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
      opacity: config.visible ? 1 : 0.5,
    }]}>
      <GestureDetector gesture={pan}>
        <View style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 18, color: dim, fontWeight: '700' }}>⠿</Text>
        </View>
      </GestureDetector>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: text }}>{label}</Text>
      <Switch value={config.visible} onValueChange={() => onToggle(config.id)} trackColor={{ true: accent }} />
    </Animated.View>
  );
}

export function EditHomeCardsModal({ visible, layout, labels, accent, isDark, onChangeLayout, onClose, title, subtitle, doneLabel }: {
  visible: boolean;
  layout: HomeCardConfig[];
  labels: Record<HomeCardId, string>;
  accent: string;
  isDark: boolean;
  onChangeLayout: (layout: HomeCardConfig[]) => void;
  onClose: () => void;
  title: string;
  subtitle: string;
  doneLabel: string;
}) {
  const [order, setOrder] = useState<HomeCardConfig[]>(layout);

  useEffect(() => { if (visible) setOrder(layout); }, [visible]);

  function toggle(id: HomeCardId) {
    setOrder(prev => {
      const next = prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c);
      onChangeLayout(next);
      return next;
    });
  }

  function reorder(id: HomeCardId, newIndex: number) {
    setOrder(prev => {
      const oldIndex = prev.findIndex(c => c.id === id);
      if (oldIndex === -1 || oldIndex === newIndex) return prev;
      const next = [...prev];
      const [item] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, item);
      return next;
    });
  }

  function commitOrder() {
    onChangeLayout(order);
  }

  const bg = isDark ? '#1C1917' : '#FFFFFF';
  const text = isDark ? '#F5F0EE' : '#1A1209';
  const muted = isDark ? 'rgba(245,240,238,0.5)' : 'rgba(26,18,9,0.5)';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg, padding: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: text }}>{title}</Text>
            <Text style={{ fontSize: 13, color: muted, marginTop: 4 }}>{subtitle}</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: accent, fontSize: 16, fontWeight: '700' }}>{doneLabel}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: order.length * ROW_H, marginTop: 16, position: 'relative' }}>
          {order.map((config, i) => (
            <Row
              key={config.id}
              config={config}
              index={i}
              total={order.length}
              label={labels[config.id]}
              accent={accent}
              isDark={isDark}
              onToggle={toggle}
              onReorder={reorder}
              onDragEnd={commitOrder}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}
