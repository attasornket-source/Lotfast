import React from 'react';
import {
  AlertTriangle,
  CandlestickChart,
  Check,
  Copy,
  Delete,
  ExternalLink,
  Plus,
  X,
} from 'lucide-react';
import {
  APP_CONFIG,
  type InputMode,
  type PairId,
  type PairSpec,
  type VantageAccountType,
} from '../config/tradingConfig';
import {
  formatLot,
  parseRrRatio,
  sanitizeRrInput,
  type CalculationResult,
  type ProjectedTakeProfit,
} from '../utils/calculator';
import type { FeedHealthState, MarketQuote } from '../utils/quoteParser';
import { BidOfferDeck } from './BidOfferDeck';

interface CalculatorTerminalProps {
  pairs: PairSpec[];
  pairId: PairId;
  onSelectPair: (id: PairId) => void;
  onOpenSymbolManager: () => void;
  activeQuote: MarketQuote | null;
  accountType: VantageAccountType;
  wsConnected: boolean;
  feedHealth: {
    state: FeedHealthState;
    ageSeconds: number | null;
    alertMessage: string;
  };
  isRefreshingQuotes: boolean;
  onRefreshQuotes: () => void;
  riskUsd: number;
  mode: InputMode;
  onChangeMode: (mode: InputMode) => void;
  inputStr: string;
  onNumpadKey: (key: string) => void;
  result: CalculationResult;
  rrRatio: string;
  onChangeRrRatio: (value: string) => void;
  projectedTp: ProjectedTakeProfit | null;
  copiedLot: string | null;
  onCopyLot: () => void;
  onOpenMt5: (copyFirst: boolean) => void;
  onOpenTradingView: () => void;
}

const NUMPAD_KEYS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '.', '0', 'DEL',
] as const;

export const CalculatorTerminal: React.FC<CalculatorTerminalProps> = ({
  pairs,
  pairId,
  onSelectPair,
  onOpenSymbolManager,
  activeQuote,
  accountType,
  wsConnected,
  feedHealth,
  isRefreshingQuotes,
  onRefreshQuotes,
  riskUsd,
  mode,
  onChangeMode,
  inputStr,
  onNumpadKey,
  result,
  rrRatio,
  onChangeRrRatio,
  projectedTp,
  copiedLot,
  onCopyLot,
  onOpenMt5,
  onOpenTradingView,
}) => {
  const { pair } = result;
  const isAmberTheme = pair.isIndex || pair.category === 'metal';
  const isStockTheme = pair.category === 'stock';
  const unit = pair.unitLabel || 'Lot';

  const isDanger =
    result.status === 'OVER_RISK' ||
    result.status === 'BELOW_MIN_LOT' ||
    result.status === 'INVALID_RISK';
  const isReady = result.status === 'OK';
  const lot2Display = isReady
    ? formatLot(result.lot2, pair)
    : isDanger
      ? formatLot(0, pair)
      : '--';

  const pct1 =
    riskUsd > 0 && result.loss1 > 0
      ? Math.min(100, (result.loss1 / riskUsd) * 100)
      : 0;
  const pct2 =
    isReady && riskUsd > 0
      ? Math.min(100 - pct1, (result.loss2 / riskUsd) * 100)
      : 0;

  const trimmedRr = rrRatio.trim();
  const parsedRatio = trimmedRr ? parseRrRatio(trimmedRr) : null;
  const isRrInvalid = trimmedRr !== '' && parsedRatio === null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* 1. Compact Instrument Switcher Rail + Add Stock Button (46px) */}
      <div className="flex shrink-0 items-stretch gap-1.5">
        <div className="relative min-w-0 flex-1">
          <div
            className={`no-scrollbar flex gap-1.5 overflow-x-auto ${
              pairs.length <= 4 ? 'grid grid-cols-4' : 'pr-4'
            }`}
            role="group"
            aria-label="เลือกคู่เงินหรือหุ้น"
          >
            {pairs.map((p) => {
              const active = p.id === pairId;
              const activeStyle =
                p.isIndex || p.category === 'metal'
                  ? 'border-amber-400/80 bg-amber-500/[0.15] text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.16)]'
                  : p.category === 'stock'
                    ? 'border-sky-400/80 bg-sky-500/[0.15] text-sky-200 shadow-[0_0_14px_rgba(56,189,248,0.16)]'
                    : 'border-emerald-400/80 bg-emerald-500/[0.15] text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.16)]';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPair(p.id)}
                  aria-pressed={active}
                  className={`flex h-[46px] min-w-[68px] shrink-0 flex-col items-center justify-center rounded-xl border px-1.5 transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    active
                      ? activeStyle
                      : 'surface-glass border-white/[0.08] text-slate-200 hover:border-white/[0.18]'
                  }`}
                >
                  <span className="whitespace-nowrap text-xs font-extrabold leading-tight tracking-tight sm:text-[13px]">
                    {p.label}
                  </span>
                  <span
                    className={`whitespace-nowrap font-mono text-[10px] leading-tight tabular-nums ${
                      active ? 'opacity-90' : 'text-slate-400'
                    }`}
                  >
                    ไม้1: {formatLot(p.firstLot, p)}
                  </span>
                </button>
              );
            })}
          </div>
          {pairs.length > 4 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-[#06090F] to-transparent"
            />
          )}
        </div>

        <button
          type="button"
          onClick={onOpenSymbolManager}
          data-testid="add-symbol-btn"
          aria-label="เพิ่มหุ้นหรือสินทรัพย์อื่น"
          className="surface-glass flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-emerald-400/45 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/[0.12] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="text-[9px] font-bold leading-none">เพิ่ม</span>
        </button>
      </div>

      {/* 2. Institutional Live Bid / Offer Dealing Desk + Micro Sparkline */}
      <BidOfferDeck
        pair={pair}
        quote={activeQuote}
        accountType={accountType}
        wsConnected={wsConnected}
        feedHealth={feedHealth}
        isRefreshing={isRefreshingQuotes}
        onRefresh={onRefreshQuotes}
      />

      {/* 3. Compact Hero 2nd-Order Lot Card (Carbon Mesh + Copy + MT5/TV + Inline R:R) */}
      <section
        aria-label="ผลลัพธ์ขนาด Lot ไม้ที่ 2"
        className={`card-pattern-mesh shrink-0 rounded-2xl border px-3.5 py-2.5 transition-colors duration-200 ${
          isDanger
            ? 'border-rose-500/55'
            : isAmberTheme
              ? 'border-amber-400/35'
              : isStockTheme
                ? 'border-sky-400/35'
                : 'border-white/[0.1]'
        }`}
      >
        {/* Row 1: Big 2nd-Order Lot Readout + Primary Copy Button */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="font-medium">ไม้ที่ 2 ({unit})</span>
              <span aria-hidden="true">·</span>
              <span
                className={`truncate font-mono ${
                  isAmberTheme
                    ? 'font-semibold text-amber-300'
                    : isStockTheme
                      ? 'font-semibold text-sky-300'
                      : 'text-slate-300'
                }`}
              >
                Step {formatLot(pair.lotStep, pair)}
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <output
                data-testid="lot2-output"
                className={`font-mono text-[42px] font-extrabold leading-none tracking-tight tabular-nums sm:text-5xl ${
                  isDanger
                    ? 'text-rose-400'
                    : isReady
                      ? isAmberTheme
                        ? 'text-amber-400'
                        : isStockTheme
                          ? 'text-sky-400'
                          : 'text-emerald-400'
                      : 'text-slate-600'
                }`}
              >
                {lot2Display}
              </output>
              <span className="text-xs font-bold text-slate-400">{unit}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCopyLot}
            disabled={!isReady}
            data-testid="copy-lot-btn"
            className={`inline-flex h-12 min-w-[116px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-extrabold transition-transform duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              copiedLot
                ? 'bg-white text-[#06090F]'
                : isReady
                  ? isAmberTheme
                    ? 'bg-amber-400 text-[#090D14] shadow-[0_6px_18px_rgba(245,158,11,0.28)] hover:bg-amber-300'
                    : isStockTheme
                      ? 'bg-sky-400 text-[#05101A] shadow-[0_6px_18px_rgba(56,189,248,0.28)] hover:bg-sky-300'
                      : 'bg-emerald-400 text-[#04140D] shadow-[0_6px_18px_rgba(16,185,129,0.28)] hover:bg-emerald-300'
                  : ''
            }`}
          >
            {copiedLot ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                <span className="font-mono tabular-nums">{copiedLot}</span>
              </>
            ) : isDanger ? (
              <span>ห้ามเปิด</span>
            ) : isReady ? (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span className="font-mono tabular-nums">คัดลอก {lot2Display}</span>
              </>
            ) : (
              <span>คัดลอก</span>
            )}
          </button>
        </div>

        {/* Safety / Edge-Case Alert (only shown when triggered) */}
        {(isDanger || result.warning) && (
          <div
            role="alert"
            className={`mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
              isDanger
                ? 'bg-rose-500/[0.16] text-rose-200'
                : 'bg-amber-500/[0.16] text-amber-200'
            }`}
          >
            <AlertTriangle
              className={`h-3.5 w-3.5 shrink-0 ${
                isDanger ? 'text-rose-400' : 'text-amber-400'
              }`}
              aria-hidden="true"
            />
            <span className="truncate">{isDanger ? result.message : result.warning}</span>
          </div>
        )}

        {/* Dual-Color Risk Bar + Compact Breakdown */}
        <div className="mt-2 space-y-1">
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
            aria-hidden="true"
          >
            <div
              className={`h-full transition-all duration-150 ${
                isDanger ? 'bg-rose-500' : 'bg-sky-400'
              }`}
              style={{ width: `${pct1.toFixed(1)}%` }}
            />
            <div
              className={`h-full transition-all duration-150 ${
                isAmberTheme
                  ? 'bg-amber-400'
                  : isStockTheme
                    ? 'bg-cyan-400'
                    : 'bg-emerald-400'
              }`}
              style={{ width: `${pct2.toFixed(1)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 tabular-nums">
            <span>
              รวม:{' '}
              <strong className="font-mono font-semibold text-slate-100">
                {isReady || isDanger
                  ? `${formatLot(result.totalLot, pair)} ${unit}`
                  : `-- ${unit}`}
              </strong>
            </span>
            <span>
              เสี่ยงจริง:{' '}
              <strong
                className={`font-mono font-semibold ${
                  isDanger ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                ${result.totalLoss.toFixed(2)} / ${riskUsd}
              </strong>
            </span>
          </div>
        </div>

        {/* 1-Tap Quick Launch Shortcuts: MT5 & TradingView */}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onOpenMt5(isReady)}
            data-testid="shortcut-mt5-btn"
            className="inline-flex h-[36px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-400/30 bg-emerald-500/[0.11] px-2.5 text-[11.5px] font-bold text-emerald-200 transition-colors hover:bg-emerald-500/[0.2] active:scale-[0.97]"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
            <span className="truncate">
              {isReady ? 'คัดลอก & เปิด MT5' : 'เปิดแอป MT5'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenTradingView}
            data-testid="shortcut-tv-btn"
            className="inline-flex h-[36px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-sky-400/30 bg-sky-500/[0.11] px-2.5 text-[11.5px] font-bold text-sky-200 transition-colors hover:bg-sky-500/[0.2] active:scale-[0.97]"
          >
            <CandlestickChart className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
            <span className="truncate">กราฟ TradingView</span>
          </button>
        </div>

        {/* Ultra-Compact Inline R:R Selector + Take Profit Output */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-white/[0.07] pt-2">
          <div className="flex items-center gap-1">
            <label
              htmlFor="rr-ratio-input"
              className="mr-0.5 text-[10.5px] font-semibold text-slate-400"
            >
              R:R
            </label>
            {APP_CONFIG.RR_PRESETS.map((preset) => {
              const active = trimmedRr === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChangeRrRatio(active ? '' : preset)}
                  aria-pressed={active}
                  className={`h-[26px] whitespace-nowrap rounded-md border px-1.5 font-mono text-[10.5px] font-semibold tabular-nums transition-colors ${
                    active
                      ? 'border-emerald-400/75 bg-emerald-500/[0.16] text-emerald-300'
                      : 'border-white/[0.08] bg-[#080C12] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
            <div className="flex items-center rounded-md border border-white/[0.09] bg-[#080C12] pl-1.5 pr-0.5 focus-within:border-emerald-400/70">
              <input
                id="rr-ratio-input"
                data-testid="rr-ratio-input"
                type="text"
                inputMode="text"
                value={rrRatio}
                onChange={(e) => onChangeRrRatio(sanitizeRrInput(e.target.value))}
                placeholder="1:2"
                aria-label="กำหนดอัตราส่วน R:R เช่น 1:2 หรือ 1:3"
                className="h-[24px] w-10 bg-transparent text-right font-mono text-[11px] font-semibold text-slate-100 outline-none placeholder:text-slate-600 tabular-nums"
              />
              {trimmedRr !== '' && (
                <button
                  type="button"
                  onClick={() => onChangeRrRatio('')}
                  aria-label="ล้างค่า R:R"
                  className="flex h-4 w-4 items-center justify-center text-slate-500 hover:text-slate-200"
                >
                  <X className="h-2.5 w-2.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1 text-[11px] tabular-nums">
            {isRrInvalid ? (
              <span role="alert" className="text-[10.5px] text-amber-300">
                ใส่เช่น 1:2
              </span>
            ) : (
              <>
                <span className="text-slate-400">TP:</span>
                <output
                  data-testid="projected-tp-output"
                  className={`font-mono text-xs font-extrabold ${
                    projectedTp ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {projectedTp
                    ? `+$${projectedTp.secondOrderProfitUsd.toFixed(2)}`
                    : '--'}
                </output>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 4. Compact Single-Row SL Input Bar + USD/PTS Mode Switch (52px) */}
      <section
        aria-label="กรอกระยะ SL หรือยอดขาดทุนไม้แรก"
        className="surface-glass flex shrink-0 items-center justify-between gap-2 rounded-2xl border border-white/[0.08] px-3 py-2"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className={`shrink-0 font-mono text-lg font-bold ${
              mode === 'USD' ? 'text-rose-400' : 'text-sky-400'
            }`}
          >
            {mode === 'USD' ? '-$' : 'PTS'}
          </span>
          <div className="flex min-w-0 items-center overflow-hidden">
            <span
              data-testid="sl-input-display"
              className={`truncate font-mono text-2xl font-extrabold tracking-tight tabular-nums ${
                inputStr ? 'text-slate-100' : 'text-base font-medium text-slate-500'
              }`}
            >
              {inputStr ||
                (mode === 'USD'
                  ? `SL ไม้ ${formatLot(pair.firstLot, pair)} (เช่น ${pair.placeholderUsd})`
                  : `ระยะจุด (เช่น ${pair.placeholderPts})`)}
            </span>
            <span
              aria-hidden="true"
              className={`ml-0.5 inline-block h-6 w-0.5 shrink-0 rounded-full animate-cursor-blink ${
                isAmberTheme
                  ? 'bg-amber-400'
                  : isStockTheme
                    ? 'bg-sky-400'
                    : 'bg-emerald-400'
              }`}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div
            className="inline-flex items-center rounded-lg border border-white/[0.07] bg-[#080C12] p-0.5"
            role="tablist"
            aria-label="โหมดการกรอก SL"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'USD'}
              onClick={() => onChangeMode('USD')}
              className={`whitespace-nowrap rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors ${
                mode === 'USD'
                  ? 'bg-[#1D2738] text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              USD
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'PTS'}
              onClick={() => onChangeMode('PTS')}
              className={`whitespace-nowrap rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors ${
                mode === 'PTS'
                  ? 'bg-[#1D2738] text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PTS
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNumpadKey('CLEAR')}
            aria-label="ล้างค่าที่กรอก"
            disabled={!inputStr}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-300 transition-colors hover:bg-white/[0.12] active:scale-95 disabled:opacity-30"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 5. Flexible One-Handed Financial Numpad (Auto-Fits Remaining iPhone Height — Even 667px SE!) */}
      <div
        className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-1.5 lg:min-h-[216px] lg:max-h-[244px]"
        role="group"
        aria-label="แป้นตัวเลขความเร็วสูง"
      >
        {NUMPAD_KEYS.map((key) => {
          const isDotDisabled = key === '.' && mode === 'PTS';
          if (key === 'DEL') {
            return (
              <button
                key="DEL"
                type="button"
                onClick={() => onNumpadKey('DEL')}
                aria-label="ลบตัวเลข"
                className="flex h-full min-h-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#0D121B] text-slate-300 transition-transform duration-100 hover:bg-[#17202E] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Delete className="h-5 w-5" aria-hidden="true" />
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNumpadKey(key)}
              disabled={isDotDisabled}
              aria-label={key === '.' ? 'จุดทศนิยม' : `เลข ${key}`}
              className={`numpad-key flex h-full min-h-0 items-center justify-center rounded-xl border border-white/[0.08] font-mono text-xl font-semibold transition-transform duration-100 hover:border-white/[0.16] active:scale-[0.95] sm:text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                key === '.'
                  ? 'text-slate-300 disabled:opacity-25'
                  : 'text-slate-100'
              }`}
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
};
