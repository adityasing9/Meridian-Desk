export type AssetSymbol =
  | 'BTC'
  | 'ETH'
  | 'SOL'
  | 'AVAX'
  | 'LINK'
  | 'XRP'
  | 'NEAR'
  | 'BNB'
  | 'ANKR';

export type Timeframe = '15m' | '1H' | '4H' | '1D';

export type SignalBias = 'Bullish' | 'Bearish' | 'Neutral';

export interface AssetMeta {
  symbol: AssetSymbol;
  pair: string;
  name: string;
  coingeckoId: string;
  binanceSymbol: string;
  basePrice: number;
  decimals: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BollingerPoint {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export interface MACDPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface TechnicalSnapshot {
  ema20: (number | null)[];
  ema50: (number | null)[];
  rsi14: (number | null)[];
  macd: MACDPoint[];
  bollinger: BollingerPoint[];
  atr14: number;
  latestPrice: number;
  priceChangePct: number;
  latestRsi: number;
  latestMacdHistogram: number;
  emaTrend: SignalBias;
  bollingerPosition: 'Upper Band' | 'Middle Band' | 'Lower Band';
  supportLevels: [number, number];
  resistanceLevels: [number, number];
  technicalScore: number; // -100 to 100
  technicalBias: SignalBias;
}

export interface SentimentSourceMetric {
  id: string;
  label: string;
  score: number; // 0 to 100
  delta24h: number;
  bias: SignalBias;
  detail: string;
}

export interface SentimentItem {
  id: string;
  timestamp: number;
  source: string;
  asset: AssetSymbol | 'MARKET';
  headline: string;
  summary: string;
  score: number; // -100 to 100
  bias: SignalBias;
  impact: 'High' | 'Medium' | 'Low';
  keywords: string[];
}

export interface FearGreedPoint {
  dateLabel: string;
  value: number;
  classification: string;
}

export interface SentimentOverview {
  compositeIndex: number; // 0 to 100
  delta24h: number;
  bias: SignalBias;
  divergenceStatus: 'Bullish Divergence' | 'Bearish Divergence' | 'Aligned';
  divergenceNote: string;
  sources: SentimentSourceMetric[];
  fearGreedHistory: FearGreedPoint[];
  feed: SentimentItem[];
}

export interface OrderBookLevel {
  price: number;
  size: number;
  totalUsd: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bidAskImbalancePct: number; // -100 to +100
  spreadBps: number;
  whaleNetflowUsd: number;
  fundingRatePct: number;
  openInterestChangePct: number;
}

export interface ForecastPoint {
  stepLabel: string;
  projectedPrice: number;
  upperBound: number;
  lowerBound: number;
}

export interface ForecastDriver {
  factor: string;
  impact: SignalBias;
  weight: string;
}

export interface AITradeForecast {
  asset: AssetSymbol;
  timeframe: Timeframe;
  generatedAt: number;
  sourceModel: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  horizon: string;
  entryZone: {
    low: number;
    high: number;
  };
  targetPrices: {
    tp1: number;
    tp2: number;
  };
  stopLoss: number;
  riskRewardRatio: string;
  forecastPath: ForecastPoint[];
  executiveThesis: string;
  keyDrivers: ForecastDriver[];
  invalidationCondition: string;
}

export interface MarketBundle {
  asset: AssetMeta;
  timeframe: Timeframe;
  dataOrigin: 'live-api' | 'synthetic-stream';
  lastUpdated: number;
  candles: Candle[];
  technicals: TechnicalSnapshot;
  sentiment: SentimentOverview;
  orderBook: OrderBookSnapshot;
  baselineForecast: AITradeForecast;
}

export interface ScannerAssetRow {
  symbol: AssetSymbol;
  pair: string;
  name: string;
  price: number;
  change24hPct: number;
  volume24hUsd: number;
  rsi14: number;
  macdHistogram: number;
  emaTrend: SignalBias;
  sentimentIndex: number;
  divergence: 'Bullish Divergence' | 'Bearish Divergence' | 'Aligned';
  compositeBias: SignalBias;
  confidenceScore: number;
}

export interface PositionSizeInput {
  accountEquity: number;
  riskPercent: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
}

export interface PositionSizeResult {
  valid: boolean;
  riskUsd: number;
  stopDistancePct: number;
  positionUnits: number;
  positionNotionalUsd: number;
  projectedProfitUsd: number;
  riskRewardRatio: number;
}

export interface BacktestConfig {
  rsiOversold: number;
  rsiOverbought: number;
  sentimentWeight: number; // 0 to 1
  stopAtrMultiplier: number;
  takeProfitR: number;
}

export interface BacktestTrade {
  id: number;
  side: 'LONG' | 'SHORT';
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  pnlUsd: number;
  outcome: 'Win' | 'Loss';
}

export interface BacktestResult {
  totalTrades: number;
  winRatePct: number;
  profitFactor: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  finalEquityUsd: number;
  equityCurve: { index: number; timestamp: number; equity: number }[];
  trades: BacktestTrade[];
}
