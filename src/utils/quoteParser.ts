import {
  APP_CONFIG,
  type Mt5LaunchMode,
  type PairSpec,
  type VantageAccountType,
} from '../config/tradingConfig';

export type QuoteProvenance =
  | 'vantage_mt5_direct'
  | 'vantage_ws_calibrated'
  | 'live_ws_bbo'
  | 'vantage_live'
  | 'live_derived'
  | 'delayed_derived'
  | 'cached'
  | 'unavailable';

export type FeedHealthState = 'LIVE' | 'DELAYED' | 'STALE' | 'OFFLINE' | 'ERROR';

export interface MarketQuote {
  pairId: string;
  bid: number;
  ask: number;
  mid: number;
  changePct: number | null;
  changeAbs: number | null;
  spreadPoints: number;
  spreadFormatted: string;
  provenance: QuoteProvenance;
  sourceLabel: string;
  /** เวลาที่ราคาอัปเดตล่าสุด (ms) */
  fetchedAt: number;
  /** ทิศทางการขยับเทียบกับราคาก่อนหน้า */
  tickDirection: 'up' | 'down' | 'flat';
  /** นับจำนวน tick ที่วิ่งเข้ามาจริง (ช่วยกระตุ้น flash animation ทุก tick) */
  tickSeq: number;
  /** ประวัติราคา mid ล่าสุดสูงสุด 24 จุดสำหรับกราฟ Sparkline */
  sparkline: number[];
}

export interface VantageSpreadAnchor {
  spreadAbs: number;
  vantageMid: number;
  updatedAt: number;
}

export interface RawScannerRow {
  close?: number | null;
  bid?: number | null;
  ask?: number | null;
  change?: number | null;
  change_abs?: number | null;
  update_mode?: string | null;
}

export function resolveFeedTicker(
  pair: PairSpec,
  accountType: VantageAccountType
): string {
  if (accountType === 'STD' && pair.vantageStdFeedSymbol) {
    return pair.vantageStdFeedSymbol;
  }
  return pair.feedSymbol;
}

export function formatSpreadLabel(
  bid: number,
  ask: number,
  pair: PairSpec
): { spreadPoints: number; spreadFormatted: string } {
  const diff = Math.max(0, ask - bid);
  const spreadPoints = pair.pointSize > 0 ? Math.round(diff / pair.pointSize) : 0;

  if (pair.category === 'forex') {
    const pips = diff / (pair.pointSize * pair.pointsPerPip);
    return { spreadPoints, spreadFormatted: `${pips.toFixed(1)}p` };
  }
  if (pair.quoteType === 'STOCK_USD') {
    return { spreadPoints, spreadFormatted: `$${diff.toFixed(2)}` };
  }
  if (pair.quoteType === 'STOCK_THB') {
    return { spreadPoints, spreadFormatted: `฿${diff.toFixed(2)}` };
  }
  if (pair.category === 'index') {
    return { spreadPoints, spreadFormatted: `${diff.toFixed(1)}pt` };
  }
  return { spreadPoints, spreadFormatted: `$${diff.toFixed(2)}` };
}

export function appendSparkline(prev: number[] | undefined, value: number): number[] {
  const arr = Array.isArray(prev) ? prev.slice(-23) : [];
  if (!Number.isFinite(value) || value <= 0) return arr;
  arr.push(value);
  return arr;
}

/**
 * สร้าง MarketQuote จาก WebSocket Tick แบบเรียลไทม์ทุกวินาที
 * โดยนำค่า Spread จริงล่าสุดจาก Vantage Anchor มาคาลิเบรต Bid/Offer ให้แม่นยำตรงโบรกเกอร์
 */
export function buildStreamingTickQuote(params: {
  pair: PairSpec;
  mid?: number;
  directBid?: number;
  directAsk?: number;
  changePct?: number | null;
  changeAbs?: number | null;
  vantageAnchor?: VantageSpreadAnchor | null;
  accountType: VantageAccountType;
  now: number;
  prevQuote?: MarketQuote | null;
  provenance: QuoteProvenance;
  sourceLabel: string;
}): MarketQuote | null {
  const {
    pair,
    mid: rawMid,
    directBid,
    directAsk,
    changePct,
    changeAbs,
    vantageAnchor,
    now,
    prevQuote,
    provenance,
    sourceLabel,
  } = params;

  let bid: number;
  let ask: number;

  if (
    typeof directBid === 'number' &&
    typeof directAsk === 'number' &&
    Number.isFinite(directBid) &&
    Number.isFinite(directAsk) &&
    directBid > 0 &&
    directAsk >= directBid
  ) {
    bid = directBid;
    ask = directAsk;
  } else if (typeof rawMid === 'number' && Number.isFinite(rawMid) && rawMid > 0) {
    const spreadAbs =
      vantageAnchor && vantageAnchor.spreadAbs > 0
        ? vantageAnchor.spreadAbs
        : pair.typicalSpreadPoints * pair.pointSize;
    const half = spreadAbs / 2;
    bid = Math.max(pair.pointSize, rawMid - half);
    ask = rawMid + half;
  } else {
    return null;
  }

  const mid = (bid + ask) / 2;
  const { spreadPoints, spreadFormatted } = formatSpreadLabel(bid, ask, pair);

  const prevMid = prevQuote?.mid;
  const priceChanged =
    !prevQuote ||
    Math.abs(bid - prevQuote.bid) > 1e-9 ||
    Math.abs(ask - prevQuote.ask) > 1e-9;

  const tickDirection: 'up' | 'down' | 'flat' =
    typeof prevMid === 'number' && prevMid > 0
      ? mid > prevMid + 1e-9
        ? 'up'
        : mid < prevMid - 1e-9
          ? 'down'
          : prevQuote?.tickDirection ?? 'flat'
      : 'flat';

  return {
    pairId: pair.id,
    bid,
    ask,
    mid,
    changePct:
      typeof changePct === 'number' && Number.isFinite(changePct)
        ? changePct
        : prevQuote?.changePct ?? null,
    changeAbs:
      typeof changeAbs === 'number' && Number.isFinite(changeAbs)
        ? changeAbs
        : prevQuote?.changeAbs ?? null,
    spreadPoints,
    spreadFormatted,
    provenance,
    sourceLabel,
    fetchedAt: now,
    tickDirection,
    tickSeq: priceChanged ? (prevQuote?.tickSeq ?? 0) + 1 : prevQuote?.tickSeq ?? 0,
    sparkline: priceChanged
      ? appendSparkline(prevQuote?.sparkline, mid)
      : prevQuote?.sparkline?.length
        ? prevQuote.sparkline
        : [mid],
  };
}

/**
 * แปลงข้อมูลจาก TradingView Scanner (ใช้เป็น Vantage Spread Anchor และ Initial Snapshot)
 */
export function normalizeScannerQuote(params: {
  pair: PairSpec;
  raw: RawScannerRow;
  accountType: VantageAccountType;
  now: number;
  prevQuote?: MarketQuote | null;
  overrideDirectSourceLabel?: string;
}): MarketQuote | null {
  const { pair, raw, accountType, now, prevQuote, overrideDirectSourceLabel } = params;
  const close =
    typeof raw.close === 'number' && Number.isFinite(raw.close) && raw.close > 0
      ? raw.close
      : null;
  const rawBid =
    typeof raw.bid === 'number' && Number.isFinite(raw.bid) && raw.bid > 0
      ? raw.bid
      : null;
  const rawAsk =
    typeof raw.ask === 'number' && Number.isFinite(raw.ask) && raw.ask > 0
      ? raw.ask
      : null;
  const updateMode = (raw.update_mode ?? '').toLowerCase();
  const isDelayed = updateMode.includes('delayed');

  const hasSaneBidAsk =
    rawBid !== null &&
    rawAsk !== null &&
    rawAsk >= rawBid &&
    (close === null || Math.abs((rawBid + rawAsk) / 2 - close) / close <= 0.0015);

  if (hasSaneBidAsk && rawBid !== null && rawAsk !== null) {
    const label =
      overrideDirectSourceLabel ??
      (pair.isDirectVantageFeed
        ? accountType === 'STD'
          ? 'Vantage STD'
          : 'Vantage RAW'
        : 'Market B/A');
    return buildStreamingTickQuote({
      pair,
      directBid: rawBid,
      directAsk: rawAsk,
      changePct: raw.change ?? null,
      changeAbs: raw.change_abs ?? null,
      accountType,
      now,
      prevQuote,
      provenance: pair.isDirectVantageFeed ? 'vantage_live' : 'live_ws_bbo',
      sourceLabel: label,
    });
  }

  if (close !== null) {
    return buildStreamingTickQuote({
      pair,
      mid: close,
      changePct: raw.change ?? null,
      changeAbs: raw.change_abs ?? null,
      accountType,
      now,
      prevQuote,
      provenance: isDelayed ? 'delayed_derived' : 'live_derived',
      sourceLabel: isDelayed ? 'Delayed 15m' : 'CFD · Vantage Spread',
    });
  }

  return null;
}

/**
 * แยกตัวเลขราคาเป็น 3 ส่วนเหมือนหน้าจอ MT5 / cTrader Dealing Desk
 */
export function splitDealingPrice(
  price: number,
  decimals: number
): { prefix: string; bigDigits: string; superDigit: string } {
  if (!Number.isFinite(price) || price <= 0) {
    return { prefix: '--', bigDigits: '', superDigit: '' };
  }
  const formatted = price.toFixed(decimals);
  if (decimals >= 3) {
    return {
      prefix: formatted.slice(0, -3),
      bigDigits: formatted.slice(-3, -1),
      superDigit: formatted.slice(-1),
    };
  }
  if (decimals === 2) {
    return {
      prefix: formatted.slice(0, -2),
      bigDigits: formatted.slice(-2),
      superDigit: '',
    };
  }
  return {
    prefix: formatted.slice(0, Math.max(0, formatted.length - 4)),
    bigDigits: formatted.slice(Math.max(0, formatted.length - 4)),
    superDigit: '',
  };
}

/**
 * ประเมินความสดใหม่ของราคาตลาด (ตรวจจับเมื่อ WebSocket หลุดหรือราคาค้างเกิน 12/25 วินาที)
 */
export function evaluateFeedHealth(params: {
  isOnline: boolean;
  wsConnected: boolean;
  lastSuccessAt: number | null;
  consecutiveErrors: number;
  now: number;
  activeQuote?: MarketQuote | null;
}): {
  state: FeedHealthState;
  ageSeconds: number | null;
  alertMessage: string;
} {
  const { isOnline, wsConnected, lastSuccessAt, consecutiveErrors, now, activeQuote } = params;

  if (!isOnline) {
    return {
      state: 'OFFLINE',
      ageSeconds: lastSuccessAt ? Math.max(0, Math.floor((now - lastSuccessAt) / 1000)) : null,
      alertMessage: 'อุปกรณ์ออฟไลน์ — ราคาหยุดอัปเดต (โหมด USD Loss ยังคำนวณได้ปกติ)',
    };
  }

  const refTimestamp = activeQuote?.fetchedAt ?? lastSuccessAt;
  const ageMs = refTimestamp ? Math.max(0, now - refTimestamp) : null;
  const ageSeconds = ageMs !== null ? Math.floor(ageMs / 1000) : null;

  if (consecutiveErrors >= 2 && !wsConnected) {
    return {
      state: 'ERROR',
      ageSeconds,
      alertMessage:
        ageSeconds !== null
          ? `ฟีดราคาหลุดการเชื่อมต่อ (ค้าง ${ageSeconds} วิ) — แตะเชื่อมต่อใหม่`
          : 'ไม่สามารถเชื่อมต่อฟีดราคาสดได้ในขณะนี้',
    };
  }

  if (ageMs !== null && ageMs >= APP_CONFIG.QUOTE_STALE_CRITICAL_MS) {
    return {
      state: 'STALE',
      ageSeconds,
      alertMessage: `ราคาไม่ขยับมาแล้ว ${ageSeconds} วิ — โปรดเช็กราคาจริงบน MT5 ก่อนเข้าออเดอร์`,
    };
  }

  if (
    (ageMs !== null && ageMs >= APP_CONFIG.QUOTE_STALE_WARN_MS) ||
    activeQuote?.provenance === 'delayed_derived' ||
    activeQuote?.provenance === 'cached'
  ) {
    const msg =
      activeQuote?.provenance === 'delayed_derived'
        ? 'ราคาตลาดหุ้นดีเลย์ ~15 นาที — ดู Bid/Offer จริงบน MT5 ควบคู่'
        : ageSeconds !== null
          ? `ราคาอัปเดตช้า (${ageSeconds} วิที่แล้ว)`
          : 'กำลังเชื่อมต่อสตรีมราคาสด...';
    return {
      state: 'DELAYED',
      ageSeconds,
      alertMessage: msg,
    };
  }

  return {
    state: 'LIVE',
    ageSeconds,
    alertMessage: '',
  };
}

export function buildMt5LaunchUrl(mode: Mt5LaunchMode): string {
  if (mode === 'universal') {
    return 'https://download.terminal.free/cdn/mobile/mt5/ios?server=VantageInternational-Live';
  }
  if (mode === 'web_terminal') {
    return 'https://web.metatrader.app/terminal';
  }
  return 'metatrader5://';
}

export function buildTradingViewUrl(pair: PairSpec): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(pair.tvSymbol)}`;
}
