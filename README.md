# Malachi Wealth

A personal options-trading desk for **weekly, bi-weekly and monthly** expirations, built with
Next.js 15, React 19 and TradingView's [lightweight-charts](https://github.com/tradingview/lightweight-charts).
It runs locally on your own machine and needs **no API keys**.

> Research tool only. It places no orders, free market data can be delayed, and nothing here is investment advice.

## Features

**Dashboard (`/`)**
- Index watch: SPY, IWM, QQQ and NDX, live, with today's range and extended-hours prices.
- Clean line-chart overview of any symbol (1D to 5Y), with an optional second chart side by side.
- Options chain limited to this week's expiry, next week's and the next two monthlies: expected move,
  put/call ratio, max pain, IV and a plain-English read.
- Option flow, company news and a "Trump Watch" feed with market-moving topics flagged.
- Search covers stocks, ETFs, indexes, crude oil (`CRUDE`) and Bitcoin (`BTC`).

**Ticker page (`/t/SYMBOL`)**
- Full candlestick chart with candle sizes from 1m to 1W, including pre-market and after-hours.
- Indicators: Ripster EMA Clouds (5/12, 34/50), 200 DMA, VWAP, Bollinger Bands, RSI, ATR, volume.
- News, price box with IV rank, ATM IV, ATR and expected move, and near-the-money option flow (±2/5/10%).

**Analysis (`/t/SYMBOL/analysis`)**
- Financials, technical ratings (5m to 1M gauges), last four earnings (beat/miss and price reaction)
  and a supply-chain map.

**Trading simulator (`/t/SYMBOL/simulator`)**
- Paper-trade options at mid or market with live marks. Positions are stored only in your browser.

**Earnings desk (`/earnings`)**
- The week's most anticipated earnings (before open / after close) and high-impact US economic events.
  Rolls over to the next week at Sunday 12am ET.

## Run it

You need [Node.js 22 or newer](https://nodejs.org).

```bash
npm install
npm run dev            # development, http://localhost:3000
```

For everyday use, run the production build:

```bash
npm run build && npm start
```

## Optional keys

Everything works without keys. To upgrade a feed, copy `.env.example` to `.env.local` and fill in what you have.
`.env.local` is git-ignored, so keys never get committed.

| Feature | Without a key | With a key |
| --- | --- | --- |
| Prices, charts, chains, news | Yahoo Finance | — |
| Trump's posts | Truth Social public mirror + headlines | `X_BEARER_TOKEN` (X API Basic or higher) |
| Option flow | Estimated from chain volume changes | `UNUSUAL_WHALES_API_KEY` |
| More news | — | `FINNHUB_API_KEY` (free) |

Set `MALACHI_DEMO=1` to force demo data (useful offline).

## Security

The app is designed to run on your own computer, not as a public website.

- The server binds to `localhost` only, so other machines on your network can't reach it.
- Middleware rejects requests whose `Host` isn't localhost (DNS-rebinding protection) and cross-site calls to `/api`.
- A strict Content-Security-Policy and other security headers are set in `next.config.mjs`.
- External links are checked for `http(s)` before they're rendered (`lib/safeUrl.ts`).
- The in-memory cache has a size cap, and API errors return generic messages.

If you find a security issue, please open a GitHub issue without exploit details and I'll follow up.

## Data sources

Yahoo Finance (via `yahoo-finance2`), the TradingView scanner, Earnings Whispers, Forex Factory and public
news/RSS feeds. These are unofficial, keyless endpoints that may change or rate-limit at any time.
Check each provider's terms before using this beyond personal use.

## Project layout

- `app/` — pages and API routes (`app/api/*`).
- `components/` — the screens (charts, chain, analysis, simulator, earnings board).
- `lib/providers/` — one file per data source (market, news, trump, flow, analysis, earnings).
- `lib/indicators.ts` — EMA, SMA, Bollinger, RSI, VWAP, ATR, realized volatility.
- `lib/analytics.ts` — expected move, max pain, put/call and the plain-English read.
- `lib/expirations.ts` — the weekly / bi-weekly / monthly expiry filter.
- `middleware.ts`, `next.config.mjs` — localhost guard and security headers.
