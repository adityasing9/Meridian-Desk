import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePositionSize, runStrategyBacktest } from './backtest';
import { generateDeterministicCandles } from './marketData';

test('calculatePositionSize computes exact risk and units', () => {
  const res = calculatePositionSize({
    accountEquity: 10000,
    riskPercent: 2,
    entryPrice: 100,
    stopLoss: 95,
    targetPrice: 115,
  });

  assert.equal(res.valid, true);
  assert.equal(res.riskUsd, 200);
  assert.equal(res.stopDistancePct, 5);
  assert.equal(res.positionUnits, 40);
  assert.equal(res.positionNotionalUsd, 4000);
  assert.equal(res.projectedProfitUsd, 600);
  assert.equal(res.riskRewardRatio, 3);
});

test('calculatePositionSize handles invalid stop loss gracefully', () => {
  const res = calculatePositionSize({
    accountEquity: 10000,
    riskPercent: 2,
    entryPrice: 100,
    stopLoss: 100,
    targetPrice: 115,
  });
  assert.equal(res.valid, false);
});

test('runStrategyBacktest produces valid equity curve and drawdown bounds', () => {
  const candles = generateDeterministicCandles('BTC', '4H', 100);
  const sentiment = candles.map((_, idx) => 45 + Math.sin(idx * 0.3) * 20);
  const result = runStrategyBacktest(candles, sentiment, {
    rsiOversold: 35,
    rsiOverbought: 65,
    sentimentWeight: 0.4,
    stopAtrMultiplier: 1.5,
    takeProfitR: 2.0,
  });

  assert.equal(result.equityCurve.length, candles.length);
  assert.ok(result.totalTrades > 0);
  assert.ok(result.maxDrawdownPct >= 0 && result.maxDrawdownPct <= 100);
  assert.ok(result.finalEquityUsd > 0);
});
