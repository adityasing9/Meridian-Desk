import { useMemo, useState } from 'react';
import { runStrategyBacktest } from '../lib/backtest';
import type { AssetMeta, BacktestConfig, Candle, Timeframe } from '../lib/types';

interface BacktestLabProps {
  asset: AssetMeta;
  timeframe: Timeframe;
  candles: Candle[];
  baseSentimentIndex: number;
}

export function BacktestLab({
  asset,
  timeframe,
  candles,
  baseSentimentIndex,
}: BacktestLabProps) {
  const [config, setConfig] = useState<BacktestConfig>({
    rsiOversold: 34,
    rsiOverbought: 66,
    sentimentWeight: 0.45,
    stopAtrMultiplier: 1.5,
    takeProfitR: 2.2,
  });

  const sentimentSeries = useMemo(() => {
    return candles.map((_, idx) =>
      Math.max(
        15,
        Math.min(
          85,
          Math.round(baseSentimentIndex + Math.sin(idx * 0.28) * 18)
        )
      )
    );
  }, [candles, baseSentimentIndex]);

  const result = useMemo(
    () => runStrategyBacktest(candles, sentimentSeries, config),
    [candles, sentimentSeries, config]
  );

  // Equity curve SVG coordinates
  const svgW = 680;
  const svgH = 200;
  const { polyline, minEq, maxEq } = useMemo(() => {
    const pts = result.equityCurve;
    if (pts.length === 0) return { polyline: '', minEq: 9000, maxEq: 11000 };
    const values = pts.map((p) => p.equity);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = Math.max(maxV - minV, 200);
    const lo = minV - span * 0.1;
    const hi = maxV + span * 0.1;

    const line = pts
      .map((p, idx) => {
        const x = 16 + (idx / Math.max(1, pts.length - 1)) * (svgW - 32);
        const y = 16 + (1 - (p.equity - lo) / (hi - lo)) * (svgH - 36);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return { polyline: line, minEq: lo, maxEq: hi };
  }, [result.equityCurve]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Parameter Controls */}
      <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-[#111827] p-4 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Strategy Backtest Parameters
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Simulating {asset.pair} ({timeframe}) on $10,000 initial desk equity
          </p>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <div className="flex justify-between text-slate-300">
              <label htmlFor="bt-rsi-low">RSI Oversold Entry</label>
              <span className="font-mono tabular-nums">{config.rsiOversold}</span>
            </div>
            <input
              id="bt-rsi-low"
              type="range"
              min="20"
              max="45"
              step="1"
              value={config.rsiOversold}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  rsiOversold: Number(e.target.value),
                }))
              }
              className="mt-1 w-full accent-sky-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300">
              <label htmlFor="bt-rsi-high">RSI Overbought Short</label>
              <span className="font-mono tabular-nums">{config.rsiOverbought}</span>
            </div>
            <input
              id="bt-rsi-high"
              type="range"
              min="55"
              max="80"
              step="1"
              value={config.rsiOverbought}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  rsiOverbought: Number(e.target.value),
                }))
              }
              className="mt-1 w-full accent-sky-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300">
              <label htmlFor="bt-sent-weight">Sentiment Signal Weight</label>
              <span className="font-mono tabular-nums">
                {Math.round(config.sentimentWeight * 100)}%
              </span>
            </div>
            <input
              id="bt-sent-weight"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.sentimentWeight}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  sentimentWeight: Number(e.target.value),
                }))
              }
              className="mt-1 w-full accent-sky-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300">
              <label htmlFor="bt-atr-stop">Stop-Loss ATR Multiplier</label>
              <span className="font-mono tabular-nums">
                {config.stopAtrMultiplier.toFixed(1)}x
              </span>
            </div>
            <input
              id="bt-atr-stop"
              type="range"
              min="0.8"
              max="3.0"
              step="0.1"
              value={config.stopAtrMultiplier}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  stopAtrMultiplier: Number(e.target.value),
                }))
              }
              className="mt-1 w-full accent-sky-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300">
              <label htmlFor="bt-tp-r">Take-Profit Target (R)</label>
              <span className="font-mono tabular-nums">
                {config.takeProfitR.toFixed(1)}R
              </span>
            </div>
            <input
              id="bt-tp-r"
              type="range"
              min="1.2"
              max="4.0"
              step="0.2"
              value={config.takeProfitR}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  takeProfitR: Number(e.target.value),
                }))
              }
              className="mt-1 w-full accent-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Results & Equity Curve */}
      <div className="lg:col-span-8 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            {
              label: 'Final Equity',
              value: `$${result.finalEquityUsd.toLocaleString('en-US')}`,
              tone:
                result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400',
            },
            {
              label: 'Total Return',
              value: `${result.totalReturnPct >= 0 ? '+' : ''}${result.totalReturnPct}%`,
              tone:
                result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400',
            },
            {
              label: 'Win Rate',
              value: `${result.winRatePct}%`,
              tone: 'text-slate-100',
            },
            {
              label: 'Profit Factor',
              value: `${result.profitFactor}`,
              tone: 'text-sky-300',
            },
            {
              label: 'Max Drawdown',
              value: `-${result.maxDrawdownPct}%`,
              tone: 'text-rose-400',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-800 bg-[#111827] p-3"
            >
              <span className="text-[11px] text-slate-400">{stat.label}</span>
              <p
                className={`mt-1 font-mono text-base font-semibold tabular-nums ${stat.tone}`}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
          <div className="flex items-center justify-between text-xs">
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Simulated Equity Curve
            </h3>
            <span className="font-mono text-slate-400 tabular-nums">
              {result.totalTrades} closed trades · Range ${Math.round(minEq).toLocaleString()} – $
              {Math.round(maxEq).toLocaleString()}
            </span>
          </div>

          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="mt-2 w-full h-auto"
            role="img"
            aria-label="Simulated strategy equity curve"
          >
            <line
              x1={16}
              x2={svgW - 16}
              y1={svgH / 2}
              y2={svgH / 2}
              stroke="#1E293B"
              strokeDasharray="3 3"
            />
            {polyline && (
              <polyline
                fill="none"
                stroke={result.totalReturnPct >= 0 ? '#10B981' : '#EF4444'}
                strokeWidth="2"
                points={polyline}
              />
            )}
          </svg>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
          <h3 className="font-display text-sm font-semibold text-slate-100">
            Recent Simulated Trades
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Side</th>
                  <th className="py-2 px-3 text-right font-medium">Entry</th>
                  <th className="py-2 px-3 text-right font-medium">Exit</th>
                  <th className="py-2 px-3 text-right font-medium">Return</th>
                  <th className="py-2 pl-3 text-right font-medium">PnL ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {result.trades.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center font-sans text-slate-400"
                    >
                      No trades triggered under these thresholds. Widen RSI bounds to test more entries.
                    </td>
                  </tr>
                ) : (
                  result.trades.slice(0, 6).map((t) => (
                    <tr key={t.id}>
                      <td
                        className={`py-2 pr-3 font-medium ${
                          t.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.side}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-200">
                        ${t.entryPrice.toLocaleString('en-US')}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-200">
                        ${t.exitPrice.toLocaleString('en-US')}
                      </td>
                      <td
                        className={`py-2 px-3 text-right ${
                          t.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.returnPct >= 0 ? '+' : ''}
                        {t.returnPct}%
                      </td>
                      <td
                        className={`py-2 pl-3 text-right ${
                          t.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.pnlUsd >= 0 ? '+' : ''}${t.pnlUsd}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
