import type {
  AssetSymbol,
  SentimentItem,
  SentimentSourceMetric,
  SignalBias,
} from './types';

const BULLISH_LEXICON: Record<string, number> = {
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
  outflow: 14, // exchange outflow implies holding
  partnership: 14,
  record: 12,
  liquidity: 10,
  dovish: 16,
  cut: 10,
};

const BEARISH_LEXICON: Record<string, number> = {
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
  probe: -18,
};

export interface ScoredHeadlineResult {
  score: number; // -100 to 100
  bias: SignalBias;
  impact: 'High' | 'Medium' | 'Low';
  matchedKeywords: string[];
}

export function scoreHeadlineSentiment(text: string): ScoredHeadlineResult {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  let rawScore = 0;
  const matched: string[] = [];

  for (const token of tokens) {
    if (BULLISH_LEXICON[token] !== undefined) {
      rawScore += BULLISH_LEXICON[token];
      if (!matched.includes(token)) matched.push(token);
    } else if (BEARISH_LEXICON[token] !== undefined) {
      rawScore += BEARISH_LEXICON[token];
      if (!matched.includes(token)) matched.push(token);
    }
  }

  // Handle multi-word phrases
  if (cleaned.includes('rate cut')) {
    rawScore += 18;
    if (!matched.includes('rate cut')) matched.push('rate cut');
  }
  if (cleaned.includes('rate hike')) {
    rawScore -= 20;
    if (!matched.includes('rate hike')) matched.push('rate hike');
  }
  if (cleaned.includes('exchange inflow')) {
    rawScore -= 18;
    if (!matched.includes('exchange inflow')) matched.push('exchange inflow');
  }

  const score = Math.max(-100, Math.min(100, rawScore));
  let bias: SignalBias = 'Neutral';
  if (score >= 12) bias = 'Bullish';
  else if (score <= -12) bias = 'Bearish';

  const absScore = Math.abs(score);
  const impact: 'High' | 'Medium' | 'Low' =
    absScore >= 32 ? 'High' : absScore >= 14 ? 'Medium' : 'Low';

  return {
    score,
    bias,
    impact,
    matchedKeywords: matched,
  };
}

export function computeCompositeSentiment(
  sources: Pick<SentimentSourceMetric, 'id' | 'score'>[]
): number {
  if (sources.length === 0) return 50;

  const weights: Record<string, number> = {
    news: 0.3,
    social: 0.25,
    derivatives: 0.25,
    onchain: 0.2,
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

export function detectSentimentDivergence(
  priceChangePct: number,
  sentimentIndex: number,
  sentimentDelta24h: number
): {
  status: 'Bullish Divergence' | 'Bearish Divergence' | 'Aligned';
  note: string;
} {
  if (priceChangePct <= -1.2 && (sentimentIndex >= 56 || sentimentDelta24h >= 4)) {
    return {
      status: 'Bullish Divergence',
      note: 'Spot price pulled back while institutional and on-chain sentiment expanded, signaling dip accumulation.',
    };
  }
  if (priceChangePct >= 1.5 && (sentimentIndex <= 44 || sentimentDelta24h <= -4)) {
    return {
      status: 'Bearish Divergence',
      note: 'Spot price advanced while social/derivatives sentiment deteriorated, warning of momentum exhaustion.',
    };
  }
  return {
    status: 'Aligned',
    note: 'Price direction and multi-source sentiment momentum are moving in structural alignment.',
  };
}

export function createCustomSentimentItem(
  headline: string,
  asset: AssetSymbol | 'MARKET'
): SentimentItem {
  const scored = scoreHeadlineSentiment(headline);
  return {
    id: `custom-${Date.now()}`,
    timestamp: Date.now(),
    source: 'Desk Catalyst Lab',
    asset,
    headline: headline.trim(),
    summary:
      scored.matchedKeywords.length > 0
        ? `Detected catalyst drivers: ${scored.matchedKeywords.join(', ')}.`
        : 'Neutral macro phrasing with limited directional catalyst weight.',
    score: scored.score,
    bias: scored.bias,
    impact: scored.impact,
    keywords: scored.matchedKeywords,
  };
}
