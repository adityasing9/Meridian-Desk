import { computeTechnicalSnapshot } from './indicators';
import {
  computeCompositeSentiment,
  detectSentimentDivergence,
  scoreHeadlineSentiment,
} from './sentiment';
import type {
  AITradeForecast,
  AssetMeta,
  AssetSymbol,
  Candle,
  FearGreedPoint,
  MarketBundle,
  OrderBookSnapshot,
  ScannerAssetRow,
  SentimentItem,
  SentimentOverview,
  SentimentSourceMetric,
  SignalBias,
  Timeframe,
} from './types';

export const ASSETS: AssetMeta[] = [
  {
    symbol: 'BTC',
    pair: 'BTC/USD',
    name: 'Bitcoin',
    coingeckoId: 'bitcoin',
    binanceSymbol: 'BTCUSDT',
    basePrice: 92450,
    decimals: 2,
  },
  {
    symbol: 'ETH',
    pair: 'ETH/USD',
    name: 'Ethereum',
    coingeckoId: 'ethereum',
    binanceSymbol: 'ETHUSDT',
    basePrice: 3280,
    decimals: 2,
  },
  {
    symbol: 'SOL',
    pair: 'SOL/USD',
    name: 'Solana',
    coingeckoId: 'solana',
    binanceSymbol: 'SOLUSDT',
    basePrice: 214.5,
    decimals: 2,
  },
  {
    symbol: 'AVAX',
    pair: 'AVAX/USD',
    name: 'Avalanche',
    coingeckoId: 'avalanche-2',
    binanceSymbol: 'AVAXUSDT',
    basePrice: 38.4,
    decimals: 2,
  },
  {
    symbol: 'LINK',
    pair: 'LINK/USD',
    name: 'Chainlink',
    coingeckoId: 'chainlink',
    binanceSymbol: 'LINKUSDT',
    basePrice: 18.65,
    decimals: 3,
  },
  {
    symbol: 'XRP',
    pair: 'XRP/USD',
    name: 'XRP',
    coingeckoId: 'ripple',
    binanceSymbol: 'XRPUSDT',
    basePrice: 1.42,
    decimals: 4,
  },
  {
    symbol: 'NEAR',
    pair: 'NEAR/USD',
    name: 'NEAR Protocol',
    coingeckoId: 'near',
    binanceSymbol: 'NEARUSDT',
    basePrice: 5.42,
    decimals: 3,
  },
  {
    symbol: 'BNB',
    pair: 'BNB/USD',
    name: 'BNB',
    coingeckoId: 'binancecoin',
    binanceSymbol: 'BNBUSDT',
    basePrice: 618.5,
    decimals: 2,
  },
  {
    symbol: 'ANKR',
    pair: 'ANKR/USD',
    name: 'Ankr',
    coingeckoId: 'ankr',
    binanceSymbol: 'ANKRUSDT',
    basePrice: 0.0365,
    decimals: 5,
  },
];

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  '15m': 15 * 60 * 1000,
  '1H': 60 * 60 * 1000,
  '4H': 4 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
};

export function getAssetMeta(symbol: AssetSymbol): AssetMeta {
  return ASSETS.find((a) => a.symbol === symbol) ?? ASSETS[0];
}

function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function generateDeterministicCandles(
  symbol: AssetSymbol,
  timeframe: Timeframe,
  count = 96,
  anchorNow = Date.now(),
  anchorPrice?: number
): Candle[] {
  const meta = getAssetMeta(symbol);
  const intervalMs = TIMEFRAME_MS[timeframe];
  const seedBase =
    symbol.charCodeAt(0) * 131 +
    symbol.charCodeAt(1) * 37 +
    timeframe.charCodeAt(0) * 17;
  const rand = seededRandom(seedBase);

  const volScale =
    timeframe === '15m'
      ? 0.0045
      : timeframe === '1H'
      ? 0.0085
      : timeframe === '4H'
      ? 0.015
      : 0.026;

  // Different market regimes per asset for realistic scanner diversity
  const regimeDrift =
    symbol === 'BTC'
      ? 0.0014
      : symbol === 'ETH'
      ? 0.0009
      : symbol === 'SOL'
      ? 0.0021
      : symbol === 'BNB'
      ? 0.001
      : symbol === 'NEAR'
      ? 0.0016
      : symbol === 'ANKR'
      ? 0.0012
      : symbol === 'AVAX'
      ? -0.0012
      : symbol === 'LINK'
      ? 0.0011
      : -0.0006;

  const endAligned = Math.floor(anchorNow / intervalMs) * intervalMs;
  const rawSeries: Candle[] = [];
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
    const volume =
      (meta.basePrice * 1800) * (0.65 + rand() * 1.45) * (1 + Math.abs(move / open) * 18);

    rawSeries.push({
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }

  // If a real live spot price was retrieved, rescale tail cleanly to match it
  const targetEnd = anchorPrice ?? meta.basePrice;
  const generatedEnd = rawSeries[rawSeries.length - 1].close;
  const ratio = generatedEnd > 0 ? targetEnd / generatedEnd : 1;

  return rawSeries.map((c) => ({
    timestamp: c.timestamp,
    open: Number((c.open * ratio).toFixed(meta.decimals)),
    high: Number((c.high * ratio).toFixed(meta.decimals)),
    low: Number((c.low * ratio).toFixed(meta.decimals)),
    close: Number((c.close * ratio).toFixed(meta.decimals)),
    volume: Math.round(c.volume),
  }));
}

const CURATED_HEADLINES: {
  asset: AssetSymbol | 'MARKET';
  source: string;
  headline: string;
  summary: string;
  hoursAgo: number;
}[] = [
  {
    asset: 'BTC',
    source: 'Institutional Desk Wire',
    headline: 'Spot Bitcoin ETF net inflows hit $412M as pension allocations expand',
    summary: 'Sustained primary-market demand reduced exchange liquid supply across major custodians.',
    hoursAgo: 1,
  },
  {
    asset: 'ETH',
    source: 'On-Chain Analytics',
    headline: 'Ethereum validator queue surges following institutional staking upgrade',
    summary: 'Net staking inflows and L2 blob fee burn pushed supply issuance mildly deflationary.',
    hoursAgo: 2,
  },
  {
    asset: 'SOL',
    source: 'DeFi Pulse Terminal',
    headline: 'Solana DEX settlement volume sets weekly record amid institutional liquidity adoption',
    summary: 'Stablecoin velocity and perpetual open interest rose alongside spot breakout structure.',
    hoursAgo: 3,
  },
  {
    asset: 'AVAX',
    source: 'Tokenomics Monitor',
    headline: 'Scheduled Avalanche ecosystem token unlock faces cautious derivatives positioning',
    summary: 'Short-term hedging pushed perpetual funding mildly negative ahead of supply release.',
    hoursAgo: 5,
  },
  {
    asset: 'LINK',
    source: 'Protocol Research',
    headline: 'Chainlink cross-chain settlement partnership expands institutional treasury rail',
    summary: 'Whale accumulation wallets added 2.4M LINK over the trailing 72-hour window.',
    hoursAgo: 6,
  },
  {
    asset: 'XRP',
    source: 'Macro Regulatory Brief',
    headline: 'Traders digest regulatory filing delay while cross-border settlement liquidity holds',
    summary: 'Derivatives skew remained range-bound with balanced spot bid-ask depth.',
    hoursAgo: 8,
  },
  {
    asset: 'MARKET',
    source: 'Macro Liquidity Desk',
    headline: 'Dovish central bank liquidity guidance supports risk-asset institutional inflows',
    summary: 'Real yields softened 9 bps, lifting digital asset beta and spot orderflow.',
    hoursAgo: 10,
  },
  {
    asset: 'BTC',
    source: 'Derivatives Watch',
    headline: 'Short squeeze liquidations clear $140M overhead leverage near key resistance',
    summary: 'Spot-led buying replaced over-leveraged perp bids, stabilizing funding rates.',
    hoursAgo: 12,
  },
  {
    asset: 'NEAR',
    source: 'AI Infrastructure Brief',
    headline: 'NEAR Protocol chain abstraction upgrade boosts cross-chain institutional adoption',
    summary: 'Developer deployments and sharded transaction throughput hit a quarterly high.',
    hoursAgo: 4,
  },
  {
    asset: 'BNB',
    source: 'Exchange Flow Wire',
    headline: 'BNB Chain quarterly token burn and institutional DeFi liquidity inflows accelerate',
    summary: 'Validator participation and DEX fee volume strengthened spot accumulation.',
    hoursAgo: 7,
  },
  {
    asset: 'ANKR',
    source: 'Web3 Infra Monitor',
    headline: 'Ankr enterprise RPC network expansion drives decentralized node staking adoption',
    summary: 'Multi-chain liquid staking TVL and infrastructure partnerships rose steadily.',
    hoursAgo: 9,
  },
];

export function buildSentimentOverview(
  symbol: AssetSymbol,
  priceChangePct: number,
  fearGreedOverride?: FearGreedPoint[],
  anchorNow = Date.now()
): SentimentOverview {
  const assetSeed = symbol.charCodeAt(0) + symbol.charCodeAt(1);
  const feed: SentimentItem[] = CURATED_HEADLINES.map((item, idx) => {
    const scored = scoreHeadlineSentiment(item.headline);
    return {
      id: `feed-${idx}-${item.asset}`,
      timestamp: anchorNow - item.hoursAgo * 3600 * 1000,
      source: item.source,
      asset: item.asset,
      headline: item.headline,
      summary: item.summary,
      score: scored.score,
      bias: scored.bias,
      impact: scored.impact,
      keywords: scored.matchedKeywords,
    };
  });

  const relevantItems = feed.filter(
    (f) => f.asset === symbol || f.asset === 'MARKET'
  );
  const avgHeadlineScore =
    relevantItems.reduce((acc, f) => acc + f.score, 0) /
    Math.max(1, relevantItems.length);

  const newsScore = Math.max(
    18,
    Math.min(88, Math.round(50 + avgHeadlineScore * 0.75))
  );
  const socialScore = Math.max(
    20,
    Math.min(86, Math.round(52 + priceChangePct * 3.1 + ((assetSeed % 9) - 4)))
  );
  const derivativesScore = Math.max(
    22,
    Math.min(84, Math.round(54 + (symbol === 'AVAX' ? -14 : 7) + priceChangePct * 1.8))
  );
  const onchainScore = Math.max(
    25,
    Math.min(89, Math.round(58 + (symbol === 'BTC' || symbol === 'LINK' ? 12 : 3)))
  );

  const sources: SentimentSourceMetric[] = [
    {
      id: 'news',
      label: 'Institutional News Wire',
      score: newsScore,
      delta24h: Number(((newsScore - 50) * 0.28).toFixed(1)),
      bias: newsScore >= 56 ? 'Bullish' : newsScore <= 44 ? 'Bearish' : 'Neutral',
      detail: `${relevantItems.length} tracked macro and asset catalysts`,
    },
    {
      id: 'social',
      label: 'Social Velocity & Mentions',
      score: socialScore,
      delta24h: Number((priceChangePct * 1.4 + 2.1).toFixed(1)),
      bias: socialScore >= 56 ? 'Bullish' : socialScore <= 44 ? 'Bearish' : 'Neutral',
      detail: 'Weighted X, developer forum, and retail flow velocity',
    },
    {
      id: 'derivatives',
      label: 'Perp Funding & Skew',
      score: derivativesScore,
      delta24h: Number(((derivativesScore - 52) * 0.35).toFixed(1)),
      bias:
        derivativesScore >= 56
          ? 'Bullish'
          : derivativesScore <= 44
          ? 'Bearish'
          : 'Neutral',
      detail: 'Aggregate 8h funding rates and options 25-delta skew',
    },
    {
      id: 'onchain',
      label: 'Whale Exchange Netflow',
      score: onchainScore,
      delta24h: Number(((onchainScore - 50) * 0.22).toFixed(1)),
      bias:
        onchainScore >= 56 ? 'Bullish' : onchainScore <= 44 ? 'Bearish' : 'Neutral',
      detail: 'Cold-storage outflows vs. spot exchange deposits',
    },
  ];

  const compositeIndex = computeCompositeSentiment(sources);
  const delta24h = Number(
    (
      sources.reduce((sum, s) => sum + s.delta24h, 0) / sources.length
    ).toFixed(1)
  );
  const bias: SignalBias =
    compositeIndex >= 56 ? 'Bullish' : compositeIndex <= 44 ? 'Bearish' : 'Neutral';

  const divergence = detectSentimentDivergence(
    priceChangePct,
    compositeIndex,
    delta24h
  );

  const fearGreedHistory: FearGreedPoint[] =
    fearGreedOverride && fearGreedOverride.length > 0
      ? fearGreedOverride
      : Array.from({ length: 14 }, (_, idx) => {
          const val = Math.max(
            20,
            Math.min(
              84,
              Math.round(compositeIndex - 8 + Math.sin(idx * 0.65) * 9 + idx * 0.6)
            )
          );
          const date = new Date(anchorNow - (13 - idx) * 86400000);
          return {
            dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
            value: val,
            classification:
              val >= 65 ? 'Greed' : val <= 35 ? 'Fear' : 'Neutral',
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
    feed,
  };
}

export function buildOrderBookSnapshot(
  symbol: AssetSymbol,
  latestPrice: number,
  sentimentIndex: number
): OrderBookSnapshot {
  const meta = getAssetMeta(symbol);
  const rand = seededRandom(symbol.charCodeAt(0) * 97 + Math.round(latestPrice));
  const step = latestPrice * 0.0008;

  const bidBias = sentimentIndex >= 55 ? 1.24 : sentimentIndex <= 45 ? 0.82 : 1.0;

  const notionalScale = 120_000 / Math.max(0.01, latestPrice);

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
  const imbalance =
    bidVol + askVol > 0 ? ((bidVol - askVol) / (bidVol + askVol)) * 100 : 0;

  return {
    bids,
    asks,
    bidAskImbalancePct: Number(imbalance.toFixed(1)),
    spreadBps: Number((1.4 + rand() * 1.8).toFixed(2)),
    whaleNetflowUsd: Math.round((sentimentIndex - 50) * 2_450_000),
    fundingRatePct: Number(((sentimentIndex - 48) * 0.00065).toFixed(4)),
    openInterestChangePct: Number((((sentimentIndex - 46) * 0.24) - 0.5).toFixed(2)),
  };
}

export function buildBaselineForecast(
  symbol: AssetSymbol,
  timeframe: Timeframe,
  candles: Candle[],
  sentiment: SentimentOverview
): AITradeForecast {
  const meta = getAssetMeta(symbol);
  const tech = computeTechnicalSnapshot(candles);
  const price = tech.latestPrice || meta.basePrice;
  const atr = Math.max(tech.atr14, price * 0.012);

  const combinedScore =
    tech.technicalScore * 0.55 + (sentiment.compositeIndex - 50) * 1.45 * 0.45;

  const direction: 'LONG' | 'SHORT' | 'NEUTRAL' =
    combinedScore >= 10 ? 'LONG' : combinedScore <= -10 ? 'SHORT' : 'NEUTRAL';

  const confidence = Math.max(
    52,
    Math.min(89, Math.round(54 + Math.abs(combinedScore) * 0.52))
  );

  const dirMult = direction === 'SHORT' ? -1 : direction === 'LONG' ? 1 : 0.25;
  const entryLow = Number((price - atr * 0.35).toFixed(meta.decimals));
  const entryHigh = Number((price + atr * 0.25).toFixed(meta.decimals));

  const stopLoss =
    direction === 'SHORT'
      ? Number((price + atr * 1.45).toFixed(meta.decimals))
      : Number((price - atr * 1.45).toFixed(meta.decimals));

  const tp1 = Number((price + dirMult * atr * 1.8).toFixed(meta.decimals));
  const tp2 = Number((price + dirMult * atr * 3.1).toFixed(meta.decimals));

  const risk = Math.abs(price - stopLoss);
  const reward = Math.abs(tp2 - price);
  const rr = risk > 0 ? (reward / risk).toFixed(2) : '2.10';

  const stepUnit = timeframe === '15m' ? '15m' : timeframe === '1H' ? '1h' : timeframe === '4H' ? '4h' : '1d';
  const forecastPath = Array.from({ length: 6 }, (_, i) => {
    const step = i + 1;
    const projected = price + dirMult * atr * 0.48 * step;
    const band = atr * 0.55 * Math.sqrt(step);
    return {
      stepLabel: `+${step}${stepUnit}`,
      projectedPrice: Number(projected.toFixed(meta.decimals)),
      upperBound: Number((projected + band).toFixed(meta.decimals)),
      lowerBound: Number((projected - band).toFixed(meta.decimals)),
    };
  });

  const biasWord =
    direction === 'LONG'
      ? 'upside continuation'
      : direction === 'SHORT'
      ? 'downside mean-reversion'
      : 'range-bound consolidation';

  return {
    asset: symbol,
    timeframe,
    generatedAt: Date.now(),
    sourceModel: 'Quantitative Baseline Engine',
    direction,
    confidence,
    horizon: timeframe === '15m' ? '1H - 3H' : timeframe === '1H' ? '4H - 12H' : timeframe === '4H' ? '1D - 3D' : '3D - 7D',
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
        weight: '35%',
      },
      {
        factor: `Composite Multi-Source Sentiment (${sentiment.compositeIndex}/100)`,
        impact: sentiment.bias,
        weight: '35%',
      },
      {
        factor: `MACD Histogram & Bollinger (${tech.bollingerPosition})`,
        impact: tech.latestMacdHistogram >= 0 ? 'Bullish' : 'Bearish',
        weight: '30%',
      },
    ],
    invalidationCondition:
      direction === 'SHORT'
        ? `A decisive ${timeframe} candle close above ${stopLoss.toLocaleString()} invalidates the bearish thesis.`
        : `A decisive ${timeframe} candle close below ${stopLoss.toLocaleString()} invalidates the bullish setup.`,
  };
}

export function buildMarketBundle(
  symbol: AssetSymbol,
  timeframe: Timeframe,
  candlesOverride?: Candle[],
  fearGreedOverride?: FearGreedPoint[],
  dataOrigin: 'live-api' | 'synthetic-stream' = 'synthetic-stream'
): MarketBundle {
  const asset = getAssetMeta(symbol);
  const candles =
    candlesOverride && candlesOverride.length >= 20
      ? candlesOverride
      : generateDeterministicCandles(symbol, timeframe);
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
    baselineForecast,
  };
}

export function buildScannerRows(
  timeframe: Timeframe,
  livePrices?: Partial<Record<AssetSymbol, number>>
): ScannerAssetRow[] {
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
    const combined =
      tech.technicalScore * 0.55 + (sent.compositeIndex - 50) * 1.4 * 0.45;
    const compositeBias: SignalBias =
      combined >= 12 ? 'Bullish' : combined <= -12 ? 'Bearish' : 'Neutral';

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
      ),
    };
  });
}
