# NSE Multi Screener

Next.js multi-factor stock screener for NSE (Yahoo Finance). **No Python / no Streamlit** — pure TypeScript, Vercel-ready.

## Scanners

### Weekly

| Scanner | Rule |
|--------|------|
| **EMA Stack** | 10 EMA > 30 EMA > 50 EMA |
| **RSI Cross** | RSI(14) just crossed above 60 (prev ≤ 60) |
| **BB Cross** | Close just crossed above upper Bollinger Band (50, 2) |
| **Unusual Volume** | Volume ≥ strong threshold × 20-week avg (default 2.5×) |
| **Relative Volume** | Volume ≥ mild threshold × 20-week avg (default 1.5×) |
| **SMMA Buy** | SMMA5 crosses above SMMA13 **and** close > SMMA23 |
| **SMMA Sell** | SMMA5 crosses below SMMA13 |
| **SMMA Bull** | SMMA5 > SMMA13 and close > SMMA23 (structure) |
| **Momentum** | Weighted ROC(4/8/13) + RSI; strong when score > 8 |
| **Breakout** | Close just broke prior 20-week high |

### Monthly

| Scanner | Rule |
|--------|------|
| **M-RSI Cross** | Monthly RSI just crossed above 60 |
| **M-RSI Above** | Monthly RSI already > 60 (go list) |

### Meta

- **Common / Confluence** — stocks hitting 2+ core scanners
- **Top Ranked** — weighted multi-signal rank score

## SMMA strategy

Smoothed Moving Average (TradingView-style):

```
SMMA_t = (SMMA_{t-1} * (N - 1) + Price_t) / N
```

- SMMA 5 (fast), SMMA 13 (slow), SMMA 23 (trend filter)
- **Buy**: SMMA5 × above SMMA13 + close > SMMA23  
  (equivalent to `crossunder(smma13, smma5)` in Pine)
- **Sell**: SMMA5 × below SMMA13

## Run locally

```bash
cd nse-multi-screener
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

```bash
npx vercel
```

Or connect the GitHub repo in the Vercel dashboard. No env vars required.

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- `yahoo-finance2` (server-side API route)
- Client-side concurrency control for Yahoo rate limits
