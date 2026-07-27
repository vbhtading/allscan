/**
 * Multi-screener analyzer — weekly + monthly signals:
 *
 * Weekly:
 *   - EMA stack 10 > 30 > 50
 *   - RSI(14) just crossed above 60
 *   - Fresh upper Bollinger Band (50, 2) cross
 *   - Unusual volume (≥ strong × avg)
 *   - Relative volume (≥ mild × avg)
 *   - SMMA 5/13/23 buy & sell
 *   - Momentum (ROC + RSI score)
 *   - 20-week high breakout
 *
 * Monthly:
 *   - RSI just crossed above 60
 *   - RSI already above 60
 *
 * Ranking / confluence across overlapping scanners.
 */

import {
  Candle,
  BollingerResult,
  VolumeStats,
  EmaStackResult,
  SmmaStrategyResult,
  MomentumResult,
  BreakoutResult,
  detectFreshUpperBandCross,
  detectRsiCrossAbove,
  calculateVolumeStats,
  calculateBollinger,
  calculateEmaStack,
  calculateSmmaStrategy,
  calculateMomentum,
  detectBreakout,
  rsiSeries,
} from "./indicators";

export type SignalFlag =
  | "EMA_STACK"
  | "RSI_CROSS"
  | "BB_CROSS"
  | "UNUSUAL_VOL"
  | "REL_VOL"
  | "SMMA_BUY"
  | "SMMA_SELL"
  | "SMMA_BULL"
  | "MOMENTUM"
  | "BREAKOUT"
  | "M_RSI_CROSS"
  | "M_RSI_ABOVE";

export interface StockAnalysis {
  symbol: string;
  name: string;
  ltp: number;
  changePct: number;
  currency: string;

  lastWeeklyClose: number;
  previousWeeklyClose: number | null;
  weeklyChangePct: number;
  lastWeeklyDate: string;
  weeksAnalyzed: number;
  monthsAnalyzed: number;

  // EMA 10/30/50 stack
  ema: EmaStackResult;
  emaStack: boolean;

  // RSI weekly
  rsi: number | null;
  previousRsi: number | null;
  rsiCross: boolean;
  rsiAbove60: boolean;

  // Bollinger (50, 2)
  bb: BollingerResult | null;
  previousUpperBand: number | null;
  pctAboveUpper: number | null;
  bbCross: boolean;

  // Volume
  volume: VolumeStats;
  unusualVolume: boolean;
  relativeVolume: boolean;

  // SMMA strategy
  smma: SmmaStrategyResult;
  smmaBuy: boolean;
  smmaSell: boolean;
  smmaBullish: boolean;

  // Momentum
  momentum: MomentumResult;
  strongMomentum: boolean;

  // Breakout
  breakout: BreakoutResult;
  isBreakout: boolean;

  // Monthly RSI
  monthlyRsi: number | null;
  monthlyPreviousRsi: number | null;
  monthlyRsiCross: boolean;
  monthlyRsiAbove: boolean;
  lastMonthlyDate: string;

  // Confluence / ranking
  signals: SignalFlag[];
  /** Count of active buy-side scanners (excludes SMMA_SELL) */
  signalCount: number;
  /** Weighted rank score for sorting */
  rankScore: number;
  /** Appears in 2+ core scanners (EMA+RSI+BB+VOL+SMMA_BUY+MOM+BO+M_RSI) */
  commonHit: boolean;

  error?: string;
}

function emptyVolume(): VolumeStats {
  return {
    lastVolume: 0,
    avgVolume: 0,
    ratio: 0,
    isSpike: false,
    isMildSpike: false,
    usedPriorWeek: false,
    priorWeekVolume: 0,
    priorWeekRatio: 0,
  };
}

function emptyEma(): EmaStackResult {
  return {
    ema10: null,
    ema30: null,
    ema50: null,
    stackBullish: false,
    ema10Above30: false,
    ema30Above50: false,
    spread10_30_pct: null,
    spread30_50_pct: null,
  };
}

function emptySmma(): SmmaStrategyResult {
  return {
    smma5: null,
    smma13: null,
    smma23: null,
    buySignal: false,
    sellSignal: false,
    bullish: false,
    closeAboveSmma23: false,
    smma5Above13: false,
  };
}

function emptyMom(): MomentumResult {
  return {
    roc4: null,
    roc8: null,
    roc13: null,
    score: 0,
    strongMomentum: false,
  };
}

function emptyBo(): BreakoutResult {
  return {
    priorHigh: null,
    breakout: false,
    breakoutPct: null,
    lookback: 20,
  };
}

export function emptyAnalysis(
  symbol: string,
  name: string,
  reason: string
): StockAnalysis {
  return {
    symbol,
    name,
    ltp: 0,
    changePct: 0,
    currency: "INR",
    lastWeeklyClose: 0,
    previousWeeklyClose: null,
    weeklyChangePct: 0,
    lastWeeklyDate: "",
    weeksAnalyzed: 0,
    monthsAnalyzed: 0,
    ema: emptyEma(),
    emaStack: false,
    rsi: null,
    previousRsi: null,
    rsiCross: false,
    rsiAbove60: false,
    bb: null,
    previousUpperBand: null,
    pctAboveUpper: null,
    bbCross: false,
    volume: emptyVolume(),
    unusualVolume: false,
    relativeVolume: false,
    smma: emptySmma(),
    smmaBuy: false,
    smmaSell: false,
    smmaBullish: false,
    momentum: emptyMom(),
    strongMomentum: false,
    breakout: emptyBo(),
    isBreakout: false,
    monthlyRsi: null,
    monthlyPreviousRsi: null,
    monthlyRsiCross: false,
    monthlyRsiAbove: false,
    lastMonthlyDate: "",
    signals: [],
    signalCount: 0,
    rankScore: 0,
    commonHit: false,
    error: reason,
  };
}

function computeRankScore(
  signals: SignalFlag[],
  volumeRatio: number,
  momScore: number,
  weeklyChangePct: number
): number {
  const weights: Partial<Record<SignalFlag, number>> = {
    SMMA_BUY: 3.5,
    BB_CROSS: 3,
    RSI_CROSS: 3,
    M_RSI_CROSS: 2.5,
    BREAKOUT: 2.5,
    EMA_STACK: 2,
    UNUSUAL_VOL: 2,
    MOMENTUM: 1.5,
    REL_VOL: 1,
    SMMA_BULL: 0.8,
    M_RSI_ABOVE: 0.6,
  };

  let score = 0;
  for (const s of signals) {
    if (s === "SMMA_SELL") continue;
    score += weights[s] ?? 1;
  }
  // Bonus for multi-hit confluence
  const buyHits = signals.filter((s) => s !== "SMMA_SELL").length;
  if (buyHits >= 3) score += 2;
  if (buyHits >= 5) score += 2;

  score += Math.min(volumeRatio, 5) * 0.15;
  score += Math.max(0, momScore) * 0.05;
  score += Math.max(0, weeklyChangePct) * 0.02;

  return Number(score.toFixed(2));
}

export function analyzeStock(
  symbol: string,
  name: string,
  ltp: number,
  changePct: number,
  weekly: Candle[],
  monthly: Candle[],
  volStrong = 2.5,
  volMild = 1.5
): StockAnalysis {
  if (!weekly || weekly.length < 55) {
    return emptyAnalysis(
      symbol,
      name,
      `Insufficient weekly data (${weekly?.length ?? 0} weeks, need ≥55)`
    );
  }

  const closes = weekly.map((c) => c.close);
  const volumes = weekly.map((c) => c.volume);

  const last = weekly[weekly.length - 1];
  const prev = weekly[weekly.length - 2];
  const lastClose = last.close;
  const prevClose = prev?.close ?? null;
  const weeklyChangePct =
    prevClose && prevClose !== 0
      ? Number((((lastClose - prevClose) / prevClose) * 100).toFixed(2))
      : 0;

  // 1) EMA 10 > 30 > 50
  const ema = calculateEmaStack(closes);

  // 2) RSI just crossed 60
  const rsiX = detectRsiCrossAbove(closes, 14, 60);
  let rsi = rsiX.currentRsi;
  if (rsi == null) {
    const series = rsiSeries(closes, 14);
    const lastRsi = series[series.length - 1];
    if (!isNaN(lastRsi)) rsi = Number(lastRsi.toFixed(2));
  }

  // 3) Fresh upper BB(50,2)
  const bbX = detectFreshUpperBandCross(closes, 50, 2);
  const bb = bbX.currentBB ?? calculateBollinger(closes, 50, 2);
  let pctAboveUpper: number | null = null;
  if (bb) {
    pctAboveUpper = Number(
      (((lastClose - bb.upper) / bb.upper) * 100).toFixed(2)
    );
  }

  // 4) Volume — unusual (≥ strong) and relative (≥ mild)
  const volume = calculateVolumeStats(volumes, 20, volStrong, volMild);

  // 5) SMMA strategy
  const smma = calculateSmmaStrategy(closes);

  // 6) Momentum
  const momentum = calculateMomentum(closes, rsi);

  // 7) Breakout 20-week high
  const breakout = detectBreakout(weekly, 20);

  // 8) Monthly RSI
  let monthlyRsi: number | null = null;
  let monthlyPreviousRsi: number | null = null;
  let monthlyRsiCross = false;
  let monthlyRsiAbove = false;
  let lastMonthlyDate = "";
  let monthsAnalyzed = 0;

  if (monthly && monthly.length >= 16) {
    monthsAnalyzed = monthly.length;
    lastMonthlyDate = monthly[monthly.length - 1].date;
    const mCloses = monthly.map((c) => c.close);
    const mRsi = detectRsiCrossAbove(mCloses, 14, 60);
    monthlyRsi = mRsi.currentRsi;
    monthlyPreviousRsi = mRsi.previousRsi;
    monthlyRsiCross = mRsi.hasJustCrossed;
    monthlyRsiAbove = mRsi.isAbove;
    if (monthlyRsi == null) {
      const series = rsiSeries(mCloses, 14);
      const lastR = series[series.length - 1];
      if (!isNaN(lastR)) {
        monthlyRsi = Number(lastR.toFixed(2));
        monthlyRsiAbove = lastR > 60;
      }
    }
  }

  // Assemble signals
  const signals: SignalFlag[] = [];
  if (ema.stackBullish) signals.push("EMA_STACK");
  if (rsiX.hasJustCrossed) signals.push("RSI_CROSS");
  if (bbX.hasJustCrossed) signals.push("BB_CROSS");
  if (volume.isSpike) signals.push("UNUSUAL_VOL");
  if (volume.isMildSpike || volume.isSpike) signals.push("REL_VOL");
  if (smma.buySignal) signals.push("SMMA_BUY");
  if (smma.sellSignal) signals.push("SMMA_SELL");
  if (smma.bullish && !smma.buySignal) signals.push("SMMA_BULL");
  if (momentum.strongMomentum) signals.push("MOMENTUM");
  if (breakout.breakout) signals.push("BREAKOUT");
  if (monthlyRsiCross) signals.push("M_RSI_CROSS");
  if (monthlyRsiAbove && !monthlyRsiCross) signals.push("M_RSI_ABOVE");

  const coreBuy: SignalFlag[] = [
    "EMA_STACK",
    "RSI_CROSS",
    "BB_CROSS",
    "UNUSUAL_VOL",
    "SMMA_BUY",
    "MOMENTUM",
    "BREAKOUT",
    "M_RSI_CROSS",
  ];
  const signalCount = signals.filter((s) => s !== "SMMA_SELL").length;
  const coreHits = signals.filter((s) => coreBuy.includes(s)).length;
  const commonHit = coreHits >= 2;

  const rankScore = computeRankScore(
    signals,
    volume.ratio,
    momentum.score,
    weeklyChangePct
  );

  return {
    symbol,
    name,
    ltp: Number(ltp.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    currency: "INR",
    lastWeeklyClose: Number(lastClose.toFixed(2)),
    previousWeeklyClose:
      prevClose != null ? Number(prevClose.toFixed(2)) : null,
    weeklyChangePct,
    lastWeeklyDate: last.date,
    weeksAnalyzed: weekly.length,
    monthsAnalyzed,
    ema,
    emaStack: ema.stackBullish,
    rsi,
    previousRsi: rsiX.previousRsi,
    rsiCross: rsiX.hasJustCrossed,
    rsiAbove60: rsiX.isAbove || (rsi != null && rsi > 60),
    bb,
    previousUpperBand: bbX.previousUpper,
    pctAboveUpper,
    bbCross: bbX.hasJustCrossed,
    volume,
    unusualVolume: volume.isSpike,
    relativeVolume: volume.isMildSpike || volume.isSpike,
    smma,
    smmaBuy: smma.buySignal,
    smmaSell: smma.sellSignal,
    smmaBullish: smma.bullish,
    momentum,
    strongMomentum: momentum.strongMomentum,
    breakout,
    isBreakout: breakout.breakout,
    monthlyRsi,
    monthlyPreviousRsi,
    monthlyRsiCross,
    monthlyRsiAbove,
    lastMonthlyDate,
    signals,
    signalCount,
    rankScore,
    commonHit,
  };
}
