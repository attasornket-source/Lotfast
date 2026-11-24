import React, { useMemo, useState } from 'react';
import {
  Check,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  PRESET_INSTRUMENTS,
  buildCustomPairSpec,
  type AssetCategory,
  type PairSpec,
  type QuoteType,
} from '../config/tradingConfig';
import { probeSingleTickerQuote } from '../hooks/useMarketQuotes';

interface SymbolManagerModalProps {
  isOpen: boolean;
  allPairs: PairSpec[];
  onClose: () => void;
  onAddPair: (pair: PairSpec) => void;
  onRemovePair: (pairId: string) => void;
}

type LibraryFilter = 'all' | 'stock' | 'index_metal' | 'forex_crypto';

const ASSET_TEMPLATES: Array<{
  id: string;
  label: string;
  category: AssetCategory;
  quoteType: QuoteType;
  exchange: string;
  firstLot: number;
  minLot: number;
  lotStep: number;
  contractSize: number;
  pointSize: number;
  typicalSpreadPoints: number;
}> = [
  {
    id: 'us_stock',
    label: 'หุ้นสหรัฐ (US Stock USD)',
    category: 'stock',
    quoteType: 'STOCK_USD',
    exchange: 'NASDAQ',
    firstLot: 1,
    minLot: 1,
    lotStep: 1,
    contractSize: 1,
    pointSize: 0.01,
    typicalSpreadPoints: 4,
  },
  {
    id: 'th_stock',
    label: 'หุ้นไทย (SET THB)',
    category: 'stock',
    quoteType: 'STOCK_THB',
    exchange: 'SET',
    firstLot: 100,
    minLot: 100,
    lotStep: 100,
    contractSize: 1,
    pointSize: 0.25,
    typicalSpreadPoints: 1,
  },
  {
    id: 'fx_usd',
    label: 'Forex (ลงท้าย USD)',
    category: 'forex',
    quoteType: 'USD',
    exchange: 'VANTAGE',
    firstLot: 0.01,
    minLot: 0.01,
    lotStep: 0.01,
    contractSize: 100_000,
    pointSize: 0.00001,
    typicalSpreadPoints: 4,
  },
  {
    id: 'fx_jpy',
    label: 'Forex (ลงท้าย JPY)',
    category: 'forex',
    quoteType: 'JPY',
    exchange: 'VANTAGE',
    firstLot: 0.01,
    minLot: 0.01,
    lotStep: 0.01,
    contractSize: 100_000,
    pointSize: 0.001,
    typicalSpreadPoints: 8,
  },
  {
    id: 'index_cfd',
    label: 'ดัชนี (Index CFD)',
    category: 'index',
    quoteType: 'INDEX_USD',
    exchange: 'VANTAGE',
    firstLot: 0.1,
    minLot: 0.1,
    lotStep: 0.1,
    contractSize: 1,
    pointSize: 0.01,
    typicalSpreadPoints: 150,
  },
  {
    id: 'metal',
    label: 'ทองคำ / โลหะมีค่า',
    category: 'metal',
    quoteType: 'METAL_USD',
    exchange: 'VANTAGE',
    firstLot: 0.01,
    minLot: 0.01,
    lotStep: 0.01,
    contractSize: 100,
    pointSize: 0.01,
    typicalSpreadPoints: 20,
  },
  {
    id: 'crypto',
    label: 'คริปโต (Crypto USD)',
    category: 'crypto',
    quoteType: 'CRYPTO_USD',
    exchange: 'BINANCE',
    firstLot: 0.01,
    minLot: 0.01,
    lotStep: 0.01,
    contractSize: 1,
    pointSize: 0.01,
    typicalSpreadPoints: 500,
  },
];

export const SymbolManagerModal: React.FC<SymbolManagerModalProps> = ({
  isOpen,
  allPairs,
  onClose,
  onAddPair,
  onRemovePair,
}) => {
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [searchText, setSearchText] = useState('');

  // Custom ticker form state
  const [templateId, setTemplateId] = useState('us_stock');
  const [symbolInput, setSymbolInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [exchangeInput, setExchangeInput] = useState('NASDAQ');
  const [firstLotInput, setFirstLotInput] = useState('1');
  const [lotStepInput, setLotStepInput] = useState('1');
  const [contractSizeInput, setContractSizeInput] = useState('1');
  const [spreadInput, setSpreadInput] = useState('4');
  const [formError, setFormError] = useState('');

  const [probeState, setProbeState] = useState<{
    loading: boolean;
    message: string;
    ok: boolean;
    resolvedTicker?: string;
    description?: string;
  }>({ loading: false, message: '', ok: false });

  const existingIds = useMemo(
    () => new Set(allPairs.map((p) => p.id.toUpperCase())),
    [allPairs]
  );

  const customAddedPairs = useMemo(
    () => allPairs.filter((p) => p.isCustom),
    [allPairs]
  );

  const filteredPresets = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return PRESET_INSTRUMENTS.filter((item) => {
      if (filter === 'stock' && item.category !== 'stock') return false;
      if (
        filter === 'index_metal' &&
        item.category !== 'index' &&
        item.category !== 'metal'
      ) {
        return false;
      }
      if (
        filter === 'forex_crypto' &&
        item.category !== 'forex' &&
        item.category !== 'crypto'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.mt5Symbol.toLowerCase().includes(q) ||
        item.fullName.toLowerCase().includes(q)
      );
    });
  }, [filter, searchText]);

  if (!isOpen) return null;

  const applyTemplate = (nextId: string) => {
    setTemplateId(nextId);
    const tpl = ASSET_TEMPLATES.find((t) => t.id === nextId);
    if (!tpl) return;
    setExchangeInput(tpl.exchange);
    setFirstLotInput(String(tpl.firstLot));
    setLotStepInput(String(tpl.lotStep));
    setContractSizeInput(String(tpl.contractSize));
    setSpreadInput(String(tpl.typicalSpreadPoints));
  };

  const handleProbeTicker = async () => {
    const raw = symbolInput.trim().toUpperCase();
    if (!raw) {
      setFormError('กรุณากรอกชื่อหุ้นหรือสัญลักษณ์ก่อนทดสอบราคา');
      return;
    }
    setFormError('');
    setProbeState({ loading: true, message: 'กำลังตรวจสอบฟีดราคาจริง...', ok: false });
    const query = raw.includes(':') ? raw : `${exchangeInput.trim()}:${raw}`;
    let res = await probeSingleTickerQuote(query);
    if (!res.found && !raw.includes(':')) {
      res = await probeSingleTickerQuote(raw);
    }

    if (res.found) {
      const [ex] = res.resolvedTicker.split(':');
      if (ex) setExchangeInput(ex);
      const priceText =
        res.bid && res.ask
          ? `Bid ${res.bid} / Ask ${res.ask}`
          : res.price !== null
            ? `ราคาล่าสุด ${res.price}`
            : 'พบสัญลักษณ์แล้ว';
      setProbeState({
        loading: false,
        ok: true,
        resolvedTicker: res.resolvedTicker,
        description: res.description,
        message: `พบ ${res.resolvedTicker} (${res.description}) · ${priceText}`,
      });
    } else {
      setProbeState({
        loading: false,
        ok: false,
        message:
          'ไม่พบฟีดราคาอัตโนมัติ (อาจต้องระบุตลาด เช่น NYSE:DIS หรือ SET:AOT) — แต่ยังเพิ่มเพื่อคำนวณโหมด USD Loss ได้ตามปกติ',
      });
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const rawSym = symbolInput.trim().toUpperCase();
    if (!rawSym) {
      setFormError('กรุณากรอกชื่อหุ้นหรือสัญลักษณ์ เช่น NVDA, PLTR, SET:AOT');
      return;
    }

    const firstLot = Number.parseFloat(firstLotInput);
    const lotStep = Number.parseFloat(lotStepInput);
    const contractSize = Number.parseFloat(contractSizeInput);
    const spreadPts = Number.parseFloat(spreadInput);

    if (!Number.isFinite(firstLot) || firstLot <= 0) {
      setFormError('ขนาดไม้ที่ 1 ต้องมากกว่า 0');
      return;
    }
    if (!Number.isFinite(lotStep) || lotStep <= 0) {
      setFormError('Lot Step ต้องมากกว่า 0');
      return;
    }

    const tpl =
      ASSET_TEMPLATES.find((t) => t.id === templateId) ?? ASSET_TEMPLATES[0];

    const newPair = buildCustomPairSpec({
      symbol: probeState.ok && probeState.resolvedTicker ? probeState.resolvedTicker : rawSym,
      label: labelInput.trim() || undefined,
      fullName: probeState.description || undefined,
      category: tpl.category,
      quoteType: tpl.quoteType,
      exchange: exchangeInput.trim() || tpl.exchange,
      firstLot,
      minLot: lotStep,
      lotStep,
      contractSize: Number.isFinite(contractSize) && contractSize > 0 ? contractSize : tpl.contractSize,
      pointSize: tpl.pointSize,
      typicalSpreadPoints: Number.isFinite(spreadPts) && spreadPts >= 0 ? spreadPts : tpl.typicalSpreadPoints,
    });

    onAddPair(newPair);
    setSymbolInput('');
    setLabelInput('');
    setFormError('');
    setProbeState({ loading: false, message: '', ok: false });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="เพิ่มหุ้นและจัดการสินทรัพย์"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-white/[0.1] bg-[#0F1520] pb-safe sm:rounded-2xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-700 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
          <div>
            <h2 className="text-base font-bold text-slate-100">
              เพิ่มหุ้น / สินทรัพย์เทรด
            </h2>
            <p className="text-xs text-slate-400">
              เลือกจากคลังยอดนิยม หรือกรอกชื่อหุ้นสหรัฐ/ไทย/Forex ได้อิสระ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างเพิ่มหุ้น"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="flex gap-1.5 border-b border-white/[0.06] px-5 py-2.5">
          <button
            type="button"
            onClick={() => setTab('presets')}
            className={`min-h-[38px] flex-1 rounded-xl text-xs font-bold transition-colors ${
              tab === 'presets'
                ? 'bg-emerald-400 text-[#04140D]'
                : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            เลือกจากคลังหุ้น & สินทรัพย์
          </button>
          <button
            type="button"
            onClick={() => setTab('custom')}
            className={`min-h-[38px] flex-1 rounded-xl text-xs font-bold transition-colors ${
              tab === 'custom'
                ? 'bg-emerald-400 text-[#04140D]'
                : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            + กรอกหุ้น/Ticker เอง
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'presets' ? (
            <div className="space-y-3.5">
              {/* Search + Category Filter */}
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="ค้นหา เช่น AAPL, NVDA, GOLD, DELTA, BTC..."
                  aria-label="ค้นหาหุ้นหรือสินทรัพย์"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#080C12] py-2.5 pl-9 pr-3 text-base sm:text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/70"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'stock', label: 'หุ้นสหรัฐ & ไทย' },
                    { id: 'index_metal', label: 'ทอง & ดัชนี' },
                    { id: 'forex_crypto', label: 'Forex & Crypto' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      filter === f.id
                        ? 'bg-white/[0.12] text-white'
                        : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredPresets.map((item) => {
                  const alreadyAdded = existingIds.has(item.id.toUpperCase());
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-[#0B1018] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm font-bold ${
                              item.category === 'stock'
                                ? 'text-sky-300'
                                : item.isIndex
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                            }`}
                          >
                            {item.label}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {item.tvSymbol}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-slate-400">
                          {item.fullName}
                        </p>
                      </div>

                      {alreadyAdded ? (
                        <button
                          type="button"
                          onClick={() => onRemovePair(item.id)}
                          aria-label={`ลบ ${item.label}`}
                          className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.12] px-2.5 text-[11px] font-bold text-emerald-300 hover:border-rose-500/40 hover:bg-rose-500/[0.15] hover:text-rose-300"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>เพิ่มแล้ว</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddPair(item)}
                          aria-label={`เพิ่ม ${item.label}`}
                          className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg bg-white/[0.09] px-2.5 text-[11px] font-bold text-slate-100 hover:bg-emerald-400 hover:text-[#04140D]"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>เพิ่ม</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Manage Added Custom Symbols */}
              {customAddedPairs.length > 0 && (
                <div className="border-t border-white/[0.07] pt-3">
                  <p className="mb-2 text-xs font-semibold text-slate-300">
                    หุ้น/สินทรัพย์ที่เพิ่มไว้ ({customAddedPairs.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {customAddedPairs.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onRemovePair(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-[#0A0F17] px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-rose-500/40 hover:text-rose-300"
                      >
                        <span>{p.label}</span>
                        <Trash2 className="h-3 w-3 text-slate-500" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateCustom} className="space-y-3.5">
              <div>
                <label
                  htmlFor="custom-asset-type"
                  className="mb-1 block text-xs font-medium text-slate-400"
                >
                  ประเภทสินทรัพย์
                </label>
                <select
                  id="custom-asset-type"
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.1] bg-[#080C12] px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none focus:border-emerald-400"
                >
                  {ASSET_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#0F1520]">
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="custom-ticker-input"
                    className="mb-1 block text-xs font-medium text-slate-400"
                  >
                    ชื่อหุ้น / สัญลักษณ์ (เช่น PLTR, AMD, SET:AOT)
                  </label>
                  <input
                    id="custom-ticker-input"
                    data-testid="custom-ticker-input"
                    type="text"
                    value={symbolInput}
                    onChange={(e) => {
                      setSymbolInput(e.target.value.toUpperCase());
                      setFormError('');
                    }}
                    placeholder="PLTR หรือ NYSE:DIS"
                    className="w-full rounded-xl border border-white/[0.1] bg-[#080C12] px-3 py-2.5 font-mono text-base sm:text-sm font-bold text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="custom-exchange-input"
                    className="mb-1 block text-xs font-medium text-slate-400"
                  >
                    ตลาด (Exchange)
                  </label>
                  <input
                    id="custom-exchange-input"
                    type="text"
                    value={exchangeInput}
                    onChange={(e) => setExchangeInput(e.target.value.toUpperCase())}
                    placeholder="NASDAQ"
                    className="w-full rounded-xl border border-white/[0.1] bg-[#080C12] px-3 py-2.5 font-mono text-base sm:text-sm font-bold text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Live Price Probe Button */}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleProbeTicker}
                  disabled={probeState.loading}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-sky-400/35 bg-sky-500/[0.1] px-3 py-2 text-xs font-bold text-sky-300 hover:bg-sky-500/[0.18] disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {probeState.loading
                      ? 'กำลังตรวจสอบราคา...'
                      : 'ทดสอบดึงราคาสด (ตรวจ Ticker)'}
                  </span>
                </button>
                {probeState.message && (
                  <p
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                      probeState.ok
                        ? 'bg-emerald-500/[0.12] text-emerald-300'
                        : 'bg-amber-500/[0.1] text-amber-200'
                    }`}
                  >
                    {probeState.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div>
                  <label
                    htmlFor="custom-label-input"
                    className="mb-1 block text-[11px] font-medium text-slate-400"
                  >
                    ชื่อปุ่มย่อ
                  </label>
                  <input
                    id="custom-label-input"
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value.toUpperCase().slice(0, 8))}
                    placeholder="อัตโนมัติ"
                    className="w-full rounded-xl border border-white/[0.09] bg-[#080C12] px-2.5 py-2 font-mono text-sm font-semibold text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="custom-first-lot"
                    className="mb-1 block text-[11px] font-medium text-slate-400"
                  >
                    ไม้ที่ 1 (Lot)
                  </label>
                  <input
                    id="custom-first-lot"
                    type="number"
                    step="any"
                    value={firstLotInput}
                    onChange={(e) => setFirstLotInput(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#080C12] px-2.5 py-2 font-mono text-sm font-semibold text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="custom-lot-step"
                    className="mb-1 block text-[11px] font-medium text-slate-400"
                  >
                    Lot Step
                  </label>
                  <input
                    id="custom-lot-step"
                    type="number"
                    step="any"
                    value={lotStepInput}
                    onChange={(e) => setLotStepInput(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#080C12] px-2.5 py-2 font-mono text-sm font-semibold text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="custom-spread"
                    className="mb-1 block text-[11px] font-medium text-slate-400"
                  >
                    Spread (pts)
                  </label>
                  <input
                    id="custom-spread"
                    type="number"
                    step="any"
                    value={spreadInput}
                    onChange={(e) => setSpreadInput(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#080C12] px-2.5 py-2 font-mono text-sm font-semibold text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {formError && (
                <p role="alert" className="text-xs font-medium text-rose-400">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                data-testid="submit-custom-pair"
                className="min-h-[48px] w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-[#04140D] transition-colors hover:bg-emerald-300 active:scale-[0.98]"
              >
                บันทึกและเลือกสินทรัพย์นี้ทันที
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
