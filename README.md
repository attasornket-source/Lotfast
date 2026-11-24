# LotFast — Fast 2nd-Order Lot Calculator (PWA)

High-speed mobile-first PWA position size calculator tailored for **Vantage Markets (USD)** on iPhone.

## Features (`v2.0.0`)
- **Live Vantage Bid / Offer (Ask) Quotes:** Real-time Raw ECN & Standard STP Bid/Ask quotes with Spread display and automatic Stale/Disconnect alerts.
- **Instant 2nd-Order Lot Sizing:** Locks 1st order (`0.01 Lot` FX / `0.1 Lot` US30 DJ30) and safely floors 2nd-order lot size so combined risk never exceeds your Risk Limit (default `$30`).
- **Custom Stocks & Multi-Asset Support:** Add US Stocks (`AAPL`, `NVDA`, `TSLA`, `PLTR`, etc.), Thai Stocks (`SET`), Gold (`XAUUSD`), Indices (`NAS100`, `SP500`), Forex, and Crypto freely.
- **1-Tap MT5 & TradingView Shortcuts:** Copy & launch MetaTrader 5 or jump directly to the active symbol's chart on TradingView iOS.
- **Optional R:R Ratio & Take-Profit Projection:** Supports `1:1.5`, `1:2`, `1:3`, or custom ratio notation.
- **Private 4-Digit PIN Lock & iPhone PWA:** Installable full-screen via Safari `Add to Home Screen` with automatic Service Worker updates.

## Development & Deployment
```bash
npm install
npm run dev
npm run build
```

Every push to `main` automatically runs tests, builds `./dist`, and deploys to GitHub Pages via `.github/workflows/deploy-pages.yml`.
