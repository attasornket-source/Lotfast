import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_CONFIG,
  PRESET_INSTRUMENTS,
  buildCustomPairSpec,
  getPairById,
} from '../config/tradingConfig';
import {
  appendNumpadKey,
  calculateProjectedTakeProfit,
  calculateSecondOrder,
  formatLot,
  getPipValuePerFullLot,
  getPointValuePerFullLot,
  isValidPin,
  parseRrRatio,
  sanitizeRrInput,
  type LiveRates,
} from './calculator';

const SAMPLE_RATES: LiveRates = {
  USDJPY: 154.0,
  GBPUSD: 1.27,
  GBPJPY: 195.58,
  USDTHB: 34.0,
};

test('USDJPY USD Loss mode calculates safe floored 2nd lot (0.74 USD -> 0.39 Lot)', () => {
  const pair = getPairById('USDJPY');
  const res = calculateSecondOrder({
    pair,
    riskUsd: 30,
    mode: 'USD',
    inputStr: '0.74',
    rates: SAMPLE_RATES,
  });

  assert.equal(res.status, 'OK');
  assert.equal(res.lot2, 0.39);
  assert.equal(res.totalLot, 0.4);
  assert.ok(res.totalLoss <= 30.000001);
  assert.equal(res.totalLoss.toFixed(2), '29.60');
  assert.equal(formatLot(res.lot2, pair), '0.39');
});

test('Exact boundary risk (1.00 USD loss on 0.01 lot with $30 risk) yields 0.29 lot without float drift', () => {
  const pair = getPairById('GBPUSD');
  const res = calculateSecondOrder({
    pair,
    riskUsd: 30,
    mode: 'USD',
    inputStr: '1.00',
    rates: SAMPLE_RATES,
  });

  assert.equal(res.status, 'OK');
  assert.equal(res.lot2, 0.29);
  assert.equal(res.totalLot, 0.3);
  assert.equal(res.totalLoss.toFixed(2), '30.00');
});

test('US30 (Vantage DJ30) locks 1st lot to 0.1 and floors 2nd lot to 0.1 step', () => {
  const pair = getPairById('US30');
  assert.equal(pair.firstLot, 0.1);
  assert.equal(pair.lotStep, 0.1);

  const res = calculateSecondOrder({
    pair,
    riskUsd: 30,
    mode: 'USD',
    inputStr: '4.5',
    rates: SAMPLE_RATES,
  });

  assert.equal(res.status, 'OK');
  assert.equal(res.lot2, 0.5);
  assert.equal(res.totalLot, 0.6);
  assert.equal(res.totalLoss.toFixed(2), '27.00');
  assert.equal(formatLot(res.lot2, pair), '0.5');
});

test('Custom US Stock (NVDA) calculates integer 2nd-order shares/lots accurately in USD and Points modes', () => {
  const nvda = PRESET_INSTRUMENTS.find((p) => p.id === 'NVDA')!;
  assert.equal(nvda.lotDecimals, 0);

  // USD Loss mode: 1st order (1 share/lot) risks $2.50 -> $30 budget allows 11 more shares (total 12 * $2.50 = $30)
  const usdRes = calculateSecondOrder({
    pair: nvda,
    riskUsd: 30,
    mode: 'USD',
    inputStr: '2.5',
    rates: SAMPLE_RATES,
  });
  assert.equal(usdRes.status, 'OK');
  assert.equal(usdRes.lot2, 11);
  assert.equal(usdRes.totalLot, 12);
  assert.equal(usdRes.totalLoss.toFixed(2), '30.00');
  assert.equal(formatLot(usdRes.lot2, nvda), '11');

  // Points mode: 320 cents ($3.20) SL on 1 share -> 8 more shares ($25.60 + $3.20 = $28.80 <= $30)
  const ptsRes = calculateSecondOrder({
    pair: nvda,
    riskUsd: 30,
    mode: 'PTS',
    inputStr: '320',
    rates: SAMPLE_RATES,
  });
  assert.equal(ptsRes.status, 'OK');
  assert.equal(ptsRes.loss1.toFixed(2), '3.20');
  assert.equal(ptsRes.lot2, 8);
  assert.equal(ptsRes.totalLoss.toFixed(2), '28.80');
});

test('Thai Stock (SET:DELTA) converts THB tick risk to USD via live USDTHB rate', () => {
  const delta = PRESET_INSTRUMENTS.find((p) => p.id === 'SET_DELTA')!;
  // 4 ticks = 1 THB per share -> 100 shares = 100 THB / 34.0 USDTHB = $2.941176...
  const res = calculateSecondOrder({
    pair: delta,
    riskUsd: 30,
    mode: 'PTS',
    inputStr: '4',
    rates: SAMPLE_RATES,
  });
  assert.equal(res.status, 'OK');
  assert.equal(res.lot2, 900);
  assert.equal(res.totalLot, 1000);
  assert.ok(res.totalLoss <= 30.000001);
});

test('Gold (XAUUSD) calculates exact contractSize=100, pointSize=0.01 pip values', () => {
  const gold = PRESET_INSTRUMENTS.find((p) => p.id === 'XAUUSD')!;
  // 1 MT5 point ($0.01 move) on 1 lot (100 oz) = $1.00
  assert.equal(getPointValuePerFullLot(gold, SAMPLE_RATES), 1);
  // 350 MT5 points ($3.50 gold move) on 0.01 lot = $3.50 loss1 -> 0.07 lot2 (total 0.08 * $3.50/0.01 = $28.00)
  const res = calculateSecondOrder({
    pair: gold,
    riskUsd: 30,
    mode: 'PTS',
    inputStr: '350',
    rates: SAMPLE_RATES,
  });
  assert.equal(res.status, 'OK');
  assert.equal(res.loss1.toFixed(2), '3.50');
  assert.equal(res.lot2, 0.07);
  assert.equal(res.totalLoss.toFixed(2), '28.00');
});

test('buildCustomPairSpec builds clean stock and forex specs with auto exchange defaults', () => {
  const pltr = buildCustomPairSpec({
    symbol: 'PLTR',
    category: 'stock',
    quoteType: 'STOCK_USD',
    firstLot: 1,
    minLot: 1,
    lotStep: 1,
    contractSize: 1,
    pointSize: 0.01,
    typicalSpreadPoints: 4,
  });
  assert.equal(pltr.id, 'CUSTOM_PLTR');
  assert.equal(pltr.tvSymbol, 'NASDAQ:PLTR');
  assert.equal(pltr.lotDecimals, 0);

  const dis = buildCustomPairSpec({
    symbol: 'NYSE:DIS',
    category: 'stock',
    quoteType: 'STOCK_USD',
    firstLot: 1,
    minLot: 1,
    lotStep: 1,
    contractSize: 1,
    pointSize: 0.01,
    typicalSpreadPoints: 4,
  });
  assert.equal(dis.tvSymbol, 'NYSE:DIS');
  assert.equal(dis.label, 'DIS');
});

test('Edge cases: OVER_RISK, BELOW_MIN_LOT, IDLE, and Max Lot clamp all work safely', () => {
  const gj = getPairById('GBPJPY');
  const over = calculateSecondOrder({
    pair: gj,
    riskUsd: 30,
    mode: 'USD',
    inputStr: '32.5',
    rates: SAMPLE_RATES,
  });
  assert.equal(over.status, 'OVER_RISK');
  assert.equal(over.lot2, 0);

  const us30 = getPairById('US30');
  const below = calculateSecondOrder({
    pair: us30,
    riskUsd: 30,
    mode: 'USD',
    inputStr: '18',
    rates: SAMPLE_RATES,
  });
  assert.equal(below.status, 'BELOW_MIN_LOT');
  assert.equal(below.lot2, 0);

  for (const val of ['', '0', '0.', '.', 'abc', '-5']) {
    const idle = calculateSecondOrder({
      pair: gj,
      riskUsd: 30,
      mode: 'USD',
      inputStr: val,
      rates: SAMPLE_RATES,
    });
    assert.equal(idle.status, 'IDLE');
  }

  const tiny = calculateSecondOrder({
    pair: gj,
    riskUsd: 30,
    mode: 'USD',
    inputStr: '0.001',
    rates: SAMPLE_RATES,
  });
  assert.equal(tiny.status, 'OK');
  assert.equal(tiny.lot2, gj.maxLot);
  assert.ok(tiny.warning.length > 0);
});

test('Points mode uses real-time USDJPY rate for JPY pairs and exact Vantage specs for US30 & GU', () => {
  const gu = getPairById('GBPUSD');
  const uj = getPairById('USDJPY');
  const us30 = getPairById('US30');

  assert.equal(getPointValuePerFullLot(gu, SAMPLE_RATES), 1);
  assert.equal(getPipValuePerFullLot(gu, SAMPLE_RATES), 10);

  const ujPv = getPointValuePerFullLot(uj, SAMPLE_RATES);
  assert.ok(Math.abs(ujPv - 100 / 154) < 1e-9);

  const ujRes = calculateSecondOrder({
    pair: uj,
    riskUsd: 30,
    mode: 'PTS',
    inputStr: '150',
    rates: SAMPLE_RATES,
  });
  assert.equal(ujRes.status, 'OK');
  assert.equal(ujRes.lot2, 0.29);
  assert.ok(ujRes.totalLoss <= 30.000001);

  const us30Res = calculateSecondOrder({
    pair: us30,
    riskUsd: 30,
    mode: 'PTS',
    inputStr: '4500',
    rates: SAMPLE_RATES,
  });
  assert.equal(us30Res.status, 'OK');
  assert.equal(us30Res.loss1.toFixed(2), '4.50');
  assert.equal(us30Res.lot2, 0.5);
});

test('Numpad helper, R:R sanitizer, PIN 0808, and v2.1.0 version', () => {
  let s = '';
  s = appendNumpadKey(s, '.', 'USD');
  s = appendNumpadKey(s, '7', 'USD');
  s = appendNumpadKey(s, '4', 'USD');
  s = appendNumpadKey(s, '.', 'USD');
  assert.equal(s, '0.74');
  assert.equal(appendNumpadKey('12', '.', 'PTS'), '12');

  assert.equal(sanitizeRrInput('1:2.5.3'), '1:2.53');
  assert.equal(sanitizeRrInput('1::3'), '1:3');

  assert.equal(isValidPin('0808'), true);
  assert.equal(isValidPin('12a4'), false);
  assert.equal(APP_CONFIG.DEFAULT_PIN, '0808');
  assert.equal(APP_CONFIG.VERSION, 'v2.1.0');
});

test('parseRrRatio and Projected Take-Profit calculate 2nd-order, combined, and max-risk TP', () => {
  assert.equal(parseRrRatio('1:2'), 2);
  assert.equal(parseRrRatio('1:1.5'), 1.5);
  assert.equal(parseRrRatio('2:5'), 2.5);
  assert.equal(parseRrRatio('1:0'), null);
  assert.equal(parseRrRatio('1:2.3.4'), null);

  const ujRes = calculateSecondOrder({
    pair: getPairById('USDJPY'),
    riskUsd: 30,
    mode: 'USD',
    inputStr: '0.74',
    rates: SAMPLE_RATES,
  });
  const tp2 = calculateProjectedTakeProfit(ujRes, '1:2', 30);
  assert.ok(tp2 !== null);
  assert.equal(tp2.secondOrderProfitUsd.toFixed(2), '57.72');
  assert.equal(tp2.combinedProfitUsd.toFixed(2), '59.20');
  assert.equal(tp2.maxRiskProfitUsd.toFixed(2), '60.00');
});
