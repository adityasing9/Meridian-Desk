import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Search,
  Send,
} from 'lucide-react';
import { ASSETS } from '../lib/marketData';
import type {
  AssetSymbol,
  SentimentItem,
  SentimentOverview,
  SignalBias,
} from '../lib/types';

interface SentimentHubProps {
  selectedAsset: AssetSymbol;
  sentiment: SentimentOverview;
  customItems: SentimentItem[];
  onAddCustomItem: (item: SentimentItem) => void;
}

export function SentimentHub({
  selectedAsset,
  sentiment,
  customItems,
  onAddCustomItem,
}: SentimentHubProps) {
  const [biasFilter, setBiasFilter] = useState<'All' | SignalBias>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [headlineInput, setHeadlineInput] = useState('');
  const [catalystAsset, setCatalystAsset] = useState<AssetSymbol | 'MARKET'>(
    selectedAsset
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isScoring, setIsScoring] = useState(false);

  const combinedFeed = useMemo(
    () => [...customItems, ...sentiment.feed],
    [customItems, sentiment.feed]
  );

  const filteredFeed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedFeed.filter((item) => {
      if (biasFilter !== 'All' && item.bias !== biasFilter) return false;
      if (
        q &&
        !item.headline.toLowerCase().includes(q) &&
        !item.asset.toLowerCase().includes(q) &&
        !item.source.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [combinedFeed, biasFilter, searchQuery]);

  async function handleScoreCatalyst(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = headlineInput.trim();
    if (trimmed.length < 4) {
      setFormError('Enter at least 4 characters to score a catalyst headline.');
      return;
    }
    setFormError(null);
    setIsScoring(true);
    try {
      const res = await fetch('/api/sentiment/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: trimmed, asset: catalystAsset }),
      });
      const data = (await res.json()) as {
        item?: SentimentItem;
        error?: string;
      };
      if (!res.ok || !data.item) {
        setFormError(data.error || 'Could not score headline.');
      } else {
        onAddCustomItem(data.item);
        setHeadlineInput('');
      }
    } catch {
      setFormError('Network error while scoring catalyst.');
    } finally {
      setIsScoring(false);
    }
  }

  // Fear & Greed chart geometry
  const fgPoints = sentiment.fearGreedHistory;
  const fgWidth = 540;
  const fgHeight = 140;
  const fgPolyline = fgPoints
    .map((pt, idx) => {
      const x = 16 + (idx / Math.max(1, fgPoints.length - 1)) * (fgWidth - 32);
      const y = 16 + ((100 - pt.value) / 100) * (fgHeight - 38);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-4">
      {/* Top 4-Source Breakdown + Fear & Greed Trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#111827] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-100">
                Multi-Source Sentiment Attribution
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Weighted composite across news wire, social velocity, funding skew, and whale netflows
              </p>
            </div>
            <div className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
              Composite {sentiment.compositeIndex}/100 · {sentiment.bias}
            </div>
          </div>

          <div className="mt-3 divide-y divide-slate-800/80">
            {sentiment.sources.map((src) => {
              const Icon =
                src.bias === 'Bullish'
                  ? ArrowUpRight
                  : src.bias === 'Bearish'
                  ? ArrowDownRight
                  : Minus;
              const colorClass =
                src.bias === 'Bullish'
                  ? 'text-emerald-400'
                  : src.bias === 'Bearish'
                  ? 'text-rose-400'
                  : 'text-amber-400';

              return (
                <div
                  key={src.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100">
                        {src.label}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span
                        className={`inline-flex items-center gap-0.5 font-mono text-xs font-medium ${colorClass}`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {src.bias}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{src.detail}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full ${
                          src.score >= 56
                            ? 'bg-emerald-500'
                            : src.score <= 44
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${src.score}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-xs font-semibold text-slate-100 tabular-nums">
                      {src.score}/100
                    </span>
                    <span
                      className={`w-14 text-right font-mono text-xs tabular-nums ${
                        src.delta24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {src.delta24h >= 0 ? '+' : ''}
                      {src.delta24h}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Divergence Detector + 14D Fear & Greed Trend */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Price vs. Sentiment Divergence
              </h3>
              <span
                className={`font-mono text-xs font-semibold ${
                  sentiment.divergenceStatus === 'Bullish Divergence'
                    ? 'text-emerald-400'
                    : sentiment.divergenceStatus === 'Bearish Divergence'
                    ? 'text-rose-400'
                    : 'text-sky-400'
                }`}
              >
                {sentiment.divergenceStatus}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {sentiment.divergenceNote}
            </p>
          </div>

          <div className="flex-1 rounded-xl border border-slate-800 bg-[#111827] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                14-Day Fear &amp; Greed Trajectory
              </h3>
              {fgPoints.length > 0 && (
                <span className="font-mono text-xs text-slate-300 tabular-nums">
                  Latest {fgPoints[fgPoints.length - 1].value} ·{' '}
                  {fgPoints[fgPoints.length - 1].classification}
                </span>
              )}
            </div>

            <svg
              viewBox={`0 0 ${fgWidth} ${fgHeight}`}
              className="mt-2 w-full h-auto"
              role="img"
              aria-label="14-day crypto fear and greed index trend"
            >
              <line
                x1={16}
                x2={fgWidth - 16}
                y1={16 + 0.5 * (fgHeight - 38)}
                y2={16 + 0.5 * (fgHeight - 38)}
                stroke="#1E293B"
                strokeDasharray="3 3"
              />
              {fgPolyline && (
                <polyline
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2"
                  points={fgPolyline}
                />
              )}
              {fgPoints.map((pt, idx) => {
                const x =
                  16 +
                  (idx / Math.max(1, fgPoints.length - 1)) * (fgWidth - 32);
                const y = 16 + ((100 - pt.value) / 100) * (fgHeight - 38);
                return (
                  <g key={pt.dateLabel + idx}>
                    <circle cx={x} cy={y} r="3" fill="#38BDF8" />
                    {(idx === 0 ||
                      idx === Math.floor(fgPoints.length / 2) ||
                      idx === fgPoints.length - 1) && (
                      <text
                        x={x}
                        y={fgHeight - 4}
                        textAnchor="middle"
                        fill="#64748B"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {pt.dateLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Custom Catalyst Impact Scorer + Live Catalyst Wire */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-[#111827] p-4">
          <h3 className="font-display text-sm font-semibold text-slate-100">
            Catalyst Impact Scorer
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Test any breaking macro or token headline to score polarity, impact tier, and keyword drivers.
          </p>

          <form onSubmit={handleScoreCatalyst} className="mt-3 space-y-3">
            <div>
              <label
                htmlFor="catalyst-asset-select"
                className="block text-xs text-slate-300"
              >
                Target Asset
              </label>
              <select
                id="catalyst-asset-select"
                value={catalystAsset}
                onChange={(e) =>
                  setCatalystAsset(e.target.value as AssetSymbol | 'MARKET')
                }
                className="mt-1 w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="MARKET">MARKET (Macro)</option>
                {ASSETS.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.pair} ({a.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="catalyst-headline-input"
                className="block text-xs text-slate-300"
              >
                Headline or Catalyst Text
              </label>
              <textarea
                id="catalyst-headline-input"
                rows={3}
                value={headlineInput}
                onChange={(e) => setHeadlineInput(e.target.value)}
                placeholder="e.g., Major institutional custody bank announces spot ETF inflows surge"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            {formError && (
              <p role="alert" className="text-xs text-rose-400">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={isScoring}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isScoring ? 'Scoring...' : 'Score & Inject Catalyst'}</span>
            </button>
          </form>
        </div>

        {/* Filterable Catalyst Wire */}
        <div className="lg:col-span-8 rounded-xl border border-slate-800 bg-[#111827] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Tracked Catalyst &amp; Sentiment Wire
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search catalyst headlines"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter keyword or asset"
                  className="rounded-lg border border-slate-800 bg-[#0B0F17] py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div
                role="group"
                aria-label="Filter sentiment bias"
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F17] p-1"
              >
                {(['All', 'Bullish', 'Bearish', 'Neutral'] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setBiasFilter(tab)}
                      aria-pressed={biasFilter === tab}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        biasFilter === tab
                          ? 'bg-slate-800 text-slate-100'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <div
            className="mt-2 divide-y divide-slate-800/80"
            data-testid="sentiment-feed-list"
          >
            {filteredFeed.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No catalysts match the active filter. Try resetting to All or entering a new headline.
              </div>
            ) : (
              filteredFeed.map((item) => {
                const scoreColor =
                  item.bias === 'Bullish'
                    ? 'text-emerald-400'
                    : item.bias === 'Bearish'
                    ? 'text-rose-400'
                    : 'text-amber-400';

                return (
                  <article key={item.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-200">
                          {item.asset}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.source}</span>
                        <span aria-hidden="true">·</span>
                        <span>Impact {item.impact}</span>
                      </div>
                      <span className={`font-mono font-medium tabular-nums ${scoreColor}`}>
                        {item.bias} ({item.score > 0 ? '+' : ''}
                        {item.score})
                      </span>
                    </div>
                    <h4 className="mt-1 text-sm font-medium text-slate-100">
                      {item.headline}
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {item.summary}
                    </p>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
