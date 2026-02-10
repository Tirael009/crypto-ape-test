"use client";

import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RangeKey } from "@/actions/wallet.actions";
import styles from "./ProfitLossChart.module.scss";

type ChartPoint = {
  ts: number;
  value: number;
};

type Props = {
  data: ChartPoint[];
  range: RangeKey;
  firstValue: number;
  isPending: boolean;
  onHoverPoint: (point: ChartPoint | null) => void;
};

type RenderPoint = ChartPoint & {
  smoothValue: number;
};

function formatSignedUsd(n: number) {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function formatTooltipTime(ts: number, range: RangeKey) {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (range === "ALL" || range === "1M") {
    options.year = "numeric";
  }
  return new Date(ts).toLocaleString("en-US", options);
}

export default function ProfitLossChart({
  data,
  range,
  firstValue,
  isPending,
  onHoverPoint,
}: Props) {
  const renderData = useMemo<RenderPoint[]>(() => {
    if (!data.length) return [];
    if (data.length === 1) {
      return [
        {
          ...data[0],
          smoothValue: data[0].value,
        },
      ];
    }

    const startTs = data[0].ts;
    const endTs = data[data.length - 1].ts;
    const sampleCount = Math.max(56, Math.min(140, data.length * 12));

    const sampled: RenderPoint[] = [];
    let cursor = 0;

    for (let i = 0; i < sampleCount; i += 1) {
      const ratio = sampleCount <= 1 ? 0 : i / (sampleCount - 1);
      const ts = startTs + Math.round((endTs - startTs) * ratio);

      while (cursor < data.length - 2 && data[cursor + 1].ts < ts) {
        cursor += 1;
      }

      const left = data[cursor];
      const right = data[Math.min(cursor + 1, data.length - 1)];

      let value = left.value;
      if (right && right.ts !== left.ts) {
        const spanRatio = Math.max(0, Math.min(1, (ts - left.ts) / (right.ts - left.ts)));
        value = left.value + (right.value - left.value) * spanRatio;
      }

      sampled.push({
        ts,
        value,
        smoothValue: value,
      });
    }

    const lastIndex = sampled.length - 1;
    const radius = 6;
    return sampled.map((point, index) => {
      if (index === 0 || index === lastIndex) {
        return {
          ...point,
          smoothValue: point.value,
        };
      }

      let weightedSum = 0;
      let weightTotal = 0;

      for (let offset = -radius; offset <= radius; offset += 1) {
        const sample = sampled[index + offset];
        if (!sample) continue;
        const weight = radius + 1 - Math.abs(offset);
        weightedSum += sample.value * weight;
        weightTotal += weight;
      }

      const averaged = weightTotal > 0 ? weightedSum / weightTotal : point.value;
      const blend = 0.78;

      return {
        ...point,
        smoothValue: averaged * blend + point.value * (1 - blend),
      };
    });
  }, [data]);

  const onChartMove = (state: unknown) => {
    if (!state || typeof state !== "object") return;

    const maybePayload = (
      state as {
        activePayload?: Array<{ payload?: Partial<RenderPoint> }>;
      }
    ).activePayload;

    const point = maybePayload?.[0]?.payload;
    if (point && typeof point.ts === "number") {
      const nextValue = typeof point.value === "number" ? point.value : null;
      if (nextValue != null) {
        onHoverPoint({ ts: point.ts, value: nextValue });
      }
    }
  };

  return (
    <div className={styles.chartRoot}>
      {isPending ? (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingText}>Loading...</div>
        </div>
      ) : null}

      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={118}>
        <AreaChart data={renderData} onMouseMove={onChartMove} onMouseLeave={() => onHoverPoint(null)}>
          <defs>
            <linearGradient id="pnl-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F06423" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#F06423" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            hide
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            cursor={{ stroke: "rgba(240, 100, 35, 0.35)", strokeWidth: 1, strokeDasharray: "4 4" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const source = payload[0]?.payload as Partial<RenderPoint> | undefined;
              const value = Number(source?.value ?? payload[0].value ?? 0);
              return (
                <div className={styles.tooltip}>
                  <div className={styles.tooltipTime}>{formatTooltipTime(label as number, range)}</div>
                  <div className={styles.tooltipValue}>{formatSignedUsd(value - firstValue)}</div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="smoothValue"
            stroke="#F06423"
            strokeWidth={2.35}
            fillOpacity={1}
            fill="url(#pnl-fill)"
            dot={false}
            activeDot={{ r: 2.2, fill: "#F06423", stroke: "white", strokeWidth: 1.6 }}
            isAnimationActive
            animationDuration={650}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
