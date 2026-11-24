import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_INSTRUMENTS, getPairById } from '../config/tradingConfig';
import {
  buildMt5LaunchUrl,
  buildTradingViewUrl,
  evaluateFeedHealth,
  normalizeScannerQuote,
  resolveFeedTicker,
  splitDealingPrice,
} from './quoteParser';

test('resolveFeedTicker switches between Vantage RAW and Vantage Standard (.TV) feeds', () => {
  const uj = getPairById('USDJPY');
  assert.equal(resolveFeedTicker(uj, 'RAW'), 'VANTAGE:USDJPY');
  assert.equal(resolveFeedTicker(uj, 'STD'), 'VANTAGE:USDJPY.TV');
});

test('normalizeScannerQuote accepts direct live Vantage Bid/Ask and computes spread in pips', () => {
  const uj = getPairById('USDJPY');
  const q = normalizeScannerQuote({
    pair: uj,
    raw: {
      close: 159.092,
      bid: 159.09,
      ask: 159.094,
      change: 0.08,
      change_abs: 0.12,
      update_mode: 'streaming',
    },
    accountType: 'RAW',
    now: 1_000_000,
    prevMid: 159.08,
  });

  assert.ok(q !== null);
  assert.equal(q.bid, 159.09);
  assert.equal(q.ask, 159.094);
  assert.equal(q.provenance, 'vantage_live');
  assert.equal(q.sourceLabel, 'Vantage RAW Live');
  assert.equal(q.spreadFormatted, '0.4 pip');
  assert.equal(q.tickDirection, 'up');
});

test('normalizeScannerQuote catches frozen/diverged CFD bid/ask (like US30) and derives clean B/A from live close', () => {
  const us30 = getPairById('US30');
  const q = normalizeScannerQuote({
    pair: us30,
    raw: {
      close: 49770.6,
      bid: 49559.3, // frozen > 200 points away (> 0.15%)
      ask: 49563.8,
      change: -0.07,
      update_mode: 'streaming',
    },
    accountType: 'RAW',
    now: 1_000_000,
  });

  assert.ok(q !== null);
  assert.equal(q.provenance, 'live_derived');
  assert.equal(q.mid.toFixed(1), '49770.6');
  assert.equal(q.bid.toFixed(1), '49769.6');
  assert.equal(q.ask.toFixed(1), '49771.6');
  assert.equal(q.spreadFormatted, '2.0 pts');
});

test('normalizeScannerQuote catches inverted bid/ask (ask < bid) and stock null bid/ask cleanly', () => {
  const nvda = PRESET_INSTRUMENTS.find((p) => p.id === 'NVDA')!;
  const q = normalizeScannerQuote({
    pair: nvda,
    raw: {
      close: 151.88,
      bid: null,
      ask: null,
      change: -2.1,
      update_mode: 'delayed_streaming_900',
    },
    accountType: 'RAW',
    now: 1_000_000,
  });

  assert.ok(q !== null);
  assert.equal(q.provenance, 'delayed_derived');
  assert.equal(q.bid.toFixed(2), '151.86');
  assert.equal(q.ask.toFixed(2), '151.90');
  assert.equal(q.spreadFormatted, '$0.04');
});

test('evaluateFeedHealth triggers OFFLINE, ERROR, STALE (>30s), DELAYED (>18s), and LIVE properly', () => {
  const baseTime = 10_000_000;

  assert.equal(
    evaluateFeedHealth({
      isOnline: false,
      lastSuccessAt: baseTime - 2000,
      consecutiveErrors: 0,
      now: baseTime,
    }).state,
    'OFFLINE'
  );

  assert.equal(
    evaluateFeedHealth({
      isOnline: true,
      lastSuccessAt: baseTime - 5000,
      consecutiveErrors: 2,
      now: baseTime,
    }).state,
    'ERROR'
  );

  const stale = evaluateFeedHealth({
    isOnline: true,
    lastSuccessAt: baseTime - 35_000,
    consecutiveErrors: 0,
    now: baseTime,
  });
  assert.equal(stale.state, 'STALE');
  assert.equal(stale.ageSeconds, 35);
  assert.match(stale.alertMessage, /ไม่อัปเดตมาแล้ว 35 วินาที/);

  const live = evaluateFeedHealth({
    isOnline: true,
    lastSuccessAt: baseTime - 3_000,
    consecutiveErrors: 0,
    now: baseTime,
  });
  assert.equal(live.state, 'LIVE');
  assert.equal(live.alertMessage, '');
});

test('splitDealingPrice formats FX 3/5-digit and stock prices like MT5 dealing desk', () => {
  assert.deepEqual(splitDealingPrice(159.094, 3), {
    prefix: '159.',
    bigDigits: '09',
    superDigit: '4',
  });
  assert.deepEqual(splitDealingPrice(1.31158, 5), {
    prefix: '1.31',
    bigDigits: '15',
    superDigit: '8',
  });
  assert.deepEqual(splitDealingPrice(151.88, 2), {
    prefix: '151.',
    bigDigits: '88',
    superDigit: '',
  });
});

test('MT5 and TradingView deep link builders output valid iOS URLs', () => {
  assert.equal(buildMt5LaunchUrl('app_scheme'), 'metatrader5://');
  assert.match(buildMt5LaunchUrl('universal'), /VantageInternational-Live/);
  assert.equal(buildMt5LaunchUrl('web_terminal'), 'https://web.metatrader.app/terminal');

  const uj = getPairById('USDJPY');
  assert.equal(
    buildTradingViewUrl(uj),
    'https://www.tradingview.com/chart/?symbol=VANTAGE%3AUSDJPY'
  );
  const nvda = PRESET_INSTRUMENTS.find((p) => p.id === 'NVDA')!;
  assert.equal(
    buildTradingViewUrl(nvda),
    'https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA'
  );
});
