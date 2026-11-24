import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APP_CONFIG,
  STORAGE_KEYS,
  type PairSpec,
  type VantageAccountType,
} from '../config/tradingConfig';
import type { LiveRates } from '../utils/calculator';
import {
  evaluateFeedHealth,
  normalizeScannerQuote,
  resolveFeedTicker,
  type MarketQuote,
  type RawScannerRow,
} from '../utils/quoteParser';

interface StoredQuotesPayload {
  quotes: Record<string, MarketQuote>;
  rates: LiveRates;
  updatedAt: number;
}

function readCachedQuotes(): StoredQuotesPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUOTES);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQuotesPayload;
    if (parsed?.quotes && parsed?.rates && Number.isFinite(parsed.rates.USDJPY)) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

/**
 * ทดสอบดึงราคาจริงของหุ้น/สินทรัพย์เดี่ยว (ใช้ในหน้าเพิ่มหุ้น เพื่อให้เห็นราคาจริงก่อนบันทึก)
 */
export async function probeSingleTickerQuote(
  rawTicker: string
): Promise<{
  found: boolean;
  resolvedTicker: string;
  description: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  isDelayed: boolean;
}> {
  const cleaned = rawTicker.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) {
    return {
      found: false,
      resolvedTicker: '',
      description: '',
      price: null,
      bid: null,
      ask: null,
      isDelayed: false,
    };
  }

  const candidates = cleaned.includes(':')
    ? [cleaned]
    : [
        `NASDAQ:${cleaned}`,
        `NYSE:${cleaned}`,
        `VANTAGE:${cleaned}`,
        `SET:${cleaned}`,
        `BINANCE:${cleaned.endsWith('USDT') ? cleaned : `${cleaned}USDT`}`,
        `AMEX:${cleaned}`,
      ];

  try {
    const res = await fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        symbols: { tickers: candidates },
        columns: ['name', 'description', 'close', 'bid', 'ask', 'update_mode'],
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) throw new Error('scanner failed');
    const json = (await res.json()) as {
      data?: Array<{ s: string; d: Array<string | number | null> }>;
    };
    const first = json.data?.[0];
    if (!first) {
      return {
        found: false,
        resolvedTicker: cleaned,
        description: '',
        price: null,
        bid: null,
        ask: null,
        isDelayed: false,
      };
    }

    const closeVal = typeof first.d[2] === 'number' ? first.d[2] : null;
    const bidVal = typeof first.d[3] === 'number' ? first.d[3] : null;
    const askVal = typeof first.d[4] === 'number' ? first.d[4] : null;
    const mode = String(first.d[5] ?? '').toLowerCase();

    return {
      found: closeVal !== null || bidVal !== null,
      resolvedTicker: first.s,
      description: String(first.d[1] ?? first.d[0] ?? cleaned),
      price: closeVal ?? bidVal,
      bid: bidVal,
      ask: askVal,
      isDelayed: mode.includes('delayed'),
    };
  } catch {
    return {
      found: false,
      resolvedTicker: cleaned,
      description: '',
      price: null,
      bid: null,
      ask: null,
      isDelayed: false,
    };
  }
}

export function useMarketQuotes(params: {
  pairs: PairSpec[];
  activePairId: string;
  accountType: VantageAccountType;
  isOnline: boolean;
}) {
  const { pairs, activePairId, accountType, isOnline } = params;
  const cached = readCachedQuotes();

  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>(
    cached?.quotes ?? {}
  );
  const [rates, setRates] = useState<LiveRates>(
    cached?.rates ?? { ...APP_CONFIG.FALLBACK_RATES }
  );
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(
    cached?.updatedAt ?? null
  );
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;

  const ratesRef = useRef(rates);
  ratesRef.current = rates;

  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;

  const accountTypeRef = useRef(accountType);
  accountTypeRef.current = accountType;

  const inFlightRef = useRef(false);

  const refreshQuotes = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRefreshing(true);

    const currentPairs = pairsRef.current;
    const currentAcct = accountTypeRef.current;
    const now = Date.now();

    // Always include Vantage USDJPY, GBPUSD, GBPJPY, USDTHB so cross/pip conversion stays accurate
    const tickerToPairs = new Map<string, PairSpec[]>();
    const tickerSet = new Set<string>([
      currentAcct === 'STD' ? 'VANTAGE:USDJPY.TV' : 'VANTAGE:USDJPY',
      currentAcct === 'STD' ? 'VANTAGE:GBPUSD.TV' : 'VANTAGE:GBPUSD',
      currentAcct === 'STD' ? 'VANTAGE:GBPJPY.TV' : 'VANTAGE:GBPJPY',
      'VANTAGE:USDTHB',
    ]);

    const cryptoPairs: PairSpec[] = [];
    for (const pair of currentPairs) {
      const feedTicker = resolveFeedTicker(pair, currentAcct);
      tickerSet.add(feedTicker);
      const existing = tickerToPairs.get(feedTicker) ?? [];
      existing.push(pair);
      tickerToPairs.set(feedTicker, existing);
      if (pair.binanceSymbol) {
        cryptoPairs.push(pair);
      }
    }

    let gotFreshData = false;
    const nextQuotes: Record<string, MarketQuote> = { ...quotesRef.current };
    const currentRates = ratesRef.current;
    const nextRates: LiveRates = {
      USDJPY: currentRates.USDJPY || APP_CONFIG.FALLBACK_RATES.USDJPY,
      GBPUSD: currentRates.GBPUSD || APP_CONFIG.FALLBACK_RATES.GBPUSD,
      GBPJPY: currentRates.GBPJPY || APP_CONFIG.FALLBACK_RATES.GBPJPY,
      USDTHB: currentRates.USDTHB || APP_CONFIG.FALLBACK_RATES.USDTHB,
    };

    try {
      // 1. Primary Batch Fetch: TradingView Scanner (Direct Vantage RAW/STD Bid/Ask + CFD + Stocks)
      const scannerPromise = fetch('https://scanner.tradingview.com/global/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          symbols: { tickers: Array.from(tickerSet) },
          columns: [
            'name',
            'close',
            'bid',
            'ask',
            'change',
            'change_abs',
            'update_mode',
          ],
        }),
        signal: AbortSignal.timeout(7000),
      });

      // 2. Optional Parallel Crypto BookTicker Fetch (Binance real-time ms Bid/Ask, CORS *)
      const binancePromises = cryptoPairs.map(async (cp) => {
        if (!cp.binanceSymbol) return null;
        try {
          const r = await fetch(
            `https://api.binance.com/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(
              cp.binanceSymbol
            )}`,
            { cache: 'no-store', signal: AbortSignal.timeout(4500) }
          );
          if (!r.ok) return null;
          const b = (await r.json()) as { bidPrice?: string; askPrice?: string };
          const bid = Number.parseFloat(b.bidPrice ?? '');
          const ask = Number.parseFloat(b.askPrice ?? '');
          if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask >= bid) {
            return { pair: cp, bid, ask };
          }
        } catch {
          // ignore and let scanner fallback cover it
        }
        return null;
      });

      const [scannerRes, ...binanceResults] = await Promise.all([
        scannerPromise,
        ...binancePromises,
      ]);

      if (scannerRes.ok) {
        const json = (await scannerRes.json()) as {
          data?: Array<{ s: string; d: Array<string | number | null> }>;
        };

        for (const row of json.data ?? []) {
          const ticker = row.s;
          const raw: RawScannerRow = {
            close: typeof row.d[1] === 'number' ? row.d[1] : null,
            bid: typeof row.d[2] === 'number' ? row.d[2] : null,
            ask: typeof row.d[3] === 'number' ? row.d[3] : null,
            change: typeof row.d[4] === 'number' ? row.d[4] : null,
            change_abs: typeof row.d[5] === 'number' ? row.d[5] : null,
            update_mode: typeof row.d[6] === 'string' ? row.d[6] : null,
          };

          const midVal =
            raw.bid && raw.ask && raw.ask >= raw.bid
              ? (raw.bid + raw.ask) / 2
              : raw.close ?? null;

          if (midVal && midVal > 0) {
            if (ticker.startsWith('VANTAGE:USDJPY')) nextRates.USDJPY = midVal;
            if (ticker.startsWith('VANTAGE:GBPUSD')) nextRates.GBPUSD = midVal;
            if (ticker.startsWith('VANTAGE:GBPJPY')) nextRates.GBPJPY = midVal;
            if (ticker.startsWith('VANTAGE:USDTHB')) nextRates.USDTHB = midVal;
          }

          const matchedPairs = tickerToPairs.get(ticker) ?? [];
          for (const pair of matchedPairs) {
            const normalized = normalizeScannerQuote({
              pair,
              raw,
              accountType: currentAcct,
              now,
              prevMid: quotesRef.current[pair.id]?.mid,
            });
            if (normalized) {
              nextQuotes[pair.id] = normalized;
              gotFreshData = true;
            }
          }
        }
      }

      // Overlay Binance live BookTicker Bid/Ask for Crypto pairs
      for (const bItem of binanceResults) {
        if (!bItem) continue;
        const existing = nextQuotes[bItem.pair.id];
        const normalized = normalizeScannerQuote({
          pair: bItem.pair,
          raw: {
            bid: bItem.bid,
            ask: bItem.ask,
            close: (bItem.bid + bItem.ask) / 2,
            change: existing?.changePct ?? null,
            change_abs: existing?.changeAbs ?? null,
            update_mode: 'streaming',
          },
          accountType: currentAcct,
          now,
          prevMid: quotesRef.current[bItem.pair.id]?.mid,
          overrideDirectSourceLabel: 'Binance Live B/A',
        });
        if (normalized) {
          nextQuotes[bItem.pair.id] = normalized;
          gotFreshData = true;
        }
      }
    } catch {
      // Fallback below
    }

    // 3. Emergency FX Fallback if primary stream failed
    if (!gotFreshData) {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json();
          const jpy = Number(data?.rates?.JPY);
          const gbpPerUsd = Number(data?.rates?.GBP);
          const thb = Number(data?.rates?.THB);
          if (Number.isFinite(jpy) && jpy > 50 && Number.isFinite(gbpPerUsd) && gbpPerUsd > 0) {
            nextRates.USDJPY = Number(jpy.toFixed(3));
            nextRates.GBPUSD = Number((1 / gbpPerUsd).toFixed(5));
            nextRates.GBPJPY = Number(((1 / gbpPerUsd) * jpy).toFixed(3));
            if (Number.isFinite(thb) && thb > 15) {
              nextRates.USDTHB = Number(thb.toFixed(3));
            }
          }
        }
      } catch {
        // remain on cached rates
      }
    }

    if (gotFreshData) {
      setQuotes(nextQuotes);
      setRates(nextRates);
      setLastSuccessAt(now);
      setConsecutiveErrors(0);
      try {
        localStorage.setItem(
          STORAGE_KEYS.QUOTES,
          JSON.stringify({
            quotes: nextQuotes,
            rates: nextRates,
            updatedAt: now,
          })
        );
      } catch {
        // ignore quota errors
      }
    } else {
      setRates(nextRates);
      setConsecutiveErrors((c) => c + 1);
    }

    inFlightRef.current = false;
    setIsRefreshing(false);
  }, []);

  // Trigger immediate refresh on mount, when pairs list or Vantage account type changes
  useEffect(() => {
    refreshQuotes();
  }, [pairs.length, accountType, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // High-frequency live polling (pauses automatically when app is backgrounded on iPhone)
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') {
        refreshQuotes();
      }
    };
    const intervalId = window.setInterval(poll, APP_CONFIG.QUOTE_POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshQuotes();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshQuotes]);

  // 1-second watchdog clock so stale-price alerts trigger automatically in real time
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeQuote = quotes[activePairId] ?? null;
  const feedHealth = evaluateFeedHealth({
    isOnline,
    lastSuccessAt,
    consecutiveErrors,
    now: nowTick,
    activeQuote,
  });

  return {
    quotes,
    activeQuote,
    rates,
    lastSuccessAt,
    feedHealth,
    isRefreshing,
    refreshQuotes,
  };
}
