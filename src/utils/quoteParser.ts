import {
  APP_CONFIG,
  type Mt5LaunchMode,
  type PairSpec,
  type VantageAccountType,
} from '../config/tradingConfig';

export type QuoteProvenance =
  | 'vantage_live'
  | 'live_stream'
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
  /** เวลาที่ดึงราคาสำเร็จล่าสุด (ms) */
  fetchedAt: number;
  /** ทิศทางการขยับเทียบกับราคาก่อนหน้า */
  tickDirection: 'up' | 'down' | 'flat';
}

export interface RawScannerRow {
  close?: number | null;
  bid?: number | null;
  ask?: number | null;
  change?: number | null;
  change_abs?: number | null;
  update_mode?: string | null;
}

/**
 * คืนค่าสตริง Ticker ที่ใช้ยิงขอราคาจาก TradingView Scanner ตามบัญชี Vantage ที่เลือก
 */
export function resolveFeedTicker(
  pair: PairSpec,
  accountType: VantageAccountType
): string {
  if (accountType === 'STD' && pair.vantageStdFeedSymbol) {
    return pair.vantageStdFeedSymbol;
  }
  return pair.feedSymbol;
}

/**
 * แปลงค่าสเปรดเป็นข้อความอ่านง่ายตามประเภทสินทรัพย์
 */
export function formatSpreadLabel(
  bid: number,
  ask: number,
  pair: PairSpec
): { spreadPoints: number; spreadFormatted: string } {
  const diff = Math.max(0, ask - bid);
  const spreadPoints = pair.pointSize > 0 ? Math.round(diff / pair.pointSize) : 0;

  if (pair.category === 'forex') {
    const pips = diff / (pair.pointSize * pair.pointsPerPip);
    return { spreadPoints, spreadFormatted: `${pips.toFixed(1)} pip` };
  }
  if (pair.quoteType === 'STOCK_USD') {
    return { spreadPoints, spreadFormatted: `$${diff.toFixed(2)}` };
  }
  if (pair.quoteType === 'STOCK_THB') {
    return { spreadPoints, spreadFormatted: `฿${diff.toFixed(2)}` };
  }
  if (pair.category === 'index') {
    return { spreadPoints, spreadFormatted: `${diff.toFixed(1)} pts` };
  }
  return { spreadPoints, spreadFormatted: `$${diff.toFixed(2)}` };
}

/**
 * แปลงข้อมูลดิบจาก TradingView Scanner / Binance ให้เป็น Bid/Offer ที่ปลอดภัย
 * - ตรวจจับ Bid/Ask ที่กลับด้าน (ask < bid)
 * - ตรวจจับ Bid/Ask ที่ค้างห่างจากราคาล่าสุด (close) เกิน 0.15% (เช่น OANDA CFD นอกเวลา)
 *   แล้วคำนวณ Bid/Offer อิงราคา Close สด ± Vantage Typical Spread พร้อมระบุ Provenance ชัดเจน
 */
export function normalizeScannerQuote(params: {
  pair: PairSpec;
  raw: RawScannerRow;
  accountType: VantageAccountType;
  now: number;
  prevMid?: number;
  overrideDirectSourceLabel?: string;
}): MarketQuote | null {
  const { pair, raw, accountType, now, prevMid, overrideDirectSourceLabel } = params;
  const close = typeof raw.close === 'number' && Number.isFinite(raw.close) && raw.close > 0 ? raw.close : null;
  const rawBid = typeof raw.bid === 'number' && Number.isFinite(raw.bid) && raw.bid > 0 ? raw.bid : null;
  const rawAsk = typeof raw.ask === 'number' && Number.isFinite(raw.ask) && raw.ask > 0 ? raw.ask : null;
  const updateMode = (raw.update_mode ?? '').toLowerCase();
  const isDelayed = updateMode.includes('delayed');

  // ตรวจสอบว่า Bid/Ask ดิบมีอยู่จริง ไม่กลับด้าน และไม่ค้างห่างจากราคา Close สดเกิน 0.15%
  const hasSaneBidAsk =
    rawBid !== null &&
    rawAsk !== null &&
    rawAsk >= rawBid &&
    (close === null || Math.abs((rawBid + rawAsk) / 2 - close) / close <= 0.0015);

  let bid: number;
  let ask: number;
  let provenance: QuoteProvenance;
  let sourceLabel: string;

  if (hasSaneBidAsk && rawBid !== null && rawAsk !== null) {
    bid = rawBid;
    ask = rawAsk;
    if (overrideDirectSourceLabel) {
      provenance = 'live_stream';
      sourceLabel = overrideDirectSourceLabel;
    } else if (pair.isDirectVantageFeed) {
      provenance = 'vantage_live';
      sourceLabel = accountType === 'STD' ? 'Vantage STD Live' : 'Vantage RAW Live';
    } else {
      provenance = 'live_stream';
      sourceLabel = 'Live Market B/A';
    }
  } else if (close !== null) {
    // Derive realistic Bid/Offer symmetrically around live close using Vantage typical spread
    const halfSpread = (pair.typicalSpreadPoints * pair.pointSize) / 2;
    bid = Math.max(pair.pointSize, close - halfSpread);
    ask = close + halfSpread;
    if (isDelayed) {
      provenance = 'delayed_derived';
      sourceLabel = 'Delayed 15m · Est. B/A';
    } else {
      provenance = 'live_derived';
      sourceLabel = pair.isIndex || pair.category === 'metal'
        ? 'Live CFD · Vantage Spread'
        : 'Live Last · Est. B/A';
    }
  } else {
    return null;
  }

  const mid = (bid + ask) / 2;
  const { spreadPoints, spreadFormatted } = formatSpreadLabel(bid, ask, pair);
  const tickDirection: 'up' | 'down' | 'flat' =
    typeof prevMid === 'number' && prevMid > 0
      ? mid > prevMid + 1e-9
        ? 'up'
        : mid < prevMid - 1e-9
          ? 'down'
          : 'flat'
      : 'flat';

  return {
    pairId: pair.id,
    bid,
    ask,
    mid,
    changePct: typeof raw.change === 'number' && Number.isFinite(raw.change) ? raw.change : null,
    changeAbs:
      typeof raw.change_abs === 'number' && Number.isFinite(raw.change_abs)
        ? raw.change_abs
        : null,
    spreadPoints,
    spreadFormatted,
    provenance,
    sourceLabel,
    fetchedAt: now,
    tickDirection,
  };
}

/**
 * แยกตัวเลขราคาเป็น 3 ส่วนเหมือนหน้าจอ MT5 / Dealing Desk (ส่วนหน้า, เลข Pip ใหญ่, เลข Pipette เล็ก)
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
    // เช่น 159.094 -> prefix "159.", big "09", super "4" หรือ 1.31158 -> "1.31", "15", "8"
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
  // 1 decimal เช่น 49770.6 -> "497", "70.6"
  return {
    prefix: formatted.slice(0, Math.max(0, formatted.length - 4)),
    bigDigits: formatted.slice(Math.max(0, formatted.length - 4)),
    superDigit: '',
  };
}

/**
 * ประเมินสถานะความสดใหม่ของราคาตลาด เพื่อแจ้งเตือนเมื่อราคาค้างหรือเชื่อมต่อไม่ได้
 */
export function evaluateFeedHealth(params: {
  isOnline: boolean;
  lastSuccessAt: number | null;
  consecutiveErrors: number;
  now: number;
  activeQuote?: MarketQuote | null;
}): {
  state: FeedHealthState;
  ageSeconds: number | null;
  alertMessage: string;
} {
  const { isOnline, lastSuccessAt, consecutiveErrors, now, activeQuote } = params;

  if (!isOnline) {
    return {
      state: 'OFFLINE',
      ageSeconds: lastSuccessAt ? Math.max(0, Math.floor((now - lastSuccessAt) / 1000)) : null,
      alertMessage: 'อุปกรณ์ออฟไลน์ — ราคาหยุดอัปเดต (โหมด USD Loss ยังคำนวณ Lot ได้ปกติ)',
    };
  }

  const refTimestamp = activeQuote?.fetchedAt ?? lastSuccessAt;
  const ageMs = refTimestamp ? Math.max(0, now - refTimestamp) : null;
  const ageSeconds = ageMs !== null ? Math.floor(ageMs / 1000) : null;

  if (consecutiveErrors >= 2) {
    return {
      state: 'ERROR',
      ageSeconds,
      alertMessage:
        ageSeconds !== null
          ? `เชื่อมต่อฟีดราคาไม่ได้ (ค้างมาแล้ว ${ageSeconds} วินาที) — แตะรีเฟรชเพื่อลองใหม่`
          : 'ไม่สามารถเชื่อมต่อฟีดราคาตลาดได้ในขณะนี้',
    };
  }

  if (ageMs !== null && ageMs >= APP_CONFIG.QUOTE_STALE_CRITICAL_MS) {
    return {
      state: 'STALE',
      ageSeconds,
      alertMessage: `แจ้งเตือน: ราคาตลาดไม่อัปเดตมาแล้ว ${ageSeconds} วินาที — กรุณาตรวจสอบราคาใน MT5 ก่อนออกออเดอร์`,
    };
  }

  if (
    (ageMs !== null && ageMs >= APP_CONFIG.QUOTE_STALE_WARN_MS) ||
    activeQuote?.provenance === 'delayed_derived' ||
    activeQuote?.provenance === 'cached'
  ) {
    const msg =
      activeQuote?.provenance === 'delayed_derived'
        ? 'ราคาหุ้นอ้างอิงจากตลาดหลักทรัพย์ (ดีเลย์ ~15 นาที) — ควรดูราคา Bid/Offer จริงบน MT5 ควบคู่'
        : ageSeconds !== null
          ? `ราคาอัปเดตช้ากว่าปกติ (${ageSeconds} วินาทีที่แล้ว)`
          : 'กำลังใช้ราคาล่าสุดจากแคช';
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

/**
 * สร้างลิงก์เปิดแอป MetaTrader 5 บน iPhone / Web
 */
export function buildMt5LaunchUrl(mode: Mt5LaunchMode): string {
  if (mode === 'universal') {
    return 'https://download.terminal.free/cdn/mobile/mt5/ios?server=VantageInternational-Live';
  }
  if (mode === 'web_terminal') {
    return 'https://web.metatrader.app/terminal';
  }
  return 'metatrader5://';
}

/**
 * สร้างลิงก์เปิดกราฟ TradingView ตรงไปยังคู่เงิน/หุ้นที่เลือกอยู่
 * (บน iPhone iOS Universal Link จะเปิดเข้าแอป TradingView โดยตรงอัตโนมัติ)
 */
export function buildTradingViewUrl(pair: PairSpec): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(pair.tvSymbol)}`;
}
