import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  ASSETS,
  buildMarketBundle,
  buildScannerRows,
  getAssetMeta,
} from '../lib/marketData';
import { createCustomSentimentItem } from '../lib/sentiment';
import type {
  AITradeForecast,
  AssetSymbol,
  Candle,
  FearGreedPoint,
  Timeframe,
} from '../lib/types';

const VALID_SYMBOLS = new Set<AssetSymbol>(ASSETS.map((a) => a.symbol));
const VALID_TIMEFRAMES = new Set<Timeframe>(['15m', '1H', '4H', '1D']);

const BINANCE_INTERVAL: Record<Timeframe, string> = {
  '15m': '15m',
  '1H': '1h',
  '4H': '4h',
  '1D': '1d',
};

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const candleCache = new Map<string, CacheEntry<{ candles: Candle[]; origin: 'live-api' | 'synthetic-stream' }>>();
let fngCache: CacheEntry<FearGreedPoint[]> | null = null;
let spotPriceCache: CacheEntry<Partial<Record<AssetSymbol, number>>> | null = null;

async function fetchWithTimeout(url: string, timeoutMs = 2200): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getLiveCandles(
  symbol: AssetSymbol,
  timeframe: Timeframe
): Promise<{ candles?: Candle[]; origin: 'live-api' | 'synthetic-stream' }> {
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
      const raw = (await res.json()) as unknown[][];
      if (Array.isArray(raw) && raw.length >= 20) {
        const candles: Candle[] = raw.map((row) => ({
          timestamp: Number(row[0]),
          open: Number(Number(row[1]).toFixed(meta.decimals)),
          high: Number(Number(row[2]).toFixed(meta.decimals)),
          low: Number(Number(row[3]).toFixed(meta.decimals)),
          close: Number(Number(row[4]).toFixed(meta.decimals)),
          volume: Math.round(Number(row[5]) * Number(row[4])),
        }));
        candleCache.set(cacheKey, {
          expiresAt: Date.now() + 20_000,
          data: { candles, origin: 'live-api' },
        });
        return { candles, origin: 'live-api' };
      }
    }
  } catch {
    // Fallback handled smoothly by deterministic market generator
  }

  return { origin: 'synthetic-stream' };
}

async function getFearGreedHistory(): Promise<FearGreedPoint[] | undefined> {
  if (fngCache && fngCache.expiresAt > Date.now()) {
    return fngCache.data;
  }

  try {
    const res = await fetchWithTimeout('https://api.alternative.me/fng/?limit=14');
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { value: string; value_classification: string; timestamp: string }[];
      };
      if (Array.isArray(json.data) && json.data.length > 0) {
        const points: FearGreedPoint[] = json.data
          .slice()
          .reverse()
          .map((d) => {
            const dt = new Date(Number(d.timestamp) * 1000);
            return {
              dateLabel: `${dt.getMonth() + 1}/${dt.getDate()}`,
              value: Number(d.value),
              classification: d.value_classification,
            };
          });
        fngCache = { expiresAt: Date.now() + 300_000, data: points };
        return points;
      }
    }
  } catch {
    // Fallback handled smoothly in buildMarketBundle
  }
  return undefined;
}

async function getLiveSpotPrices(): Promise<Partial<Record<AssetSymbol, number>>> {
  if (spotPriceCache && spotPriceCache.expiresAt > Date.now()) {
    return spotPriceCache.data;
  }

  try {
    const ids = ASSETS.map((a) => a.coingeckoId).join(',');
    const res = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    if (res.ok) {
      const json = (await res.json()) as Record<string, { usd?: number }>;
      const mapped: Partial<Record<AssetSymbol, number>> = {};
      for (const a of ASSETS) {
        const price = json[a.coingeckoId]?.usd;
        if (typeof price === 'number' && price > 0) {
          mapped[a.symbol] = price;
        }
      }
      spotPriceCache = { expiresAt: Date.now() + 30_000, data: mapped };
      return mapped;
    }
  } catch {
    // Fallback to baseline prices
  }
  return {};
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export const app = express();
app.use(express.json({ limit: '1mb' }));

app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.get(['/api/market/bundle', '/market/bundle'], async (req, res) => {
  const rawSymbol = String(req.query.symbol || 'BTC').toUpperCase() as AssetSymbol;
  const rawTf = String(req.query.timeframe || '4H') as Timeframe;
  const symbol: AssetSymbol = VALID_SYMBOLS.has(rawSymbol) ? rawSymbol : 'BTC';
  const timeframe: Timeframe = VALID_TIMEFRAMES.has(rawTf) ? rawTf : '4H';

  const [{ candles, origin }, fearGreed] = await Promise.all([
    getLiveCandles(symbol, timeframe),
    getFearGreedHistory(),
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

app.get(['/api/market/scanner', '/market/scanner'], async (req, res) => {
  const rawTf = String(req.query.timeframe || '4H') as Timeframe;
  const timeframe: Timeframe = VALID_TIMEFRAMES.has(rawTf) ? rawTf : '4H';
  const livePrices = await getLiveSpotPrices();
  const rows = buildScannerRows(timeframe, livePrices);
  res.json({ timeframe, rows, updatedAt: Date.now() });
});

app.post(['/api/sentiment/score', '/sentiment/score'], (req, res) => {
  const headline = String(req.body?.headline || '').trim();
  const asset = String(req.body?.asset || 'MARKET').toUpperCase() as AssetSymbol | 'MARKET';

  if (headline.length < 4) {
    res.status(400).json({ error: 'Please enter a headline of at least 4 characters.' });
    return;
  }

  const item = createCustomSentimentItem(
    headline,
    VALID_SYMBOLS.has(asset as AssetSymbol) ? (asset as AssetSymbol) : 'MARKET'
  );
  res.json({ item });
});

app.post(['/api/ai/predict', '/ai/predict'], async (req, res) => {
  const rawSymbol = String(req.body?.symbol || 'BTC').toUpperCase() as AssetSymbol;
  const rawTf = String(req.body?.timeframe || '4H') as Timeframe;
  const symbol: AssetSymbol = VALID_SYMBOLS.has(rawSymbol) ? rawSymbol : 'BTC';
  const timeframe: Timeframe = VALID_TIMEFRAMES.has(rawTf) ? rawTf : '4H';
  const customContext = String(req.body?.customContext || '').trim();

  const [{ candles, origin }, fearGreed] = await Promise.all([
    getLiveCandles(symbol, timeframe),
    getFearGreedHistory(),
  ]);
  const bundle = buildMarketBundle(symbol, timeframe, candles, fearGreed, origin);

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error:
        'Gemini API key is not configured on the server. Check Settings > Secrets or continue with the Quantitative Baseline Engine.',
    });
    return;
  }

  const tech = bundle.technicals;
  const sent = bundle.sentiment;
  const book = bundle.orderBook;
  const recentCloses = bundle.candles
    .slice(-10)
    .map((c) => c.close)
    .join(', ');

  const prompt = [
    `Analyze ${bundle.asset.name} (${bundle.asset.pair}) on the ${timeframe} timeframe and produce an actionable institutional trade forecast.`,
    `Current Price: $${tech.latestPrice} (24-period change: ${tech.priceChangePct.toFixed(2)}%)`,
    `Recent 10 Closes: [${recentCloses}]`,
    `Technicals: RSI(14)=${tech.latestRsi}, EMA Trend=${tech.emaTrend}, MACD Histogram=${tech.latestMacdHistogram}, Bollinger=${tech.bollingerPosition}, ATR(14)=$${tech.atr14.toFixed(bundle.asset.decimals)}`,
    `Key Support Levels: ${tech.supportLevels.join(', ')} | Key Resistance Levels: ${tech.resistanceLevels.join(', ')}`,
    `Sentiment Dashboard: Composite=${sent.compositeIndex}/100 (${sent.bias}, 24h delta ${sent.delta24h}), Divergence=${sent.divergenceStatus}`,
    `Orderflow & Derivatives: Bid/Ask Imbalance=${book.bidAskImbalancePct}%, Funding Rate=${book.fundingRatePct}%, OI Change=${book.openInterestChangePct}%, Whale Netflow=$${book.whaleNetflowUsd}`,
    `Top Headlines: ${sent.feed
      .slice(0, 4)
      .map((f) => `[${f.asset}: ${f.bias} (${f.score})] ${f.headline}`)
      .join(' | ')}`,
    customContext ? `Trader Hypothesis / Catalyst Note: ${customContext}` : '',
    `Constraints: Forecast path must have exactly 6 forward steps starting near current price $${tech.latestPrice}. Ensure stopLoss and targetPrices (tp1, tp2) are realistic relative to ATR $${tech.atr14.toFixed(bundle.asset.decimals)}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const config = {
    systemInstruction:
      'You are a senior quantitative crypto strategist at an institutional trading desk. Combine technical structure, orderflow, and multi-source sentiment into precise, realistic, risk-managed trade forecasts. Keep thesis concise and factual.',
    thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        direction: {
          type: Type.STRING,
          enum: ['LONG', 'SHORT', 'NEUTRAL'],
        },
        confidence: { type: Type.INTEGER },
        horizon: { type: Type.STRING },
        entryZone: {
          type: Type.OBJECT,
          properties: {
            low: { type: Type.NUMBER },
            high: { type: Type.NUMBER },
          },
          required: ['low', 'high'],
        },
        targetPrices: {
          type: Type.OBJECT,
          properties: {
            tp1: { type: Type.NUMBER },
            tp2: { type: Type.NUMBER },
          },
          required: ['tp1', 'tp2'],
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
              lowerBound: { type: Type.NUMBER },
            },
            required: [
              'stepLabel',
              'projectedPrice',
              'upperBound',
              'lowerBound',
            ],
          },
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
                enum: ['Bullish', 'Bearish', 'Neutral'],
              },
              weight: { type: Type.STRING },
            },
            required: ['factor', 'impact', 'weight'],
          },
        },
        invalidationCondition: { type: Type.STRING },
      },
      required: [
        'direction',
        'confidence',
        'horizon',
        'entryZone',
        'targetPrices',
        'stopLoss',
        'riskRewardRatio',
        'forecastPath',
        'executiveThesis',
        'keyDrivers',
        'invalidationCondition',
      ],
    },
  };

  const callModel = async (modelId: string) => {
    return ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config:
        modelId === 'gemini-4-hydrogen'
          ? config
          : {
              systemInstruction: config.systemInstruction,
              responseMimeType: config.responseMimeType,
              responseSchema: config.responseSchema,
            },
    });
  };

  try {
    let usedModel = 'Gemini 4 Hydrogen';
    let response;
    try {
      response = await callModel('gemini-4-hydrogen');
    } catch (primaryErr) {
      const msg = primaryErr instanceof Error ? primaryErr.message : '';
      if (msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE')) {
        await new Promise((r) => setTimeout(r, 850));
        try {
          response = await callModel('gemini-4-hydrogen');
        } catch {
          usedModel = 'Gemini 3.1 Flash Lite';
          response = await callModel('gemini-3.1-flash-lite');
        }
      } else {
        throw primaryErr;
      }
    }

    const rawText = (response.text ?? '').trim();
    const parsed = JSON.parse(rawText) as Omit<
      AITradeForecast,
      'asset' | 'timeframe' | 'generatedAt' | 'sourceModel'
    >;

    const forecast: AITradeForecast = {
      ...parsed,
      asset: symbol,
      timeframe,
      generatedAt: Date.now(),
      sourceModel: usedModel,
      confidence: Math.max(1, Math.min(99, Math.round(parsed.confidence))),
      forecastPath: (parsed.forecastPath || []).slice(0, 6),
    };

    res.json({ forecast });
  } catch (err) {
    let cleanMsg = 'Gemini AI service is temporarily busy. Please retry shortly.';
    if (err instanceof Error) {
      try {
        const parsedErr = JSON.parse(err.message) as {
          error?: { message?: string };
        };
        cleanMsg = parsedErr.error?.message || err.message;
      } catch {
        cleanMsg = err.message;
      }
    }
    res.status(502).json({ error: cleanMsg });
  }
});

export default app;
