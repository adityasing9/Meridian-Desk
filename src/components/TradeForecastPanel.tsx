import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { calculatePositionSize } from '../lib/backtest';
import type { AITradeForecast, OrderBookSnapshot } from '../lib/types';

interface TradeForecastPanelProps {
  forecast: AITradeForecast;
  decimals: number;
  currentPrice: number;
  orderBook: OrderBookSnapshot;
  isPredicting: boolean;
  aiError: string | null;
  customHypothesis: string;
  onChangeHypothesis: (val: string) => void;
  onRunForecast: () => void;
  onClearAiError: () => void;
}

function fmt(val: number, decimals: number): string {
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function TradeForecastPanel({
  forecast,
  decimals,
  currentPrice,
  orderBook,
  isPredicting,
  aiError,
  customHypothesis,
  onChangeHypothesis,
  onRunForecast,
  onClearAiError,
}: TradeForecastPanelProps) {
  const [accountEquity, setAccountEquity] = useState<string>('25000');
  const [riskPercent, setRiskPercent] = useState<string>('1.5');

  const sizing = useMemo(() => {
    const equityNum = Number(accountEquity) || 0;
    const riskNum = Number(riskPercent) || 0;
    const entryMid = (forecast.entryZone.low + forecast.entryZone.high) / 2;
    return calculatePositionSize({
      accountEquity: equityNum,
      riskPercent: riskNum,
      entryPrice: entryMid || currentPrice,
      stopLoss: forecast.stopLoss,
      targetPrice: forecast.targetPrices.tp2,
    });
  }, [accountEquity, riskPercent, forecast, currentPrice]);

  const directionStyles =
    forecast.direction === 'LONG'
      ? {
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/30',
          Icon: ArrowUpRight,
          label: 'LONG BIAS',
        }
      : forecast.direction === 'SHORT'
      ? {
          color: 'text-rose-400',
          bg: 'bg-rose-500/10 border-rose-500/30',
          Icon: ArrowDownRight,
          label: 'SHORT BIAS',
        }
      : {
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/30',
          Icon: Minus,
          label: 'NEUTRAL / RANGE',
        };

  const DirIcon = directionStyles.Icon;

  return (
    <aside className="flex flex-col gap-4">
      {/* AI Trade Prediction Card */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              AI Trade Prediction
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {forecast.sourceModel} · Horizon {forecast.horizon}
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold ${directionStyles.bg} ${directionStyles.color}`}
          >
            <DirIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{directionStyles.label}</span>
          </div>
        </div>

        {aiError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-medium text-amber-100">
                  Live AI Synthesis Notice
                </p>
                <p className="mt-1 text-amber-200/90">{aiError}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onRunForecast}
                    className="inline-flex items-center gap-1 font-medium text-sky-300 hover:text-sky-200 underline"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Retry Gemini Forecast
                  </button>
                  <button
                    type="button"
                    onClick={onClearAiError}
                    className="text-slate-300 hover:text-slate-100"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actionable Levels Grid */}
        <div className="mt-3 grid grid-cols-2 gap-3 border-b border-slate-800 pb-3 font-mono text-xs tabular-nums">
          <div>
            <span className="font-sans text-[11px] text-slate-400">
              Entry Zone
            </span>
            <p className="mt-0.5 font-medium text-slate-100">
              ${fmt(forecast.entryZone.low, decimals)} – $
              {fmt(forecast.entryZone.high, decimals)}
            </p>
          </div>
          <div>
            <span className="font-sans text-[11px] text-slate-400">
              Confidence / R:R
            </span>
            <p className="mt-0.5 font-medium text-sky-300">
              {forecast.confidence}% · {forecast.riskRewardRatio}
            </p>
          </div>
          <div>
            <span className="font-sans text-[11px] text-slate-400">
              Targets (TP1 / TP2)
            </span>
            <p className="mt-0.5 font-medium text-emerald-400">
              ${fmt(forecast.targetPrices.tp1, decimals)} / $
              {fmt(forecast.targetPrices.tp2, decimals)}
            </p>
          </div>
          <div>
            <span className="font-sans text-[11px] text-slate-400">
              Stop Loss
            </span>
            <p className="mt-0.5 font-medium text-rose-400">
              ${fmt(forecast.stopLoss, decimals)}
            </p>
          </div>
        </div>

        {/* Executive Thesis */}
        <div className="mt-3 space-y-2.5 text-xs">
          <p className="leading-relaxed text-slate-300">
            {forecast.executiveThesis}
          </p>

          <div className="space-y-1.5 pt-1">
            {forecast.keyDrivers.map((driver, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-1.5 last:border-b-0 last:pb-0"
              >
                <span className="text-slate-300 truncate">{driver.factor}</span>
                <span
                  className={`font-mono text-[11px] font-medium shrink-0 ${
                    driver.impact === 'Bullish'
                      ? 'text-emerald-400'
                      : driver.impact === 'Bearish'
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {driver.impact} · {driver.weight}
                </span>
              </div>
            ))}
          </div>

          <p className="pt-1 text-[11px] text-slate-400">
            <strong className="font-medium text-slate-300">Invalidation:</strong>{' '}
            {forecast.invalidationCondition}
          </p>
        </div>

        {/* Custom Catalyst Hypothesis Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRunForecast();
          }}
          className="mt-3 border-t border-slate-800 pt-3"
        >
          <label
            htmlFor="ai-hypothesis-input"
            className="block text-[11px] font-medium text-slate-400"
          >
            Custom catalyst or macro note (optional)
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="ai-hypothesis-input"
              type="text"
              value={customHypothesis}
              onChange={(e) => onChangeHypothesis(e.target.value)}
              placeholder="e.g., CPI print softer than consensus"
              className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isPredicting}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/25 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              <span>Synthesize</span>
            </button>
          </div>
        </form>
      </div>

      {/* Position Sizing & Risk Calculator */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <h3 className="font-display text-sm font-semibold text-slate-100">
          Position Risk Calculator
        </h3>
        <div className="mt-2.5 grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="account-equity-input"
              className="block text-[11px] text-slate-400"
            >
              Account Equity ($)
            </label>
            <input
              id="account-equity-input"
              type="number"
              min="100"
              step="500"
              value={accountEquity}
              onChange={(e) => setAccountEquity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-2.5 py-1.5 font-mono text-xs text-slate-100 tabular-nums focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="risk-percent-input"
              className="block text-[11px] text-slate-400"
            >
              Risk per Trade (%)
            </label>
            <input
              id="risk-percent-input"
              type="number"
              min="0.1"
              max="10"
              step="0.25"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-2.5 py-1.5 font-mono text-xs text-slate-100 tabular-nums focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-y-2 border-t border-slate-800 pt-3 font-mono text-xs tabular-nums">
          <div>
            <span className="font-sans text-[11px] text-slate-400">
              Position Size
            </span>
            <p className="font-medium text-slate-100" data-testid="calc-position-units">
              {sizing.valid ? `${sizing.positionUnits} ${forecast.asset}` : '—'}
            </p>
          </div>
          <div>
            <span className="font-sans text-[11px] text-slate-400">
              Notional Exposure
            </span>
            <p className="font-medium text-slate-100">
              {sizing.valid
                ? `$${sizing.positionNotionalUsd.toLocaleString('en-US')}`
                : '—'}
            </p>
          </div>
          <div>
            <span className="font-sans text-[11px] text-slate-400">
              Max Risk ({sizing.stopDistancePct}% SL)
            </span>
            <p className="font-medium text-rose-400" data-testid="calc-max-risk">
              {sizing.valid ? `-$${sizing.riskUsd.toLocaleString('en-US')}` : '—'}
            </p>
          </div>
          <div>
            <span className="font-sans text-[11px] text-slate-400">
              Projected TP2 Gain
            </span>
            <p className="font-medium text-emerald-400">
              {sizing.valid
                ? `+$${sizing.projectedProfitUsd.toLocaleString('en-US')}`
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Orderflow & Derivatives Depth Snapshot */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-slate-100">
            Orderflow &amp; Derivatives
          </h3>
          <span
            className={`font-mono text-xs font-medium ${
              orderBook.bidAskImbalancePct >= 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {orderBook.bidAskImbalancePct >= 0 ? 'Bid Heavy' : 'Ask Heavy'}{' '}
            {orderBook.bidAskImbalancePct >= 0 ? '+' : ''}
            {orderBook.bidAskImbalancePct}%
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2 border-b border-slate-800 pb-3 font-mono text-xs tabular-nums">
          <div>
            <span className="font-sans text-[11px] text-slate-400">Funding</span>
            <p className="text-slate-100">{orderBook.fundingRatePct}%</p>
          </div>
          <div>
            <span className="font-sans text-[11px] text-slate-400">OI 24h</span>
            <p
              className={
                orderBook.openInterestChangePct >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }
            >
              {orderBook.openInterestChangePct >= 0 ? '+' : ''}
              {orderBook.openInterestChangePct}%
            </p>
          </div>
          <div>
            <span className="font-sans text-[11px] text-slate-400">Spread</span>
            <p className="text-slate-100">{orderBook.spreadBps} bps</p>
          </div>
        </div>

        {/* Top 3 Bids vs Asks */}
        <div className="mt-2.5 grid grid-cols-2 gap-3 font-mono text-[11px] tabular-nums">
          <div className="space-y-1">
            <div className="flex justify-between font-sans text-slate-400">
              <span>Bid</span>
              <span>Depth</span>
            </div>
            {orderBook.bids.slice(0, 3).map((b, i) => (
              <div key={i} className="flex justify-between text-emerald-400">
                <span>{fmt(b.price, decimals)}</span>
                <span className="text-slate-300">
                  ${Math.round(b.totalUsd / 1000)}k
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between font-sans text-slate-400">
              <span>Ask</span>
              <span>Depth</span>
            </div>
            {orderBook.asks.slice(0, 3).map((a, i) => (
              <div key={i} className="flex justify-between text-rose-400">
                <span>{fmt(a.price, decimals)}</span>
                <span className="text-slate-300">
                  ${Math.round(a.totalUsd / 1000)}k
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
