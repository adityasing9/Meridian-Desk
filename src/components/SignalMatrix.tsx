import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Minus,
} from 'lucide-react';
import type {
  AssetSymbol,
  ScannerAssetRow,
  SignalBias,
  Timeframe,
} from '../lib/types';

interface SignalMatrixProps {
  rows: ScannerAssetRow[];
  timeframe: Timeframe;
  selectedAsset: AssetSymbol;
  onInspectAsset: (symbol: AssetSymbol) => void;
}

type SortKey = 'price' | 'change24hPct' | 'rsi14' | 'sentimentIndex' | 'confidenceScore';

export function SignalMatrix({
  rows,
  timeframe,
  selectedAsset,
  onInspectAsset,
}: SignalMatrixProps) {
  const [biasFilter, setBiasFilter] = useState<'All' | SignalBias>('All');
  const [sortKey, setSortKey] = useState<SortKey>('confidenceScore');
  const [sortAsc, setSortAsc] = useState(false);

  const visibleRows = useMemo(() => {
    return rows
      .filter((r) => (biasFilter === 'All' ? true : r.compositeBias === biasFilter))
      .slice()
      .sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortAsc ? diff : -diff;
      });
  }, [rows, biasFilter, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-100">
            Cross-Asset Signal Matrix ({timeframe})
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Unified technical momentum, sentiment alignment, and divergence scan across major pairs
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter matrix by bias"
          className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F17] p-1"
        >
          {(['All', 'Bullish', 'Bearish', 'Neutral'] as const).map((tab) => (
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
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2.5 pr-4 font-medium">Asset</th>
              <th className="py-2.5 px-3 text-right font-medium">
                <button
                  type="button"
                  onClick={() => handleSort('price')}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <span>Price</span>
                  <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right font-medium">
                <button
                  type="button"
                  onClick={() => handleSort('change24hPct')}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <span>24P Change</span>
                  <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right font-medium">
                <button
                  type="button"
                  onClick={() => handleSort('rsi14')}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <span>RSI(14)</span>
                  <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium">EMA Trend</th>
              <th className="py-2.5 px-3 text-right font-medium">
                <button
                  type="button"
                  onClick={() => handleSort('sentimentIndex')}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <span>Sentiment</span>
                  <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium">Divergence</th>
              <th className="py-2.5 px-3 text-right font-medium">
                <button
                  type="button"
                  onClick={() => handleSort('confidenceScore')}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <span>Signal</span>
                  <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 pl-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  No assets match the selected bias filter.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const BiasIcon =
                  row.compositeBias === 'Bullish'
                    ? ArrowUpRight
                    : row.compositeBias === 'Bearish'
                    ? ArrowDownRight
                    : Minus;
                const biasColor =
                  row.compositeBias === 'Bullish'
                    ? 'text-emerald-400'
                    : row.compositeBias === 'Bearish'
                    ? 'text-rose-400'
                    : 'text-amber-400';

                return (
                  <tr
                    key={row.symbol}
                    className={`transition-colors hover:bg-slate-800/35 ${
                      selectedAsset === row.symbol ? 'bg-sky-500/5' : ''
                    }`}
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-100">
                        {row.pair}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {row.name}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-100 tabular-nums">
                      $
                      {row.price.toLocaleString('en-US', {
                        minimumFractionDigits:
                          row.price < 0.1 ? 5 : row.price < 5 ? 4 : 2,
                        maximumFractionDigits:
                          row.price < 0.1 ? 5 : row.price < 5 ? 4 : 2,
                      })}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono tabular-nums ${
                        row.change24hPct >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {row.change24hPct >= 0 ? '+' : ''}
                      {row.change24hPct.toFixed(2)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200 tabular-nums">
                      {row.rsi14.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{row.emaTrend}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200 tabular-nums">
                      {row.sentimentIndex}/100
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {row.divergence}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1 font-mono font-medium tabular-nums ${biasColor}`}
                      >
                        <BiasIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {row.compositeBias} ({row.confidenceScore}%)
                        </span>
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectAsset(row.symbol)}
                        className="rounded-md border border-slate-700 bg-[#0B0F17] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-sky-500 hover:text-sky-300 whitespace-nowrap"
                      >
                        Open {row.symbol}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
