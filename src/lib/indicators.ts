import type {
  BollingerPoint,
  Candle,
  MACDPoint,
  SignalBias,
  TechnicalSnapshot,
} from './types';

export function computeEMA(values: number[], period: number): (number | null)[] {
  if (values.length === 0 || period <= 0) return [];
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let ema = sum / period;
  result[period - 1] = ema;

  const multiplier = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    result[i] = ema;
  }

  return result;
}

export function computeRSI(closes: number[], period = 14): (number | null)[] {
  if (closes.length === 0) return [];
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const calcRsi = (g: number, l: number) => {
    if (l === 0 && g === 0) return 50;
    if (l === 0) return 100;
    const rs = g / l;
    return 100 - 100 / (1 + rs);
  };

  result[period] = calcRsi(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = calcRsi(avgGain, avgLoss);
  }

  return result;
}

export function computeMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDPoint[] {
  if (closes.length === 0) return [];
  const fastEma = computeEMA(closes, fastPeriod);
  const slowEma = computeEMA(closes, slowPeriod);

  const macdLine: (number | null)[] = closes.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });

  const validMacdValues: number[] = [];
  const validIndices: number[] = [];
  macdLine.forEach((val, idx) => {
    if (val !== null) {
      validMacdValues.push(val);
      validIndices.push(idx);
    }
  });

  const signalOnValid = computeEMA(validMacdValues, signalPeriod);
  const signalLine: (number | null)[] = new Array(closes.length).fill(null);
  validIndices.forEach((origIdx, vIdx) => {
    signalLine[origIdx] = signalOnValid[vIdx] ?? null;
  });

  return closes.map((_, i) => {
    const macd = macdLine[i];
    const signal = signalLine[i];
    const histogram = macd !== null && signal !== null ? macd - signal : null;
    return { macd, signal, histogram };
  });
}

export function computeBollingerBands(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2
): BollingerPoint[] {
  if (closes.length === 0) return [];
  return closes.map((_, i) => {
    if (i < period - 1) {
      return { upper: null, middle: null, lower: null };
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((acc, v) => acc + v, 0) / period;
    const variance =
      slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    return {
      upper: mean + stdDevMultiplier * std,
      middle: mean,
      lower: mean - stdDevMultiplier * std,
    };
  });
}

export function computeATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) {
    return candles[0] ? Math.max(candles[0].high - candles[0].low, 0.0001) : 0;
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prevClose),
      Math.abs(curr.low - prevClose)
    );
    trueRanges.push(tr);
  }

  const slice = trueRanges.slice(-period);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function computePivotLevels(candles: Candle[]): {
  support: [number, number];
  resistance: [number, number];
} {
  if (candles.length === 0) {
    return { support: [0, 0], resistance: [0, 0] };
  }
  const window = candles.slice(-24);
  const high = Math.max(...window.map((c) => c.high));
  const low = Math.min(...window.map((c) => c.low));
  const close = window[window.length - 1].close;
  const pivot = (high + low + close) / 3;

  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);

  return {
    support: [Number(s1.toFixed(4)), Number(s2.toFixed(4))],
    resistance: [Number(r1.toFixed(4)), Number(r2.toFixed(4))],
  };
}

export function computeTechnicalSnapshot(candles: Candle[]): TechnicalSnapshot {
  if (candles.length === 0) {
    return {
      ema20: [],
      ema50: [],
      rsi14: [],
      macd: [],
      bollinger: [],
      atr14: 0,
      latestPrice: 0,
      priceChangePct: 0,
      latestRsi: 50,
      latestMacdHistogram: 0,
      emaTrend: 'Neutral',
      bollingerPosition: 'Middle Band',
      supportLevels: [0, 0],
      resistanceLevels: [0, 0],
      technicalScore: 0,
      technicalBias: 'Neutral',
    };
  }

  const closes = candles.map((c) => c.close);
  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const rsi14 = computeRSI(closes, 14);
  const macd = computeMACD(closes);
  const bollinger = computeBollingerBands(closes, 20, 2);
  const atr14 = computeATR(candles, 14);
  const pivots = computePivotLevels(candles);

  const lastIdx = candles.length - 1;
  const lookbackIdx = Math.max(0, lastIdx - 24);
  const latestPrice = closes[lastIdx];
  const basePrice = closes[lookbackIdx] || latestPrice;
  const priceChangePct =
    basePrice > 0 ? ((latestPrice - basePrice) / basePrice) * 100 : 0;

  const latestRsi = rsi14[lastIdx] ?? 50;
  const latestMacdHistogram = macd[lastIdx]?.histogram ?? 0;
  const latestEma20 = ema20[lastIdx] ?? latestPrice;
  const latestEma50 = ema50[lastIdx] ?? latestPrice;
  const latestBb = bollinger[lastIdx];

  let emaTrend: SignalBias = 'Neutral';
  if (latestPrice > latestEma20 && latestEma20 >= latestEma50 * 0.999) {
    emaTrend = 'Bullish';
  } else if (latestPrice < latestEma20 && latestEma20 <= latestEma50 * 1.001) {
    emaTrend = 'Bearish';
  }

  let bollingerPosition: 'Upper Band' | 'Middle Band' | 'Lower Band' =
    'Middle Band';
  if (latestBb && latestBb.upper !== null && latestBb.lower !== null) {
    const range = latestBb.upper - latestBb.lower;
    if (range > 0) {
      const pct = (latestPrice - latestBb.lower) / range;
      if (pct >= 0.72) bollingerPosition = 'Upper Band';
      else if (pct <= 0.28) bollingerPosition = 'Lower Band';
    }
  }

  // Deterministic composite technical score (-100 to +100)
  let score = 0;
  if (emaTrend === 'Bullish') score += 32;
  else if (emaTrend === 'Bearish') score -= 32;

  if (latestRsi < 32) score += 28; // Oversold mean-reversion upside
  else if (latestRsi > 70) score -= 24; // Overbought exhaustion risk
  else if (latestRsi >= 52 && latestRsi <= 66) score += 18; // Healthy momentum
  else if (latestRsi <= 46 && latestRsi >= 35) score -= 18;

  if (latestMacdHistogram > 0) score += 22;
  else if (latestMacdHistogram < 0) score -= 22;

  if (priceChangePct > 1.5) score += 12;
  else if (priceChangePct < -1.5) score -= 12;

  score = Math.max(-100, Math.min(100, Math.round(score)));

  let technicalBias: SignalBias = 'Neutral';
  if (score >= 18) technicalBias = 'Bullish';
  else if (score <= -18) technicalBias = 'Bearish';

  return {
    ema20,
    ema50,
    rsi14,
    macd,
    bollinger,
    atr14,
    latestPrice,
    priceChangePct,
    latestRsi: Number(latestRsi.toFixed(2)),
    latestMacdHistogram: Number(latestMacdHistogram.toFixed(4)),
    emaTrend,
    bollingerPosition,
    supportLevels: pivots.support,
    resistanceLevels: pivots.resistance,
    technicalScore: score,
    technicalBias,
  };
}
