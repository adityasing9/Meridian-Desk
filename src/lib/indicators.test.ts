import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeATR,
  computeBollingerBands,
  computeEMA,
  computeMACD,
  computeRSI,
  computeTechnicalSnapshot,
} from './indicators';
import type { Candle } from './types';

function makeTrendCandles(count: number, start: number, step: number): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const close = start + i * step;
    const open = close - step * 0.5;
    return {
      timestamp: 1700000000000 + i * 3600000,
      open,
      high: Math.max(open, close) + 2,
      low: Math.min(open, close) - 2,
      close,
      volume: 1000 + i * 10,
    };
  });
}

test('computeEMA handles empty and valid series accurately', () => {
  assert.deepEqual(computeEMA([], 5), []);
  const ema = computeEMA([10, 12, 14, 16, 18], 3);
  assert.equal(ema[0], null);
  assert.equal(ema[1], null);
  assert.equal(ema[2], 12); // SMA of 10, 12, 14
  assert.ok(ema[4]! > 15 && ema[4]! <= 18);
});

test('computeRSI bounds output between 0 and 100 and reflects trends', () => {
  const upCandles = makeTrendCandles(30, 100, 2);
  const upRsi = computeRSI(upCandles.map((c) => c.close), 14);
  assert.equal(upRsi[3], null);
  assert.equal(upRsi[29], 100);

  const downCandles = makeTrendCandles(30, 200, -2);
  const downRsi = computeRSI(downCandles.map((c) => c.close), 14);
  assert.equal(downRsi[29], 0);
});

test('computeMACD and computeBollingerBands return aligned arrays', () => {
  const candles = makeTrendCandles(60, 100, 1.5);
  const closes = candles.map((c) => c.close);
  const macd = computeMACD(closes);
  const bb = computeBollingerBands(closes, 20, 2);

  assert.equal(macd.length, 60);
  assert.equal(bb.length, 60);
  assert.ok(macd[59].macd !== null && macd[59].macd > 0);
  assert.ok(bb[59].upper! > bb[59].middle! && bb[59].middle! > bb[59].lower!);
});

test('computeATR and computeTechnicalSnapshot produce Bullish bias on strong uptrend', () => {
  const candles = makeTrendCandles(70, 500, 5);
  const atr = computeATR(candles, 14);
  assert.ok(atr > 0);

  const snap = computeTechnicalSnapshot(candles);
  assert.equal(snap.emaTrend, 'Bullish');
  assert.equal(snap.technicalBias, 'Bullish');
  assert.ok(snap.resistanceLevels[0] > snap.supportLevels[0]);
});
