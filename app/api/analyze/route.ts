import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { analyzeStock, StockAnalysis } from "@/lib/analyzer";
import { Candle } from "@/lib/indicators";
import { toYahooSymbol, shortSymbol } from "@/lib/symbols";

const yf = new YahooFinance({
  suppressNotices: ["ripHistorical", "yahooSurvey"],
});

// In-memory cache per server instance
const histCache = new Map<string, { data: any[]; ts: number }>();
const quoteCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

function getCached<T>(
  map: Map<string, { data: T; ts: number }>,
  key: string
): T | null {
  const hit = map.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;
  return null;
}

function setCached<T>(
  map: Map<string, { data: T; ts: number }>,
  key: string,
  data: T
) {
  map.set(key, { data, ts: Date.now() });
}

function toCandles(hist: any[]): Candle[] {
  return hist
    .filter((h: any) => h.close != null)
    .map((h: any) => ({
      date: new Date(h.date).toISOString().split("T")[0],
      timestamp: new Date(h.date).getTime(),
      open: Number(h.open ?? h.close),
      high: Number(h.high ?? h.close),
      low: Number(h.low ?? h.close),
      close: Number(h.close),
      volume: Number(h.volume ?? 0),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchChart(
  ySymbol: string,
  interval: "1wk" | "1mo",
  years: number
): Promise<any[]> {
  const cacheKey = `${ySymbol}:${interval}`;
  const cached = getCached(histCache, cacheKey);
  if (cached) return cached;

  const start = new Date();
  start.setFullYear(start.getFullYear() - years);

  const chartResult = await yf.chart(ySymbol, {
    period1: start,
    interval,
  });

  const hist = chartResult.quotes || [];
  setCached(histCache, cacheKey, hist);
  return hist;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol, volStrong = 2.5, volMild = 1.5 } = body;

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json(
        { error: "symbol is required" },
        { status: 400 }
      );
    }

    const ySymbol = toYahooSymbol(symbol);
    const displaySym = shortSymbol(ySymbol);

    // 1. Quote
    let quote: any = getCached(quoteCache, ySymbol);
    if (!quote) {
      try {
        quote = await yf.quote(ySymbol);
        setCached(quoteCache, ySymbol, quote);
      } catch {
        quote = null;
      }
    }

    const ltp =
      quote?.regularMarketPrice ?? quote?.postMarketPrice ?? 0;
    const changePct = quote?.regularMarketChangePercent ?? 0;
    const displayName =
      quote?.shortName ||
      quote?.longName ||
      quote?.displayName ||
      displaySym;

    // 2. Weekly (~4y for BB50 + EMAs) + Monthly (~8y for RSI)
    let weeklyHist: any[] = [];
    let monthlyHist: any[] = [];

    try {
      [weeklyHist, monthlyHist] = await Promise.all([
        fetchChart(ySymbol, "1wk", 4),
        fetchChart(ySymbol, "1mo", 8),
      ]);
    } catch (e) {
      console.error("Chart fetch failed for", ySymbol, e);
      return NextResponse.json(
        { error: `Failed to fetch history for ${displaySym}` },
        { status: 502 }
      );
    }

    if (!weeklyHist || weeklyHist.length === 0) {
      return NextResponse.json(
        { error: `No weekly data for ${displaySym}` },
        { status: 404 }
      );
    }

    const weekly = toCandles(weeklyHist);
    const monthly = toCandles(monthlyHist);
    const effectiveLtp = ltp || weekly[weekly.length - 1]?.close || 0;

    const analysis: StockAnalysis = analyzeStock(
      displaySym,
      displayName,
      effectiveLtp,
      changePct,
      weekly,
      monthly,
      volStrong,
      volMild
    );

    return NextResponse.json(analysis);
  } catch (err: any) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
