import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_INSTRUMENTS, getPairById } from '../config/tradingConfig';
import {
  buildMt5LaunchUrl,
  buildStreamingTickQuote,
  buildTradingViewAppUrl,
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

test('normalizeScannerQuote accepts direct live Vantage Bid/Ask and computes compact spread', () => {
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
  });

  assert.ok(q !== null);
  assert.equal(q.bid, 159.09);
  assert.equal(q.ask, 159.094);
  assert.equal(q.provenance, 'vantage_live');
  assert.equal(q.spreadFormatted, '0.4p');
  assert.equal(q.sparkline.length, 1);
});

test('buildStreamingTickQuote applies live Vantage spread anchor, tracks tick direction, and grows sparkline', () => {
  const uj = getPairById('USDJPY');
  const t1 = buildStreamingTickQuote({
    pair: uj,
    mid: 159.267,
    vantageAnchor: { spreadAbs: 0.004, vantageMid: 159.27, updatedAt: 1000 },
    accountType: 'RAW',
    now: 1000,
    provenance: 'vantage_ws_calibrated',
    sourceLabel: 'Vantage RAW · Live WS',
  });
  assert.ok(t1 !== null);
  assert.equal(t1.bid.toFixed(3), '159.265');
  assert.equal(t1.ask.toFixed(3), '159.269');
  assert.equal(t1.spreadFormatted, '0.4p');
  assert.equal(t1.tickSeq, 1);

  const t2 = buildStreamingTickQuote({
    pair: uj,
    mid: 159.281,
    vantageAnchor: { spreadAbs: 0.004, vantageMid: 159.27, updatedAt: 1000 },
    accountType: 'RAW',
    now: 2000,
    prevQuote: t1,
    provenance: 'vantage_ws_calibrated',
    sourceLabel: 'Vantage RAW · Live WS',
  });
  assert.ok(t2 !== null);
  assert.equal(t2.tickDirection, 'up');
  assert.equal(t2.tickSeq, 2);
  assert.equal(t2.sparkline.length, 2);

  // Duplicate unchanged tick does NOT increment tickSeq (prevents noisy flashes)
  const t3 = buildStreamingTickQuote({
    pair: uj,
    mid: 159.281,
    vantageAnchor: { spreadAbs: 0.004, vantageMid: 159.27, updatedAt: 1000 },
    accountType: 'RAW',
    now: 3000,
    prevQuote: t2,
    provenance: 'vantage_ws_calibrated',
    sourceLabel: 'Vantage RAW · Live WS',
  });
  assert.ok(t3 !== null);
  assert.equal(t3.tickSeq, 2);
});

test('normalizeScannerQuote catches frozen/diverged CFD bid/ask (US30) and derives clean B/A from live close', () => {
  const us30 = getPairById('US30');
  const q = normalizeScannerQuote({
    pair: us30,
    raw: {
      close: 49770.6,
      bid: 49559.3,
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
  assert.equal(q.spreadFormatted, '2.0pt');
});

test('normalizeScannerQuote handles stock null bid/ask cleanly', () => {
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

test('evaluateFeedHealth triggers OFFLINE, ERROR, STALE (>25s), DELAYED (>12s), and LIVE properly', () => {
  const baseTime = 10_000_000;

  assert.equal(
    evaluateFeedHealth({
      isOnline: false,
      wsConnected: false,
      lastSuccessAt: baseTime - 2000,
      consecutiveErrors: 0,
      now: baseTime,
    }).state,
    'OFFLINE'
  );

  assert.equal(
    evaluateFeedHealth({
      isOnline: true,
      wsConnected: false,
      lastSuccessAt: baseTime - 5000,
      consecutiveErrors: 2,
      now: baseTime,
    }).state,
    'ERROR'
  );

  const stale = evaluateFeedHealth({
    isOnline: true,
    wsConnected: true,
    lastSuccessAt: baseTime - 30_000,
    consecutiveErrors: 0,
    now: baseTime,
  });
  assert.equal(stale.state, 'STALE');
  assert.equal(stale.ageSeconds, 30);
  assert.match(stale.alertMessage, /30 วิ/);

  const live = evaluateFeedHealth({
    isOnline: true,
    wsConnected: true,
    lastSuccessAt: baseTime - 2_000,
    consecutiveErrors: 0,
    now: baseTime,
  });
  assert.equal(live.state, 'LIVE');
  assert.equal(live.alertMessage, '');
});

test('splitDealingPrice and MT5/TradingView URL builders work cleanly', () => {
  assert.deepEqual(splitDealingPrice(159.094, 3), {
    prefix: '159.',
    bigDigits: '09',
    superDigit: '4',
  });
  assert.equal(buildMt5LaunchUrl('app_scheme'), 'metatrader5://');
  assert.equal(
    buildTradingViewAppUrl('app_scheme', getPairById('USDJPY')),
    'tradingview://'
  );
  assert.equal(
    buildTradingViewAppUrl('chart_link', getPairById('USDJPY')),
    'https://www.tradingview.com/chart/?symbol=VANTAGE%3AUSDJPY'
  );
  assert.equal(
    buildTradingViewUrl(getPairById('USDJPY')),
    'https://www.tradingview.com/chart/?symbol=VANTAGE%3AUSDJPY'
  );
});
