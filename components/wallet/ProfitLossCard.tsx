"use client";

import React, { useMemo, useState, useTransition } from "react";
import NumberFlow from "@number-flow/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { getPnLSeries, type RangeKey } from "@/actions/wallet.actions";
import RangeTabs from "@/components/wallet/RangeTabs";
import styles from "./ProfitLossCard.module.scss";

type Props = {
  initial: Awaited<ReturnType<typeof getPnLSeries>> | null;
  walletAddress?: string;
};

type ChartPoint = {
  ts: number;
  value: number;
};

const ProfitLossChart = dynamic(() => import("@/components/wallet/ProfitLossChart"), {
  ssr: false,
  loading: () => <div className={styles.chartLoadingPlaceholder} />,
});

function rangeCaption(range: RangeKey) {
  if (range === "1D") return "Past Day";
  if (range === "ALL") return "Past All Time";
  return `Past ${range}`;
}

function formatHoverDate(ts: number, range: RangeKey): string {
  const base: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (range === "ALL" || range === "1M") {
    base.year = "numeric";
  }
  return new Date(ts).toLocaleString("en-US", base);
}

function GrowthGlyph() {
  return (
    <svg viewBox="0 0 24 24" className={styles.growthGlyph} fill="currentColor" aria-hidden>
      <path d="M12 5 20 19H4z" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" className={styles.shareGlyph} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 4h4v4" />
      <path d="M20 4 11 13" />
      <path d="M20 12v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h5" />
    </svg>
  );
}

export default function ProfitLossCard({ initial, walletAddress }: Props) {
  const initialRange = initial?.range ?? "6H";
  const [range, setRange] = useState<RangeKey>(initialRange);
  const [series, setSeries] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [hoverPoint, setHoverPoint] = useState<ChartPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const data = useMemo<ChartPoint[]>(() => {
    return (series?.points ?? []).map((point) => ({
      ts: point.ts,
      value: point.value,
    }));
  }, [series]);

  const firstValue = data[0]?.value ?? 0;
  const hoveredDelta =
    hoverPoint != null ? Math.round((hoverPoint.value - firstValue) * 100) / 100 : null;
  const displayDelta = hoveredDelta ?? series?.delta ?? 0;
  const displayCaption = hoverPoint ? formatHoverDate(hoverPoint.ts, range) : rangeCaption(range);
  const seriesMessage = series?.message ?? null;
  const emptyLabel = seriesMessage ?? "No chart data";

  const onSelectRange = (nextRange: RangeKey) => {
    if (nextRange === range && series) return;
    setRange(nextRange);
    setHoverPoint(null);
    setError(null);

    startTransition(async () => {
      try {
        const next = await getPnLSeries(nextRange, walletAddress);
        setSeries(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load chart");
      }
    });
  };

  const onShareClick = async () => {
    try {
      const currentUrl = new URL(window.location.href);
      if (walletAddress) {
        currentUrl.searchParams.set("publicKey", walletAddress);
      }
      const shareUrl = currentUrl.toString();

      if (navigator.share) {
        await navigator.share({
          title: "Profit/Loss",
          text: "Open wallet profit/loss view",
          url: shareUrl,
        });
        setShareStatus("Shared");
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("Link copied");
      }
    } catch {
      setShareStatus("Share failed");
    } finally {
      window.setTimeout(() => setShareStatus(null), 2000);
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.titleRow}>
            <GrowthGlyph />
            <span className={styles.titleText}>Profit/Loss</span>
            <button
              type="button"
              className={styles.shareButton}
              onClick={onShareClick}
              aria-label="Share profit/loss link"
              title="Share profit/loss link"
            >
              <ShareGlyph />
            </button>
            {shareStatus ? <span className={styles.shareStatus}>{shareStatus}</span> : null}
          </div>

          <div
            className={`${styles.deltaValue} ${
              displayDelta < 0 ? styles.deltaValueNegative : styles.deltaValuePositive
            }`}
          >
            <NumberFlow
              value={displayDelta}
              locales="en-US"
              format={{
                style: "currency",
                currency: "USD",
                signDisplay: "always",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }}
            />
          </div>
        </div>

        <RangeTabs value={range} onChange={onSelectRange} disabled={isPending} className={styles.tabs} />
      </div>

      <div className={styles.captionRow}>
        <div className={styles.caption}>{isPending ? `Updating ${range}...` : displayCaption}</div>
        <div className={styles.watermarkWrap}>
          <Image
            src="/assets/dashboard/Group%203.svg"
            alt=""
            width={30}
            height={20}
            className={styles.watermarkGlyph}
            aria-hidden
          />
        </div>
      </div>

      {error ? <div className={styles.errorText}>{error}</div> : null}
      {!error && series?.status === "error" && seriesMessage ? (
        <div className={styles.errorText}>{seriesMessage}</div>
      ) : null}

      <div className={styles.chartWrap}>
        {data.length === 0 ? (
          <div className={styles.emptyState}>{emptyLabel}</div>
        ) : (
          <ProfitLossChart
            data={data}
            range={range}
            firstValue={firstValue}
            isPending={isPending}
            onHoverPoint={setHoverPoint}
          />
        )}
      </div>
    </section>
  );
}
