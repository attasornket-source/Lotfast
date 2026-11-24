import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import type { PairSpec, VantageAccountType } from '../config/tradingConfig';
import {
  splitDealingPrice,
  type FeedHealthState,
  type MarketQuote,
} from '../utils/quoteParser';

interface BidOfferDeckProps {
  pair: PairSpec;
  quote: MarketQuote | null;
  accountType: VantageAccountType;
  wsConnected: boolean;
  feedHealth: {
    state: FeedHealthState;
    ageSeconds: number | null;
    alertMessage: string;
  };
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * กราฟเส้น Micro Tick Sparkline ขนาดกะทัดรัดแสดงทิศทางราคา 24 Tick ล่าสุด
 */
const MicroSparkline: React.FC<{
  points: number[];
  direction: 'up' | 'down' | 'flat';
}> = ({ points, direction }) => {
  const path = useMemo(() => {
    if (!points || points.length < 2) return '';
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 56;
    const height = 16;
    return points
      .map((val, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - 2 - ((val - min) / range) * (height - 4);
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [points]);

  if (!path) return null;

  const strokeColor =
    direction === 'up'
      ? '#34d399'
      : direction === 'down'
        ? '#fb7185'
        : '#94a3b8';

  return (
    <svg
      width="56"
      height="16"
      viewBox="0 0 56 16"
      aria-hidden="true"
      className="shrink-0 overflow-visible opacity-90"
    >
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const BidOfferDeck: React.FC<BidOfferDeckProps> = ({
  pair,
  quote,
  accountType,
  wsConnected,
  feedHealth,
  isRefreshing,
  onRefresh,
}) => {
  const isCriticalStale =
    feedHealth.state === 'STALE' ||
    feedHealth.state === 'ERROR' ||
    feedHealth.state === 'OFFLINE';
  const isDelayed = feedHealth.state === 'DELAYED';

  const bidParts = quote
    ? splitDealingPrice(quote.bid, pair.priceDecimals)
    : { prefix: '--', bigDigits: '', superDigit: '' };
  const askParts = quote
    ? splitDealingPrice(quote.ask, pair.priceDecimals)
    : { prefix: '--', bigDigits: '', superDigit: '' };

  const tickAnimClass =
    quote && quote.tickSeq > 0
      ? quote.tickDirection === 'up'
        ? 'animate-tick-up'
        : quote.tickDirection === 'down'
          ? 'animate-tick-down'
          : ''
      : '';

  const ageLabel =
    feedHealth.ageSeconds === null
      ? 'เชื่อมต่อ...'
      : feedHealth.ageSeconds <= 1
        ? 'สด 1s'
        : `${feedHealth.ageSeconds}s`;

  const changePct = quote?.changePct ?? null;
  const dir = quote?.tickDirection ?? 'flat';

  return (
    <section
      aria-label="ราคา Bid และ Offer แบบเรียลไทม์"
      data-testid="bid-offer-deck"
      className={`surface-glass shrink-0 rounded-2xl border px-2.5 py-2 transition-colors duration-150 ${
        isCriticalStale
          ? 'border-rose-500/60 bg-[#1B0E14]'
          : isDelayed
            ? 'border-amber-500/40'
            : 'border-white/[0.09]'
      }`}
    >
      {/* Compact Live Telemetry + Sparkline Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[10.5px]">
          {feedHealth.state === 'LIVE' ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
              <span
                className="relative flex h-2 w-2 shrink-0"
                aria-hidden="true"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="truncate">
                {quote?.sourceLabel ??
                  (accountType === 'STD' ? 'Vantage STD' : 'Vantage RAW')}
              </span>
            </span>
          ) : isCriticalStale ? (
            <span className="inline-flex items-center gap-1 font-bold text-rose-400">
              {feedHealth.state === 'OFFLINE' ? (
                <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">
                {feedHealth.state === 'OFFLINE' ? 'ออฟไลน์' : 'ราคาค้าง!'}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {quote?.sourceLabel ?? (wsConnected ? 'กำลังซิงค์...' : 'แคชล่าสุด')}
              </span>
            </span>
          )}

          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span
            data-testid="quote-age"
            className="shrink-0 font-mono text-[10px] text-slate-400 tabular-nums"
          >
            {ageLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {quote?.sparkline && quote.sparkline.length >= 2 && (
            <MicroSparkline points={quote.sparkline} direction={dir} />
          )}

          {changePct !== null && (
            <span
              className={`font-mono text-[10.5px] font-bold tabular-nums ${
                changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {changePct >= 0 ? '+' : ''}
              {changePct.toFixed(2)}%
            </span>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="เชื่อมต่อและรีเฟรชราคา Bid และ Offer"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-white active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Institutional Split Dealing Board: SELL (BID) | SPREAD | BUY (OFFER) */}
      <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5">
        {/* SELL / BID */}
        <div
          key={`bid-${quote?.tickSeq ?? 0}`}
          className={`flex flex-col justify-between rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-500/[0.12] via-[#130C12] to-[#090D14] px-2.5 py-1.5 ${tickAnimClass}`}
        >
          <div className="flex items-center justify-between text-[9.5px] font-bold tracking-wider text-rose-300/90">
            <span>BID · ขาย</span>
            {dir === 'up' ? (
              <ArrowUpRight className="h-3 w-3 text-emerald-400" aria-hidden="true" />
            ) : dir === 'down' ? (
              <ArrowDownRight className="h-3 w-3 text-rose-400" aria-hidden="true" />
            ) : null}
          </div>
          <div
            data-testid="live-bid-price"
            className="mt-0.5 flex items-baseline font-mono tabular-nums"
          >
            <span className="text-xs font-semibold text-rose-200/75 sm:text-sm">
              {bidParts.prefix}
            </span>
            <span className="text-[22px] font-extrabold leading-none tracking-tight text-rose-100 sm:text-2xl">
              {bidParts.bigDigits}
            </span>
            {bidParts.superDigit && (
              <span className="ml-0.5 -translate-y-1.5 text-[11px] font-bold text-rose-300">
                {bidParts.superDigit}
              </span>
            )}
          </div>
        </div>

        {/* Dedicated Center Spread Column (Never overlaps Bid/Offer text!) */}
        <div
          aria-label="ค่าสเปรดปัจจุบัน"
          className="flex flex-col items-center justify-center rounded-lg border border-white/[0.08] bg-[#080C12] px-1.5 py-1 text-center"
        >
          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-slate-500">
            SPD
          </span>
          <span
            data-testid="live-spread"
            className="mt-0.5 whitespace-nowrap font-mono text-[10.5px] font-bold text-slate-200 tabular-nums"
          >
            {quote ? quote.spreadFormatted : '--'}
          </span>
        </div>

        {/* BUY / OFFER (ASK) */}
        <div
          key={`ask-${quote?.tickSeq ?? 0}`}
          className={`flex flex-col justify-between rounded-xl border border-emerald-500/25 bg-gradient-to-bl from-emerald-500/[0.12] via-[#0B1513] to-[#090D14] px-2.5 py-1.5 text-right ${tickAnimClass}`}
        >
          <div className="flex items-center justify-between text-[9.5px] font-bold tracking-wider text-emerald-300/90">
            {dir === 'up' ? (
              <ArrowUpRight className="h-3 w-3 text-emerald-400" aria-hidden="true" />
            ) : dir === 'down' ? (
              <ArrowDownRight className="h-3 w-3 text-rose-400" aria-hidden="true" />
            ) : (
              <span />
            )}
            <span>OFFER · ซื้อ</span>
          </div>
          <div
            data-testid="live-ask-price"
            className="mt-0.5 flex items-baseline justify-end font-mono tabular-nums"
          >
            <span className="text-xs font-semibold text-emerald-200/75 sm:text-sm">
              {askParts.prefix}
            </span>
            <span className="text-[22px] font-extrabold leading-none tracking-tight text-emerald-100 sm:text-2xl">
              {askParts.bigDigits}
            </span>
            {askParts.superDigit && (
              <span className="ml-0.5 -translate-y-1.5 text-[11px] font-bold text-emerald-300">
                {askParts.superDigit}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Compact Single-Row Stale / Disconnect Warning Alert */}
      {feedHealth.alertMessage && (
        <div
          role="alert"
          data-testid="stale-price-alert"
          className={`mt-1.5 flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-[10.5px] font-medium ${
            isCriticalStale
              ? 'border border-rose-500/40 bg-rose-500/[0.16] text-rose-200'
              : 'border border-amber-500/25 bg-amber-500/[0.1] text-amber-200'
          }`}
        >
          <span className="truncate">{feedHealth.alertMessage}</span>
          {isCriticalStale && (
            <button
              type="button"
              onClick={onRefresh}
              className="shrink-0 whitespace-nowrap rounded-md bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-400"
            >
              เชื่อมใหม่
            </button>
          )}
        </div>
      )}
    </section>
  );
};
