"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  Play,
  Pause,
  RefreshCw,
  Download,
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
import { toast } from "sonner";
import { STOCKS } from "@/lib/symbols";
import type { StockAnalysis, SignalFlag } from "@/lib/analyzer";
import {
  formatINR,
  formatPercent,
  formatCompact,
  runWithConcurrency,
} from "@/lib/utils";

type ScanResult = StockAnalysis & { scannedAt: string };

type TabId =
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

const TABS: { id: TabId; label: string; hint: string; icon: React.ReactNode }[] =
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

const CONCURRENCY = 5;
const DEFAULT_VOL_STRONG = 2.5;
const DEFAULT_VOL_MILD = 1.5;

function SignalBadges({ signals }: { signals: SignalFlag[] }) {
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

function KpiCard({
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

function matchesTab(r: ScanResult, tab: TabId): boolean {
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

export default function MultiScreenerPage() {
  const [volStrong, setVolStrong] = useState(DEFAULT_VOL_STRONG);
  const [volMild, setVolMild] = useState(DEFAULT_VOL_MILD);
  const [customSymbols, setCustomSymbols] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ScanResult[]>([]);
  const [errors, setErrors] = useState(0);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [tab, setTab] = useState<TabId>("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("rankScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const pauseRef = useRef(false);
  const abortRef = useRef(false);

  const universe = useMemo(() => {
    const base = [...STOCKS];
    const extra = customSymbols.filter((s) => !base.includes(s));
    return [...base, ...extra];
  }, [customSymbols]);

  const counts = useMemo(() => {
    const c: Record<TabId, number> = {
      common: 0,
      rank: 0,
      ema: 0,
      rsi: 0,
      bb: 0,
      uvol: 0,
      rvol: 0,
      smma_buy: 0,
      smma_sell: 0,
      smma_bull: 0,
      mom: 0,
      breakout: 0,
      m_rsi_cross: 0,
      m_rsi_above: 0,
      all: results.length,
    };
    for (const r of results) {
      if (r.commonHit) c.common++;
      if (r.signalCount > 0) c.rank++;
      if (r.emaStack) c.ema++;
      if (r.rsiCross) c.rsi++;
      if (r.bbCross) c.bb++;
      if (r.unusualVolume) c.uvol++;
      if (r.relativeVolume) c.rvol++;
      if (r.smmaBuy) c.smma_buy++;
      if (r.smmaSell) c.smma_sell++;
      if (r.smmaBullish) c.smma_bull++;
      if (r.strongMomentum) c.mom++;
      if (r.isBreakout) c.breakout++;
      if (r.monthlyRsiCross) c.m_rsi_cross++;
      if (r.monthlyRsiAbove) c.m_rsi_above++;
    }
    return c;
  }, [results]);

  const filteredResults = useMemo(() => {
    let data = results.filter((r) => matchesTab(r, tab));
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      data = data.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      );
    }
    data = [...data].sort((a, b) => {
      let va: string | number = 0;
      let vb: string | number = 0;
      switch (sortKey) {
        case "symbol":
          va = a.symbol;
          vb = b.symbol;
          break;
        case "ltp":
          va = a.ltp;
          vb = b.ltp;
          break;
        case "weeklyChangePct":
          va = a.weeklyChangePct;
          vb = b.weeklyChangePct;
          break;
        case "rsi":
          va = a.rsi ?? -1;
          vb = b.rsi ?? -1;
          break;
        case "monthlyRsi":
          va = a.monthlyRsi ?? -1;
          vb = b.monthlyRsi ?? -1;
          break;
        case "volRatio":
          va = a.volume.ratio;
          vb = b.volume.ratio;
          break;
        case "momScore":
          va = a.momentum.score;
          vb = b.momentum.score;
          break;
        case "signalCount":
          va = a.signalCount;
          vb = b.signalCount;
          break;
        default:
          va = a.rankScore;
          vb = b.rankScore;
      }
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [results, tab, searchTerm, sortKey, sortDir]);

  const addCustomSymbol = useCallback(() => {
    const raw = customInput.trim().toUpperCase().replace(/\.NS$/i, "");
    if (!raw) return;
    if (universe.includes(raw)) {
      toast.info(`${raw} is already in the list`);
      setCustomInput("");
      return;
    }
    setCustomSymbols((prev) => [...prev, raw]);
    setCustomInput("");
    toast.success(`Added ${raw}`);
  }, [customInput, universe]);

  async function analyzeOne(symbol: string): Promise<ScanResult | null> {
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, volStrong, volMild }),
      });
      if (!res.ok) {
        setErrors((e) => e + 1);
        return null;
      }
      const data: StockAnalysis = await res.json();
      if (data.error && data.weeksAnalyzed === 0) {
        setErrors((e) => e + 1);
        return null;
      }
      return { ...data, scannedAt: new Date().toISOString() };
    } catch {
      setErrors((e) => e + 1);
      return null;
    }
  }

  async function startScan(rescan = false) {
    if (isScanning && !rescan) return;
    abortRef.current = false;
    pauseRef.current = false;
    setIsPaused(false);
    setIsScanning(true);
    setErrors(0);
    if (!rescan || results.length === 0) setResults([]);
    const list = universe;
    setProgress({ done: 0, total: list.length });
    toast.message(`Scanning ${list.length} stocks (weekly + monthly)…`);
    let done = 0;
    const batch: ScanResult[] = [];
    await runWithConcurrency(list, CONCURRENCY, async (symbol) => {
      while (pauseRef.current && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (abortRef.current) return null;
      const result = await analyzeOne(symbol);
      done += 1;
      setProgress({ done, total: list.length });
      if (result) {
        batch.push(result);
        if (batch.length % 4 === 0 || done === list.length) {
          setResults((prev) => {
            const map = new Map(prev.map((r) => [r.symbol, r]));
            for (const r of batch) map.set(r.symbol, r);
            return Array.from(map.values());
          });
        }
      }
      return result;
    });
    setResults((prev) => {
      const map = new Map(prev.map((r) => [r.symbol, r]));
      for (const r of batch) map.set(r.symbol, r);
      return Array.from(map.values());
    });
    setIsScanning(false);
    setIsPaused(false);
    setLastScan(new Date());
    toast.success(`Scan complete — ${done} symbols processed`);
  }

  function togglePause() {
    if (!isScanning) return;
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
    toast.message(pauseRef.current ? "Scan paused" : "Scan resumed");
  }

  function stopScan() {
    abortRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
    setIsScanning(false);
    toast.message("Scan stopped");
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    if (!filteredResults.length) {
      toast.error("Nothing to export");
      return;
    }
    const headers = [
      "symbol",
      "name",
      "ltp",
      "weeklyChangePct",
      "rankScore",
      "signalCount",
      "signals",
      "emaStack",
      "ema10",
      "ema30",
      "ema50",
      "rsi",
      "previousRsi",
      "rsiCross",
      "bbCross",
      "upperBB",
      "unusualVolume",
      "relativeVolume",
      "volRatio",
      "smmaBuy",
      "smmaSell",
      "smmaBullish",
      "smma5",
      "smma13",
      "smma23",
      "momScore",
      "roc4",
      "roc8",
      "breakout",
      "monthlyRsi",
      "monthlyRsiCross",
      "monthlyRsiAbove",
      "commonHit",
      "lastWeeklyDate",
    ];
    const rows = filteredResults.map((r) =>
      [
        r.symbol,
        `"${r.name.replace(/"/g, '""')}"`,
        r.ltp,
        r.weeklyChangePct,
        r.rankScore,
        r.signalCount,
        r.signals.join("|"),
        r.emaStack,
        r.ema.ema10 ?? "",
        r.ema.ema30 ?? "",
        r.ema.ema50 ?? "",
        r.rsi ?? "",
        r.previousRsi ?? "",
        r.rsiCross,
        r.bbCross,
        r.bb?.upper ?? "",
        r.unusualVolume,
        r.relativeVolume,
        r.volume.ratio,
        r.smmaBuy,
        r.smmaSell,
        r.smmaBullish,
        r.smma.smma5 ?? "",
        r.smma.smma13 ?? "",
        r.smma.smma23 ?? "",
        r.momentum.score,
        r.momentum.roc4 ?? "",
        r.momentum.roc8 ?? "",
        r.isBreakout,
        r.monthlyRsi ?? "",
        r.monthlyRsiCross,
        r.monthlyRsiAbove,
        r.commonHit,
        r.lastWeeklyDate,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `multi-scan-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  const pct =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="min-h-screen hero-glow">
      <header className="border-b border-slate-800/80 bg-[#070b14]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1500px] mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Crosshair className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-slate-100 leading-tight">
                NSE Multi Screener
              </h1>
              <p className="text-[11px] text-slate-500">
                EMA · RSI · BB · Volume · SMMA 5/13/23 · Monthly RSI · Momentum ·
                Breakout · Yahoo · Vercel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isScanning ? (
              <button
                onClick={() => startScan(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25 font-semibold text-sm transition"
              >
                <Play className="w-4 h-4" /> Scan {universe.length}
              </button>
            ) : (
              <>
                <button
                  onClick={togglePause}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/40 text-sm font-semibold"
                >
                  {isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={stopScan}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/40 text-sm font-semibold"
                >
                  <X className="w-4 h-4" /> Stop
                </button>
              </>
            )}
            <button
              onClick={() => startScan(true)}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm disabled:opacity-40"
            >
              <RefreshCw className="w-4 h-4" /> Rescan
            </button>
            <button
              onClick={exportCsv}
              disabled={!filteredResults.length}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm disabled:opacity-40"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>
        {isScanning && (
          <div className="max-w-[1500px] mx-auto px-4 pb-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>
                {isPaused ? "Paused" : "Scanning"}… {progress.done}/
                {progress.total}
                {errors > 0 && (
                  <span className="text-rose-400 ml-2">{errors} failed</span>
                )}
              </span>
              <span className="metric">{pct}%</span>
            </div>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[1500px] mx-auto px-4 py-6 space-y-6">
        {/* Strategy legend */}
        <section className="card p-4 sm:p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="badge badge-ema mb-2">EMA STACK</div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Weekly: 10 EMA &gt; 30 EMA &gt; 50 EMA (bullish trend stack).
              </p>
            </div>
            <div>
              <div className="badge badge-rsi mb-2">RSI CROSS</div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Weekly RSI(14) just crossed above 60 (prev ≤ 60, now &gt; 60).
              </p>
            </div>
            <div>
              <div className="badge badge-bb mb-2">BB CROSS</div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Close just crossed above upper Bollinger Band (50, 2).
              </p>
            </div>
            <div>
              <div className="badge badge-vol mb-2">VOLUME</div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Unusual ≥ {volStrong}× · Relative ≥ {volMild}× trailing 20-week
                avg.
              </p>
            </div>
            <div>
              <div className="badge badge-smma mb-2">SMMA BUY / SELL</div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Buy: SMMA5 crosses above SMMA13 + close &gt; SMMA23. Sell: SMMA5
                crosses below SMMA13.
              </p>
            </div>
            <div>
              <div className="badge badge-mrsi mb-2">MONTHLY RSI</div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Fresh cross above 60, or already above 60 (go list).
              </p>
            </div>
            <div>
              <div className="badge badge-mom mb-2">MOMENTUM</div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Weighted ROC (4/8/13w) + RSI; strong when score &gt; 8 and rising.
              </p>
            </div>
            <div>
              <div className="badge badge-bo mb-2">BREAKOUT</div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Close just broke above prior 20-week high.
              </p>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="card p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Unusual vol (×)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1.5}
                max={5}
                step={0.1}
                value={volStrong}
                onChange={(e) => setVolStrong(Number(e.target.value))}
                className="w-28"
                disabled={isScanning}
              />
              <span className="metric text-sm text-amber-300 w-10">
                {volStrong.toFixed(1)}
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Relative vol (×)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={volMild}
                onChange={(e) => setVolMild(Number(e.target.value))}
                className="w-28"
                disabled={isScanning}
              />
              <span className="metric text-sm text-orange-300 w-10">
                {volMild.toFixed(1)}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 block mb-1">
              Add custom NSE symbol
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomSymbol()}
                placeholder="e.g. RELIANCE"
                className="px-3 py-2 text-sm flex-1 max-w-xs"
                disabled={isScanning}
              />
              <button
                onClick={addCustomSymbol}
                className="px-3 py-2 text-sm rounded-xl border border-slate-700 bg-slate-800 text-slate-200"
              >
                Add
              </button>
            </div>
          </div>
          {lastScan && (
            <div className="text-xs text-slate-500 ml-auto">
              Last scan: {lastScan.toLocaleString()}
            </div>
          )}
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3">
          <KpiCard
            label="Scanned"
            value={results.length}
            sub={`${universe.length} in universe`}
          />
          <KpiCard
            label="Common"
            value={counts.common}
            sub="2+ core hits"
            accent="text-cyan-300"
          />
          <KpiCard
            label="SMMA Buy"
            value={counts.smma_buy}
            accent="text-teal-300"
          />
          <KpiCard
            label="RSI Cross"
            value={counts.rsi}
            accent="text-purple-300"
          />
          <KpiCard label="BB Cross" value={counts.bb} accent="text-sky-300" />
          <KpiCard
            label="Unusual Vol"
            value={counts.uvol}
            sub={`≥${volStrong}×`}
            accent="text-amber-300"
          />
          <KpiCard
            label="M-RSI Cross"
            value={counts.m_rsi_cross}
            accent="text-violet-300"
          />
        </section>

        {/* Tabs + search */}
        <section className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={t.hint}
                className={`tab-btn inline-flex items-center gap-1.5 ${
                  tab === t.id ? "active" : ""
                }`}
              >
                {t.icon}
                {t.label}
                <span className="text-[10px] opacity-70 metric">
                  {counts[t.id]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by symbol or name…"
                className="w-full pl-9 pr-3 py-2 text-sm"
              />
            </div>
            <span className="text-xs text-slate-500 metric">
              {filteredResults.length} rows
            </span>
          </div>
        </section>

        {/* Table */}
        <section className="table-wrap card">
          <table className="scan-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("symbol")}>Symbol</th>
                <th onClick={() => toggleSort("ltp")}>LTP</th>
                <th onClick={() => toggleSort("weeklyChangePct")}>W%</th>
                <th onClick={() => toggleSort("rankScore")}>Rank</th>
                <th onClick={() => toggleSort("signalCount")}>#</th>
                <th>Signals</th>
                <th onClick={() => toggleSort("rsi")}>RSI</th>
                <th onClick={() => toggleSort("monthlyRsi")}>M-RSI</th>
                <th>EMA 10/30/50</th>
                <th>SMMA 5/13/23</th>
                <th onClick={() => toggleSort("volRatio")}>Vol×</th>
                <th onClick={() => toggleSort("momScore")}>Mom</th>
                <th>BB Upper</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center text-slate-500 py-12">
                    {results.length === 0
                      ? "Hit Scan to analyze the universe"
                      : "No stocks match this filter"}
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => (
                  <tr key={r.symbol}>
                    <td>
                      <div className="font-semibold text-slate-100">
                        {r.symbol}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                        {r.name}
                      </div>
                    </td>
                    <td className="metric">{formatINR(r.ltp)}</td>
                    <td
                      className={`metric ${
                        r.weeklyChangePct >= 0 ? "pos" : "neg"
                      }`}
                    >
                      {formatPercent(r.weeklyChangePct)}
                    </td>
                    <td className="metric text-cyan-300 font-semibold">
                      {r.rankScore.toFixed(1)}
                    </td>
                    <td className="metric">{r.signalCount}</td>
                    <td>
                      <SignalBadges signals={r.signals} />
                    </td>
                    <td className="metric">
                      {r.rsi != null ? r.rsi.toFixed(1) : "—"}
                      {r.rsiCross && (
                        <span className="text-purple-400 text-[10px] ml-1">
                          ×
                        </span>
                      )}
                    </td>
                    <td className="metric">
                      {r.monthlyRsi != null ? r.monthlyRsi.toFixed(1) : "—"}
                      {r.monthlyRsiCross && (
                        <span className="text-violet-400 text-[10px] ml-1">
                          ×
                        </span>
                      )}
                    </td>
                    <td className="metric text-[11px] text-slate-400">
                      {r.ema.ema10 != null ? (
                        <>
                          <span
                            className={
                              r.emaStack ? "text-emerald-400" : undefined
                            }
                          >
                            {r.ema.ema10}
                          </span>
                          {" / "}
                          {r.ema.ema30} / {r.ema.ema50}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="metric text-[11px] text-slate-400">
                      {r.smma.smma5 != null ? (
                        <>
                          <span
                            className={
                              r.smmaBuy
                                ? "text-teal-300"
                                : r.smmaSell
                                  ? "text-rose-300"
                                  : undefined
                            }
                          >
                            {r.smma.smma5}
                          </span>
                          {" / "}
                          {r.smma.smma13} / {r.smma.smma23}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={`metric ${
                        r.unusualVolume
                          ? "text-amber-300 font-semibold"
                          : r.relativeVolume
                            ? "text-orange-300"
                            : "text-slate-400"
                      }`}
                    >
                      {r.volume.ratio.toFixed(2)}×
                      <div className="text-[10px] text-slate-600">
                        {formatCompact(r.volume.lastVolume)}
                      </div>
                    </td>
                    <td className="metric">
                      {r.momentum.score.toFixed(1)}
                      {r.strongMomentum && (
                        <span className="text-pink-400 text-[10px] ml-1">
                          ★
                        </span>
                      )}
                    </td>
                    <td className="metric text-[11px] text-slate-400">
                      {r.bb?.upper != null ? r.bb.upper : "—"}
                      {r.bbCross && (
                        <span className="text-sky-400 text-[10px] ml-1">×</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <footer className="text-center text-[11px] text-slate-600 pb-8">
          Data via Yahoo Finance · Weekly &amp; monthly candles · Not financial
          advice · Deployable on Vercel
        </footer>
      </main>
    </div>
  );
}
