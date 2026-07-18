// components/GradientBar.tsx
// Horizontaler Fortschrittsbalken mit Farbverlauf (abgerundete Ecken, Gradient von hell nach Akzentfarbe).
// Nutzt echte Pixelbreite (onLayout) statt SVG-viewBox-Skalierung, damit die runden Ecken
// bei jeder Container-Breite kreisrund bleiben (kein "preserveAspectRatio"-Verzerren).

import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export function GradientBar({
  pct, color, trackColor, height = 8, style,
}: {
  pct: number;
  color: string;
  trackColor?: string;
  height?: number;
  style?: object;
}) {
  const [w, setW] = useState(0);
  const clamped = Math.max(0, Math.min(100, pct));
  const r = height / 2;

  function onLayout(e: LayoutChangeEvent) {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - w) > 0.5) setW(width);
  }

  const fillW = Math.max(0, (clamped / 100) * w);
  const gradId = `gb-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <View onLayout={onLayout} style={[{ height, borderRadius: r, overflow: 'hidden', backgroundColor: trackColor ?? 'rgba(128,128,128,0.15)' }, style]}>
      {w > 0 && fillW > 0 && (
        <Svg width={fillW} height={height}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={color} stopOpacity={0.45} />
              <Stop offset="1" stopColor={color} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={fillW} height={height} rx={r} ry={r} fill={`url(#${gradId})`} />
        </Svg>
      )}
    </View>
  );
}
