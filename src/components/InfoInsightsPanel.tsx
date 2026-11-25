import React, { useState } from 'react';
import {
  CandlestickChart,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  APP_CONFIG,
  CHANGELOG,
  MT5_NO_VPS_OPTIONS,
  type InputMode,
  type PairId,
  type PairSpec,
  type VantageAccountType,
} from '../config/tradingConfig';
import {
  formatLot,
  getPipValuePerFullLot,
  type CalculationResult,
  type LiveRates,
} from '../utils/calculator';
import type { FeedHealthState, MarketQuote } from '../utils/quoteParser';
import { PWAInstallButton } from './Modals';

export type InfoTab = 'specs' | 'mt5' | 'pwa';

export interface CalcHistoryItem {
  id: string;
  timestamp: number;
  pairId: PairId;
  pairLabel?: string;
  mode: InputMode;
  inputStr: string;
  riskUsd: number;
  lot2: string;
  totalLoss: number;
}

interface InfoInsightsPanelProps {
  activeTab: InfoTab;
  onChangeTab: (tab: InfoTab) => void;
  pairs: PairSpec[];
  selectedPairId: PairId;
  onSelectPair: (id: PairId) => void;
  onOpenSymbolManager: () => void;
  onRemovePair: (id: string) => void;
  result: CalculationResult;
  riskUsd: number;
  rates: LiveRates;
  quotes: Record<string, MarketQuote>;
  accountType: VantageAccountType;
  feedHealth: {
    state: FeedHealthState;
    ageSeconds: number | null;
    alertMessage: string;
  };
  rateUpdatedAt: number | null;
  isRefreshingRates: boolean;
  onRefreshRates: () => void;
  history: CalcHistoryItem[];
  onApplyHistory: (item: CalcHistoryItem) => void;
  onClearHistory: () => void;
  onForceUpdate: () => void;
  onOpenMt5: (copyFirst: boolean) => void;
  onOpenTradingViewApp: (copyFirst: boolean) => void;
  onOpenTradingViewChart: () => void;
}

export const InfoInsightsPanel: React.FC<InfoInsightsPanelProps> = ({
  activeTab,
  onChangeTab,
  pairs,
  selectedPairId,
  onSelectPair,
  onOpenSymbolManager,
  onRemovePair,
  result,
  riskUsd,
  rates,
  quotes,
  accountType,
  feedHealth,
  rateUpdatedAt,
  isRefreshingRates,
  onRefreshRates,
  history,
  onApplyHistory,
  onClearHistory,
  onForceUpdate,
  onOpenMt5,
  onOpenTradingViewApp,
  onOpenTradingViewChart,
}) => {
  const [urlCopied, setUrlCopied] = useState(false);

  const formattedTime = rateUpdatedAt
    ? new Date(rateUpdatedAt).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  const handleCopyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setUrlCopied(true);
      window.setTimeout(() => setUrlCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="surface-glass flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08]">
      {/* Segmented Navigation Tabs */}
      <div
        className="flex shrink-0 items-center gap-1 border-b border-white/[0.08] p-2"
        role="tablist"
        aria-label="ข้อมูลตลาดและการเชื่อมต่อ"
      >
        {(
          [
            { id: 'specs', label: 'กระดาน Bid/Offer & ประวัติ' },
            { id: 'mt5', label: 'TradingView & MT5' },
            { id: 'pwa', label: `ติดตั้ง iPhone · ${APP_CONFIG.VERSION}` },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChangeTab(tab.id)}
              className={`min-h-[38px] flex-1 whitespace-nowrap rounded-xl px-2.5 py-2 text-xs font-bold transition-colors ${
                active
                  ? 'bg-white/[0.11] text-slate-50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Body (Internal Scroll Only) */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
        {activeTab === 'specs' && (
          <div className="space-y-5">
            {/* Live Vantage Market Watch Table */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-100">
                    กระดานราคา Vantage ({accountType === 'STD' ? 'Standard STP' : 'Raw ECN'})
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {feedHealth.state === 'LIVE'
                      ? `ฟีดสดทำงานปกติ · อัปเดต ${formattedTime}`
                      : feedHealth.alertMessage || `อัปเดตล่าสุด ${formattedTime}`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onOpenSymbolManager}
                    className="inline-flex min-h-[36px] items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-400/35 bg-emerald-500/[0.12] px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/[0.2]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>เพิ่มหุ้น</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRefreshRates}
                    disabled={isRefreshingRates}
                    aria-label="อัปเดตเรทตลาดล่าสุด"
                    className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.1] disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isRefreshingRates ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>รีเฟรช</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-[#080C12]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400">
                      <th className="px-3 py-2.5 font-semibold">สินทรัพย์</th>
                      <th className="px-2.5 py-2.5 text-right font-semibold text-rose-300/90">
                        Bid (ขาย)
                      </th>
                      <th className="px-2.5 py-2.5 text-right font-semibold text-emerald-300/90">
                        Offer (ซื้อ)
                      </th>
                      <th className="px-2.5 py-2.5 text-right font-semibold">สเปรด</th>
                      <th className="px-3 py-2.5 text-right font-semibold">$/Pip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] font-mono tabular-nums">
                    {pairs.map((p) => {
                      const q = quotes[p.id];
                      const pipVal = getPipValuePerFullLot(p, rates);
                      const isSelected = p.id === selectedPairId;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => onSelectPair(p.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <td className="px-3 py-2.5 font-sans">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold ${
                                  p.isIndex || p.category === 'metal'
                                    ? 'text-amber-300'
                                    : p.category === 'stock'
                                      ? 'text-sky-300'
                                      : 'text-slate-100'
                                }`}
                              >
                                {p.label}
                              </span>
                              {p.isCustom && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemovePair(p.id);
                                  }}
                                  aria-label={`ลบ ${p.label}`}
                                  className="rounded p-0.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300"
                                >
                                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                            <span className="block text-[10px] text-slate-500">
                              ไม้ 1: {formatLot(p.firstLot, p)} · {p.mt5Symbol}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-right text-rose-300">
                            {q ? q.bid.toFixed(p.priceDecimals) : '--'}
                          </td>
                          <td className="px-2.5 py-2.5 text-right text-emerald-300">
                            {q ? q.ask.toFixed(p.priceDecimals) : '--'}
                          </td>
                          <td className="px-2.5 py-2.5 text-right text-[11px] text-slate-400">
                            {q ? q.spreadFormatted : '--'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-200">
                            ${pipVal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Trade Risk Breakdown */}
            <div className="rounded-xl border border-white/[0.07] bg-[#080C12] p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  รายละเอียดการแบ่งความเสี่ยง ({result.pair.label})
                </span>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  งบสูงสุด ${riskUsd}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-2.5 font-mono text-xs tabular-nums">
                <div>
                  <span className="block font-sans text-[11px] text-slate-400">
                    ไม้ที่ 1 ({formatLot(result.pair.firstLot, result.pair)})
                  </span>
                  <strong className="mt-0.5 block text-sky-300">
                    -${result.loss1.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span className="block font-sans text-[11px] text-slate-400">
                    ไม้ที่ 2 ({formatLot(result.lot2, result.pair)})
                  </span>
                  <strong
                    className={`mt-0.5 block ${
                      result.pair.isIndex ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    -${result.loss2.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span className="block font-sans text-[11px] text-slate-400">
                    งบเหลือปลอดภัย
                  </span>
                  <strong className="mt-0.5 block text-slate-200">
                    ${Math.max(0, result.unusedRisk).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Session Copy History */}
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-100">
                  ประวัติการคำนวณล่าสุด
                </h2>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="inline-flex min-h-[34px] items-center gap-1 text-xs font-medium text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>ล้างประวัติ</span>
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.09] px-4 py-5 text-center text-xs text-slate-400">
                  ยังไม่มีประวัติ — เมื่อคำนวณและกด{' '}
                  <strong className="text-slate-200">คัดลอก</strong> หรือ{' '}
                  <strong className="text-slate-200">คัดลอก & เปิด TradingView</strong>{' '}
                  รายการจะถูกบันทึกไว้ที่นี่
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-[#080C12]">
                  {history.map((item) => {
                    const matched = pairs.find((p) => p.id === item.pairId);
                    const displayLabel = item.pairLabel ?? matched?.label ?? item.pairId;
                    const unit = matched?.unitLabel || 'Lot';
                    const isAmber = matched?.isIndex || item.pairId === 'US30';
                    const timeStr = new Date(item.timestamp).toLocaleTimeString(
                      'th-TH',
                      { hour: '2-digit', minute: '2-digit' }
                    );
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onApplyHistory(item)}
                          className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span
                                className={`font-bold ${
                                  isAmber ? 'text-amber-300' : 'text-slate-100'
                                }`}
                              >
                                {displayLabel}
                              </span>
                              <span className="text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono text-slate-300 tabular-nums">
                                {item.mode === 'USD'
                                  ? `SL -$${item.inputStr}`
                                  : `SL ${item.inputStr} pts`}
                              </span>
                              <span className="text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                {timeStr}
                              </span>
                            </div>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-400 tabular-nums">
                              เสี่ยงจริง ${item.totalLoss.toFixed(2)} / ${item.riskUsd}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                              isAmber ? 'text-amber-300' : 'text-emerald-400'
                            }`}
                          >
                            {item.lot2} {unit}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'mt5' && (
          <div className="space-y-4">
            {/* Quick Launch Panel */}
            <div className="rounded-xl border border-white/[0.08] bg-[#080C12] p-3.5">
              <h2 className="font-display text-sm font-bold text-slate-100">
                ปุ่มคีย์ลัดเปิดแอป TradingView & MT5 บน iPhone
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                ปุ่มหลักบนหน้าจอจะเปิดแอป <strong className="text-slate-200">TradingView</strong> โดยตรง (
                <code className="font-mono text-slate-300">tradingview://</code>) และปุ่มกราฟจะเปิดตรงเข้ากราฟ{' '}
                <strong className="font-mono text-sky-300">{result.pair.tvSymbol}</strong> ปรับโหมดได้ในหน้าตั้งค่า (⚙️)
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenTradingViewApp(false)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-[var(--lf-accent-border)] bg-[var(--lf-accent-soft)] px-2 text-xs font-bold text-slate-100 hover:brightness-110"
                >
                  <ExternalLink className="accent-text h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">แอป TV</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenTradingViewChart}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-sky-400/35 bg-sky-500/[0.12] px-2 text-xs font-bold text-sky-300 hover:bg-sky-500/[0.2]"
                >
                  <CandlestickChart className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">กราฟ {result.pair.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMt5(false)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-white/[0.1] bg-white/[0.05] px-2 text-xs font-bold text-slate-200 hover:bg-white/[0.1]"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate">เปิด MT5</span>
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-100">
                แนวทางเชื่อมต่อ Vantage MT5 จริง (โดยไม่เช่า VPS)
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                เปรียบเทียบ 3 แนวทางเชื่อมต่อพอร์ตจริงบน iPhone โดยไม่ต้องดูแล Windows VPS:
              </p>
            </div>

            <div className="space-y-3">
              {MT5_NO_VPS_OPTIONS.map((opt) => (
                <article
                  key={opt.id}
                  className="rounded-xl border border-white/[0.07] bg-[#080C12] p-3.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-100">{opt.title}</h4>
                    <span className="font-mono text-[11px] font-semibold text-emerald-400">
                      {opt.costLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{opt.howItWorks}</p>
                  <p className="mt-2 text-[11px] text-slate-300">
                    ความสะดวกบน iPhone: <strong>{opt.iphoneEase}</strong>
                  </p>
                  <div className="mt-2.5 grid gap-2 border-t border-white/[0.06] pt-2.5 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-400">ข้อดี</p>
                      <ul className="mt-1 space-y-1 text-[11px] text-slate-300">
                        {opt.pros.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-amber-400">ข้อควรพิจารณา</p>
                      <ul className="mt-1 space-y-1 text-[11px] text-slate-400">
                        {opt.cons.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'pwa' && (
          <div className="space-y-5">
            {/* Step-by-step iPhone Installation Card */}
            <div className="rounded-xl border border-emerald-400/25 bg-[#080C12] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/[0.15] text-emerald-400">
                    <Smartphone className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">
                      ติดตั้ง LotFast ลงหน้าจอโฮม iPhone
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      เวอร์ชัน{' '}
                      <span className="font-mono font-semibold text-emerald-300">
                        {APP_CONFIG.VERSION}
                      </span>{' '}
                      · PIN เริ่มต้น{' '}
                      <span className="font-mono font-semibold text-slate-200">
                        {APP_CONFIG.DEFAULT_PIN}
                      </span>
                    </p>
                  </div>
                </div>
                <PWAInstallButton showAlwaysGuide />
              </div>

              <ol className="mt-3.5 space-y-2 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-slate-300">
                <li>
                  1. เปิดลิงก์เว็บแอปนี้ด้วยเบราว์เซอร์ <strong>Safari</strong> บน iPhone{' '}
                  <span className="text-slate-400">(ห้ามเปิดผ่าน Chrome หรือ LINE Browser)</span>
                </li>
                <li>
                  2. แตะปุ่ม <strong>แชร์ (Share)</strong> รูปสี่เหลี่ยมมีลูกศรชี้ขึ้นที่แถบด้านล่าง
                </li>
                <li>
                  3. เลื่อนลงแล้วเลือก <strong>เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</strong>
                </li>
                <li>
                  4. กด <strong>เพิ่ม (Add)</strong> มุมขวาบน — ไอคอน <strong>LotFast</strong> โฉมใหม่จะขึ้นบนหน้าจอโฮม เปิดเต็มจอไร้แถบ Safari ทันที
                </li>
              </ol>

              <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleCopyCurrentUrl}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.1]"
                >
                  {urlCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span>คัดลอกลิงก์แล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>คัดลอกลิงก์เปิดใน Safari</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onForceUpdate}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.1] px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/[0.18]"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>ดึงเวอร์ชันล่าสุด (ล้าง Cache)</span>
                </button>
              </div>
            </div>

            {/* Version Changelog */}
            <div>
              <h3 className="mb-2.5 text-sm font-bold text-slate-100">
                บันทึกเวอร์ชัน (Version History)
              </h3>
              <div className="space-y-3">
                {CHANGELOG.map((entry) => (
                  <div
                    key={entry.version}
                    className="rounded-xl border border-white/[0.07] bg-[#080C12] p-3.5"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-emerald-400"
                        aria-hidden="true"
                      />
                      <span className="font-mono font-bold text-slate-100">
                        {entry.version}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-400">{entry.date}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-300">
                      {entry.notes.map((n) => (
                        <li key={n}>• {n}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
