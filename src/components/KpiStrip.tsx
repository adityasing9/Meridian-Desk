import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type {
  AITradeForecast,
  AssetMeta,
  SentimentOverview,
  SignalBias,
  TechnicalSnapshot,
} from '../lib/types';

interface KpiStripProps {
  asset: AssetMeta;
  technicals: TechnicalSnapshot;
  sentiment: SentimentOverview;
  forecast: AITradeForecast;
}

function BiasBadge({ bias, label }: { bias: SignalBias; label: string }) {
  if (bias === 'Bullish') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-emerald-400">
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (bias === 'Bearish') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-rose-400">
        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-amber-400">
      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function KpiStrip({
  asset,
  technicals,
  sentiment,
  forecast,
}: KpiStripProps) {
  const isUp = technicals.priceChangePct >= 0;
  const forecastBias: SignalBias =
    forecast.direction === 'LONG'
      ? 'Bullish'
      : forecast.direction === 'SHORT'
      ? 'Bearish'
      : 'Neutral';

  return (
    <section
      aria-label="Key market and sentiment indicators"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* 1. Spot Price & 24h Move */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{asset.name} Spot</span>
          <span className="font-mono">{asset.pair}</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span
            data-testid="kpi-spot-price"
            className="font-mono text-xl font-semibold tracking-tight text-slate-100 tabular-nums"
          >
            $
            {technicals.latestPrice.toLocaleString('en-US', {
              minimumFractionDigits: asset.decimals,
              maximumFractionDigits: asset.decimals,
            })}
          </span>
          <BiasBadge
            bias={isUp ? 'Bullish' : 'Bearish'}
            label={`${isUp ? '+' : ''}${technicals.priceChangePct.toFixed(2)}%`}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
          ATR(14) ${technicals.atr14.toFixed(asset.decimals)} · S1 $
          {technicals.supportLevels[0].toLocaleString('en-US', {
            minimumFractionDigits: asset.decimals,
            maximumFractionDigits: asset.decimals,
          })}
        </p>
      </div>

      {/* 2. Technical Regime */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Technical Regime</span>
          <span>EMA · RSI · MACD</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="font-mono text-xl font-semibold text-slate-100 tabular-nums">
            {technicals.technicalScore > 0 ? '+' : ''}
            {technicals.technicalScore}
            <span className="text-xs font-normal text-slate-400"> / 100</span>
          </span>
          <BiasBadge
            bias={technicals.technicalBias}
            label={technicals.technicalBias}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
          RSI(14) {technicals.latestRsi} · {technicals.bollingerPosition}
        </p>
      </div>

      {/* 3. Integrated Sentiment Index */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Sentiment Index</span>
          <span>4 Sources</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span
            data-testid="kpi-sentiment-index"
            className="font-mono text-xl font-semibold text-slate-100 tabular-nums"
          >
            {sentiment.compositeIndex}
            <span className="text-xs font-normal text-slate-400"> / 100</span>
          </span>
          <BiasBadge
            bias={sentiment.bias}
            label={`${sentiment.bias} (${sentiment.delta24h >= 0 ? '+' : ''}${sentiment.delta24h})`}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400 truncate">
          Divergence: <span className="text-slate-200">{sentiment.divergenceStatus}</span>
        </p>
      </div>

      {/* 4. AI Trade Setup */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Active AI Setup</span>
          <span className="whitespace-nowrap">
            {forecast.sourceModel === 'Quantitative Baseline Engine'
              ? 'Baseline Quant'
              : forecast.sourceModel}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="font-mono text-xl font-semibold text-slate-100 tabular-nums">
            {forecast.confidence}%
            <span className="text-xs font-normal text-slate-400"> conf.</span>
          </span>
          <BiasBadge bias={forecastBias} label={forecast.direction} />
        </div>
        <p className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
          R:R {forecast.riskRewardRatio} · Horizon {forecast.horizon}
        </p>
      </div>
    </section>
  );
}
