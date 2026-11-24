/**
 * ============================================================================
 *  LOTFAST v2.1.0 — TRADING CONFIGURATION & MULTI-ASSET STREAMING CATALOG
 *  แก้ไขเวอร์ชัน, โบรกเกอร์ Vantage, คู่เงินหลัก, หุ้น และรหัส PIN ได้ที่นี่
 * ============================================================================
 */

export type PairId = string;
export type AssetCategory = 'forex' | 'index' | 'stock' | 'metal' | 'crypto';
export type QuoteType =
  | 'USD'
  | 'JPY'
  | 'INDEX_USD'
  | 'STOCK_USD'
  | 'STOCK_THB'
  | 'METAL_USD'
  | 'CRYPTO_USD';
export type InputMode = 'USD' | 'PTS';
export type VantageAccountType = 'RAW' | 'STD';
export type Mt5LaunchMode = 'app_scheme' | 'universal' | 'web_terminal';

export interface MetaApiDirectConfig {
  enabled: boolean;
  token: string;
  accountId: string;
  region: 'new-york' | 'london' | 'singapore' | 'vint-hill';
}

export interface PairSpec {
  id: PairId;
  /** ชื่อย่อแสดงบนปุ่มกด 1 แตะ */
  label: string;
  /** ชื่อสัญลักษณ์บน Vantage MT5 */
  mt5Symbol: string;
  fullName: string;
  category: AssetCategory;
  /** สัญลักษณ์สำหรับเปิดกราฟบน TradingView (iOS Universal Link) */
  tvSymbol: string;
  /** ฟีดราคาอ้างอิง/สเปรด Vantage บน TradingView Scanner (Raw ECN) */
  feedSymbol: string;
  /** ฟีดราคา Vantage Standard STP (.TV) */
  vantageStdFeedSymbol?: string;
  /** สัญลักษณ์ WebSocket หลักบน Yahoo Finance Streamer (อัปเดตทุกวินาที) */
  yahooSymbol?: string;
  /** สัญลักษณ์ ETF/Proxy ความเร็วสูงบน Yahoo WS (เช่น DIA สำหรับ US30) */
  yahooProxySymbol?: string;
  /** สัญลักษณ์ WebSocket Level-1 BBO บน Kraken (ทุกมิลลิวินาที) */
  krakenSymbol?: string;
  /** สัญลักษณ์ WebSocket BookTicker บน Binance (ทุกมิลลิวินาทีสำหรับ Crypto) */
  binanceSymbol?: string;
  /** ระบุว่าฟีดสเปรดอ้างอิงตรงจาก Vantage หรือไม่ */
  isDirectVantageFeed?: boolean;
  /** จำนวนทศนิยมราคาที่แสดงบนจอ Bid/Offer */
  priceDecimals: number;
  /** สเปรดอ้างอิงของ Vantage (หน่วยเป็น MT5 Points) */
  typicalSpreadPoints: number;
  /** ขนาดไม้ที่ 1 ที่ล็อกไว้ตามระบบเทรด */
  firstLot: number;
  /** ขนาด Lot/หุ้น ขั้นต่ำของโบรกเกอร์ */
  minLot: number;
  /** ระยะขยับของ Lot/หุ้น (Step) */
  lotStep: number;
  /** ขนาด Lot สูงสุดต่อออเดอร์ (กันพิมพ์ผิด) */
  maxLot: number;
  /** จำนวนทศนิยมของ Lot */
  lotDecimals: number;
  /** Contract Size ของโบรกเกอร์ Vantage */
  contractSize: number;
  /** 1 MT5 Point มีค่าเท่ากับราคาขยับเท่าไหร่ */
  pointSize: number;
  /** 1 Pip / 1 Index Point / $1 เท่ากับกี่ MT5 Points */
  pointsPerPip: number;
  quoteType: QuoteType;
  pointHint: string;
  placeholderUsd: string;
  placeholderPts: string;
  isIndex: boolean;
  isCustom?: boolean;
  unitLabel?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

export interface Mt5Option {
  id: string;
  title: string;
  subtitle: string;
  costLabel: string;
  iphoneEase: string;
  needsVps: boolean;
  recommended?: boolean;
  howItWorks: string;
  pros: string[];
  cons: string[];
}

export const APP_CONFIG = {
  /** อัปเดตเลขเวอร์ชันนี้ทุกครั้งที่มีการแก้ไขเพื่อติดตามเวอร์ชันบน iPhone */
  VERSION: 'v2.1.0',
  RELEASE_DATE: '2026-11-25',
  APP_NAME: 'LotFast',
  BROKER_NAME: 'Vantage Markets (USD)',

  /** รหัส PIN เริ่มต้น (สามารถเปลี่ยนใหม่ในหน้าตั้งค่าบนเครื่องได้) */
  DEFAULT_PIN: '0808',

  /** คงสถานะปลดล็อกไว้นานกี่นาที */
  SESSION_TIMEOUT_MINUTES: 60,

  /** Risk Limit เริ่มต้นต่อการเทรด 1 ชุด (ไม้ 1 + ไม้ 2) */
  DEFAULT_RISK_USD: 30,

  RISK_PRESETS: [15, 30, 50, 100] as const,
  RR_PRESETS: ['1:1.5', '1:2', '1:3'] as const,

  /** ความถี่ในการเทียบสเปรด Vantage (ms) และเกณฑ์แจ้งเตือนราคาค้าง (ms) */
  VANTAGE_ANCHOR_POLL_MS: 8000,
  METAAPI_POLL_MS: 1000,
  QUOTE_STALE_WARN_MS: 12_000,
  QUOTE_STALE_CRITICAL_MS: 25_000,

  FALLBACK_RATES: {
    USDJPY: 159.27,
    GBPUSD: 1.3118,
    GBPJPY: 208.92,
    USDTHB: 33.93,
  },

  /** 4 คู่เงินหลักเริ่มต้นตามสเปก Vantage Markets บัญชี USD */
  PAIRS: [
    {
      id: 'USDJPY',
      label: 'USDJPY',
      mt5Symbol: 'USDJPY',
      fullName: 'US Dollar / Japanese Yen',
      category: 'forex',
      tvSymbol: 'VANTAGE:USDJPY',
      feedSymbol: 'VANTAGE:USDJPY',
      vantageStdFeedSymbol: 'VANTAGE:USDJPY.TV',
      yahooSymbol: 'JPY=X',
      isDirectVantageFeed: true,
      priceDecimals: 3,
      typicalSpreadPoints: 4,
      firstLot: 0.01,
      minLot: 0.01,
      lotStep: 0.01,
      maxLot: 100,
      lotDecimals: 2,
      contractSize: 100_000,
      pointSize: 0.001,
      pointsPerPip: 10,
      quoteType: 'JPY',
      pointHint: 'MT5 Points (10 pts = 1 pip)',
      placeholderUsd: '0.74',
      placeholderPts: '114',
      isIndex: false,
      unitLabel: 'Lot',
    },
    {
      id: 'GBPUSD',
      label: 'GU',
      mt5Symbol: 'GBPUSD',
      fullName: 'British Pound / US Dollar',
      category: 'forex',
      tvSymbol: 'VANTAGE:GBPUSD',
      feedSymbol: 'VANTAGE:GBPUSD',
      vantageStdFeedSymbol: 'VANTAGE:GBPUSD.TV',
      yahooSymbol: 'GBPUSD=X',
      isDirectVantageFeed: true,
      priceDecimals: 5,
      typicalSpreadPoints: 4,
      firstLot: 0.01,
      minLot: 0.01,
      lotStep: 0.01,
      maxLot: 100,
      lotDecimals: 2,
      contractSize: 100_000,
      pointSize: 0.00001,
      pointsPerPip: 10,
      quoteType: 'USD',
      pointHint: 'MT5 Points (10 pts = 1 pip)',
      placeholderUsd: '1.20',
      placeholderPts: '120',
      isIndex: false,
      unitLabel: 'Lot',
    },
    {
      id: 'GBPJPY',
      label: 'GJ',
      mt5Symbol: 'GBPJPY',
      fullName: 'British Pound / Japanese Yen',
      category: 'forex',
      tvSymbol: 'VANTAGE:GBPJPY',
      feedSymbol: 'VANTAGE:GBPJPY',
      vantageStdFeedSymbol: 'VANTAGE:GBPJPY.TV',
      yahooSymbol: 'GBPJPY=X',
      isDirectVantageFeed: true,
      priceDecimals: 3,
      typicalSpreadPoints: 10,
      firstLot: 0.01,
      minLot: 0.01,
      lotStep: 0.01,
      maxLot: 100,
      lotDecimals: 2,
      contractSize: 100_000,
      pointSize: 0.001,
      pointsPerPip: 10,
      quoteType: 'JPY',
      pointHint: 'MT5 Points (10 pts = 1 pip)',
      placeholderUsd: '0.95',
      placeholderPts: '145',
      isIndex: false,
      unitLabel: 'Lot',
    },
    {
      id: 'US30',
      label: 'US30',
      mt5Symbol: 'DJ30',
      fullName: 'Dow Jones 30 Cash CFD (Vantage DJ30)',
      category: 'index',
      tvSymbol: 'VANTAGE:DJ30',
      feedSymbol: 'OANDA:US30USD',
      yahooSymbol: '^DJI',
      yahooProxySymbol: 'DIA',
      isDirectVantageFeed: false,
      priceDecimals: 1,
      typicalSpreadPoints: 200,
      firstLot: 0.1,
      minLot: 0.1,
      lotStep: 0.1,
      maxLot: 100,
      lotDecimals: 1,
      contractSize: 1,
      pointSize: 0.01,
      pointsPerPip: 100,
      quoteType: 'INDEX_USD',
      pointHint: 'MT5 Points (100 pts = 1 จุดดัชนี)',
      placeholderUsd: '4.50',
      placeholderPts: '4500',
      isIndex: true,
      unitLabel: 'Lot',
    },
  ] as PairSpec[],
} as const;

export const PRESET_INSTRUMENTS: PairSpec[] = [
  {
    id: 'AAPL',
    label: 'AAPL',
    mt5Symbol: 'AAPL',
    fullName: 'Apple Inc. (NASDAQ)',
    category: 'stock',
    tvSymbol: 'NASDAQ:AAPL',
    feedSymbol: 'NASDAQ:AAPL',
    yahooSymbol: 'AAPL',
    priceDecimals: 2,
    typicalSpreadPoints: 4,
    firstLot: 1,
    minLot: 1,
    lotStep: 1,
    maxLot: 10_000,
    lotDecimals: 0,
    contractSize: 1,
    pointSize: 0.01,
    pointsPerPip: 100,
    quoteType: 'STOCK_USD',
    pointHint: 'เซ็นต์ / MT5 Points (100 pts = $1)',
    placeholderUsd: '2.50',
    placeholderPts: '250',
    isIndex: false,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'NVDA',
    label: 'NVDA',
    mt5Symbol: 'NVDA',
    fullName: 'NVIDIA Corp. (NASDAQ)',
    category: 'stock',
    tvSymbol: 'NASDAQ:NVDA',
    feedSymbol: 'NASDAQ:NVDA',
    yahooSymbol: 'NVDA',
    priceDecimals: 2,
    typicalSpreadPoints: 4,
    firstLot: 1,
    minLot: 1,
    lotStep: 1,
    maxLot: 10_000,
    lotDecimals: 0,
    contractSize: 1,
    pointSize: 0.01,
    pointsPerPip: 100,
    quoteType: 'STOCK_USD',
    pointHint: 'เซ็นต์ / MT5 Points (100 pts = $1)',
    placeholderUsd: '3.20',
    placeholderPts: '320',
    isIndex: false,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'TSLA',
    label: 'TSLA',
    mt5Symbol: 'TSLA',
    fullName: 'Tesla Inc. (NASDAQ)',
    category: 'stock',
    tvSymbol: 'NASDAQ:TSLA',
    feedSymbol: 'NASDAQ:TSLA',
    yahooSymbol: 'TSLA',
    priceDecimals: 2,
    typicalSpreadPoints: 6,
    firstLot: 1,
    minLot: 1,
    lotStep: 1,
    maxLot: 10_000,
    lotDecimals: 0,
    contractSize: 1,
    pointSize: 0.01,
    pointsPerPip: 100,
    quoteType: 'STOCK_USD',
    pointHint: 'เซ็นต์ / MT5 Points (100 pts = $1)',
    placeholderUsd: '5.00',
    placeholderPts: '500',
    isIndex: false,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'MSFT',
    label: 'MSFT',
    mt5Symbol: 'MSFT',
    fullName: 'Microsoft Corp. (NASDAQ)',
    category: 'stock',
    tvSymbol: 'NASDAQ:MSFT',
    feedSymbol: 'NASDAQ:MSFT',
    yahooSymbol: 'MSFT',
    priceDecimals: 2,
    typicalSpreadPoints: 5,
    firstLot: 1,
    minLot: 1,
    lotStep: 1,
    maxLot: 10_000,
    lotDecimals: 0,
    contractSize: 1,
    pointSize: 0.01,
    pointsPerPip: 100,
    quoteType: 'STOCK_USD',
    pointHint: 'เซ็นต์ / MT5 Points (100 pts = $1)',
    placeholderUsd: '4.00',
    placeholderPts: '400',
    isIndex: false,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'META',
    label: 'META',
    mt5Symbol: 'META',
    fullName: 'Meta Platforms Inc. (NASDAQ)',
    category: 'stock',
    tvSymbol: 'NASDAQ:META',
    feedSymbol: 'NASDAQ:META',
    yahooSymbol: 'META',
    priceDecimals: 2,
    typicalSpreadPoints: 6,
    firstLot: 1,
    minLot: 1,
    lotStep: 1,
    maxLot: 10_000,
    lotDecimals: 0,
    contractSize: 1,
    pointSize: 0.01,
    pointsPerPip: 100,
    quoteType: 'STOCK_USD',
    pointHint: 'เซ็นต์ / MT5 Points (100 pts = $1)',
    placeholderUsd: '5.50',
    placeholderPts: '550',
    isIndex: false,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'AMZN',
    label: 'AMZN',
    mt5Symbol: 'AMZN',
    fullName: 'Amazon.com Inc. (NASDAQ)',
    category: 'stock',
    tvSymbol: 'NASDAQ:AMZN',
    feedSymbol: 'NASDAQ:AMZN',
    yahooSymbol: 'AMZN',
    priceDecimals: 2,
    typicalSpreadPoints: 4,
    firstLot: 1,
    minLot: 1,
    lotStep: 1,
    maxLot: 10_000,
    lotDecimals: 0,
    contractSize: 1,
    pointSize: 0.01,
    pointsPerPip: 100,
    quoteType: 'STOCK_USD',
    pointHint: 'เซ็นต์ / MT5 Points (100 pts = $1)',
    placeholderUsd: '3.00',
    placeholderPts: '300',
    isIndex: false,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'XAUUSD',
    label: 'GOLD',
    mt5Symbol: 'XAUUSD',
    fullName: 'Gold Spot / US Dollar (Vantage)',
    category: 'metal',
    tvSymbol: 'VANTAGE:XAUUSD',
    feedSymbol: 'PEPPERSTONE:XAUUSD',
    yahooSymbol: 'GC=F',
    yahooProxySymbol: 'GLD',
    krakenSymbol: 'PAXG/USD',
    priceDecimals: 2,
    typicalSpreadPoints: 18,
    firstLot: 0.01,
    minLot: 0.01,
    lotStep: 0.01,
    maxLot: 100,
    lotDecimals: 2,
    contractSize: 100,
    pointSize: 0.01,
    pointsPerPip: 10,
    quoteType: 'METAL_USD',
    pointHint: 'MT5 Points (100 pts = $1 ทอง)',
    placeholderUsd: '3.50',
    placeholderPts: '350',
    isIndex: true,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'NAS100',
    label: 'NAS100',
    mt5Symbol: 'NAS100',
    fullName: 'Nasdaq 100 Index (Vantage)',
    category: 'index',
    tvSymbol: 'VANTAGE:NAS100',
    feedSymbol: 'CME_MINI:NQ1!',
    yahooSymbol: '^NDX',
    yahooProxySymbol: 'QQQ',
    priceDecimals: 1,
    typicalSpreadPoints: 150,
    firstLot: 0.1,
    minLot: 0.1,
    lotStep: 0.1,
    maxLot: 100,
    lotDecimals: 1,
    contractSize: 1,
    pointSize: 0.01,
    pointsPerPip: 100,
    quoteType: 'INDEX_USD',
    pointHint: 'MT5 Points (100 pts = 1 จุดดัชนี)',
    placeholderUsd: '3.50',
    placeholderPts: '3500',
    isIndex: true,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'SP500',
    label: 'SP500',
    mt5Symbol: 'SP500',
    fullName: 'S&P 500 Index (Vantage)',
    category: 'index',
    tvSymbol: 'VANTAGE:SP500',
    feedSymbol: 'CME_MINI:ES1!',
    yahooSymbol: '^GSPC',
    yahooProxySymbol: 'SPY',
    priceDecimals: 1,
    typicalSpreadPoints: 60,
    firstLot: 0.1,
    minLot: 0.1,
    lotStep: 0.1,
    maxLot: 100,
    lotDecimals: 1,
    contractSize: 1,
    pointSize: 0.01,
    pointsPerPip: 100,
    quoteType: 'INDEX_USD',
    pointHint: 'MT5 Points (100 pts = 1 จุดดัชนี)',
    placeholderUsd: '2.00',
    placeholderPts: '2000',
    isIndex: true,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'EURUSD',
    label: 'EU',
    mt5Symbol: 'EURUSD',
    fullName: 'Euro / US Dollar (Vantage)',
    category: 'forex',
    tvSymbol: 'VANTAGE:EURUSD',
    feedSymbol: 'VANTAGE:EURUSD',
    vantageStdFeedSymbol: 'VANTAGE:EURUSD.TV',
    yahooSymbol: 'EURUSD=X',
    isDirectVantageFeed: true,
    priceDecimals: 5,
    typicalSpreadPoints: 2,
    firstLot: 0.01,
    minLot: 0.01,
    lotStep: 0.01,
    maxLot: 100,
    lotDecimals: 2,
    contractSize: 100_000,
    pointSize: 0.00001,
    pointsPerPip: 10,
    quoteType: 'USD',
    pointHint: 'MT5 Points (10 pts = 1 pip)',
    placeholderUsd: '1.00',
    placeholderPts: '100',
    isIndex: false,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'BTCUSD',
    label: 'BTC',
    mt5Symbol: 'BTCUSD',
    fullName: 'Bitcoin / US Dollar',
    category: 'crypto',
    tvSymbol: 'VANTAGE:BTCUSD',
    feedSymbol: 'BINANCE:BTCUSDT',
    yahooSymbol: 'BTC-USD',
    krakenSymbol: 'BTC/USD',
    binanceSymbol: 'BTCUSDT',
    priceDecimals: 2,
    typicalSpreadPoints: 1500,
    firstLot: 0.01,
    minLot: 0.01,
    lotStep: 0.01,
    maxLot: 50,
    lotDecimals: 2,
    contractSize: 1,
    pointSize: 0.01,
    pointsPerPip: 100,
    quoteType: 'CRYPTO_USD',
    pointHint: 'MT5 Points (100 pts = $1 BTC)',
    placeholderUsd: '5.00',
    placeholderPts: '50000',
    isIndex: true,
    isCustom: true,
    unitLabel: 'Lot',
  },
  {
    id: 'SET_DELTA',
    label: 'DELTA',
    mt5Symbol: 'DELTA',
    fullName: 'Delta Electronics (SET)',
    category: 'stock',
    tvSymbol: 'SET:DELTA',
    feedSymbol: 'SET:DELTA',
    yahooSymbol: 'DELTA.BK',
    priceDecimals: 2,
    typicalSpreadPoints: 1,
    firstLot: 100,
    minLot: 100,
    lotStep: 100,
    maxLot: 1_000_000,
    lotDecimals: 0,
    contractSize: 1,
    pointSize: 0.25,
    pointsPerPip: 4,
    quoteType: 'STOCK_THB',
    pointHint: 'ช่องราคา (4 ช่อง = 1 บาท)',
    placeholderUsd: '3.00',
    placeholderPts: '4',
    isIndex: false,
    isCustom: true,
    unitLabel: 'หุ้น',
  },
  {
    id: 'SET_PTT',
    label: 'PTT',
    mt5Symbol: 'PTT',
    fullName: 'PTT Public Co. (SET)',
    category: 'stock',
    tvSymbol: 'SET:PTT',
    feedSymbol: 'SET:PTT',
    yahooSymbol: 'PTT.BK',
    priceDecimals: 2,
    typicalSpreadPoints: 1,
    firstLot: 100,
    minLot: 100,
    lotStep: 100,
    maxLot: 1_000_000,
    lotDecimals: 0,
    contractSize: 1,
    pointSize: 0.25,
    pointsPerPip: 4,
    quoteType: 'STOCK_THB',
    pointHint: 'ช่องราคา (4 ช่อง = 1 บาท)',
    placeholderUsd: '2.00',
    placeholderPts: '4',
    isIndex: false,
    isCustom: true,
    unitLabel: 'หุ้น',
  },
];

export const STORAGE_KEYS = {
  RISK: 'lotfast_risk_usd_v1',
  PAIR: 'lotfast_selected_pair_v1',
  MODE: 'lotfast_input_mode_v1',
  RR_RATIO: 'lotfast_rr_ratio_v1',
  PIN: 'lotfast_user_pin_v2',
  UNLOCK_UNTIL: 'lotfast_unlock_until_v1',
  QUOTES: 'lotfast_cached_quotes_v3',
  HISTORY: 'lotfast_calc_history_v1',
  CUSTOM_PAIRS: 'lotfast_custom_pairs_v2',
  VANTAGE_ACCOUNT: 'lotfast_vantage_acct_v2',
  MT5_LAUNCH_MODE: 'lotfast_mt5_launch_v2',
  METAAPI_CONFIG: 'lotfast_metaapi_direct_v1',
} as const;

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v2.1.0',
    date: '2026-11-25',
    notes: [
      'อัปเกรดเอนจินราคาเป็น WebSocket Real-time แท้ (Yahoo Live Stream + Kraken BBO + Binance WS) ที่ราคาวิ่งขึ้นลงจริงทุกวินาที พร้อมคาลิเบรตสเปรดและฐานราคาตรงจากฟีด Vantage RAW/STD',
      'รองรับการเชื่อมต่อราคาตรง 1:1 จากเซิร์ฟเวอร์ Vantage MT5 (MetaApi Direct) ในหน้าตั้งค่าสำหรับผู้ที่ต้องการทศนิยมตรงพอร์ต 100%',
      'ปรับโฉมแผง Bid / Offer ใหม่ทั้งหมดพร้อมกราฟเส้น Tick Sparkline สด, ลูกศรทิศทางราคา, ค่า Spread และแจ้งเตือนทันทีเมื่อราคาค้าง',
      'ปรับสัดส่วน Layout ให้พอดี 1 หน้าจอ iPhone (100dvh Fit-to-Screen) ไม่ต้องเลื่อนขึ้นลงขณะออกออเดอร์',
    ],
  },
  {
    version: 'v2.0.0',
    date: '2026-11-24',
    notes: [
      'เพิ่มแผงราคา Bid/Offer, ปุ่มคีย์ลัด 1 แตะ MT5 & TradingView, ระบบเพิ่มหุ้นอิสระ และปรับโฉม Obsidian Grid UI',
    ],
  },
  {
    version: 'v1.1.1',
    date: '2026-11-22',
    notes: [
      'เพิ่มช่องตั้งค่า R:R Ratio (1:2, 1:3) คำนวณ Take Profit คาดการณ์ และเปลี่ยน PIN เริ่มต้นเป็น 0808',
    ],
  },
];

export const MT5_NO_VPS_OPTIONS: Mt5Option[] = [
  {
    id: 'metaapi',
    title: '1. เชื่อมต่อตรง Vantage MT5 ผ่าน MetaApi Cloud (รองรับในหน้าตั้งค่าแล้ว!)',
    subtitle: 'ดึงราคา Bid/Offer ตรงจากเซิร์ฟเวอร์ Vantage MT5 ของคุณ 1:1 โดยไม่ต้องใช้ VPS',
    costLabel: 'มี Free Tier ทดลอง / ~$15–$30/ด.',
    iphoneEase: 'กรอก Token + Account ID ในปุ่ม ⚙️ ของ LotFast ได้ทันที',
    needsVps: false,
    recommended: true,
    howItWorks:
      'สมัคร MetaApi Cloud และผูกบัญชี Vantage MT5 (ใช้ Investor Password แบบดูอย่างเดียวก็ดึงราคาสดได้ ปลอดภัย 100%) แล้วนำ Token + Account ID มาใส่ในหน้าตั้งค่า ⚙️ ของ LotFast',
    pros: [
      'ราคา Bid/Offer ตรงกับแอป MT5 Vantage ของคุณทุกทศนิยม 100%',
      'ไม่ต้องเช่า VPS ไม่ต้องเปิดคอมทิ้งไว้ และใช้บน iPhone ได้ตลอด 24 ชม.',
      'ใช้ Investor Password (Read-only) ได้เพื่อความปลอดภัยสูงสุด',
    ],
    cons: [
      'บัญชีขนาดใหญ่หรือใช้งานหนักอาจมีค่าบริการรายเดือนของ MetaApi',
    ],
  },
  {
    id: 'tradingview',
    title: '2. บัญชี Vantage + แอป TradingView บน iPhone',
    subtitle: 'ทางลัดฟรี 100% เทรดบนกราฟพร้อมตั้ง Risk เป็น USD ในไม้เดียว',
    costLabel: 'ฟรี 100%',
    iphoneEase: 'กดปุ่ม "กราฟ TradingView" จาก LotFast เปิดกราฟคู่เงินนั้นทันที',
    needsVps: false,
    howItWorks:
      'เปิดบัญชี Vantage ประเภทที่รองรับ TradingView แล้วล็อกอินในแอป TradingView บน iPhone หน้า Order Panel สามารถกรอก Risk $30 เพื่อคำนวณ Lot ให้อัตโนมัติ',
    pros: [
      'ฟรี 100% เชื่อมตรงกับโบรกเกอร์ Vantage',
      'ตั้ง Stop Loss และกำหนด Risk เป็น USD จบในหน้าจอเดียว',
    ],
    cons: [
      'ต้องย้ายไปกดออเดอร์ผ่านแอป TradingView แทนแอป MT5',
    ],
  },
  {
    id: 'python-bridge',
    title: '3. Local Python Bridge + Cloudflare Tunnel',
    subtitle: 'ฟรีและยืดหยุ่นสูงสุด สำหรับผู้ที่เปิดคอม Windows ที่บ้านอยู่แล้ว',
    costLabel: 'ฟรี (ค่าไฟคอมที่บ้าน)',
    iphoneEase: 'ใช้ได้เฉพาะช่วงที่เปิดคอมทิ้งไว้',
    needsVps: false,
    howItWorks:
      'รัน Python + ไลบรารี MetaTrader5 + FastAPI บน PC ที่บ้าน แล้วเชื่อมเข้า LotFast ผ่าน Cloudflare Tunnel (HTTPS ฟรี)',
    pros: ['ฟรีและปรับแต่งเงื่อนไข EA/Risk ได้อิสระเต็มที่'],
    cons: ['หากปิดคอมหรือเน็ตบ้านหลุดจะไม่สามารถเชื่อมต่อได้'],
  },
];

export function getPairById(pairId: string, allPairs: PairSpec[] = APP_CONFIG.PAIRS): PairSpec {
  return allPairs.find((p) => p.id === pairId) ?? allPairs[0] ?? APP_CONFIG.PAIRS[0];
}

export interface CustomInstrumentInput {
  symbol: string;
  label?: string;
  fullName?: string;
  category: AssetCategory;
  quoteType: QuoteType;
  exchange?: string;
  firstLot: number;
  minLot: number;
  lotStep: number;
  contractSize: number;
  pointSize: number;
  typicalSpreadPoints: number;
}

export function buildCustomPairSpec(input: CustomInstrumentInput): PairSpec {
  const cleanRaw = input.symbol.trim().toUpperCase().replace(/\s+/g, '');
  const hasExchange = cleanRaw.includes(':');
  const [explicitEx, tickerOnly] = hasExchange
    ? cleanRaw.split(':', 2)
    : ['', cleanRaw];

  const cleanTicker = (tickerOnly || cleanRaw).replace(/[^A-Z0-9._-]/g, '');
  const id = explicitEx ? `${explicitEx}_${cleanTicker}` : cleanTicker;
  const label = (input.label?.trim().toUpperCase() || cleanTicker).slice(0, 8);

  const defaultExchange =
    explicitEx ||
    input.exchange?.trim().toUpperCase() ||
    (input.quoteType === 'STOCK_THB'
      ? 'SET'
      : input.category === 'stock'
        ? 'NASDAQ'
        : input.category === 'forex'
          ? 'VANTAGE'
          : input.category === 'crypto'
            ? 'BINANCE'
            : 'VANTAGE');

  const tvSymbol = `${defaultExchange}:${cleanTicker}`;
  const isVantageForex = input.category === 'forex' && defaultExchange === 'VANTAGE';

  // Auto-resolve Yahoo Finance WebSocket ticker for real-time every-second ticks!
  let yahooSymbol: string | undefined;
  if (input.quoteType === 'STOCK_THB') {
    yahooSymbol = cleanTicker.endsWith('.BK') ? cleanTicker : `${cleanTicker}.BK`;
  } else if (input.category === 'stock') {
    yahooSymbol = cleanTicker;
  } else if (input.category === 'forex') {
    yahooSymbol = cleanTicker.startsWith('USD') && cleanTicker.length === 6
      ? `${cleanTicker.slice(3)}=X`
      : `${cleanTicker}=X`;
  } else if (input.category === 'crypto') {
    const base = cleanTicker.replace(/USDT?$/, '');
    yahooSymbol = `${base}-USD`;
  }

  const lotStep = Number.isFinite(input.lotStep) && input.lotStep > 0 ? input.lotStep : 0.01;
  const lotDecimals =
    lotStep >= 1 ? 0 : Math.min(4, Math.max(0, (lotStep.toString().split('.')[1] ?? '').length));

  const priceDecimals =
    input.quoteType === 'JPY'
      ? 3
      : input.quoteType === 'USD' && input.category === 'forex'
        ? 5
        : input.category === 'index'
          ? 1
          : 2;

  const pointsPerPip =
    input.category === 'forex'
      ? 10
      : input.quoteType === 'STOCK_THB'
        ? 4
        : 100;

  return {
    id: `CUSTOM_${id}`,
    label,
    mt5Symbol: cleanTicker,
    fullName: input.fullName?.trim() || `${cleanTicker} (${defaultExchange})`,
    category: input.category,
    tvSymbol,
    feedSymbol: tvSymbol,
    vantageStdFeedSymbol: isVantageForex ? `${tvSymbol}.TV` : undefined,
    yahooSymbol,
    binanceSymbol:
      input.category === 'crypto'
        ? cleanTicker.endsWith('USDT')
          ? cleanTicker
          : `${cleanTicker.replace(/USD$/, '')}USDT`
        : undefined,
    isDirectVantageFeed: isVantageForex,
    priceDecimals,
    typicalSpreadPoints: Math.max(0, input.typicalSpreadPoints || 0),
    firstLot: Number.isFinite(input.firstLot) && input.firstLot > 0 ? input.firstLot : lotStep,
    minLot: Number.isFinite(input.minLot) && input.minLot > 0 ? input.minLot : lotStep,
    lotStep,
    maxLot: input.category === 'stock' ? 100_000 : 100,
    lotDecimals,
    contractSize:
      Number.isFinite(input.contractSize) && input.contractSize > 0
        ? input.contractSize
        : 1,
    pointSize:
      Number.isFinite(input.pointSize) && input.pointSize > 0
        ? input.pointSize
        : 0.01,
    pointsPerPip,
    quoteType: input.quoteType,
    pointHint:
      input.quoteType === 'STOCK_USD'
        ? 'เซ็นต์ / MT5 Points (100 pts = $1)'
        : input.quoteType === 'STOCK_THB'
          ? 'ช่องราคา (4 ช่อง = 1 บาท)'
          : input.category === 'forex'
            ? 'MT5 Points (10 pts = 1 pip)'
            : 'MT5 Points (100 pts = 1 จุด)',
    placeholderUsd: input.category === 'stock' ? '2.50' : '1.20',
    placeholderPts: input.category === 'stock' ? '250' : '120',
    isIndex: input.category === 'index' || input.category === 'metal',
    isCustom: true,
    unitLabel: input.quoteType === 'STOCK_THB' ? 'หุ้น' : 'Lot',
  };
}
