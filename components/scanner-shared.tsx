"use client";

import React from "react";
import {
  Search,
  X,
  Activity,
  Target,
  Zap,
  BarChart3,
  TrendingUp,
  LineChart,
  Gauge,
  Layers,
  Flame,
  ArrowUpRight,
  Crosshair,
  ListChecks,
} from "lucide-react";
import type { StockAnalysis, SignalFlag } from "@/lib/analyzer";

export type ScanResult = StockAnalysis & { scannedAt: string };

export type TabId =
  | "common"
  | "rank"
  | "ema"
  | "rsi"
  | "bb"
  | "uvol"
  | "rvol"
  | "smma_buy"
  | "smma_sell"
  | "smma_bull"
  | "mom"
  | "breakout"
  | "m_rsi_cross"
  | "m_rsi_above"
  | "all";

export const TABS: { id: TabId; label: string; hint: string; icon: React.ReactNode }[] =
  [
    {
      id: "common",
      label: "Common / Confluence",
      hint: "In 2+ core scanners",
      icon: <ListChecks className="w-3.5 h-3.5" />,
    },
    {
      id: "rank",
      label: "Top Ranked",
      hint: "Weighted multi-signal score",
      icon: <Target className="w-3.5 h-3.5" />,
    },
    {
      id: "ema",
      label: "EMA 10>30>50",
      hint: "Weekly bullish EMA stack",
      icon: <LineChart className="w-3.5 h-3.5" />,
    },
    {
      id: "rsi",
      label: "RSI Cross 60",
      hint: "Weekly RSI just crossed above 60",
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    {
      id: "bb",
      label: "BB Upper Cross",
      hint: "Just crossed upper BB(50,2)",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
    },
    {
      id: "uvol",
      label: "Unusual Vol",
      hint: "Volume ≥ strong × avg",
      icon: <Zap className="w-3.5 h-3.5" />,
    },
    {
      id: "rvol",
      label: "Relative Vol",
      hint: "Volume ≥ mild × avg",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
    {
      id: "smma_buy",
      label: "SMMA Buy",
      hint: "SMMA5×13 up + close > SMMA23",
      icon: <Flame className="w-3.5 h-3.5" />,
    },
    {
      id: "smma_sell",
      label: "SMMA Sell",
      hint: "SMMA5 crossed below SMMA13",
      icon: <X className="w-3.5 h-3.5" />,
    },
    {
      id: "smma_bull",
      label: "SMMA Bull",
      hint: "SMMA5>13 and close>SMMA23",
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      id: "mom",
      label: "Momentum",
      hint: "Strong ROC + RSI momentum",
      icon: <Gauge className="w-3.5 h-3.5" />,
    },
    {
      id: "breakout",
      label: "Breakout",
      hint: "Fresh 20-week high breakout",
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
    },
    {
      id: "m_rsi_cross",
      label: "M-RSI Cross",
      hint: "Monthly RSI just crossed 60",
      icon: <Crosshair className="w-3.5 h-3.5" />,
    },
    {
      id: "m_rsi_above",
      label: "M-RSI Above",
      hint: "Monthly RSI already > 60",
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    {
      id: "all",
      label: "Full Universe",
      hint: "Every scanned stock",
      icon: <Search className="w-3.5 h-3.5" />,
    },
  ];

export const CONCURRENCY = 5;
export const DEFAULT_VOL_STRONG = 2.5;
export const DEFAULT_VOL_MILD = 1.5;

export function SignalBadges({ signals }: { signals: SignalFlag[] }) {
  if (!signals.length) return <span className="badge badge-gray">—</span>;
  return (
    <div className="flex flex-wrap gap-1 max-w-[280px]">
      {signals.includes("EMA_STACK") && (
        <span className="badge badge-ema">EMA</span>
      )}
      {signals.includes("RSI_CROSS") && (
        <span className="badge badge-rsi">RSI×</span>
      )}
      {signals.includes("BB_CROSS") && (
        <span className="badge badge-bb">BB×</span>
      )}
      {signals.includes("UNUSUAL_VOL") && (
        <span className="badge badge-vol">UVOL</span>
      )}
      {signals.includes("REL_VOL") &&
        !signals.includes("UNUSUAL_VOL") && (
          <span className="badge badge-rvol">RVOL</span>
        )}
      {signals.includes("SMMA_BUY") && (
        <span className="badge badge-smma">SMMA BUY</span>
      )}
      {signals.includes("SMMA_SELL") && (
        <span className="badge badge-sell">SMMA SELL</span>
      )}
      {signals.includes("SMMA_BULL") && (
        <span className="badge badge-smma">SMMA↑</span>
      )}
      {signals.includes("MOMENTUM") && (
        <span className="badge badge-mom">MOM</span>
      )}
      {signals.includes("BREAKOUT") && (
        <span className="badge badge-bo">BO</span>
      )}
      {signals.includes("M_RSI_CROSS") && (
        <span className="badge badge-mrsi">M-RSI×</span>
      )}
      {signals.includes("M_RSI_ABOVE") && (
        <span className="badge badge-mrsi">M-RSI</span>
      )}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </div>
      <div className={`text-2xl font-semibold metric ${accent || "text-slate-100"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export function matchesTab(r: ScanResult, tab: TabId): boolean {
  switch (tab) {
    case "common":
      return r.commonHit;
    case "rank":
      return r.signalCount > 0;
    case "ema":
      return r.emaStack;
    case "rsi":
      return r.rsiCross;
    case "bb":
      return r.bbCross;
    case "uvol":
      return r.unusualVolume;
    case "rvol":
      return r.relativeVolume;
    case "smma_buy":
      return r.smmaBuy;
    case "smma_sell":
      return r.smmaSell;
    case "smma_bull":
      return r.smmaBullish;
    case "mom":
      return r.strongMomentum;
    case "breakout":
      return r.isBreakout;
    case "m_rsi_cross":
      return r.monthlyRsiCross;
    case "m_rsi_above":
      return r.monthlyRsiAbove;
    case "all":
      return true;
  }
}
