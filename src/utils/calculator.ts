import { APP_CONFIG, type InputMode, type PairSpec } from '../config/tradingConfig';

export interface LiveRates {
  USDJPY: number;
  GBPUSD: number;
  GBPJPY: number;
  USDTHB?: number;
}

export type CalculationStatus =
  | 'IDLE'
  | 'OK'
  | 'OVER_RISK'
  | 'BELOW_MIN_LOT'
  | 'INVALID_RISK';

export interface CalculationResult {
  status: CalculationStatus;
  pair: PairSpec;
  /** ยอดขาดทุนของไม้ที่ 1 (USD) */
  loss1: number;
  /** ยอดขาดทุนของไม้ที่ 2 (USD) */
  loss2: number;
  /** ขนาด Lot/หุ้น ที่แนะนำสำหรับไม้ที่ 2 (ปัดลงตาม Lot Step เสมอ) */
  lot2: number;
  /** ขนาด Lot/หุ้น รวม 2 ไม้ */
  totalLot: number;
  /** ยอดขาดทุนรวม 2 ไม้ (รับประกัน <= riskUsd เมื่อ status === 'OK') */
  totalLoss: number;
  /** งบเสี่ยงคงเหลือหลังหักไม้ 1 + ไม้ 2 */
  unusedRisk: number;
  /** มูลค่าต่อ 1 MT5 Point สำหรับ 1.00 Lot (USD) */
  pointValuePerFullLot: number;
  /** มูลค่าต่อ 1 Pip / 1 Index Point / $1 สำหรับ 1.00 Lot (USD) */
  pipValuePerFullLot: number;
  /** ข้อความแจ้งเตือนสำหรับ Edge Case */
  message: string;
  /** คำเตือนเมื่อ Lot 2 ถูกจำกัดที่ Max Lot */
  warning: string;
}

/**
 * คำนวณมูลค่าต่อ 1 MT5 Point สำหรับขนาด 1.00 Lot (สกุลบัญชี USD)
 * รองรับครบทั้ง Forex (USD/JPY), Index CFD, US Stocks, Thai Stocks (SET), Gold และ Crypto
 */
export function getPointValuePerFullLot(pair: PairSpec, rates: LiveRates): number {
  if (pair.quoteType === 'JPY') {
    const usdJpy =
      Number.isFinite(rates.USDJPY) && rates.USDJPY > 0
        ? rates.USDJPY
        : APP_CONFIG.FALLBACK_RATES.USDJPY;
    return (pair.contractSize * pair.pointSize) / usdJpy;
  }

  if (pair.quoteType === 'STOCK_THB') {
    const usdThb =
      typeof rates.USDTHB === 'number' && Number.isFinite(rates.USDTHB) && rates.USDTHB > 0
        ? rates.USDTHB
        : APP_CONFIG.FALLBACK_RATES.USDTHB;
    return (pair.contractSize * pair.pointSize) / usdThb;
  }

  // USD, INDEX_USD, STOCK_USD, METAL_USD, CRYPTO_USD
  return pair.contractSize * pair.pointSize;
}

/**
 * คำนวณมูลค่าต่อ 1 Pip / 1 Index Point / $1 ต่อ 1.00 Lot (USD)
 */
export function getPipValuePerFullLot(pair: PairSpec, rates: LiveRates): number {
  return getPointValuePerFullLot(pair, rates) * pair.pointsPerPip;
}

/**
 * จัดรูปแบบตัวเลข Lot/หุ้น ให้ตรงกับจำนวนทศนิยมของสินทรัพย์นั้นๆ (0, 1, 2 ตำแหน่ง)
 */
export function formatLot(lot: number, pair: PairSpec): string {
  if (!Number.isFinite(lot)) return (0).toFixed(pair.lotDecimals);
  return lot.toFixed(pair.lotDecimals);
}

/**
 * คำนวณขนาด Lot/หุ้น ไม้ที่ 2 แบบ Production-Ready พร้อมตรวจสอบ Edge Case ทั้งหมด
 * รับประกันว่า:
 * 1. ไม่มี NaN หรือ Division-by-Zero
 * 2. ปัดเศษลงตาม Lot Step ของสินทรัพย์นั้นๆ เสมอ (0.01 FX, 0.1 US30, 1 หุ้นสหรัฐ, 100 หุ้นไทย)
 * 3. ยอดขาดทุนรวม (ไม้ 1 + ไม้ 2) ไม่มีวันเกิน riskUsd
 */
export function calculateSecondOrder(params: {
  pair: PairSpec;
  riskUsd: number;
  mode: InputMode;
  inputStr: string;
  rates: LiveRates;
}): CalculationResult {
  const { pair, riskUsd, mode, inputStr, rates } = params;
  const pointValuePerFullLot = getPointValuePerFullLot(pair, rates);
  const pipValuePerFullLot = pointValuePerFullLot * pair.pointsPerPip;
  const unit = pair.unitLabel || 'Lot';

  const baseIdle: CalculationResult = {
    status: 'IDLE',
    pair,
    loss1: 0,
    loss2: 0,
    lot2: 0,
    totalLot: pair.firstLot,
    totalLoss: 0,
    unusedRisk: Number.isFinite(riskUsd) && riskUsd > 0 ? riskUsd : 0,
    pointValuePerFullLot,
    pipValuePerFullLot,
    message: '',
    warning: '',
  };

  if (!Number.isFinite(riskUsd) || riskUsd <= 0) {
    return {
      ...baseIdle,
      status: 'INVALID_RISK',
      message: 'กรุณาตั้งค่า Risk Limit มากกว่า $0',
    };
  }

  const trimmed = inputStr.trim();
  if (!trimmed || trimmed === '.' || trimmed === '-') {
    return baseIdle;
  }

  const rawNum = Number.parseFloat(trimmed);
  if (!Number.isFinite(rawNum) || rawNum <= 0) {
    return baseIdle;
  }

  // แปลงค่าที่กรอกเป็นยอดขาดทุนของไม้ที่ 1 (USD)
  const loss1 =
    mode === 'USD'
      ? Math.abs(rawNum)
      : Math.abs(rawNum) * pointValuePerFullLot * pair.firstLot;

  if (!Number.isFinite(loss1) || loss1 <= 0) {
    return baseIdle;
  }

  // Edge Case 1: ไม้แรกขาดทุนเท่ากับหรือเกิน Risk Limit แล้ว
  if (loss1 >= riskUsd) {
    const over = loss1 - riskUsd;
    return {
      ...baseIdle,
      status: 'OVER_RISK',
      loss1,
      totalLoss: loss1,
      unusedRisk: riskUsd - loss1,
      message:
        over > 0.005
          ? `ห้ามเปิดไม้ 2 — ไม้แรกเกินงบเสี่ยงแล้ว (+$${over.toFixed(2)})`
          : `ไม้แรกครบงบเสี่ยง $${riskUsd.toFixed(2)} พอดีแล้ว ไม่ต้องเปิดไม้ 2`,
    };
  }

  const remainingRisk = riskUsd - loss1;
  const lossPerStep = (loss1 / pair.firstLot) * pair.lotStep;

  if (!Number.isFinite(lossPerStep) || lossPerStep <= 0) {
    return baseIdle;
  }

  // คำนวณจำนวน Step ด้วยการปัดเศษลง (รองรับ floating-point precision เช่น 29 / 1.0)
  let steps = Math.floor(remainingRisk / lossPerStep + 1e-9);
  let lot2 = Number((steps * pair.lotStep).toFixed(pair.lotDecimals));

  // Double-Safety Verification: ตรวจซ้ำว่ายอดขาดทุนรวมไม่เกิน Risk Limit เด็ดขาด
  while (steps > 0) {
    const verifyTotalLoss = ((pair.firstLot + lot2) / pair.firstLot) * loss1;
    if (verifyTotalLoss <= riskUsd + 1e-6) {
      break;
    }
    steps -= 1;
    lot2 = Number((steps * pair.lotStep).toFixed(pair.lotDecimals));
  }

  // Edge Case 2: งบเสี่ยงที่เหลือไม่พอเปิดขั้นต่ำของไม้ที่ 2
  if (lot2 < pair.minLot) {
    const minLotCost = (loss1 / pair.firstLot) * pair.minLot;
    return {
      ...baseIdle,
      status: 'BELOW_MIN_LOT',
      loss1,
      totalLoss: loss1,
      unusedRisk: remainingRisk,
      message: `งบคงเหลือ $${remainingRisk.toFixed(2)} ไม่พอเปิดขั้นต่ำ ${formatLot(
        pair.minLot,
        pair
      )} ${unit} (ต้องใช้ $${minLotCost.toFixed(2)})`,
    };
  }

  // Edge Case 3: ป้องกันกรณีพิมพ์จุดทศนิยมผิดจนขนาดไม้สูงเกินขีดจำกัดโบรกเกอร์
  let warning = '';
  if (lot2 > pair.maxLot) {
    lot2 = pair.maxLot;
    warning = `จำกัดสูงสุดที่ ${formatLot(pair.maxLot, pair)} ${unit} — กรุณาตรวจสอบตัวเลข SL อีกครั้ง`;
  }

  const loss2 = (lot2 / pair.firstLot) * loss1;
  const totalLot = Number((pair.firstLot + lot2).toFixed(pair.lotDecimals));
  const totalLoss = loss1 + loss2;
  const unusedRisk = Math.max(0, riskUsd - totalLoss);

  return {
    status: 'OK',
    pair,
    loss1,
    loss2,
    lot2,
    totalLot,
    totalLoss,
    unusedRisk,
    pointValuePerFullLot,
    pipValuePerFullLot,
    message: '',
    warning,
  };
}

/**
 * จัดการการกดปุ่มบน Financial Numpad (รองรับทั้ง USD decimal และ Points integer)
 */
export function appendNumpadKey(current: string, key: string, mode: InputMode): string {
  if (key === 'CLEAR') return '';
  if (key === 'DEL') return current.slice(0, -1);

  if (key === '.') {
    if (mode === 'PTS') return current; // MT5 Points เป็นจำนวนเต็ม ป้องกันกดพลาด
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }

  if (/^[0-9]$/.test(key)) {
    if (current.length >= 8) return current;
    if (current === '0' && key === '0') return current;
    if (current === '0' && key !== '0') return key;
    if (current.includes('.')) {
      const decimals = current.split('.')[1] ?? '';
      if (decimals.length >= 3) return current;
    }
    return `${current}${key}`;
  }

  return current;
}

/**
 * กรองข้อความ R:R Ratio ให้พิมพ์ได้เฉพาะตัวเลข, จุดทศนิยม (1 จุดต่อฝั่ง), และเครื่องหมาย : (1 ตัว)
 */
export function sanitizeRrInput(raw: string): string {
  const onlyAllowed = raw.replace(/[^0-9.:]/g, '').slice(0, 7);
  const colonIdx = onlyAllowed.indexOf(':');
  if (colonIdx === -1) {
    return onlyAllowed.replace(/(\..*)\./g, '$1');
  }
  const left = onlyAllowed.slice(0, colonIdx).replace(/(\..*)\./g, '$1');
  const right = onlyAllowed
    .slice(colonIdx + 1)
    .replace(/:/g, '')
    .replace(/(\..*)\./g, '$1');
  return `${left}:${right}`;
}

/**
 * ตรวจสอบความถูกต้องของรหัส PIN 4 หลัก
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export interface ProjectedTakeProfit {
  ratio: number;
  formattedRatio: string;
  secondOrderProfitUsd: number;
  combinedProfitUsd: number;
  maxRiskProfitUsd: number;
}

/**
 * แปลงค่า R:R ที่ผู้ใช้กรอก รองรับทั้งรูปแบบ "1:2", "1:3", "2:5" และตัวเลขเดี่ยว "2", "1.5"
 */
export function parseRrRatio(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return null;
    const left = parts[0].trim();
    const right = parts[1].trim();
    if (!/^\d+(\.\d+)?$/.test(left) || !/^\d+(\.\d+)?$/.test(right)) {
      return null;
    }
    const riskPart = Number.parseFloat(left);
    const rewardPart = Number.parseFloat(right);
    if (!Number.isFinite(riskPart) || !Number.isFinite(rewardPart) || riskPart <= 0 || rewardPart <= 0) {
      return null;
    }
    const ratio = rewardPart / riskPart;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const ratio = Number.parseFloat(trimmed);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function formatRrRatioLabel(ratio: number): string {
  const rounded = Number(ratio.toFixed(2));
  return `1:${rounded}`;
}

/**
 * คำนวณกำไรคาดการณ์ (Projected Take Profit ในหน่วย USD)
 */
export function calculateProjectedTakeProfit(
  result: CalculationResult,
  rrRatioInput: string,
  riskUsd?: number
): ProjectedTakeProfit | null {
  const ratio = parseRrRatio(rrRatioInput);
  if (ratio === null) return null;

  if (result.status !== 'OK' || result.lot2 <= 0 || result.loss2 <= 0) {
    return null;
  }

  const effectiveRisk =
    typeof riskUsd === 'number' && Number.isFinite(riskUsd) && riskUsd > 0
      ? riskUsd
      : result.totalLoss + result.unusedRisk;

  const secondOrderProfitUsd = result.loss2 * ratio;
  const combinedProfitUsd = result.totalLoss * ratio;
  const maxRiskProfitUsd = effectiveRisk * ratio;

  if (!Number.isFinite(secondOrderProfitUsd) || !Number.isFinite(combinedProfitUsd)) {
    return null;
  }

  return {
    ratio,
    formattedRatio: formatRrRatioLabel(ratio),
    secondOrderProfitUsd,
    combinedProfitUsd,
    maxRiskProfitUsd,
  };
}
