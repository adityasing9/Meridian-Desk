// src/server/app.ts
import "dotenv/config";
import express from "express";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

// src/lib/indicators.ts
function computeEMA(values, period) {
  if (values.length === 0 || period <= 0) return [];
  const result = new Array(values.length).fill(null);
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
function computeRSI(closes, period = 14) {
  if (closes.length === 0) return [];
  const result = new Array(closes.length).fill(null);
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
  const calcRsi = (g, l) => {
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
function computeMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (closes.length === 0) return [];
  const fastEma = computeEMA(closes, fastPeriod);
  const slowEma = computeEMA(closes, slowPeriod);
  const macdLine = closes.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });
  const validMacdValues = [];
  const validIndices = [];
  macdLine.forEach((val, idx) => {
    if (val !== null) {
      validMacdValues.push(val);
      validIndices.push(idx);
    }
  });
  const signalOnValid = computeEMA(validMacdValues, signalPeriod);
  const signalLine = new Array(closes.length).fill(null);
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
function computeBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  if (closes.length === 0) return [];
  return closes.map((_, i) => {
    if (i < period - 1) {
      return { upper: null, middle: null, lower: null };
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((acc, v) => acc + v, 0) / period;
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    return {
      upper: mean + stdDevMultiplier * std,
      middle: mean,
      lower: mean - stdDevMultiplier * std
    };
  });
}
function computeATR(candles, period = 14) {
  if (candles.length < 2) {
    return candles[0] ? Math.max(candles[0].high - candles[0].low, 1e-4) : 0;
  }
  const trueRanges = [];
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
function computePivotLevels(candles) {
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
    resistance: [Number(r1.toFixed(4)), Number(r2.toFixed(4))]
  };
}
function computeTechnicalSnapshot(candles) {
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
      emaTrend: "Neutral",
      bollingerPosition: "Middle Band",
      supportLevels: [0, 0],
      resistanceLevels: [0, 0],
      technicalScore: 0,
      technicalBias: "Neutral"
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
  const priceChangePct = basePrice > 0 ? (latestPrice - basePrice) / basePrice * 100 : 0;
  const latestRsi = rsi14[lastIdx] ?? 50;
  const latestMacdHistogram = macd[lastIdx]?.histogram ?? 0;
  const latestEma20 = ema20[lastIdx] ?? latestPrice;
  const latestEma50 = ema50[lastIdx] ?? latestPrice;
  const latestBb = bollinger[lastIdx];
  let emaTrend = "Neutral";
  if (latestPrice > latestEma20 && latestEma20 >= latestEma50 * 0.999) {
    emaTrend = "Bullish";
  } else if (latestPrice < latestEma20 && latestEma20 <= latestEma50 * 1.001) {
    emaTrend = "Bearish";
  }
  let bollingerPosition = "Middle Band";
  if (latestBb && latestBb.upper !== null && latestBb.lower !== null) {
    const range = latestBb.upper - latestBb.lower;
    if (range > 0) {
      const pct = (latestPrice - latestBb.lower) / range;
      if (pct >= 0.72) bollingerPosition = "Upper Band";
      else if (pct <= 0.28) bollingerPosition = "Lower Band";
    }
  }
  let score = 0;
  if (emaTrend === "Bullish") score += 32;
  else if (emaTrend === "Bearish") score -= 32;
  if (latestRsi < 32) score += 28;
  else if (latestRsi > 70) score -= 24;
  else if (latestRsi >= 52 && latestRsi <= 66) score += 18;
  else if (latestRsi <= 46 && latestRsi >= 35) score -= 18;
  if (latestMacdHistogram > 0) score += 22;
  else if (latestMacdHistogram < 0) score -= 22;
  if (priceChangePct > 1.5) score += 12;
  else if (priceChangePct < -1.5) score -= 12;
  score = Math.max(-100, Math.min(100, Math.round(score)));
  let technicalBias = "Neutral";
  if (score >= 18) technicalBias = "Bullish";
  else if (score <= -18) technicalBias = "Bearish";
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
    technicalBias
  };
}

// src/lib/sentiment.ts
var BULLISH_LEXICON = {
  etf: 18,
  inflow: 22,
  inflows: 22,
  approval: 24,
  approved: 24,
  breakout: 18,
  accumulation: 20,
  institutional: 18,
  surge: 16,
  rally: 18,
  upgrade: 16,
  adoption: 18,
  treasury: 15,
  buyback: 18,
  bullish: 22,
  outflow: 14,
  // exchange outflow implies holding
  partnership: 14,
  record: 12,
  liquidity: 10,
  dovish: 16,
  cut: 10
};
var BEARISH_LEXICON = {
  hack: -32,
  exploit: -30,
  sec: -16,
  lawsuit: -24,
  liquidation: -20,
  liquidations: -20,
  selloff: -22,
  dump: -22,
  ban: -26,
  hawkish: -18,
  crackdown: -24,
  insolvency: -34,
  bankruptcy: -34,
  delay: -14,
  rejected: -24,
  rejection: -24,
  bearish: -22,
  inflation: -12,
  unlock: -14,
  outage: -20,
  fine: -16,
  probe: -18
};
function scoreHeadlineSentiment(text) {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  let rawScore = 0;
  const matched = [];
  for (const token of tokens) {
    if (BULLISH_LEXICON[token] !== void 0) {
      rawScore += BULLISH_LEXICON[token];
      if (!matched.includes(token)) matched.push(token);
    } else if (BEARISH_LEXICON[token] !== void 0) {
      rawScore += BEARISH_LEXICON[token];
      if (!matched.includes(token)) matched.push(token);
    }
  }
  if (cleaned.includes("rate cut")) {
    rawScore += 18;
    if (!matched.includes("rate cut")) matched.push("rate cut");
  }
  if (cleaned.includes("rate hike")) {
    rawScore -= 20;
    if (!matched.includes("rate hike")) matched.push("rate hike");
  }
  if (cleaned.includes("exchange inflow")) {
    rawScore -= 18;
    if (!matched.includes("exchange inflow")) matched.push("exchange inflow");
  }
  const score = Math.max(-100, Math.min(100, rawScore));
  let bias = "Neutral";
  if (score >= 12) bias = "Bullish";
  else if (score <= -12) bias = "Bearish";
  const absScore = Math.abs(score);
  const impact = absScore >= 32 ? "High" : absScore >= 14 ? "Medium" : "Low";
  return {
    score,
    bias,
    impact,
    matchedKeywords: matched
  };
}
function computeCompositeSentiment(sources) {
  if (sources.length === 0) return 50;
  const weights = {
    news: 0.3,
    social: 0.25,
    derivatives: 0.25,
    onchain: 0.2
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of sources) {
    const w = weights[s.id] ?? 0.25;
    weightedSum += Math.max(0, Math.min(100, s.score)) * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 50;
  return Math.round(weightedSum / totalWeight);
}
function detectSentimentDivergence(priceChangePct, sentimentIndex, sentimentDelta24h) {
  if (priceChangePct <= -1.2 && (sentimentIndex >= 56 || sentimentDelta24h >= 4)) {
    return {
      status: "Bullish Divergence",
      note: "Spot price pulled back while institutional and on-chain sentiment expanded, signaling dip accumulation."
    };
  }
  if (priceChangePct >= 1.5 && (sentimentIndex <= 44 || sentimentDelta24h <= -4)) {
    return {
      status: "Bearish Divergence",
      note: "Spot price advanced while social/derivatives sentiment deteriorated, warning of momentum exhaustion."
    };
  }
  return {
    status: "Aligned",
    note: "Price direction and multi-source sentiment momentum are moving in structural alignment."
  };
}
function createCustomSentimentItem(headline, asset) {
  const scored = scoreHeadlineSentiment(headline);
  return {
    id: `custom-${Date.now()}`,
    timestamp: Date.now(),
    source: "Desk Catalyst Lab",
    asset,
    headline: headline.trim(),
    summary: scored.matchedKeywords.length > 0 ? `Detected catalyst drivers: ${scored.matchedKeywords.join(", ")}.` : "Neutral macro phrasing with limited directional catalyst weight.",
    score: scored.score,
    bias: scored.bias,
    impact: scored.impact,
    keywords: scored.matchedKeywords
  };
}

// src/lib/marketData.ts
var ASSETS = [
  {
    symbol: "BTC",
    pair: "BTC/USD",
    name: "Bitcoin",
    coingeckoId: "bitcoin",
    binanceSymbol: "BTCUSDT",
    basePrice: 92450,
    decimals: 2
  },
  {
    symbol: "ETH",
    pair: "ETH/USD",
    name: "Ethereum",
    coingeckoId: "ethereum",
    binanceSymbol: "ETHUSDT",
    basePrice: 3280,
    decimals: 2
  },
  {
    symbol: "SOL",
    pair: "SOL/USD",
    name: "Solana",
    coingeckoId: "solana",
    binanceSymbol: "SOLUSDT",
    basePrice: 214.5,
    decimals: 2
  },
  {
    symbol: "AVAX",
    pair: "AVAX/USD",
    name: "Avalanche",
    coingeckoId: "avalanche-2",
    binanceSymbol: "AVAXUSDT",
    basePrice: 38.4,
    decimals: 2
  },
  {
    symbol: "LINK",
    pair: "LINK/USD",
    name: "Chainlink",
    coingeckoId: "chainlink",
    binanceSymbol: "LINKUSDT",
    basePrice: 18.65,
    decimals: 3
  },
  {
    symbol: "XRP",
    pair: "XRP/USD",
    name: "XRP",
    coingeckoId: "ripple",
    binanceSymbol: "XRPUSDT",
    basePrice: 1.42,
    decimals: 4
  },
  {
    symbol: "NEAR",
    pair: "NEAR/USD",
    name: "NEAR Protocol",
    coingeckoId: "near",
    binanceSymbol: "NEARUSDT",
    basePrice: 5.42,
    decimals: 3
  },
  {
    symbol: "BNB",
    pair: "BNB/USD",
    name: "BNB",
    coingeckoId: "binancecoin",
    binanceSymbol: "BNBUSDT",
    basePrice: 618.5,
    decimals: 2
  },
  {
    symbol: "ANKR",
    pair: "ANKR/USD",
    name: "Ankr",
    coingeckoId: "ankr",
    binanceSymbol: "ANKRUSDT",
    basePrice: 0.0365,
    decimals: 5
  }
];
var TIMEFRAME_MS = {
  "15m": 15 * 60 * 1e3,
  "1H": 60 * 60 * 1e3,
  "4H": 4 * 60 * 60 * 1e3,
  "1D": 24 * 60 * 60 * 1e3
};
function getAssetMeta(symbol) {
  return ASSETS.find((a) => a.symbol === symbol) ?? ASSETS[0];
}
function seededRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}
function generateDeterministicCandles(symbol, timeframe, count = 96, anchorNow = Date.now(), anchorPrice) {
  const meta = getAssetMeta(symbol);
  const intervalMs = TIMEFRAME_MS[timeframe];
  const seedBase = symbol.charCodeAt(0) * 131 + symbol.charCodeAt(1) * 37 + timeframe.charCodeAt(0) * 17;
  const rand = seededRandom(seedBase);
  const volScale = timeframe === "15m" ? 45e-4 : timeframe === "1H" ? 85e-4 : timeframe === "4H" ? 0.015 : 0.026;
  const regimeDrift = symbol === "BTC" ? 14e-4 : symbol === "ETH" ? 9e-4 : symbol === "SOL" ? 21e-4 : symbol === "BNB" ? 1e-3 : symbol === "NEAR" ? 16e-4 : symbol === "ANKR" ? 12e-4 : symbol === "AVAX" ? -12e-4 : symbol === "LINK" ? 11e-4 : -6e-4;
  const endAligned = Math.floor(anchorNow / intervalMs) * intervalMs;
  const rawSeries = [];
  let price = meta.basePrice * 0.94;
  for (let i = 0; i < count; i++) {
    const ts = endAligned - (count - 1 - i) * intervalMs;
    const wave = Math.sin(i * 0.24 + seedBase) * volScale * 0.65;
    const noise = (rand() - 0.49) * volScale * 1.4;
    const open = price;
    const move = open * (regimeDrift + wave + noise);
    const close = Math.max(open * 0.5, open + move);
    const wickUp = Math.abs(rand() * volScale * open * 0.9);
    const wickDown = Math.abs(rand() * volScale * open * 0.9);
    const high = Math.max(open, close) + wickUp;
    const low = Math.max(open * 0.4, Math.min(open, close) - wickDown);
    const volume = meta.basePrice * 1800 * (0.65 + rand() * 1.45) * (1 + Math.abs(move / open) * 18);
    rawSeries.push({
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume
    });
    price = close;
  }
  const targetEnd = anchorPrice ?? meta.basePrice;
  const generatedEnd = rawSeries[rawSeries.length - 1].close;
  const ratio = generatedEnd > 0 ? targetEnd / generatedEnd : 1;
  return rawSeries.map((c) => ({
    timestamp: c.timestamp,
    open: Number((c.open * ratio).toFixed(meta.decimals)),
    high: Number((c.high * ratio).toFixed(meta.decimals)),
    low: Number((c.low * ratio).toFixed(meta.decimals)),
    close: Number((c.close * ratio).toFixed(meta.decimals)),
    volume: Math.round(c.volume)
  }));
}
var CURATED_HEADLINES = [
  {
    asset: "BTC",
    source: "Institutional Desk Wire",
    headline: "Spot Bitcoin ETF net inflows hit $412M as pension allocations expand",
    summary: "Sustained primary-market demand reduced exchange liquid supply across major custodians.",
    hoursAgo: 1
  },
  {
    asset: "ETH",
    source: "On-Chain Analytics",
    headline: "Ethereum validator queue surges following institutional staking upgrade",
    summary: "Net staking inflows and L2 blob fee burn pushed supply issuance mildly deflationary.",
    hoursAgo: 2
  },
  {
    asset: "SOL",
    source: "DeFi Pulse Terminal",
    headline: "Solana DEX settlement volume sets weekly record amid institutional liquidity adoption",
    summary: "Stablecoin velocity and perpetual open interest rose alongside spot breakout structure.",
    hoursAgo: 3
  },
  {
    asset: "AVAX",
    source: "Tokenomics Monitor",
    headline: "Scheduled Avalanche ecosystem token unlock faces cautious derivatives positioning",
    summary: "Short-term hedging pushed perpetual funding mildly negative ahead of supply release.",
    hoursAgo: 5
  },
  {
    asset: "LINK",
    source: "Protocol Research",
    headline: "Chainlink cross-chain settlement partnership expands institutional treasury rail",
    summary: "Whale accumulation wallets added 2.4M LINK over the trailing 72-hour window.",
    hoursAgo: 6
  },
  {
    asset: "XRP",
    source: "Macro Regulatory Brief",
    headline: "Traders digest regulatory filing delay while cross-border settlement liquidity holds",
    summary: "Derivatives skew remained range-bound with balanced spot bid-ask depth.",
    hoursAgo: 8
  },
  {
    asset: "MARKET",
    source: "Macro Liquidity Desk",
    headline: "Dovish central bank liquidity guidance supports risk-asset institutional inflows",
    summary: "Real yields softened 9 bps, lifting digital asset beta and spot orderflow.",
    hoursAgo: 10
  },
  {
    asset: "BTC",
    source: "Derivatives Watch",
    headline: "Short squeeze liquidations clear $140M overhead leverage near key resistance",
    summary: "Spot-led buying replaced over-leveraged perp bids, stabilizing funding rates.",
    hoursAgo: 12
  },
  {
    asset: "NEAR",
    source: "AI Infrastructure Brief",
    headline: "NEAR Protocol chain abstraction upgrade boosts cross-chain institutional adoption",
    summary: "Developer deployments and sharded transaction throughput hit a quarterly high.",
    hoursAgo: 4
  },
  {
    asset: "BNB",
    source: "Exchange Flow Wire",
    headline: "BNB Chain quarterly token burn and institutional DeFi liquidity inflows accelerate",
    summary: "Validator participation and DEX fee volume strengthened spot accumulation.",
    hoursAgo: 7
  },
  {
    asset: "ANKR",
    source: "Web3 Infra Monitor",
    headline: "Ankr enterprise RPC network expansion drives decentralized node staking adoption",
    summary: "Multi-chain liquid staking TVL and infrastructure partnerships rose steadily.",
    hoursAgo: 9
  }
];
function buildSentimentOverview(symbol, priceChangePct, fearGreedOverride, anchorNow = Date.now()) {
  const assetSeed = symbol.charCodeAt(0) + symbol.charCodeAt(1);
  const feed = CURATED_HEADLINES.map((item, idx) => {
    const scored = scoreHeadlineSentiment(item.headline);
    return {
      id: `feed-${idx}-${item.asset}`,
      timestamp: anchorNow - item.hoursAgo * 3600 * 1e3,
      source: item.source,
      asset: item.asset,
      headline: item.headline,
      summary: item.summary,
      score: scored.score,
      bias: scored.bias,
      impact: scored.impact,
      keywords: scored.matchedKeywords
    };
  });
  const relevantItems = feed.filter(
    (f) => f.asset === symbol || f.asset === "MARKET"
  );
  const avgHeadlineScore = relevantItems.reduce((acc, f) => acc + f.score, 0) / Math.max(1, relevantItems.length);
  const newsScore = Math.max(
    18,
    Math.min(88, Math.round(50 + avgHeadlineScore * 0.75))
  );
  const socialScore = Math.max(
    20,
    Math.min(86, Math.round(52 + priceChangePct * 3.1 + (assetSeed % 9 - 4)))
  );
  const derivativesScore = Math.max(
    22,
    Math.min(84, Math.round(54 + (symbol === "AVAX" ? -14 : 7) + priceChangePct * 1.8))
  );
  const onchainScore = Math.max(
    25,
    Math.min(89, Math.round(58 + (symbol === "BTC" || symbol === "LINK" ? 12 : 3)))
  );
  const sources = [
    {
      id: "news",
      label: "Institutional News Wire",
      score: newsScore,
      delta24h: Number(((newsScore - 50) * 0.28).toFixed(1)),
      bias: newsScore >= 56 ? "Bullish" : newsScore <= 44 ? "Bearish" : "Neutral",
      detail: `${relevantItems.length} tracked macro and asset catalysts`
    },
    {
      id: "social",
      label: "Social Velocity & Mentions",
      score: socialScore,
      delta24h: Number((priceChangePct * 1.4 + 2.1).toFixed(1)),
      bias: socialScore >= 56 ? "Bullish" : socialScore <= 44 ? "Bearish" : "Neutral",
      detail: "Weighted X, developer forum, and retail flow velocity"
    },
    {
      id: "derivatives",
      label: "Perp Funding & Skew",
      score: derivativesScore,
      delta24h: Number(((derivativesScore - 52) * 0.35).toFixed(1)),
      bias: derivativesScore >= 56 ? "Bullish" : derivativesScore <= 44 ? "Bearish" : "Neutral",
      detail: "Aggregate 8h funding rates and options 25-delta skew"
    },
    {
      id: "onchain",
      label: "Whale Exchange Netflow",
      score: onchainScore,
      delta24h: Number(((onchainScore - 50) * 0.22).toFixed(1)),
      bias: onchainScore >= 56 ? "Bullish" : onchainScore <= 44 ? "Bearish" : "Neutral",
      detail: "Cold-storage outflows vs. spot exchange deposits"
    }
  ];
  const compositeIndex = computeCompositeSentiment(sources);
  const delta24h = Number(
    (sources.reduce((sum, s) => sum + s.delta24h, 0) / sources.length).toFixed(1)
  );
  const bias = compositeIndex >= 56 ? "Bullish" : compositeIndex <= 44 ? "Bearish" : "Neutral";
  const divergence = detectSentimentDivergence(
    priceChangePct,
    compositeIndex,
    delta24h
  );
  const fearGreedHistory = fearGreedOverride && fearGreedOverride.length > 0 ? fearGreedOverride : Array.from({ length: 14 }, (_, idx) => {
    const val = Math.max(
      20,
      Math.min(
        84,
        Math.round(compositeIndex - 8 + Math.sin(idx * 0.65) * 9 + idx * 0.6)
      )
    );
    const date = new Date(anchorNow - (13 - idx) * 864e5);
    return {
      dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      value: val,
      classification: val >= 65 ? "Greed" : val <= 35 ? "Fear" : "Neutral"
    };
  });
  return {
    compositeIndex,
    delta24h,
    bias,
    divergenceStatus: divergence.status,
    divergenceNote: divergence.note,
    sources,
    fearGreedHistory,
    feed
  };
}
function buildOrderBookSnapshot(symbol, latestPrice, sentimentIndex) {
  const meta = getAssetMeta(symbol);
  const rand = seededRandom(symbol.charCodeAt(0) * 97 + Math.round(latestPrice));
  const step = latestPrice * 8e-4;
  const bidBias = sentimentIndex >= 55 ? 1.24 : sentimentIndex <= 45 ? 0.82 : 1;
  const notionalScale = 12e4 / Math.max(0.01, latestPrice);
  const bids = Array.from({ length: 6 }, (_, i) => {
    const price = Number((latestPrice - step * (i + 1)).toFixed(meta.decimals));
    const size = Number(((0.4 + rand() * 1.6) * bidBias * notionalScale).toFixed(2));
    return { price, size, totalUsd: Math.round(price * size) };
  });
  const asks = Array.from({ length: 6 }, (_, i) => {
    const price = Number((latestPrice + step * (i + 1)).toFixed(meta.decimals));
    const size = Number(((0.4 + rand() * 1.6) * (2 - bidBias) * notionalScale).toFixed(2));
    return { price, size, totalUsd: Math.round(price * size) };
  });
  const bidVol = bids.reduce((s, b) => s + b.totalUsd, 0);
  const askVol = asks.reduce((s, a) => s + a.totalUsd, 0);
  const imbalance = bidVol + askVol > 0 ? (bidVol - askVol) / (bidVol + askVol) * 100 : 0;
  return {
    bids,
    asks,
    bidAskImbalancePct: Number(imbalance.toFixed(1)),
    spreadBps: Number((1.4 + rand() * 1.8).toFixed(2)),
    whaleNetflowUsd: Math.round((sentimentIndex - 50) * 245e4),
    fundingRatePct: Number(((sentimentIndex - 48) * 65e-5).toFixed(4)),
    openInterestChangePct: Number(((sentimentIndex - 46) * 0.24 - 0.5).toFixed(2))
  };
}
function buildBaselineForecast(symbol, timeframe, candles, sentiment) {
  const meta = getAssetMeta(symbol);
  const tech = computeTechnicalSnapshot(candles);
  const price = tech.latestPrice || meta.basePrice;
  const atr = Math.max(tech.atr14, price * 0.012);
  const combinedScore = tech.technicalScore * 0.55 + (sentiment.compositeIndex - 50) * 1.45 * 0.45;
  const direction = combinedScore >= 10 ? "LONG" : combinedScore <= -10 ? "SHORT" : "NEUTRAL";
  const confidence = Math.max(
    52,
    Math.min(89, Math.round(54 + Math.abs(combinedScore) * 0.52))
  );
  const dirMult = direction === "SHORT" ? -1 : direction === "LONG" ? 1 : 0.25;
  const entryLow = Number((price - atr * 0.35).toFixed(meta.decimals));
  const entryHigh = Number((price + atr * 0.25).toFixed(meta.decimals));
  const stopLoss = direction === "SHORT" ? Number((price + atr * 1.45).toFixed(meta.decimals)) : Number((price - atr * 1.45).toFixed(meta.decimals));
  const tp1 = Number((price + dirMult * atr * 1.8).toFixed(meta.decimals));
  const tp2 = Number((price + dirMult * atr * 3.1).toFixed(meta.decimals));
  const risk = Math.abs(price - stopLoss);
  const reward = Math.abs(tp2 - price);
  const rr = risk > 0 ? (reward / risk).toFixed(2) : "2.10";
  const stepUnit = timeframe === "15m" ? "15m" : timeframe === "1H" ? "1h" : timeframe === "4H" ? "4h" : "1d";
  const forecastPath = Array.from({ length: 6 }, (_, i) => {
    const step = i + 1;
    const projected = price + dirMult * atr * 0.48 * step;
    const band = atr * 0.55 * Math.sqrt(step);
    return {
      stepLabel: `+${step}${stepUnit}`,
      projectedPrice: Number(projected.toFixed(meta.decimals)),
      upperBound: Number((projected + band).toFixed(meta.decimals)),
      lowerBound: Number((projected - band).toFixed(meta.decimals))
    };
  });
  const biasWord = direction === "LONG" ? "upside continuation" : direction === "SHORT" ? "downside mean-reversion" : "range-bound consolidation";
  return {
    asset: symbol,
    timeframe,
    generatedAt: Date.now(),
    sourceModel: "Quantitative Baseline Engine",
    direction,
    confidence,
    horizon: timeframe === "15m" ? "1H - 3H" : timeframe === "1H" ? "4H - 12H" : timeframe === "4H" ? "1D - 3D" : "3D - 7D",
    entryZone: { low: entryLow, high: entryHigh },
    targetPrices: { tp1, tp2 },
    stopLoss,
    riskRewardRatio: `1 : ${rr}`,
    forecastPath,
    executiveThesis: `${meta.name} (${meta.pair}) exhibits ${biasWord} on the ${timeframe} structure with RSI(14) at ${tech.latestRsi} and a ${sentiment.compositeIndex}/100 multi-source sentiment reading (${sentiment.divergenceStatus}).`,
    keyDrivers: [
      {
        factor: `EMA 20/50 Trend Structure (${tech.emaTrend})`,
        impact: tech.emaTrend,
        weight: "35%"
      },
      {
        factor: `Composite Multi-Source Sentiment (${sentiment.compositeIndex}/100)`,
        impact: sentiment.bias,
        weight: "35%"
      },
      {
        factor: `MACD Histogram & Bollinger (${tech.bollingerPosition})`,
        impact: tech.latestMacdHistogram >= 0 ? "Bullish" : "Bearish",
        weight: "30%"
      }
    ],
    invalidationCondition: direction === "SHORT" ? `A decisive ${timeframe} candle close above ${stopLoss.toLocaleString()} invalidates the bearish thesis.` : `A decisive ${timeframe} candle close below ${stopLoss.toLocaleString()} invalidates the bullish setup.`
  };
}
function buildMarketBundle(symbol, timeframe, candlesOverride, fearGreedOverride, dataOrigin = "synthetic-stream") {
  const asset = getAssetMeta(symbol);
  const candles = candlesOverride && candlesOverride.length >= 20 ? candlesOverride : generateDeterministicCandles(symbol, timeframe);
  const technicals = computeTechnicalSnapshot(candles);
  const sentiment = buildSentimentOverview(
    symbol,
    technicals.priceChangePct,
    fearGreedOverride
  );
  const orderBook = buildOrderBookSnapshot(
    symbol,
    technicals.latestPrice,
    sentiment.compositeIndex
  );
  const baselineForecast = buildBaselineForecast(
    symbol,
    timeframe,
    candles,
    sentiment
  );
  return {
    asset,
    timeframe,
    dataOrigin,
    lastUpdated: Date.now(),
    candles,
    technicals,
    sentiment,
    orderBook,
    baselineForecast
  };
}
function buildScannerRows(timeframe, livePrices) {
  return ASSETS.map((meta) => {
    const candles = generateDeterministicCandles(
      meta.symbol,
      timeframe,
      80,
      Date.now(),
      livePrices?.[meta.symbol]
    );
    const tech = computeTechnicalSnapshot(candles);
    const sent = buildSentimentOverview(meta.symbol, tech.priceChangePct);
    const combined = tech.technicalScore * 0.55 + (sent.compositeIndex - 50) * 1.4 * 0.45;
    const compositeBias = combined >= 12 ? "Bullish" : combined <= -12 ? "Bearish" : "Neutral";
    return {
      symbol: meta.symbol,
      pair: meta.pair,
      name: meta.name,
      price: tech.latestPrice,
      change24hPct: Number(tech.priceChangePct.toFixed(2)),
      volume24hUsd: Math.round(
        candles.slice(-24).reduce((s, c) => s + c.volume, 0)
      ),
      rsi14: tech.latestRsi,
      macdHistogram: tech.latestMacdHistogram,
      emaTrend: tech.emaTrend,
      sentimentIndex: sent.compositeIndex,
      divergence: sent.divergenceStatus,
      compositeBias,
      confidenceScore: Math.max(
        50,
        Math.min(92, Math.round(52 + Math.abs(combined) * 0.55))
      )
    };
  });
}

// src/server/app.ts
var VALID_SYMBOLS = new Set(ASSETS.map((a) => a.symbol));
var VALID_TIMEFRAMES = /* @__PURE__ */ new Set(["15m", "1H", "4H", "1D"]);
var BINANCE_INTERVAL = {
  "15m": "15m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d"
};
var candleCache = /* @__PURE__ */ new Map();
var fngCache = null;
var spotPriceCache = null;
async function fetchWithTimeout(url, timeoutMs = 2200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function getLiveCandles(symbol, timeframe) {
  const cacheKey = `${symbol}:${timeframe}`;
  const cached = candleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { candles: cached.data.candles, origin: cached.data.origin };
  }
  const meta = getAssetMeta(symbol);
  const interval = BINANCE_INTERVAL[timeframe];
  try {
    const res = await fetchWithTimeout(
      `https://api.binance.com/api/v3/klines?symbol=${meta.binanceSymbol}&interval=${interval}&limit=96`
    );
    if (res.ok) {
      const raw = await res.json();
      if (Array.isArray(raw) && raw.length >= 20) {
        const candles = raw.map((row) => ({
          timestamp: Number(row[0]),
          open: Number(Number(row[1]).toFixed(meta.decimals)),
          high: Number(Number(row[2]).toFixed(meta.decimals)),
          low: Number(Number(row[3]).toFixed(meta.decimals)),
          close: Number(Number(row[4]).toFixed(meta.decimals)),
          volume: Math.round(Number(row[5]) * Number(row[4]))
        }));
        candleCache.set(cacheKey, {
          expiresAt: Date.now() + 2e4,
          data: { candles, origin: "live-api" }
        });
        return { candles, origin: "live-api" };
      }
    }
  } catch {
  }
  return { origin: "synthetic-stream" };
}
async function getFearGreedHistory() {
  if (fngCache && fngCache.expiresAt > Date.now()) {
    return fngCache.data;
  }
  try {
    const res = await fetchWithTimeout("https://api.alternative.me/fng/?limit=14");
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        const points = json.data.slice().reverse().map((d) => {
          const dt = new Date(Number(d.timestamp) * 1e3);
          return {
            dateLabel: `${dt.getMonth() + 1}/${dt.getDate()}`,
            value: Number(d.value),
            classification: d.value_classification
          };
        });
        fngCache = { expiresAt: Date.now() + 3e5, data: points };
        return points;
      }
    }
  } catch {
  }
  return void 0;
}
async function getLiveSpotPrices() {
  if (spotPriceCache && spotPriceCache.expiresAt > Date.now()) {
    return spotPriceCache.data;
  }
  try {
    const ids = ASSETS.map((a) => a.coingeckoId).join(",");
    const res = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    if (res.ok) {
      const json = await res.json();
      const mapped = {};
      for (const a of ASSETS) {
        const price = json[a.coingeckoId]?.usd;
        if (typeof price === "number" && price > 0) {
          mapped[a.symbol] = price;
        }
      }
      spotPriceCache = { expiresAt: Date.now() + 3e4, data: mapped };
      return mapped;
    }
  } catch {
  }
  return {};
}
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
var app = express();
app.use(express.json({ limit: "1mb" }));
app.get(["/api/health", "/health"], (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});
app.get(["/api/market/bundle", "/market/bundle"], async (req, res) => {
  const rawSymbol = String(req.query.symbol || "BTC").toUpperCase();
  const rawTf = String(req.query.timeframe || "4H");
  const symbol = VALID_SYMBOLS.has(rawSymbol) ? rawSymbol : "BTC";
  const timeframe = VALID_TIMEFRAMES.has(rawTf) ? rawTf : "4H";
  const [{ candles, origin }, fearGreed] = await Promise.all([
    getLiveCandles(symbol, timeframe),
    getFearGreedHistory()
  ]);
  const bundle = buildMarketBundle(
    symbol,
    timeframe,
    candles,
    fearGreed,
    origin
  );
  res.json(bundle);
});
app.get(["/api/market/scanner", "/market/scanner"], async (req, res) => {
  const rawTf = String(req.query.timeframe || "4H");
  const timeframe = VALID_TIMEFRAMES.has(rawTf) ? rawTf : "4H";
  const livePrices = await getLiveSpotPrices();
  const rows = buildScannerRows(timeframe, livePrices);
  res.json({ timeframe, rows, updatedAt: Date.now() });
});
app.post(["/api/sentiment/score", "/sentiment/score"], (req, res) => {
  const headline = String(req.body?.headline || "").trim();
  const asset = String(req.body?.asset || "MARKET").toUpperCase();
  if (headline.length < 4) {
    res.status(400).json({ error: "Please enter a headline of at least 4 characters." });
    return;
  }
  const item = createCustomSentimentItem(
    headline,
    VALID_SYMBOLS.has(asset) ? asset : "MARKET"
  );
  res.json({ item });
});
app.post(["/api/ai/predict", "/ai/predict"], async (req, res) => {
  const rawSymbol = String(req.body?.symbol || "BTC").toUpperCase();
  const rawTf = String(req.body?.timeframe || "4H");
  const symbol = VALID_SYMBOLS.has(rawSymbol) ? rawSymbol : "BTC";
  const timeframe = VALID_TIMEFRAMES.has(rawTf) ? rawTf : "4H";
  const customContext = String(req.body?.customContext || "").trim();
  const [{ candles, origin }, fearGreed] = await Promise.all([
    getLiveCandles(symbol, timeframe),
    getFearGreedHistory()
  ]);
  const bundle = buildMarketBundle(symbol, timeframe, candles, fearGreed, origin);
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: "Gemini API key is not configured on the server. Check Settings > Secrets or continue with the Quantitative Baseline Engine."
    });
    return;
  }
  const tech = bundle.technicals;
  const sent = bundle.sentiment;
  const book = bundle.orderBook;
  const recentCloses = bundle.candles.slice(-10).map((c) => c.close).join(", ");
  const prompt = [
    `Analyze ${bundle.asset.name} (${bundle.asset.pair}) on the ${timeframe} timeframe and produce an actionable institutional trade forecast.`,
    `Current Price: $${tech.latestPrice} (24-period change: ${tech.priceChangePct.toFixed(2)}%)`,
    `Recent 10 Closes: [${recentCloses}]`,
    `Technicals: RSI(14)=${tech.latestRsi}, EMA Trend=${tech.emaTrend}, MACD Histogram=${tech.latestMacdHistogram}, Bollinger=${tech.bollingerPosition}, ATR(14)=$${tech.atr14.toFixed(bundle.asset.decimals)}`,
    `Key Support Levels: ${tech.supportLevels.join(", ")} | Key Resistance Levels: ${tech.resistanceLevels.join(", ")}`,
    `Sentiment Dashboard: Composite=${sent.compositeIndex}/100 (${sent.bias}, 24h delta ${sent.delta24h}), Divergence=${sent.divergenceStatus}`,
    `Orderflow & Derivatives: Bid/Ask Imbalance=${book.bidAskImbalancePct}%, Funding Rate=${book.fundingRatePct}%, OI Change=${book.openInterestChangePct}%, Whale Netflow=$${book.whaleNetflowUsd}`,
    `Top Headlines: ${sent.feed.slice(0, 4).map((f) => `[${f.asset}: ${f.bias} (${f.score})] ${f.headline}`).join(" | ")}`,
    customContext ? `Trader Hypothesis / Catalyst Note: ${customContext}` : "",
    `Constraints: Forecast path must have exactly 6 forward steps starting near current price $${tech.latestPrice}. Ensure stopLoss and targetPrices (tp1, tp2) are realistic relative to ATR $${tech.atr14.toFixed(bundle.asset.decimals)}.`
  ].filter(Boolean).join("\n");
  const config = {
    systemInstruction: "You are a senior quantitative crypto strategist at an institutional trading desk. Combine technical structure, orderflow, and multi-source sentiment into precise, realistic, risk-managed trade forecasts. Keep thesis concise and factual.",
    thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        direction: {
          type: Type.STRING,
          enum: ["LONG", "SHORT", "NEUTRAL"]
        },
        confidence: { type: Type.INTEGER },
        horizon: { type: Type.STRING },
        entryZone: {
          type: Type.OBJECT,
          properties: {
            low: { type: Type.NUMBER },
            high: { type: Type.NUMBER }
          },
          required: ["low", "high"]
        },
        targetPrices: {
          type: Type.OBJECT,
          properties: {
            tp1: { type: Type.NUMBER },
            tp2: { type: Type.NUMBER }
          },
          required: ["tp1", "tp2"]
        },
        stopLoss: { type: Type.NUMBER },
        riskRewardRatio: { type: Type.STRING },
        forecastPath: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              stepLabel: { type: Type.STRING },
              projectedPrice: { type: Type.NUMBER },
              upperBound: { type: Type.NUMBER },
              lowerBound: { type: Type.NUMBER }
            },
            required: [
              "stepLabel",
              "projectedPrice",
              "upperBound",
              "lowerBound"
            ]
          }
        },
        executiveThesis: { type: Type.STRING },
        keyDrivers: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              factor: { type: Type.STRING },
              impact: {
                type: Type.STRING,
                enum: ["Bullish", "Bearish", "Neutral"]
              },
              weight: { type: Type.STRING }
            },
            required: ["factor", "impact", "weight"]
          }
        },
        invalidationCondition: { type: Type.STRING }
      },
      required: [
        "direction",
        "confidence",
        "horizon",
        "entryZone",
        "targetPrices",
        "stopLoss",
        "riskRewardRatio",
        "forecastPath",
        "executiveThesis",
        "keyDrivers",
        "invalidationCondition"
      ]
    }
  };
  const callModel = async (modelId) => {
    return ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: modelId === "gemini-4-hydrogen" ? config : {
        systemInstruction: config.systemInstruction,
        responseMimeType: config.responseMimeType,
        responseSchema: config.responseSchema
      }
    });
  };
  try {
    let usedModel = "Gemini 4 Hydrogen";
    let response;
    try {
      response = await callModel("gemini-4-hydrogen");
    } catch (primaryErr) {
      const msg = primaryErr instanceof Error ? primaryErr.message : "";
      if (msg.includes("503") || msg.includes("429") || msg.includes("UNAVAILABLE")) {
        await new Promise((r) => setTimeout(r, 850));
        try {
          response = await callModel("gemini-4-hydrogen");
        } catch {
          usedModel = "Gemini 3.1 Flash Lite";
          response = await callModel("gemini-3.1-flash-lite");
        }
      } else {
        throw primaryErr;
      }
    }
    const rawText = (response.text ?? "").trim();
    const parsed = JSON.parse(rawText);
    const forecast = {
      ...parsed,
      asset: symbol,
      timeframe,
      generatedAt: Date.now(),
      sourceModel: usedModel,
      confidence: Math.max(1, Math.min(99, Math.round(parsed.confidence))),
      forecastPath: (parsed.forecastPath || []).slice(0, 6)
    };
    res.json({ forecast });
  } catch (err) {
    let cleanMsg = "Gemini AI service is temporarily busy. Please retry shortly.";
    if (err instanceof Error) {
      try {
        const parsedErr = JSON.parse(err.message);
        cleanMsg = parsedErr.error?.message || err.message;
      } catch {
        cleanMsg = err.message;
      }
    }
    res.status(502).json({ error: cleanMsg });
  }
});
var app_default = app;
export {
  app,
  app_default as default
};
