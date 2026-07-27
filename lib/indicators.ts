/**
 * Pure technical indicators for multi-screener:
 * EMA, SMMA, RSI (Wilder), Bollinger(50,2), volume stats,
 * relative volume, momentum, breakout helpers.
 */

export interface Candle {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BollingerResult {
  middle: number;
  upper: number;
  lower: number;
}

// ── helpers ──────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** EMA series — seed with SMA of first `period` values. */
export function emaSeries(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let ema = sum / period;
  out[period - 1] = ema;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

/**
 * SMMA (Smoothed Moving Average) — TradingView / Pine-compatible.
 * Seeds with SMA of first N values, then:
 *   SMMA_t = (SMMA_{t-1} * (N - 1) + Price_t) / N
 */
export function smmaSeries(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period || period < 1) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let smma = sum / period;
  out[period - 1] = smma;

  for (let i = period; i < values.length; i++) {
    smma = (smma * (period - 1) + values[i]) / period;
    out[i] = smma;
  }
  return out;
}

/** True when series A just crossed above series B (prev A ≤ B, curr A > B). */
export function crossedAbove(
  a: number[],
  b: number[],
  i: number
): boolean {
  if (i < 1) return false;
  const a0 = a[i - 1];
  const b0 = b[i - 1];
  const a1 = a[i];
  const b1 = b[i];
  if ([a0, b0, a1, b1].some((v) => isNaN(v))) return false;
  return a0 <= b0 && a1 > b1;
}

/** True when series A just crossed below series B. */
export function crossedBelow(
  a: number[],
  b: number[],
  i: number
): boolean {
  if (i < 1) return false;
  const a0 = a[i - 1];
  const b0 = b[i - 1];
  const a1 = a[i];
  const b1 = b[i];
  if ([a0, b0, a1, b1].some((v) => isNaN(v))) return false;
  return a0 >= b0 && a1 < b1;
}

// ── Bollinger Bands ──────────────────────────────────────────────────

/** Population std-dev Bollinger (common charting convention). */
export function calculateBollinger(
  closes: number[],
  period = 50,
  stdDev = 2
): BollingerResult | null {
  if (closes.length < period) return null;

  const slice = closes.slice(-period);
  const m = mean(slice);
  const variance =
    slice.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / period;
  const std = Math.sqrt(variance);

  return {
    middle: Number(m.toFixed(2)),
    upper: Number((m + stdDev * std).toFixed(2)),
    lower: Number((m - stdDev * std).toFixed(2)),
  };
}

/**
 * Fresh upper-band cross:
 *   previous close ≤ previous upper band
 *   current  close  > current  upper band
 */
export function detectFreshUpperBandCross(
  closes: number[],
  period = 50,
  stdDev = 2
): {
  hasJustCrossed: boolean;
  currentUpper: number | null;
  previousUpper: number | null;
  currentBB: BollingerResult | null;
} {
  if (closes.length < period + 1) {
    return {
      hasJustCrossed: false,
      currentUpper: null,
      previousUpper: null,
      currentBB: null,
    };
  }

  const currentBB = calculateBollinger(closes, period, stdDev);
  const previousWindow = closes.slice(-period - 1, -1);
  const previousBB = calculateBollinger(previousWindow, period, stdDev);

  const currentClose = closes[closes.length - 1];
  const previousClose = closes[closes.length - 2];

  const hasJustCrossed =
    currentBB !== null &&
    previousBB !== null &&
    previousClose <= previousBB.upper &&
    currentClose > currentBB.upper;

  return {
    hasJustCrossed,
    currentUpper: currentBB?.upper ?? null,
    previousUpper: previousBB?.upper ?? null,
    currentBB,
  };
}

// ── RSI (Wilder / RMA) ───────────────────────────────────────────────

/** Full RSI series (NaN until warm-up). Period default 14. */
export function rsiSeries(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return out;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  out[period] = 100 - 100 / (1 + rs0);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

/**
 * RSI just crossed above threshold (default 60):
 *   previous RSI ≤ threshold, current RSI > threshold
 */
export function detectRsiCrossAbove(
  closes: number[],
  period = 14,
  threshold = 60
): {
  hasJustCrossed: boolean;
  isAbove: boolean;
  currentRsi: number | null;
  previousRsi: number | null;
} {
  const series = rsiSeries(closes, period);
  if (series.length < 2) {
    return {
      hasJustCrossed: false,
      isAbove: false,
      currentRsi: null,
      previousRsi: null,
    };
  }

  const curr = series[series.length - 1];
  const prev = series[series.length - 2];

  if (isNaN(curr) || isNaN(prev)) {
    return {
      hasJustCrossed: false,
      isAbove: false,
      currentRsi: null,
      previousRsi: null,
    };
  }

  return {
    hasJustCrossed: prev <= threshold && curr > threshold,
    isAbove: curr > threshold,
    currentRsi: Number(curr.toFixed(2)),
    previousRsi: Number(prev.toFixed(2)),
  };
}

// ── EMA stack 10 / 30 / 50 ───────────────────────────────────────────

export interface EmaStackResult {
  ema10: number | null;
  ema30: number | null;
  ema50: number | null;
  /** 10 > 30 > 50 bullish stack */
  stackBullish: boolean;
  ema10Above30: boolean;
  ema30Above50: boolean;
  spread10_30_pct: number | null;
  spread30_50_pct: number | null;
}

export function calculateEmaStack(closes: number[]): EmaStackResult {
  if (closes.length < 50) {
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

  const e10 = emaSeries(closes, 10);
  const e30 = emaSeries(closes, 30);
  const e50 = emaSeries(closes, 50);
  const i = closes.length - 1;
  const a = e10[i];
  const b = e30[i];
  const c = e50[i];

  if (isNaN(a) || isNaN(b) || isNaN(c)) {
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

  return {
    ema10: Number(a.toFixed(2)),
    ema30: Number(b.toFixed(2)),
    ema50: Number(c.toFixed(2)),
    stackBullish: a > b && b > c,
    ema10Above30: a > b,
    ema30Above50: b > c,
    spread10_30_pct: Number((((a - b) / b) * 100).toFixed(2)),
    spread30_50_pct: Number((((b - c) / c) * 100).toFixed(2)),
  };
}

// ── SMMA 5 / 13 / 23 strategy ────────────────────────────────────────

export interface SmmaStrategyResult {
  smma5: number | null;
  smma13: number | null;
  smma23: number | null;
  /** SMMA5 crossed above SMMA13 AND close > SMMA23 */
  buySignal: boolean;
  /** SMMA5 crossed below SMMA13 */
  sellSignal: boolean;
  /** Currently SMMA5 > SMMA13 and close > SMMA23 (in bullish structure) */
  bullish: boolean;
  closeAboveSmma23: boolean;
  smma5Above13: boolean;
}

/**
 * Buy when SMMA5 crosses above SMMA13 and close > SMMA23.
 * Sell when SMMA5 crosses below SMMA13.
 * (crossunder(smma13, smma5) ≡ smma5 crosses above smma13)
 */
export function calculateSmmaStrategy(closes: number[]): SmmaStrategyResult {
  if (closes.length < 25) {
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

  const s5 = smmaSeries(closes, 5);
  const s13 = smmaSeries(closes, 13);
  const s23 = smmaSeries(closes, 23);
  const i = closes.length - 1;
  const close = closes[i];
  const a = s5[i];
  const b = s13[i];
  const c = s23[i];

  if (isNaN(a) || isNaN(b) || isNaN(c)) {
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

  const crossUp = crossedAbove(s5, s13, i);
  const crossDown = crossedBelow(s5, s13, i);
  const closeAboveSmma23 = close > c;
  const smma5Above13 = a > b;

  return {
    smma5: Number(a.toFixed(2)),
    smma13: Number(b.toFixed(2)),
    smma23: Number(c.toFixed(2)),
    buySignal: crossUp && closeAboveSmma23,
    sellSignal: crossDown,
    bullish: smma5Above13 && closeAboveSmma23,
    closeAboveSmma23,
    smma5Above13,
  };
}

// ── Volume ───────────────────────────────────────────────────────────

export interface VolumeStats {
  lastVolume: number;
  avgVolume: number;
  /** Unusual / relative volume ratio vs trailing average */
  ratio: number;
  isSpike: boolean;
  isMildSpike: boolean;
  usedPriorWeek: boolean;
  priorWeekVolume: number;
  priorWeekRatio: number;
}

/**
 * Volume vs trailing N-period average.
 * Handles incomplete latest bar (Yahoo mid-week/mid-month).
 */
export function calculateVolumeStats(
  volumes: number[],
  lookback = 20,
  strongThreshold = 2.5,
  mildThreshold = 1.5
): VolumeStats {
  if (volumes.length === 0) {
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

  const lastVolume = volumes[volumes.length - 1];
  const priorWeekVolume =
    volumes.length >= 2 ? volumes[volumes.length - 2] : 0;

  const n = Math.min(lookback, Math.max(0, volumes.length - 1));
  let avgVolume = lastVolume;
  if (n > 0) {
    const prior = volumes.slice(-n - 1, -1);
    avgVolume = mean(prior);
  }

  let usedPriorWeek = false;
  let evalVolume = lastVolume;
  let evalAvg = avgVolume;

  const lastRatio = avgVolume > 0 ? lastVolume / avgVolume : 0;
  if (lastRatio < 0.45 && volumes.length >= 3) {
    usedPriorWeek = true;
    evalVolume = priorWeekVolume;
    const n2 = Math.min(lookback, volumes.length - 2);
    if (n2 > 0) {
      const baseline = volumes.slice(-n2 - 2, -2);
      evalAvg = mean(baseline);
      avgVolume = evalAvg;
    }
  }

  const ratio = evalAvg > 0 ? evalVolume / evalAvg : 0;
  const priorWeekRatio =
    avgVolume > 0 && priorWeekVolume ? priorWeekVolume / avgVolume : 0;

  return {
    lastVolume: Math.round(usedPriorWeek ? evalVolume : lastVolume),
    avgVolume: Math.round(avgVolume),
    ratio: Number(ratio.toFixed(2)),
    isSpike: ratio >= strongThreshold,
    isMildSpike: ratio >= mildThreshold,
    usedPriorWeek,
    priorWeekVolume: Math.round(priorWeekVolume),
    priorWeekRatio: Number(priorWeekRatio.toFixed(2)),
  };
}

// ── Momentum ─────────────────────────────────────────────────────────

export interface MomentumResult {
  /** ROC over N periods: (close / close_N - 1) * 100 */
  roc4: number | null;
  roc8: number | null;
  roc13: number | null;
  /** Simple momentum score: weighted ROC + RSI position */
  score: number;
  strongMomentum: boolean;
}

export function calculateMomentum(
  closes: number[],
  rsi: number | null
): MomentumResult {
  function roc(n: number): number | null {
    if (closes.length <= n) return null;
    const curr = closes[closes.length - 1];
    const past = closes[closes.length - 1 - n];
    if (!past || past === 0) return null;
    return Number((((curr - past) / past) * 100).toFixed(2));
  }

  const roc4 = roc(4);
  const roc8 = roc(8);
  const roc13 = roc(13);

  // Weighted momentum: short-term heavier + RSI boost above 50
  let score = 0;
  if (roc4 != null) score += roc4 * 0.45;
  if (roc8 != null) score += roc8 * 0.3;
  if (roc13 != null) score += roc13 * 0.15;
  if (rsi != null) score += (rsi - 50) * 0.2;

  score = Number(score.toFixed(2));
  const strongMomentum =
    score > 8 &&
    (roc4 ?? 0) > 0 &&
    (roc8 ?? 0) > 0 &&
    (rsi == null || rsi >= 55);

  return { roc4, roc8, roc13, score, strongMomentum };
}

// ── Breakout ─────────────────────────────────────────────────────────

export interface BreakoutResult {
  /** Highest high of prior N bars (excluding current) */
  priorHigh: number | null;
  /** Close just broke above prior N-bar high */
  breakout: boolean;
  /** Distance above breakout level % */
  breakoutPct: number | null;
  lookback: number;
}

/**
 * Classic N-period high breakout on close (default 20 bars).
 * Fresh: previous close ≤ prior high, current close > prior high.
 */
export function detectBreakout(
  candles: Candle[],
  lookback = 20
): BreakoutResult {
  if (candles.length < lookback + 2) {
    return {
      priorHigh: null,
      breakout: false,
      breakoutPct: null,
      lookback,
    };
  }

  // Prior high over lookback bars ending at previous bar
  const window = candles.slice(-lookback - 1, -1);
  const priorHigh = Math.max(...window.map((c) => c.high));
  const curr = candles[candles.length - 1].close;
  const prev = candles[candles.length - 2].close;

  const breakout = prev <= priorHigh && curr > priorHigh;
  const breakoutPct =
    priorHigh > 0
      ? Number((((curr - priorHigh) / priorHigh) * 100).toFixed(2))
      : null;

  return {
    priorHigh: Number(priorHigh.toFixed(2)),
    breakout,
    breakoutPct,
    lookback,
  };
}
