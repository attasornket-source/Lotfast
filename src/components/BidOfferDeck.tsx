import React from 'react';
import {
  AlertTriangle,
  Radio,
  RefreshCw,
  TrendingDown,
  TrendingUp,
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
  feedHealth: {
    state: FeedHealthState;
    ageSeconds: number | null;
    alertMessage: string;
  };
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const BidOfferDeck: React.FC<BidOfferDeckProps> = ({
  pair,
  quote,
  accountType,
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
    quote?.tickDirection === 'up'
      ? 'animate-tick-up'
      : quote?.tickDirection === 'down'
        ? 'animate-tick-down'
        : '';

  const ageLabel =
    feedHealth.ageSeconds === null
      ? 'กำลังเชื่อมต่อ...'
      : feedHealth.ageSeconds <= 1
        ? 'อัปเดตเมื่อสักครู่'
        : `${feedHealth.ageSeconds} วิที่แล้ว`;

  const changePct = quote?.changePct ?? null;

  return (
    <section
      aria-label="ราคา Bid และ Offer แบบเรียลไทม์"
      data-testid="bid-offer-deck"
      className={`surface-glass rounded-2xl border p-3 transition-colors duration-200 ${
        isCriticalStale
          ? 'border-rose-500/55 bg-[#190F14]'
          : isDelayed
            ? 'border-amber-500/40'
            : 'border-white/[0.08]'
      }`}
    >
      {/* Top Telemetry Strip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px]">
          {feedHealth.state === 'LIVE' ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
              <Radio className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {quote?.sourceLabel ??
                  (accountType === 'STD' ? 'Vantage STD' : 'Vantage RAW')}
              </span>
            </span>
          ) : isCriticalStale ? (
            <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
              {feedHealth.state === 'OFFLINE' ? (
                <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">
                {feedHealth.state === 'OFFLINE'
                  ? 'ออฟไลน์'
                  : 'ราคาไม่อัปเดต'}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {quote?.sourceLabel ?? 'กำลังอัปเดต'}
              </span>
            </span>
          )}

          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span
            data-testid="quote-age"
            className="truncate font-mono text-[10.5px] text-slate-400 tabular-nums"
          >
            {ageLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {changePct !== null && (
            <span
              className={`inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {changePct >= 0 ? (
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden="true" />
              )}
              {changePct >= 0 ? '+' : ''}
              {changePct.toFixed(2)}%
            </span>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="รีเฟรชราคา Bid และ Offer"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.09] hover:text-white active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Dealing Desk Split: SELL (BID) | SPREAD | BUY (OFFER / ASK) */}
      <div className="relative mt-2.5 grid grid-cols-2 gap-2">
        {/* SELL / BID */}
        <div
          key={`bid-${quote?.fetchedAt ?? 0}`}
          className={`rounded-xl border border-rose-500/20 bg-gradient-to-b from-rose-500/[0.08] to-[#0A0E16]/90 px-3 py-2 ${tickAnimClass}`}
        >
          <div className="text-[10px] font-semibold tracking-wider text-rose-300/90">
            BID (ขาย)
          </div>
          <div
            data-testid="live-bid-price"
            className="mt-1 flex items-baseline font-mono text-rose-300 tabular-nums"
          >
            <span className="text-sm font-semibold opacity-80">
              {bidParts.prefix}
            </span>
            <span className="text-2xl font-extrabold leading-none tracking-tight text-rose-200">
              {bidParts.bigDigits}
            </span>
            {bidParts.superDigit && (
              <span className="ml-0.5 -translate-y-2 text-xs font-bold text-rose-300/90">
                {bidParts.superDigit}
              </span>
            )}
          </div>
        </div>

        {/* Center Spread Floating Indicator */}
        <div
          aria-label="ค่าสเปรด"
          className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-md border border-white/[0.12] bg-[#0B1018]/95 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-200 shadow-md tabular-nums"
        >
          {quote ? quote.spreadFormatted : '--'}
        </div>

        {/* BUY / OFFER (ASK) */}
        <div
          key={`ask-${quote?.fetchedAt ?? 0}`}
          className={`rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] to-[#0A0E16]/90 px-3 py-2 text-right ${tickAnimClass}`}
        >
          <div className="text-[10px] font-semibold tracking-wider text-emerald-300/90">
            OFFER · ASK (ซื้อ)
          </div>
          <div
            data-testid="live-ask-price"
            className="mt-1 flex items-baseline justify-end font-mono text-emerald-300 tabular-nums"
          >
            <span className="text-sm font-semibold opacity-80">
              {askParts.prefix}
            </span>
            <span className="text-2xl font-extrabold leading-none tracking-tight text-emerald-200">
              {askParts.bigDigits}
            </span>
            {askParts.superDigit && (
              <span className="ml-0.5 -translate-y-2 text-xs font-bold text-emerald-300/90">
                {askParts.superDigit}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stale / Disconnected / Delayed Price Alert Banner */}
      {feedHealth.alertMessage && (
        <div
          role="alert"
          data-testid="stale-price-alert"
          className={`mt-2.5 flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-[11px] font-medium ${
            isCriticalStale
              ? 'border border-rose-500/35 bg-rose-500/[0.14] text-rose-200'
              : 'border border-amber-500/25 bg-amber-500/[0.1] text-amber-200'
          }`}
        >
          <div className="flex min-w-0 items-start gap-1.5">
            <AlertTriangle
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                isCriticalStale ? 'text-rose-400' : 'text-amber-400'
              }`}
              aria-hidden="true"
            />
            <span className="leading-snug">{feedHealth.alertMessage}</span>
          </div>
          {isCriticalStale && (
            <button
              type="button"
              onClick={onRefresh}
              className="shrink-0 whitespace-nowrap rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-400 active:scale-95"
            >
              ลองใหม่
            </button>
          )}
        </div>
      )}
    </section>
  );
};
