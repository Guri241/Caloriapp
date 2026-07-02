import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { colors, spacing } from "@/theme";
import type { WeightLog } from "@/api/types";

const CHART_HEIGHT = 160;
const PADDING = 16;

interface WeightChartProps {
  logs: WeightLog[];
  width: number;
}

// 体重推移の簡易折れ線グラフ（react-native-svgで自前実装、外部チャートライブラリ非依存）
export function WeightChart({ logs, width }: WeightChartProps) {
  if (logs.length < 2) {
    return (
      <View style={[styles.empty, { width, height: CHART_HEIGHT }]}>
        <Text style={styles.emptyText}>記録が2件以上になるとグラフが表示されます</Text>
      </View>
    );
  }

  const ascending = [...logs].reverse();
  const weights = ascending.map((log) => log.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const plotWidth = width - PADDING * 2;
  const plotHeight = CHART_HEIGHT - PADDING * 2;

  const points = ascending.map((log, i) => {
    const x = PADDING + (i / (ascending.length - 1)) * plotWidth;
    const y = PADDING + plotHeight - ((log.weightKg - min) / range) * plotHeight;
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View>
      <Svg width={width} height={CHART_HEIGHT}>
        <Line
          x1={PADDING}
          y1={PADDING + plotHeight}
          x2={width - PADDING}
          y2={PADDING + plotHeight}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.primary} />
        ))}
      </Svg>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min.toFixed(1)} kg</Text>
        <Text style={styles.rangeText}>{max.toFixed(1)} kg</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: PADDING,
    marginTop: spacing.xs,
  },
  rangeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
