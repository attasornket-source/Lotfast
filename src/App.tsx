import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Lock,
  Radio,
  Settings,
  X,
} from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import {
  APP_CONFIG,
  STORAGE_KEYS,
  getPairById,
  type InputMode,
  type Mt5LaunchMode,
  type PairId,
  type PairSpec,
  type VantageAccountType,
} from './config/tradingConfig';
import {
  appendNumpadKey,
  calculateProjectedTakeProfit,
  calculateSecondOrder,
  formatLot,
} from './utils/calculator';
import { buildMt5LaunchUrl, buildTradingViewUrl } from './utils/quoteParser';
import { useMarketQuotes } from './hooks/useMarketQuotes';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { PinLockScreen } from './components/PinLockScreen';
import { CalculatorTerminal } from './components/CalculatorTerminal';
import {
  InfoInsightsPanel,
  type CalcHistoryItem,
  type InfoTab,
} from './components/InfoInsightsPanel';
import {
  PWAInstallButton,
  RiskLimitModal,
  SettingsModal,
} from './components/Modals';
import { SymbolManagerModal } from './components/SymbolManagerModal';

function readCustomPairs(): PairSpec[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_PAIRS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PairSpec =>
        Boolean(p && typeof p.id === 'string' && typeof p.label === 'string' && p.lotStep > 0)
    );
  } catch {
    return [];
  }
}

function readInitialPair(allPairs: PairSpec[]): PairId {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PAIR);
    if (saved && allPairs.some((p) => p.id === saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return APP_CONFIG.PAIRS[0].id;
}

function readInitialRisk(): number {
  try {
    const saved = Number.parseFloat(localStorage.getItem(STORAGE_KEYS.RISK) ?? '');
    if (Number.isFinite(saved) && saved > 0) return saved;
  } catch {
    // ignore
  }
  return APP_CONFIG.DEFAULT_RISK_USD;
}

function readInitialMode(): InputMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MODE);
    if (saved === 'USD' || saved === 'PTS') return saved;
  } catch {
    // ignore
  }
  return 'USD';
}

function readInitialRrRatio(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.RR_RATIO);
    if (saved && /^[0-9.:]{1,7}$/.test(saved)) return saved;
  } catch {
    // ignore
  }
  return '';
}

function readInitialPin(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PIN);
    if (saved && /^\d{4}$/.test(saved)) return saved;
  } catch {
    // ignore
  }
  return APP_CONFIG.DEFAULT_PIN;
}

function readInitialUnlocked(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return true;
    const until = Number.parseInt(
      localStorage.getItem(STORAGE_KEYS.UNLOCK_UNTIL) ?? '0',
      10
    );
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function readInitialHistory(): CalcHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function readInitialVantageAccount(): VantageAccountType {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.VANTAGE_ACCOUNT);
    if (saved === 'RAW' || saved === 'STD') return saved;
  } catch {
    // ignore
  }
  return 'RAW';
}

function readInitialMt5Mode(): Mt5LaunchMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MT5_LAUNCH_MODE);
    if (saved === 'app_scheme' || saved === 'universal' || saved === 'web_terminal') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'app_scheme';
}

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(readInitialUnlocked);
  const [pinCode, setPinCode] = useState<string>(readInitialPin);

  const [customPairs, setCustomPairs] = useState<PairSpec[]>(readCustomPairs);
  const allPairs = useMemo(
    () => [...APP_CONFIG.PAIRS, ...customPairs],
    [customPairs]
  );

  const [pairId, setPairId] = useState<PairId>(() =>
    readInitialPair([...APP_CONFIG.PAIRS, ...readCustomPairs()])
  );
  const [riskUsd, setRiskUsd] = useState<number>(readInitialRisk);
  const [mode, setMode] = useState<InputMode>(readInitialMode);
  const [rrRatio, setRrRatio] = useState<string>(readInitialRrRatio);
  const [inputStr, setInputStr] = useState<string>('');
  const [copiedLot, setCopiedLot] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [vantageAccountType, setVantageAccountType] =
    useState<VantageAccountType>(readInitialVantageAccount);
  const [mt5LaunchMode, setMt5LaunchMode] =
    useState<Mt5LaunchMode>(readInitialMt5Mode);

  const [history, setHistory] = useState<CalcHistoryItem[]>(readInitialHistory);
  const [infoTab, setInfoTab] = useState<InfoTab>('specs');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [symbolModalOpen, setSymbolModalOpen] = useState(false);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(
    null
  );
  const copyTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const isOnline = useOnlineStatus();
  const {
    quotes,
    activeQuote,
    rates,
    lastSuccessAt,
    feedHealth,
    isRefreshing,
    refreshQuotes,
  } = useMarketQuotes({
    pairs: allPairs,
    activePairId: pairId,
    accountType: vantageAccountType,
    isOnline,
  });

  // Cleanup timers on unmount (fixes memory leak from v1.1.1)
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Register VitePWA service worker and watch for updates
  useEffect(() => {
    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          setUpdateAvailable(true);
        },
      });
      updateSwRef.current = updateSW;
    } catch {
      // ignore if service worker unsupported
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2200);
  }, []);

  const activePair = useMemo(
    () => getPairById(pairId, allPairs),
    [pairId, allPairs]
  );

  const result = useMemo(
    () =>
      calculateSecondOrder({
        pair: activePair,
        riskUsd,
        mode,
        inputStr,
        rates,
      }),
    [activePair, riskUsd, mode, inputStr, rates]
  );

  const projectedTp = useMemo(
    () => calculateProjectedTakeProfit(result, rrRatio, riskUsd),
    [result, rrRatio, riskUsd]
  );

  const handleAddPair = useCallback(
    (newPair: PairSpec) => {
      setCustomPairs((prev) => {
        if (
          prev.some((p) => p.id.toUpperCase() === newPair.id.toUpperCase()) ||
          APP_CONFIG.PAIRS.some((p) => p.id.toUpperCase() === newPair.id.toUpperCase())
        ) {
          return prev;
        }
        const next = [...prev, { ...newPair, isCustom: true }];
        try {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_PAIRS, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      setPairId(newPair.id);
      setInputStr('');
      setCopiedLot(null);
      try {
        localStorage.setItem(STORAGE_KEYS.PAIR, newPair.id);
      } catch {
        // ignore
      }
      showToast(`เพิ่ม ${newPair.label} เข้ากระดานแล้ว`);
    },
    [showToast]
  );

  const handleRemovePair = useCallback(
    (targetId: string) => {
      setCustomPairs((prev) => {
        const next = prev.filter((p) => p.id !== targetId);
        try {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_PAIRS, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      if (pairId === targetId) {
        const fallback = APP_CONFIG.PAIRS[0].id;
        setPairId(fallback);
        try {
          localStorage.setItem(STORAGE_KEYS.PAIR, fallback);
        } catch {
          // ignore
        }
      }
    },
    [pairId]
  );

  const handleChangeRrRatio = useCallback((nextRatio: string) => {
    setRrRatio(nextRatio);
    try {
      localStorage.setItem(STORAGE_KEYS.RR_RATIO, nextRatio);
    } catch {
      // ignore
    }
  }, []);

  const handleSelectPair = useCallback((id: PairId) => {
    setPairId(id);
    setCopiedLot(null);
    try {
      localStorage.setItem(STORAGE_KEYS.PAIR, id);
    } catch {
      // ignore
    }
  }, []);

  const handleSaveRisk = useCallback((nextRisk: number) => {
    setRiskUsd(nextRisk);
    try {
      localStorage.setItem(STORAGE_KEYS.RISK, String(nextRisk));
    } catch {
      // ignore
    }
  }, []);

  const handleChangeMode = useCallback((nextMode: InputMode) => {
    setMode(nextMode);
    setInputStr('');
    setCopiedLot(null);
    try {
      localStorage.setItem(STORAGE_KEYS.MODE, nextMode);
    } catch {
      // ignore
    }
  }, []);

  const handleNumpadKey = useCallback(
    (key: string) => {
      setCopiedLot(null);
      setInputStr((prev) => appendNumpadKey(prev, key, mode));
    },
    [mode]
  );

  const handleUnlock = useCallback(() => {
    const until = Date.now() + APP_CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000;
    try {
      localStorage.setItem(STORAGE_KEYS.UNLOCK_UNTIL, String(until));
    } catch {
      // ignore
    }
    setIsUnlocked(true);
  }, []);

  const handleLockNow = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.UNLOCK_UNTIL);
    } catch {
      // ignore
    }
    setIsUnlocked(false);
    setSettingsModalOpen(false);
    setRiskModalOpen(false);
    setSymbolModalOpen(false);
    setMobileSheetOpen(false);
  }, []);

  const handleSavePin = useCallback((newPin: string) => {
    setPinCode(newPin);
    try {
      localStorage.setItem(STORAGE_KEYS.PIN, newPin);
    } catch {
      // ignore
    }
  }, []);

  const handleChangeVantageAccountType = useCallback((type: VantageAccountType) => {
    setVantageAccountType(type);
    try {
      localStorage.setItem(STORAGE_KEYS.VANTAGE_ACCOUNT, type);
    } catch {
      // ignore
    }
  }, []);

  const handleChangeMt5LaunchMode = useCallback((launchMode: Mt5LaunchMode) => {
    setMt5LaunchMode(launchMode);
    try {
      localStorage.setItem(STORAGE_KEYS.MT5_LAUNCH_MODE, launchMode);
    } catch {
      // ignore
    }
  }, []);

  const handleCopyLot = useCallback(async () => {
    if (result.status !== 'OK') return false;
    const text = formatLot(result.lot2, result.pair);

    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        // fallback below
      }
    }
    if (!copied) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, 99999);
      try {
        document.execCommand('copy');
        copied = true;
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    }

    setCopiedLot(text);
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedLot(null);
    }, 1200);

    const entry: CalcHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      pairId: result.pair.id,
      pairLabel: result.pair.label,
      mode,
      inputStr,
      riskUsd,
      lot2: text,
      totalLoss: result.totalLoss,
    };
    setHistory((prev) => {
      const deduped = prev.filter(
        (h) =>
          !(
            h.pairId === entry.pairId &&
            h.mode === entry.mode &&
            h.inputStr === entry.inputStr &&
            h.riskUsd === entry.riskUsd
          )
      );
      const next = [entry, ...deduped].slice(0, 12);
      try {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    return copied;
  }, [result, mode, inputStr, riskUsd]);

  const handleOpenMt5 = useCallback(
    async (copyFirst: boolean) => {
      if (copyFirst && result.status === 'OK') {
        await handleCopyLot();
      }
      const url = buildMt5LaunchUrl(mt5LaunchMode);
      showToast(
        copyFirst && result.status === 'OK'
          ? `คัดลอก ${formatLot(result.lot2, result.pair)} แล้ว — กำลังเปิด MT5`
          : 'กำลังเปิด MetaTrader 5...'
      );
      if (mt5LaunchMode === 'app_scheme') {
        window.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    [handleCopyLot, mt5LaunchMode, result, showToast]
  );

  const handleOpenTradingView = useCallback(() => {
    const url = buildTradingViewUrl(activePair);
    showToast(`กำลังเปิดกราฟ ${activePair.label} บน TradingView...`);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [activePair, showToast]);

  const handleApplyHistory = useCallback(
    (item: CalcHistoryItem) => {
      if (allPairs.some((p) => p.id === item.pairId)) {
        setPairId(item.pairId);
        try {
          localStorage.setItem(STORAGE_KEYS.PAIR, item.pairId);
        } catch {
          // ignore
        }
      }
      setMode(item.mode);
      setRiskUsd(item.riskUsd);
      setInputStr(item.inputStr);
      setMobileSheetOpen(false);
      try {
        localStorage.setItem(STORAGE_KEYS.MODE, item.mode);
        localStorage.setItem(STORAGE_KEYS.RISK, String(item.riskUsd));
      } catch {
        // ignore
      }
    },
    [allPairs]
  );

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    } catch {
      // ignore
    }
  }, []);

  const handleForceUpdate = useCallback(async () => {
    if (updateSwRef.current) {
      try {
        await updateSwRef.current(true);
        return;
      } catch {
        // fallback below
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    window.location.reload();
  }, []);

  // Desktop keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        !isUnlocked ||
        riskModalOpen ||
        settingsModalOpen ||
        symbolModalOpen ||
        mobileSheetOpen
      ) {
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (/^[0-9]$/.test(e.key) || e.key === '.') {
        e.preventDefault();
        handleNumpadKey(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleNumpadKey('DEL');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleNumpadKey('CLEAR');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleCopyLot();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isUnlocked,
    riskModalOpen,
    settingsModalOpen,
    symbolModalOpen,
    mobileSheetOpen,
    handleNumpadKey,
    handleCopyLot,
  ]);

  const openMobileTab = (tab: InfoTab) => {
    setInfoTab(tab);
    setMobileSheetOpen(true);
  };

  const bgThemeClass =
    activePair.isIndex || activePair.category === 'metal'
      ? 'bg-terminal-grid-amber'
      : activePair.category === 'stock'
        ? 'bg-terminal-grid-stock'
        : 'bg-terminal-grid';

  const isGlobalAlert =
    feedHealth.state === 'OFFLINE' ||
    feedHealth.state === 'ERROR' ||
    feedHealth.state === 'STALE';

  return (
    <div className={`min-h-dvh text-[#F1F5F9] transition-colors duration-300 ${bgThemeClass}`}>
      {/* Private 4-Digit PIN Gate */}
      {!isUnlocked && (
        <PinLockScreen expectedPin={pinCode} onUnlock={handleUnlock} />
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#06090F]/85 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#calculator"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-extrabold tracking-tight text-slate-100"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/35 bg-emerald-500/[0.12] font-mono text-xs font-extrabold text-emerald-400">
              LF
            </span>
            <span>{APP_CONFIG.APP_NAME}</span>
          </a>

          {/* Zone 2: Unboxed Broker & Version Info (Desktop) */}
          <div className="hidden items-center gap-2 text-xs text-slate-400 lg:flex">
            <span>{APP_CONFIG.BROKER_NAME}</span>
            <span aria-hidden="true">·</span>
            <span>{vantageAccountType === 'STD' ? 'Standard STP' : 'Raw ECN'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-300">{APP_CONFIG.VERSION}</span>
          </div>

          {/* Zone 3: Live Feed Status + Utility Controls */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={refreshQuotes}
              disabled={isRefreshing}
              aria-label={`สถานะราคา ${feedHealth.state} แตะเพื่ออัปเดต`}
              className={`inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors tabular-nums ${
                isGlobalAlert
                  ? 'bg-rose-500/[0.16] text-rose-300'
                  : 'text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              {isGlobalAlert ? (
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
              ) : (
                <Radio
                  className={`h-3.5 w-3.5 ${
                    feedHealth.state === 'LIVE'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                  aria-hidden="true"
                />
              )}
              <span className="font-mono">
                {isGlobalAlert
                  ? 'STALE'
                  : `UJ ${rates.USDJPY.toFixed(2)}`}
              </span>
            </button>

            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>

            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              aria-label="เปิดหน้าตั้งค่า"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={handleLockNow}
              aria-label="ล็อกแอปทันที"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Auto-Update Banner */}
      {updateAvailable && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/[0.12]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs text-emerald-200 sm:px-6">
            <span>พบเวอร์ชันใหม่ของ LotFast พร้อมใช้งานแล้ว</span>
            <button
              type="button"
              onClick={handleForceUpdate}
              className="whitespace-nowrap rounded-lg bg-emerald-400 px-3 py-1 font-bold text-[#04140D]"
            >
              อัปเดตทันที
            </button>
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <main
        id="calculator"
        className="mx-auto max-w-6xl px-3.5 pb-6 pt-3 sm:px-6 lg:py-7 pb-safe"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
          {/* Left Column: Primary One-Handed Calculator Terminal */}
          <div className="lg:col-span-5">
            <CalculatorTerminal
              pairs={allPairs}
              pairId={pairId}
              onSelectPair={handleSelectPair}
              onOpenSymbolManager={() => setSymbolModalOpen(true)}
              activeQuote={activeQuote}
              accountType={vantageAccountType}
              feedHealth={feedHealth}
              isRefreshingQuotes={isRefreshing}
              onRefreshQuotes={refreshQuotes}
              riskUsd={riskUsd}
              onOpenRiskModal={() => setRiskModalOpen(true)}
              mode={mode}
              onChangeMode={handleChangeMode}
              inputStr={inputStr}
              onNumpadKey={handleNumpadKey}
              result={result}
              rrRatio={rrRatio}
              onChangeRrRatio={handleChangeRrRatio}
              projectedTp={projectedTp}
              copiedLot={copiedLot}
              onCopyLot={handleCopyLot}
              onOpenMt5={handleOpenMt5}
              onOpenTradingView={handleOpenTradingView}
            />

            {/* Mobile Quick Access Strip */}
            <div className="mt-3 grid grid-cols-3 gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => openMobileTab('specs')}
                className="surface-glass flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/[0.08] px-2 text-xs font-semibold text-slate-200 active:scale-[0.97]"
              >
                <BookOpen className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span>กระดาน & ประวัติ</span>
              </button>
              <button
                type="button"
                onClick={() => openMobileTab('mt5')}
                className="surface-glass flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-white/[0.08] px-2 text-xs font-semibold text-slate-200 active:scale-[0.97]"
              >
                ต่อ MT5
              </button>
              <button
                type="button"
                onClick={() => openMobileTab('pwa')}
                className="surface-glass flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-white/[0.08] px-2 text-xs font-semibold text-slate-200 active:scale-[0.97]"
              >
                iPhone · {APP_CONFIG.VERSION}
              </button>
            </div>
          </div>

          {/* Right Column (Desktop): Market Board, History, MT5 Guide & iPhone PWA */}
          <div className="hidden lg:col-span-7 lg:block">
            <InfoInsightsPanel
              activeTab={infoTab}
              onChangeTab={setInfoTab}
              pairs={allPairs}
              selectedPairId={pairId}
              onSelectPair={handleSelectPair}
              onOpenSymbolManager={() => setSymbolModalOpen(true)}
              onRemovePair={handleRemovePair}
              result={result}
              riskUsd={riskUsd}
              rates={rates}
              quotes={quotes}
              accountType={vantageAccountType}
              feedHealth={feedHealth}
              rateUpdatedAt={lastSuccessAt}
              isRefreshingRates={isRefreshing}
              onRefreshRates={refreshQuotes}
              history={history}
              onApplyHistory={handleApplyHistory}
              onClearHistory={handleClearHistory}
              onForceUpdate={handleForceUpdate}
              onOpenMt5={handleOpenMt5}
              onOpenTradingView={handleOpenTradingView}
            />
          </div>
        </div>

        {/* Quiet Editorial Footer (Desktop) */}
        <footer className="mt-7 hidden items-center justify-between border-t border-white/[0.07] pt-4 text-xs text-slate-500 lg:flex">
          <div className="flex items-center gap-2">
            <span>{APP_CONFIG.APP_NAME}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{APP_CONFIG.VERSION}</span>
            <span aria-hidden="true">·</span>
            <span>{APP_CONFIG.BROKER_NAME}</span>
          </div>
          <span>คีย์ลัดคีย์บอร์ด: พิมพ์ตัวเลขเพื่อคำนวณ · Enter คัดลอก · Esc ล้างค่า</span>
        </footer>
      </main>

      {/* Transient Feedback Toast */}
      {toastMsg && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-400/35 bg-[#0D1623]/95 px-4 py-2 text-xs font-bold text-emerald-200 shadow-2xl backdrop-blur-md"
        >
          {toastMsg}
        </div>
      )}

      {/* Mobile Bottom Sheet Drawer */}
      {mobileSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="ข้อมูลตลาด คีย์ลัด MT5 และการติดตั้ง iPhone"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileSheetOpen(false);
          }}
        >
          <div className="flex max-h-[86dvh] w-full flex-col rounded-t-3xl border-t border-white/[0.1] bg-[#0F1520] pb-safe">
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <span className="text-sm font-bold text-slate-100">
                กระดานราคา · MT5 · ติดตั้ง iPhone
              </span>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="ปิดแผงข้อมูล"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-slate-300"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              <InfoInsightsPanel
                activeTab={infoTab}
                onChangeTab={setInfoTab}
                pairs={allPairs}
                selectedPairId={pairId}
                onSelectPair={(id) => {
                  handleSelectPair(id);
                  setMobileSheetOpen(false);
                }}
                onOpenSymbolManager={() => {
                  setMobileSheetOpen(false);
                  setSymbolModalOpen(true);
                }}
                onRemovePair={handleRemovePair}
                result={result}
                riskUsd={riskUsd}
                rates={rates}
                quotes={quotes}
                accountType={vantageAccountType}
                feedHealth={feedHealth}
                rateUpdatedAt={lastSuccessAt}
                isRefreshingRates={isRefreshing}
                onRefreshRates={refreshQuotes}
                history={history}
                onApplyHistory={handleApplyHistory}
                onClearHistory={handleClearHistory}
                onForceUpdate={handleForceUpdate}
                onOpenMt5={handleOpenMt5}
                onOpenTradingView={handleOpenTradingView}
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom Stocks / Assets Manager Modal */}
      <SymbolManagerModal
        isOpen={symbolModalOpen}
        allPairs={allPairs}
        onClose={() => setSymbolModalOpen(false)}
        onAddPair={handleAddPair}
        onRemovePair={handleRemovePair}
      />

      {/* Risk Limit Modal */}
      <RiskLimitModal
        isOpen={riskModalOpen}
        riskUsd={riskUsd}
        onClose={() => setRiskModalOpen(false)}
        onSave={handleSaveRisk}
      />

      {/* Settings & PIN Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSavePin={handleSavePin}
        onForceUpdate={handleForceUpdate}
        usdJpyRate={rates.USDJPY}
        vantageAccountType={vantageAccountType}
        onChangeVantageAccountType={handleChangeVantageAccountType}
        mt5LaunchMode={mt5LaunchMode}
        onChangeMt5LaunchMode={handleChangeMt5LaunchMode}
      />
    </div>
  );
}
