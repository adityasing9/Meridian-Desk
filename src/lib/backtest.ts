import { computeATR, computeEMA, computeRSI } from './indicators';
import type {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  Candle,
  PositionSizeInput,
  PositionSizeResult,
} from './types';

export function calculatePositionSize(
  input: PositionSizeInput
): PositionSizeResult {
  const { accountEquity, riskPercent, entryPrice, stopLoss, targetPrice } =
    input;

  if (
    accountEquity <= 0 ||
    riskPercent <= 0 ||
    entryPrice <= 0 ||
    stopLoss <= 0 ||
    entryPrice === stopLoss
  ) {
    return {
      valid: false,
      riskUsd: 0,
      stopDistancePct: 0,
      positionUnits: 0,
      positionNotionalUsd: 0,
      projectedProfitUsd: 0,
      riskRewardRatio: 0,
    };
  }

  const riskUsd = accountEquity * (riskPercent / 100);
  const priceRiskPerUnit = Math.abs(entryPrice - stopLoss);
  const stopDistancePct = (priceRiskPerUnit / entryPrice) * 100;
  const positionUnits = riskUsd / priceRiskPerUnit;
  const positionNotionalUsd = positionUnits * entryPrice;

  const rewardPerUnit = Math.abs(targetPrice - entryPrice);
  const projectedProfitUsd = positionUnits * rewardPerUnit;
  const riskRewardRatio =
    priceRiskPerUnit > 0 ? rewardPerUnit / priceRiskPerUnit : 0;

  return {
    valid: true,
    riskUsd: Number(riskUsd.toFixed(2)),
    stopDistancePct: Number(stopDistancePct.toFixed(2)),
    positionUnits: Number(positionUnits.toFixed(4)),
    positionNotionalUsd: Number(positionNotionalUsd.toFixed(2)),
    projectedProfitUsd: Number(projectedProfitUsd.toFixed(2)),
    riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
  };
}

export function runStrategyBacktest(
  candles: Candle[],
  sentimentSeries: number[],
  config: BacktestConfig
): BacktestResult {
  const initialEquity = 10000;
  if (candles.length < 30) {
    return {
      totalTrades: 0,
      winRatePct: 0,
      profitFactor: 0,
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      finalEquityUsd: initialEquity,
      equityCurve: candles.map((c, idx) => ({
        index: idx,
        timestamp: c.timestamp,
        equity: initialEquity,
      })),
      trades: [],
    };
  }

  const closes = candles.map((c) => c.close);
  const ema20 = computeEMA(closes, 20);
  const rsi14 = computeRSI(closes, 14);
  const atr = Math.max(computeATR(candles, 14), closes[closes.length - 1] * 0.005);

  let equity = initialEquity;
  let peakEquity = initialEquity;
  let maxDrawdownPct = 0;

  let grossProfit = 0;
  let grossLoss = 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: { index: number; timestamp: number; equity: number }[] = [];

  let openTrade: {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    entryTime: number;
    stopLoss: number;
    takeProfit: number;
  } | null = null;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const rsi = rsi14[i];
    const ema = ema20[i];
    const sent = sentimentSeries[i] ?? 50;

    if (openTrade) {
      let exitPrice: number | null = null;
      if (openTrade.side === 'LONG') {
        if (candle.low <= openTrade.stopLoss) exitPrice = openTrade.stopLoss;
        else if (candle.high >= openTrade.takeProfit)
          exitPrice = openTrade.takeProfit;
      } else {
        if (candle.high >= openTrade.stopLoss) exitPrice = openTrade.stopLoss;
        else if (candle.low <= openTrade.takeProfit)
          exitPrice = openTrade.takeProfit;
      }

      if (exitPrice !== null) {
        const rawReturn =
          openTrade.side === 'LONG'
            ? (exitPrice - openTrade.entryPrice) / openTrade.entryPrice
            : (openTrade.entryPrice - exitPrice) / openTrade.entryPrice;

        // Allocate 25% equity position per signal for realistic portfolio drawdown
        const pnlUsd = equity * 0.25 * rawReturn * 2.5;
        equity = Math.max(100, equity + pnlUsd);

        if (pnlUsd >= 0) grossProfit += pnlUsd;
        else grossLoss += Math.abs(pnlUsd);

        trades.push({
          id: trades.length + 1,
          side: openTrade.side,
          entryTime: openTrade.entryTime,
          exitTime: candle.timestamp,
          entryPrice: Number(openTrade.entryPrice.toFixed(4)),
          exitPrice: Number(exitPrice.toFixed(4)),
          returnPct: Number((rawReturn * 100).toFixed(2)),
          pnlUsd: Number(pnlUsd.toFixed(2)),
          outcome: pnlUsd >= 0 ? 'Win' : 'Loss',
        });

        openTrade = null;
      }
    } else if (i >= 20 && rsi !== null && ema !== null) {
      // Combine technical RSI/EMA signal with weighted sentiment bias
      const sentBoost = (sent - 50) * config.sentimentWeight;
      const stopDist = atr * config.stopAtrMultiplier;

      const longMeanReversion = rsi <= config.rsiOversold + 6 && sentBoost >= -6;
      const longMomentum =
        candle.close > ema &&
        rsi >= 48 &&
        rsi <= config.rsiOverbought - 6 &&
        sentBoost > 1;

      const shortMeanReversion = rsi >= config.rsiOverbought - 6 && sentBoost <= 6;
      const shortMomentum =
        candle.close < ema &&
        rsi <= 52 &&
        rsi >= config.rsiOversold + 6 &&
        sentBoost < -1;

      if (longMeanReversion || longMomentum) {
        openTrade = {
          side: 'LONG',
          entryPrice: candle.close,
          entryTime: candle.timestamp,
          stopLoss: candle.close - stopDist,
          takeProfit: candle.close + stopDist * config.takeProfitR,
        };
      } else if (shortMeanReversion || shortMomentum) {
        openTrade = {
          side: 'SHORT',
          entryPrice: candle.close,
          entryTime: candle.timestamp,
          stopLoss: candle.close + stopDist,
          takeProfit: candle.close - stopDist * config.takeProfitR,
        };
      }
    }

    if (equity > peakEquity) peakEquity = equity;
    const dd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;

    equityCurve.push({
      index: i,
      timestamp: candle.timestamp,
      equity: Number(equity.toFixed(2)),
    });
  }

  const wins = trades.filter((t) => t.outcome === 'Win').length;
  const winRatePct =
    trades.length > 0 ? Number(((wins / trades.length) * 100).toFixed(1)) : 0;
  const profitFactor =
    grossLoss > 0
      ? Number((grossProfit / grossLoss).toFixed(2))
      : grossProfit > 0
      ? 3.5
      : 0;
  const totalReturnPct = Number(
    (((equity - initialEquity) / initialEquity) * 100).toFixed(2)
  );

  return {
    totalTrades: trades.length,
    winRatePct,
    profitFactor,
    totalReturnPct,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    finalEquityUsd: Number(equity.toFixed(2)),
    equityCurve,
    trades: trades.slice(-15).reverse(),
  };
}
