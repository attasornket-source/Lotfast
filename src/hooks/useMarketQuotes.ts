import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APP_CONFIG,
  STORAGE_KEYS,
  type MetaApiDirectConfig,
  type PairSpec,
  type VantageAccountType,
} from '../config/tradingConfig';
import type { LiveRates } from '../utils/calculator';
import {
  buildStreamingTickQuote,
  evaluateFeedHealth,
  normalizeScannerQuote,
  resolveFeedTicker,
  type MarketQuote,
  type RawScannerRow,
  type VantageSpreadAnchor,
} from '../utils/quoteParser';
import { decodeYahooPricingData } from '../utils/yahooProto';

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
      // Mark restored quotes as cached with preserved sparklines
      const restored: Record<string, MarketQuote> = {};
      for (const [k, q] of Object.entries(parsed.quotes)) {
        if (q && Number.isFinite(q.bid) && Number.isFinite(q.ask)) {
          restored[k] = {
            ...q,
            sparkline: Array.isArray(q.sparkline) ? q.sparkline.slice(-24) : [q.mid],
            tickSeq: typeof q.tickSeq === 'number' ? q.tickSeq : 0,
          };
        }
      }
      return { ...parsed, quotes: restored };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

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
  metaApiConfig: MetaApiDirectConfig;
  isOnline: boolean;
}) {
  const { pairs, activePairId, accountType, metaApiConfig, isOnline } = params;
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
  const [wsConnected, setWsConnected] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const quotesRef = useRef<Record<string, MarketQuote>>(quotes);
  quotesRef.current = quotes;

  const ratesRef = useRef<LiveRates>(rates);
  ratesRef.current = rates;

  const pairsRef = useRef<PairSpec[]>(pairs);
  pairsRef.current = pairs;

  const activePairIdRef = useRef(activePairId);
  activePairIdRef.current = activePairId;

  const accountTypeRef = useRef(accountType);
  accountTypeRef.current = accountType;

  const metaApiRef = useRef(metaApiConfig);
  metaApiRef.current = metaApiConfig;

  const vantageAnchorsRef = useRef<Record<string, VantageSpreadAnchor>>({});
  const proxyScaleRef = useRef<Record<string, { ratio: number; lastProxy: number }>>({});
  const lastWsTickAtRef = useRef<Record<string, number>>({});
  const pendingUpdatesRef = useRef<Record<string, MarketQuote>>({});
  const pendingRatesRef = useRef<Partial<LiveRates>>({});
  const inFlightAnchorRef = useRef(false);

  // Coalesce high-frequency WebSocket ticks every 200ms so UI feels silky-smooth on iPhone
  useEffect(() => {
    const flushTimer = window.setInterval(() => {
      const pendingQ = pendingUpdatesRef.current;
      const keys = Object.keys(pendingQ);
      if (keys.length === 0) return;

      pendingUpdatesRef.current = {};
      const nextQuotes = { ...quotesRef.current, ...pendingQ };
      quotesRef.current = nextQuotes;
      setQuotes(nextQuotes);

      const pRates = pendingRatesRef.current;
      if (Object.keys(pRates).length > 0) {
        pendingRatesRef.current = {};
        const nextRates = { ...ratesRef.current, ...pRates };
        ratesRef.current = nextRates;
        setRates(nextRates);
      }

      const now = Date.now();
      setLastSuccessAt(now);
      setConsecutiveErrors(0);
    }, 200);

    return () => window.clearInterval(flushTimer);
  }, []);

  // Persist snapshot occasionally (every 10s) so reload starts warm without thrashing localStorage
  useEffect(() => {
    const saveTimer = window.setInterval(() => {
      if (Object.keys(quotesRef.current).length === 0) return;
      try {
        localStorage.setItem(
          STORAGE_KEYS.QUOTES,
          JSON.stringify({
            quotes: quotesRef.current,
            rates: ratesRef.current,
            updatedAt: Date.now(),
          })
        );
      } catch {
        // ignore storage quota
      }
    }, 10_000);
    return () => window.clearInterval(saveTimer);
  }, []);

  const queueTick = useCallback((quote: MarketQuote) => {
    pendingUpdatesRef.current[quote.pairId] = quote;
    quotesRef.current[quote.pairId] = quote;
    lastWsTickAtRef.current[quote.pairId] = quote.fetchedAt;

    if (quote.pairId === 'USDJPY') pendingRatesRef.current.USDJPY = quote.mid;
    else if (quote.pairId === 'GBPUSD') pendingRatesRef.current.GBPUSD = quote.mid;
    else if (quote.pairId === 'GBPJPY') pendingRatesRef.current.GBPJPY = quote.mid;
  }, []);

  // =========================================================================
  // LAYER 1: Vantage Live Spread Anchor + Initial Snapshot (TradingView Scanner)
  // =========================================================================
  const refreshVantageAnchor = useCallback(async () => {
    if (inFlightAnchorRef.current) return;
    inFlightAnchorRef.current = true;
    setIsRefreshing(true);

    const currentPairs = pairsRef.current;
    const currentAcct = accountTypeRef.current;
    const now = Date.now();

    const tickerToPairs = new Map<string, PairSpec[]>();
    const tickerSet = new Set<string>([
      currentAcct === 'STD' ? 'VANTAGE:USDJPY.TV' : 'VANTAGE:USDJPY',
      currentAcct === 'STD' ? 'VANTAGE:GBPUSD.TV' : 'VANTAGE:GBPUSD',
      currentAcct === 'STD' ? 'VANTAGE:GBPJPY.TV' : 'VANTAGE:GBPJPY',
      'VANTAGE:USDTHB',
    ]);

    for (const pair of currentPairs) {
      const feedTicker = resolveFeedTicker(pair, currentAcct);
      tickerSet.add(feedTicker);
      const list = tickerToPairs.get(feedTicker) ?? [];
      list.push(pair);
      tickerToPairs.set(feedTicker, list);
    }

    let gotAny = false;

    try {
      const res = await fetch('https://scanner.tradingview.com/global/scan', {
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

      if (res.ok) {
        const json = (await res.json()) as {
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
            if (ticker.startsWith('VANTAGE:USDJPY')) pendingRatesRef.current.USDJPY = midVal;
            if (ticker.startsWith('VANTAGE:GBPUSD')) pendingRatesRef.current.GBPUSD = midVal;
            if (ticker.startsWith('VANTAGE:GBPJPY')) pendingRatesRef.current.GBPJPY = midVal;
            if (ticker.startsWith('VANTAGE:USDTHB')) pendingRatesRef.current.USDTHB = midVal;
          }

          const matchedPairs = tickerToPairs.get(ticker) ?? [];
          for (const pair of matchedPairs) {
            // Save Vantage's exact live spread anchor whenever Bid & Ask are healthy
            if (
              raw.bid &&
              raw.ask &&
              raw.ask >= raw.bid &&
              (!raw.close || Math.abs((raw.bid + raw.ask) / 2 - raw.close) / raw.close <= 0.002)
            ) {
              vantageAnchorsRef.current[pair.id] = {
                spreadAbs: Math.max(pair.pointSize, raw.ask - raw.bid),
                vantageMid: (raw.bid + raw.ask) / 2,
                updatedAt: now,
              };
            }

            // Re-calibrate ETF proxy ratio (e.g. DIA -> US30) whenever real index price arrives
            if (pair.yahooProxySymbol && raw.close && raw.close > 0) {
              const prevProxy = proxyScaleRef.current[pair.id]?.lastProxy;
              if (prevProxy && prevProxy > 0) {
                proxyScaleRef.current[pair.id] = {
                  ratio: raw.close / prevProxy,
                  lastProxy: prevProxy,
                };
              }
            }

            // Do NOT overwrite a live WebSocket tick received within the last 4 seconds!
            const lastWs = lastWsTickAtRef.current[pair.id] ?? 0;
            if (now - lastWs < 4000) {
              gotAny = true;
              continue;
            }

            const normalized = normalizeScannerQuote({
              pair,
              raw,
              accountType: currentAcct,
              now,
              prevQuote: quotesRef.current[pair.id],
            });
            if (normalized) {
              pendingUpdatesRef.current[pair.id] = normalized;
              quotesRef.current[pair.id] = normalized;
              gotAny = true;
            }
          }
        }
      }
    } catch {
      // handled below
    }

    if (!gotAny) {
      setConsecutiveErrors((c) => c + 1);
    } else {
      setLastSuccessAt(now);
      setConsecutiveErrors(0);
    }

    inFlightAnchorRef.current = false;
    setIsRefreshing(false);
  }, []);

  // =========================================================================
  // LAYER 2: Sub-Second Real-Time WebSockets (Yahoo Live + Kraken BBO + Binance)
  // =========================================================================
  useEffect(() => {
    if (!isOnline) {
      setWsConnected(false);
      return;
    }

    // If user enabled Direct Vantage MT5 (MetaApi), let Layer 3 drive the active symbol
    let disposed = false;
    let yahooWs: WebSocket | null = null;
    let krakenWs: WebSocket | null = null;
    let binanceWs: WebSocket | null = null;
    let retryTimer: number | null = null;
    let retryDelay = 1200;

    let yahooUp = false;
    let krakenUp = false;
    let binanceUp = false;

    const syncConnectedFlag = () => {
      if (!disposed) {
        setWsConnected(yahooUp || krakenUp || binanceUp);
      }
    };

    const connectYahoo = () => {
      if (disposed || typeof WebSocket === 'undefined') return;
      try {
        const ws = new WebSocket('wss://streamer.finance.yahoo.com/');
        yahooWs = ws;

        ws.onopen = () => {
          if (disposed) {
            ws.close();
            return;
          }
          yahooUp = true;
          retryDelay = 1200;
          syncConnectedFlag();

          const subs = new Set<string>(['JPY=X', 'GBPUSD=X', 'GBPJPY=X', 'THB=X']);
          for (const p of pairsRef.current) {
            if (p.yahooSymbol) subs.add(p.yahooSymbol);
            if (p.yahooProxySymbol) subs.add(p.yahooProxySymbol);
          }
          ws.send(JSON.stringify({ subscribe: Array.from(subs) }));
        };

        ws.onmessage = (ev) => {
          if (disposed) return;
          const tick = decodeYahooPricingData(String(ev.data));
          if (!tick) return;

          const now = Date.now();
          const currentAcct = accountTypeRef.current;

          if (tick.id === 'THB=X') {
            pendingRatesRef.current.USDTHB = tick.price;
          }

          for (const pair of pairsRef.current) {
            // Skip direct WebSocket override when MetaApi Direct is active for this symbol
            if (
              metaApiRef.current.enabled &&
              metaApiRef.current.token &&
              metaApiRef.current.accountId
            ) {
              continue;
            }

            // 1. Direct Yahoo symbol match (USDJPY, GBPUSD, GBPJPY, AAPL, NVDA, TSLA, PLTR, etc.)
            if (pair.yahooSymbol && tick.id === pair.yahooSymbol) {
              // If Kraken BBO is actively streaming tighter millisecond BBO for this pair (<2s ago), prefer Kraken
              const prev = quotesRef.current[pair.id];
              if (
                pair.krakenSymbol &&
                prev?.provenance === 'live_ws_bbo' &&
                now - prev.fetchedAt < 2500
              ) {
                continue;
              }

              // Update exact index ratio when real index ticks (e.g. ^DJI, ^NDX, ^GSPC)
              if (pair.yahooProxySymbol && proxyScaleRef.current[pair.id]?.lastProxy) {
                proxyScaleRef.current[pair.id].ratio =
                  tick.price / proxyScaleRef.current[pair.id].lastProxy;
              }

              const anchor = vantageAnchorsRef.current[pair.id];
              const isVantageCal = Boolean(pair.isDirectVantageFeed || anchor);
              const q = buildStreamingTickQuote({
                pair,
                mid: tick.price,
                directBid: tick.bid ?? undefined,
                directAsk: tick.ask ?? undefined,
                changePct: tick.changePercent,
                changeAbs: tick.change,
                vantageAnchor: anchor,
                accountType: currentAcct,
                now,
                prevQuote: prev,
                provenance: isVantageCal ? 'vantage_ws_calibrated' : 'live_ws_bbo',
                sourceLabel: pair.isDirectVantageFeed
                  ? currentAcct === 'STD'
                    ? 'Vantage STD · Live WS'
                    : 'Vantage RAW · Live WS'
                  : pair.category === 'stock'
                    ? 'Live Stock WS'
                    : 'Live WS · Vantage Spread',
              });
              if (q) queueTick(q);
            }
            // 2. High-frequency ETF proxy match (e.g. DIA -> US30, QQQ -> NAS100, SPY -> SP500)
            else if (pair.yahooProxySymbol && tick.id === pair.yahooProxySymbol) {
              const prev = quotesRef.current[pair.id];
              const existingScale = proxyScaleRef.current[pair.id];
              let ratio = existingScale?.ratio;

              if (!ratio && prev && prev.mid > 0) {
                ratio = prev.mid / tick.price;
              } else if (!ratio) {
                // Default known ETF -> Index multiplier fallback (DIA*100 ≈ US30, SPY*10 ≈ SP500, QQQ*41 ≈ NAS100)
                ratio = pair.id === 'US30' ? 100 : pair.id === 'SP500' ? 10 : pair.id === 'NAS100' ? 41 : 10.9;
              }

              proxyScaleRef.current[pair.id] = { ratio, lastProxy: tick.price };
              const scaledMid = tick.price * ratio;
              const anchor = vantageAnchorsRef.current[pair.id];

              const q = buildStreamingTickQuote({
                pair,
                mid: scaledMid,
                changePct: tick.changePercent ?? prev?.changePct ?? null,
                vantageAnchor: anchor,
                accountType: currentAcct,
                now,
                prevQuote: prev,
                provenance: 'vantage_ws_calibrated',
                sourceLabel: 'Live WS · Vantage DJ30 Spread',
              });
              if (q) queueTick(q);
            }
          }
        };

        ws.onerror = () => {
          yahooUp = false;
          syncConnectedFlag();
        };

        ws.onclose = () => {
          yahooUp = false;
          syncConnectedFlag();
          if (!disposed && document.visibilityState === 'visible') {
            retryTimer = window.setTimeout(() => {
              retryDelay = Math.min(8000, retryDelay * 1.6);
              connectYahoo();
            }, retryDelay);
          }
        };
      } catch {
        yahooUp = false;
        syncConnectedFlag();
      }
    };

    const connectKraken = () => {
      if (disposed || typeof WebSocket === 'undefined') return;
      const krakenSymbols = pairsRef.current
        .map((p) => p.krakenSymbol)
        .filter((s): s is string => Boolean(s));
      if (krakenSymbols.length === 0) return;

      try {
        const ws = new WebSocket('wss://ws.kraken.com/v2');
        krakenWs = ws;

        ws.onopen = () => {
          if (disposed) {
            ws.close();
            return;
          }
          krakenUp = true;
          syncConnectedFlag();
          ws.send(
            JSON.stringify({
              method: 'subscribe',
              params: {
                channel: 'ticker',
                event_trigger: 'bbo',
                symbol: Array.from(new Set(krakenSymbols)),
              },
            })
          );
        };

        ws.onmessage = (ev) => {
          if (disposed) return;
          if (
            metaApiRef.current.enabled &&
            metaApiRef.current.token &&
            metaApiRef.current.accountId
          ) {
            return;
          }
          try {
            const msg = JSON.parse(String(ev.data)) as {
              channel?: string;
              data?: Array<{
                symbol?: string;
                bid?: number;
                ask?: number;
                change_pct?: number;
                change?: number;
              }>;
            };
            if (msg.channel !== 'ticker' || !Array.isArray(msg.data)) return;
            const now = Date.now();
            const currentAcct = accountTypeRef.current;

            for (const item of msg.data) {
              if (!item.symbol || !item.bid || !item.ask || item.ask < item.bid) continue;
              const matched = pairsRef.current.filter(
                (p) => p.krakenSymbol === item.symbol
              );
              for (const pair of matched) {
                const anchor = vantageAnchorsRef.current[pair.id];
                const mid = (item.bid + item.ask) / 2;
                // If Vantage spread anchor exists for Forex, apply exact Vantage RAW/STD spread around live BBO mid
                const useAnchorSpread = pair.isDirectVantageFeed && anchor && anchor.spreadAbs > 0;
                const q = buildStreamingTickQuote({
                  pair,
                  mid: useAnchorSpread ? mid : undefined,
                  directBid: useAnchorSpread ? undefined : item.bid,
                  directAsk: useAnchorSpread ? undefined : item.ask,
                  changePct:
                    typeof item.change_pct === 'number' ? item.change_pct : null,
                  changeAbs: typeof item.change === 'number' ? item.change : null,
                  vantageAnchor: useAnchorSpread ? anchor : null,
                  accountType: currentAcct,
                  now,
                  prevQuote: quotesRef.current[pair.id],
                  provenance: useAnchorSpread ? 'vantage_ws_calibrated' : 'live_ws_bbo',
                  sourceLabel: pair.isDirectVantageFeed
                    ? currentAcct === 'STD'
                      ? 'Vantage STD · Live BBO'
                      : 'Vantage RAW · Live BBO'
                    : 'Live BBO WS',
                });
                if (q) queueTick(q);
              }
            }
          } catch {
            // ignore malformed frame
          }
        };

        ws.onerror = () => {
          krakenUp = false;
          syncConnectedFlag();
        };

        ws.onclose = () => {
          krakenUp = false;
          syncConnectedFlag();
        };
      } catch {
        krakenUp = false;
        syncConnectedFlag();
      }
    };

    const connectBinance = () => {
      if (disposed || typeof WebSocket === 'undefined') return;
      const cryptoPairs = pairsRef.current.filter((p) => Boolean(p.binanceSymbol));
      if (cryptoPairs.length === 0) return;
      const streams = cryptoPairs
        .map((p) => `${p.binanceSymbol!.toLowerCase()}@bookTicker`)
        .join('/');

      try {
        const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
        binanceWs = ws;

        ws.onopen = () => {
          if (disposed) {
            ws.close();
            return;
          }
          binanceUp = true;
          syncConnectedFlag();
        };

        ws.onmessage = (ev) => {
          if (disposed) return;
          try {
            const payload = JSON.parse(String(ev.data)) as {
              data?: { s?: string; b?: string; a?: string };
            };
            const d = payload.data;
            if (!d?.s || !d.b || !d.a) return;
            const bid = Number.parseFloat(d.b);
            const ask = Number.parseFloat(d.a);
            if (!Number.isFinite(bid) || !Number.isFinite(ask) || ask < bid) return;

            const now = Date.now();
            for (const pair of pairsRef.current) {
              if (pair.binanceSymbol?.toUpperCase() === d.s.toUpperCase()) {
                const q = buildStreamingTickQuote({
                  pair,
                  directBid: bid,
                  directAsk: ask,
                  accountType: accountTypeRef.current,
                  now,
                  prevQuote: quotesRef.current[pair.id],
                  provenance: 'live_ws_bbo',
                  sourceLabel: 'Binance Live BBO',
                });
                if (q) queueTick(q);
              }
            }
          } catch {
            // ignore
          }
        };

        ws.onerror = () => {
          binanceUp = false;
          syncConnectedFlag();
        };

        ws.onclose = () => {
          binanceUp = false;
          syncConnectedFlag();
        };
      } catch {
        binanceUp = false;
        syncConnectedFlag();
      }
    };

    connectYahoo();
    connectKraken();
    connectBinance();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !disposed) {
        refreshVantageAnchor();
        if (!yahooWs || yahooWs.readyState > WebSocket.OPEN) connectYahoo();
        if (!krakenWs || krakenWs.readyState > WebSocket.OPEN) connectKraken();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      try {
        yahooWs?.close();
      } catch {
        // ignore
      }
      try {
        krakenWs?.close();
      } catch {
        // ignore
      }
      try {
        binanceWs?.close();
      } catch {
        // ignore
      }
    };
  }, [pairs.length, isOnline, reconnectNonce, queueTick, refreshVantageAnchor]);

  // =========================================================================
  // LAYER 3: Optional Direct 1:1 Vantage MT5 Server Feed (MetaApi Cloud)
  // =========================================================================
  useEffect(() => {
    if (
      !isOnline ||
      !metaApiConfig.enabled ||
      !metaApiConfig.token.trim() ||
      !metaApiConfig.accountId.trim()
    ) {
      return;
    }

    let cancelled = false;

    const pollMetaApi = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const active =
        pairsRef.current.find((p) => p.id === activePairIdRef.current) ??
        pairsRef.current[0];
      if (!active) return;

      const region = metaApiConfig.region || 'new-york';
      const url = `https://mt-client-api-v1.${region}.agiliumtrade.ai/users/current/accounts/${encodeURIComponent(
        metaApiConfig.accountId.trim()
      )}/symbols/${encodeURIComponent(active.mt5Symbol)}/current-price`;

      try {
        const res = await fetch(url, {
          headers: { 'auth-token': metaApiConfig.token.trim() },
          cache: 'no-store',
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) throw new Error(`MetaApi HTTP ${res.status}`);
        const d = (await res.json()) as { bid?: number; ask?: number };
        if (
          typeof d.bid === 'number' &&
          typeof d.ask === 'number' &&
          d.bid > 0 &&
          d.ask >= d.bid
        ) {
          const q = buildStreamingTickQuote({
            pair: active,
            directBid: d.bid,
            directAsk: d.ask,
            accountType: accountTypeRef.current,
            now: Date.now(),
            prevQuote: quotesRef.current[active.id],
            provenance: 'vantage_mt5_direct',
            sourceLabel: 'Vantage MT5 Direct',
          });
          if (q) queueTick(q);
        }
      } catch {
        setConsecutiveErrors((c) => c + 1);
      }
    };

    pollMetaApi();
    const id = window.setInterval(pollMetaApi, APP_CONFIG.METAAPI_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    isOnline,
    metaApiConfig.enabled,
    metaApiConfig.token,
    metaApiConfig.accountId,
    metaApiConfig.region,
    activePairId,
    queueTick,
  ]);

  // Initial & periodic Vantage Spread Anchor calibration
  useEffect(() => {
    refreshVantageAnchor();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshVantageAnchor();
      }
    }, APP_CONFIG.VANTAGE_ANCHOR_POLL_MS);
    return () => window.clearInterval(id);
  }, [pairs.length, accountType, isOnline, refreshVantageAnchor]);

  // 1-second watchdog clock for instant stale-price alerting
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const manualReconnect = useCallback(() => {
    setReconnectNonce((n) => n + 1);
    refreshVantageAnchor();
  }, [refreshVantageAnchor]);

  const activeQuote = quotes[activePairId] ?? null;
  const feedHealth = evaluateFeedHealth({
    isOnline,
    wsConnected,
    lastSuccessAt,
    consecutiveErrors,
    now: nowTick,
    activeQuote,
  });

  return {
    quotes,
    activeQuote,
    rates,
    wsConnected,
    lastSuccessAt,
    feedHealth,
    isRefreshing,
    refreshQuotes: manualReconnect,
  };
}
