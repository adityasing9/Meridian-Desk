import { Pause, Play, RefreshCw } from 'lucide-react';
import { ASSETS } from '../lib/marketData';
import type { AssetSymbol, Timeframe } from '../lib/types';

export interface ChartOverlayState {
  ema: boolean;
  bollinger: boolean;
  pivots: boolean;
  forecastCone: boolean;
  rsi: boolean;
  macd: boolean;
}

interface WorkspaceToolbarProps {
  selectedAsset: AssetSymbol;
  onSelectAsset: (symbol: AssetSymbol) => void;
  timeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  isLiveStream: boolean;
  onToggleLiveStream: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  overlays: ChartOverlayState;
  onToggleOverlay: (key: keyof ChartOverlayState) => void;
  showChartControls: boolean;
  dataOrigin: 'live-api' | 'synthetic-stream';
}

const TIMEFRAMES: Timeframe[] = ['15m', '1H', '4H', '1D'];

export function WorkspaceToolbar({
  selectedAsset,
  onSelectAsset,
  timeframe,
  onSelectTimeframe,
  isLiveStream,
  onToggleLiveStream,
  onRefresh,
  isRefreshing,
  overlays,
  onToggleOverlay,
  showChartControls,
  dataOrigin,
}: WorkspaceToolbarProps) {
  return (
    <section
      aria-label="Market controls and indicators"
      className="border-b border-slate-800/80 bg-[#0F141F]"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 sm:px-6">
        {/* Asset Pair Selector */}
        <div className="flex max-w-full flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Select crypto asset"
            className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-[#0B0F17] p-1"
          >
            {ASSETS.map((asset) => {
              const active = selectedAsset === asset.symbol;
              return (
                <button
                  key={asset.symbol}
                  type="button"
                  onClick={() => onSelectAsset(asset.symbol)}
                  aria-pressed={active}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    active
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {asset.pair}
                </button>
              );
            })}
          </div>

          {/* Timeframe Selector */}
          <div
            role="group"
            aria-label="Select chart timeframe"
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F17] p-1"
          >
            {TIMEFRAMES.map((tf) => {
              const active = timeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onSelectTimeframe(tf)}
                  aria-pressed={active}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    active
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        </div>

        {/* Indicator Toggles & Stream Control */}
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {showChartControls && (
            <div
              role="group"
              aria-label="Technical chart overlays"
              className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-[#0B0F17] p-1"
            >
              {(
                [
                  ['ema', 'EMA 20/50'],
                  ['bollinger', 'Bollinger'],
                  ['pivots', 'S/R Levels'],
                  ['forecastCone', 'AI Cone'],
                  ['rsi', 'RSI'],
                  ['macd', 'MACD'],
                ] as const
              ).map(([key, label]) => {
                const active = overlays[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onToggleOverlay(key)}
                    aria-pressed={active}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      active
                        ? 'bg-slate-800 text-sky-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleLiveStream}
            aria-pressed={isLiveStream}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              isLiveStream
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-800 bg-[#0B0F17] text-slate-300 hover:text-slate-100'
            }`}
          >
            {isLiveStream ? (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Live Feed</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Paused</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh market data"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0B0F17] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {dataOrigin === 'live-api' ? 'Spot Synced' : 'Desk Feed'}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
