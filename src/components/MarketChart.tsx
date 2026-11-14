import { useMemo, useState } from 'react';
import type {
  AITradeForecast,
  Candle,
  TechnicalSnapshot,
  Timeframe,
} from '../lib/types';
import type { ChartOverlayState } from './WorkspaceToolbar';

interface MarketChartProps {
  pair: string;
  decimals: number;
  timeframe: Timeframe;
  candles: Candle[];
  technicals: TechnicalSnapshot;
  forecast: AITradeForecast;
  overlays: ChartOverlayState;
}

function formatPrice(val: number, decimals: number): string {
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatTimeLabel(ts: number, timeframe: Timeframe): string {
  const d = new Date(ts);
  if (timeframe === '1D') {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export function MarketChart({
  pair,
  decimals,
  timeframe,
  candles,
  technicals,
  forecast,
  overlays,
}: MarketChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Display most recent 64 candles plus space for 6 forecast steps
  const visibleCount = Math.min(64, candles.length);
  const offset = candles.length - visibleCount;

  const visibleCandles = useMemo(
    () => candles.slice(offset),
    [candles, offset]
  );

  const forecastSteps = overlays.forecastCone ? forecast.forecastPath : [];
  const totalSlots = visibleCandles.length + forecastSteps.length;

  const svgWidth = 920;
  const priceHeight = 330;
  const rsiHeight = overlays.rsi ? 90 : 0;
  const macdHeight = overlays.macd ? 90 : 0;
  const gap = 16;
  const bottomAxisHeight = 28;
  const totalHeight =
    priceHeight +
    (rsiHeight > 0 ? gap + rsiHeight : 0) +
    (macdHeight > 0 ? gap + macdHeight : 0) +
    bottomAxisHeight;

  const padLeft = 14;
  const padRight = 76;
  const plotWidth = svgWidth - padLeft - padRight;

  const { minPrice, maxPrice, maxVol } = useMemo(() => {
    const prices: number[] = [];
    let maxV = 1;
    visibleCandles.forEach((c, idx) => {
      prices.push(c.low, c.high);
      if (c.volume > maxV) maxV = c.volume;
      const globalIdx = offset + idx;
      if (overlays.bollinger) {
        const bb = technicals.bollinger[globalIdx];
        if (bb?.upper) prices.push(bb.upper);
        if (bb?.lower) prices.push(bb.lower);
      }
    });

    if (overlays.forecastCone) {
      forecastSteps.forEach((f) => {
        prices.push(f.lowerBound, f.upperBound);
      });
      prices.push(forecast.stopLoss, forecast.targetPrices.tp1);
    }

    const rawMin = prices.length ? Math.min(...prices) : 0;
    const rawMax = prices.length ? Math.max(...prices) : 100;
    const span = Math.max(rawMax - rawMin, rawMax * 0.01 || 1);
    return {
      minPrice: rawMin - span * 0.08,
      maxPrice: rawMax + span * 0.08,
      maxVol: maxV,
    };
  }, [
    visibleCandles,
    offset,
    overlays.bollinger,
    overlays.forecastCone,
    technicals.bollinger,
    forecastSteps,
    forecast.stopLoss,
    forecast.targetPrices.tp1,
  ]);

  const xForSlot = (slotIdx: number) =>
    padLeft + ((slotIdx + 0.5) / Math.max(1, totalSlots)) * plotWidth;

  const yForPrice = (p: number) => {
    const ratio = (p - minPrice) / Math.max(1e-9, maxPrice - minPrice);
    return 18 + (1 - ratio) * (priceHeight - 36);
  };

  const slotWidth = plotWidth / Math.max(1, totalSlots);
  const candleBodyWidth = Math.max(3, Math.min(10, slotWidth * 0.62));

  // Build SVG polyline helper
  const buildPolyline = (
    values: (number | null)[],
    yTransform: (val: number) => number
  ) => {
    const pts: string[] = [];
    for (let i = 0; i < visibleCandles.length; i++) {
      const val = values[offset + i];
      if (val !== null && val !== undefined) {
        pts.push(`${xForSlot(i).toFixed(1)},${yTransform(val).toFixed(1)}`);
      }
    }
    return pts.join(' ');
  };

  // Forecast cone polygon & median path
  const lastCandleIdx = visibleCandles.length - 1;
  const lastCandle = visibleCandles[lastCandleIdx];
  const forecastConePoints = useMemo(() => {
    if (!overlays.forecastCone || !lastCandle || forecastSteps.length === 0) {
      return { polygon: '', medianLine: '' };
    }
    const startX = xForSlot(lastCandleIdx);
    const startY = yForPrice(lastCandle.close);

    const upperPts = [`${startX.toFixed(1)},${startY.toFixed(1)}`];
    const lowerPts: string[] = [];
    const medianPts = [`${startX.toFixed(1)},${startY.toFixed(1)}`];

    forecastSteps.forEach((pt, idx) => {
      const x = xForSlot(visibleCandles.length + idx);
      upperPts.push(`${x.toFixed(1)},${yForPrice(pt.upperBound).toFixed(1)}`);
      lowerPts.unshift(`${x.toFixed(1)},${yForPrice(pt.lowerBound).toFixed(1)}`);
      medianPts.push(`${x.toFixed(1)},${yForPrice(pt.projectedPrice).toFixed(1)}`);
    });

    return {
      polygon: [...upperPts, ...lowerPts].join(' '),
      medianLine: medianPts.join(' '),
    };
  }, [overlays.forecastCone, lastCandle, forecastSteps, visibleCandles.length, minPrice, maxPrice]);

  // Price axis ticks
  const priceTicks = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const p = minPrice + ((maxPrice - minPrice) * i) / 4;
      return { price: p, y: yForPrice(p) };
    });
  }, [minPrice, maxPrice]);

  // Active hovered candle or latest
  const inspectedIdx =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < visibleCandles.length
      ? hoverIdx
      : lastCandleIdx;
  const inspectedCandle = visibleCandles[inspectedIdx];
  const inspectedGlobalIdx = offset + inspectedIdx;
  const inspectedRsi = technicals.rsi14[inspectedGlobalIdx];
  const inspectedEma20 = technicals.ema20[inspectedGlobalIdx];
  const inspectedEma50 = technicals.ema50[inspectedGlobalIdx];

  const rsiTop = priceHeight + gap;
  const macdTop = priceHeight + (rsiHeight > 0 ? gap + rsiHeight : 0) + gap;

  const yForRsi = (val: number) =>
    rsiTop + 8 + ((100 - Math.max(0, Math.min(100, val))) / 100) * (rsiHeight - 16);

  const macdRange = useMemo(() => {
    if (!overlays.macd) return 1;
    let maxAbs = 0.0001;
    for (let i = 0; i < visibleCandles.length; i++) {
      const pt = technicals.macd[offset + i];
      if (pt?.macd !== null) maxAbs = Math.max(maxAbs, Math.abs(pt.macd));
      if (pt?.signal !== null) maxAbs = Math.max(maxAbs, Math.abs(pt.signal));
      if (pt?.histogram !== null)
        maxAbs = Math.max(maxAbs, Math.abs(pt.histogram));
    }
    return maxAbs * 1.15;
  }, [overlays.macd, visibleCandles.length, technicals.macd, offset]);

  const yForMacd = (val: number) =>
    macdTop + macdHeight / 2 - (val / macdRange) * (macdHeight * 0.42);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      {/* Live Crosshair Telemetry Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-slate-300 font-mono tabular-nums">
          <span className="font-sans text-sm font-semibold text-slate-100">
            {pair} · {timeframe}
          </span>
          {inspectedCandle && (
            <>
              <span>
                O{' '}
                <strong className="font-medium text-slate-100">
                  {formatPrice(inspectedCandle.open, decimals)}
                </strong>
              </span>
              <span>
                H{' '}
                <strong className="font-medium text-emerald-400">
                  {formatPrice(inspectedCandle.high, decimals)}
                </strong>
              </span>
              <span>
                L{' '}
                <strong className="font-medium text-rose-400">
                  {formatPrice(inspectedCandle.low, decimals)}
                </strong>
              </span>
              <span>
                C{' '}
                <strong className="font-medium text-slate-100">
                  {formatPrice(inspectedCandle.close, decimals)}
                </strong>
              </span>
              <span className="text-slate-400">
                Vol ${(inspectedCandle.volume / 1_000_000).toFixed(2)}M
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums">
          {overlays.ema && inspectedEma20 !== null && (
            <span className="text-sky-400">
              EMA20 {formatPrice(inspectedEma20, decimals)}
            </span>
          )}
          {overlays.ema && inspectedEma50 !== null && (
            <span className="text-amber-400">
              EMA50 {formatPrice(inspectedEma50, decimals)}
            </span>
          )}
          {inspectedRsi !== null && inspectedRsi !== undefined && (
            <span className="text-slate-300">
              RSI(14) {inspectedRsi.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Responsive Interactive SVG Chart */}
      <div className="relative w-full" data-testid="market-chart">
        <svg
          viewBox={`0 0 ${svgWidth} ${totalHeight}`}
          className="w-full h-auto select-none overflow-visible"
          role="img"
          aria-label={`${pair} ${timeframe} candlestick chart with technical overlays and AI forecast cone`}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Horizontal Price Gridlines */}
          {priceTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                x2={svgWidth - padRight}
                y1={t.y}
                y2={t.y}
                stroke="#1E293B"
                strokeWidth="1"
              />
              <text
                x={svgWidth - padRight + 8}
                y={t.y + 4}
                fill="#94A3B8"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatPrice(t.price, decimals)}
              </text>
            </g>
          ))}

          {/* Bollinger Bands Fill & Lines */}
          {overlays.bollinger && (
            <>
              <polyline
                fill="none"
                stroke="#64748B"
                strokeWidth="1"
                strokeDasharray="3 3"
                points={buildPolyline(
                  technicals.bollinger.map((b) => b.upper),
                  yForPrice
                )}
              />
              <polyline
                fill="none"
                stroke="#64748B"
                strokeWidth="1"
                strokeDasharray="3 3"
                points={buildPolyline(
                  technicals.bollinger.map((b) => b.lower),
                  yForPrice
                )}
              />
            </>
          )}

          {/* Pivot Support & Resistance Reference Lines */}
          {overlays.pivots && (
            <g>
              <line
                x1={padLeft}
                x2={svgWidth - padRight}
                y1={yForPrice(technicals.resistanceLevels[0])}
                y2={yForPrice(technicals.resistanceLevels[0])}
                stroke="#F43F5E"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padLeft + 4}
                y={yForPrice(technicals.resistanceLevels[0]) - 4}
                fill="#FDA4AF"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                R1 {formatPrice(technicals.resistanceLevels[0], decimals)}
              </text>

              <line
                x1={padLeft}
                x2={svgWidth - padRight}
                y1={yForPrice(technicals.supportLevels[0])}
                y2={yForPrice(technicals.supportLevels[0])}
                stroke="#10B981"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padLeft + 4}
                y={yForPrice(technicals.supportLevels[0]) + 12}
                fill="#6EE7B7"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                S1 {formatPrice(technicals.supportLevels[0], decimals)}
              </text>
            </g>
          )}

          {/* Volume Histogram at Bottom of Price Pane */}
          {visibleCandles.map((c, i) => {
            const x = xForSlot(i);
            const isUp = c.close >= c.open;
            const barH = Math.max(2, (c.volume / maxVol) * 44);
            return (
              <rect
                key={`vol-${c.timestamp}`}
                x={x - candleBodyWidth / 2}
                y={priceHeight - barH - 4}
                width={candleBodyWidth}
                height={barH}
                fill={isUp ? '#10B981' : '#EF4444'}
                fillOpacity="0.2"
              />
            );
          })}

          {/* Candlesticks */}
          {visibleCandles.map((c, i) => {
            const x = xForSlot(i);
            const isUp = c.close >= c.open;
            const color = isUp ? '#10B981' : '#EF4444';
            const yHigh = yForPrice(c.high);
            const yLow = yForPrice(c.low);
            const yOpen = yForPrice(c.open);
            const yClose = yForPrice(c.close);
            const bodyTop = Math.min(yOpen, yClose);
            const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));

            return (
              <g key={c.timestamp}>
                <line
                  x1={x}
                  x2={x}
                  y1={yHigh}
                  y2={yLow}
                  stroke={color}
                  strokeWidth="1.2"
                />
                <rect
                  x={x - candleBodyWidth / 2}
                  y={bodyTop}
                  width={candleBodyWidth}
                  height={bodyH}
                  fill={color}
                  rx="1"
                />
              </g>
            );
          })}

          {/* EMA 20 & EMA 50 */}
          {overlays.ema && (
            <>
              <polyline
                fill="none"
                stroke="#38BDF8"
                strokeWidth="1.6"
                points={buildPolyline(technicals.ema20, yForPrice)}
              />
              <polyline
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.6"
                points={buildPolyline(technicals.ema50, yForPrice)}
              />
            </>
          )}

          {/* AI Forecast Cone & Target/Stop Lines */}
          {overlays.forecastCone && forecastSteps.length > 0 && (
            <g>
              {/* Separator line between history and forecast */}
              <line
                x1={xForSlot(lastCandleIdx) + slotWidth * 0.5}
                x2={xForSlot(lastCandleIdx) + slotWidth * 0.5}
                y1={14}
                y2={priceHeight}
                stroke="#38BDF8"
                strokeOpacity="0.3"
                strokeDasharray="3 3"
              />

              <polygon
                points={forecastConePoints.polygon}
                fill={
                  forecast.direction === 'SHORT' ? '#EF4444' : '#0EA5E9'
                }
                fillOpacity="0.16"
              />
              <polyline
                fill="none"
                stroke={
                  forecast.direction === 'SHORT' ? '#F87171' : '#38BDF8'
                }
                strokeWidth="2"
                strokeDasharray="5 3"
                points={forecastConePoints.medianLine}
              />

              {/* TP1 & Stop Loss markers positioned cleanly inside right plot edge */}
              <line
                x1={xForSlot(lastCandleIdx)}
                x2={svgWidth - padRight}
                y1={yForPrice(forecast.targetPrices.tp1)}
                y2={yForPrice(forecast.targetPrices.tp1)}
                stroke="#10B981"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text
                x={svgWidth - padRight - 6}
                y={yForPrice(forecast.targetPrices.tp1) - 4}
                textAnchor="end"
                fill="#34D399"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                TP1 {formatPrice(forecast.targetPrices.tp1, decimals)}
              </text>

              <line
                x1={xForSlot(lastCandleIdx)}
                x2={svgWidth - padRight}
                y1={yForPrice(forecast.stopLoss)}
                y2={yForPrice(forecast.stopLoss)}
                stroke="#EF4444"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text
                x={svgWidth - padRight - 6}
                y={yForPrice(forecast.stopLoss) - 4}
                textAnchor="end"
                fill="#F87171"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                SL {formatPrice(forecast.stopLoss, decimals)}
              </text>
            </g>
          )}

          {/* Current Price Tag on Right Axis */}
          {lastCandle && (
            <g>
              <rect
                x={svgWidth - padRight + 4}
                y={yForPrice(lastCandle.close) - 10}
                width={68}
                height={20}
                rx={4}
                fill="#0EA5E9"
              />
              <text
                x={svgWidth - padRight + 10}
                y={yForPrice(lastCandle.close) + 4}
                fill="#0B0F17"
                fontSize="10.5"
                fontWeight="600"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatPrice(lastCandle.close, decimals)}
              </text>
            </g>
          )}

          {/* RSI Sub-Pane */}
          {overlays.rsi && (
            <g>
              <rect
                x={padLeft}
                y={rsiTop}
                width={plotWidth}
                height={rsiHeight}
                fill="#0D1320"
                stroke="#1E293B"
              />
              <line
                x1={padLeft}
                x2={svgWidth - padRight}
                y1={yForRsi(70)}
                y2={yForRsi(70)}
                stroke="#EF4444"
                strokeOpacity="0.35"
                strokeDasharray="3 3"
              />
              <line
                x1={padLeft}
                x2={svgWidth - padRight}
                y1={yForRsi(30)}
                y2={yForRsi(30)}
                stroke="#10B981"
                strokeOpacity="0.35"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft + 6}
                y={rsiTop + 14}
                fill="#94A3B8"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                RSI(14)
              </text>
              <text
                x={svgWidth - padRight + 8}
                y={yForRsi(70) + 3}
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                70
              </text>
              <text
                x={svgWidth - padRight + 8}
                y={yForRsi(30) + 3}
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                30
              </text>
              <polyline
                fill="none"
                stroke="#A78BFA"
                strokeWidth="1.5"
                points={buildPolyline(technicals.rsi14, yForRsi)}
              />
            </g>
          )}

          {/* MACD Sub-Pane */}
          {overlays.macd && (
            <g>
              <rect
                x={padLeft}
                y={macdTop}
                width={plotWidth}
                height={macdHeight}
                fill="#0D1320"
                stroke="#1E293B"
              />
              <line
                x1={padLeft}
                x2={svgWidth - padRight}
                y1={yForMacd(0)}
                y2={yForMacd(0)}
                stroke="#334155"
                strokeWidth="1"
              />
              <text
                x={padLeft + 6}
                y={macdTop + 14}
                fill="#94A3B8"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                MACD(12,26,9)
              </text>
              {visibleCandles.map((c, i) => {
                const pt = technicals.macd[offset + i];
                if (!pt || pt.histogram === null) return null;
                const yZero = yForMacd(0);
                const yVal = yForMacd(pt.histogram);
                const h = Math.max(1, Math.abs(yVal - yZero));
                return (
                  <rect
                    key={`hist-${c.timestamp}`}
                    x={xForSlot(i) - candleBodyWidth / 2}
                    y={Math.min(yZero, yVal)}
                    width={candleBodyWidth}
                    height={h}
                    fill={pt.histogram >= 0 ? '#10B981' : '#EF4444'}
                    fillOpacity="0.65"
                  />
                );
              })}
              <polyline
                fill="none"
                stroke="#38BDF8"
                strokeWidth="1.3"
                points={buildPolyline(
                  technicals.macd.map((m) => m.macd),
                  yForMacd
                )}
              />
              <polyline
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.3"
                points={buildPolyline(
                  technicals.macd.map((m) => m.signal),
                  yForMacd
                )}
              />
            </g>
          )}

          {/* Crosshair Hover Line */}
          {hoverIdx !== null && visibleCandles[hoverIdx] && (
            <line
              x1={xForSlot(hoverIdx)}
              x2={xForSlot(hoverIdx)}
              y1={12}
              y2={totalHeight - bottomAxisHeight}
              stroke="#64748B"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Bottom Time Labels */}
          {[0, 18, 36, 54].map((idx) => {
            const c = visibleCandles[idx];
            if (!c) return null;
            return (
              <text
                key={`t-${idx}`}
                x={xForSlot(idx)}
                y={totalHeight - 8}
                textAnchor="middle"
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatTimeLabel(c.timestamp, timeframe)}
              </text>
            );
          })}
          {overlays.forecastCone &&
            forecastSteps.length > 0 &&
            [2, forecastSteps.length - 1].map((fIdx) => {
              const step = forecastSteps[fIdx];
              if (!step) return null;
              return (
                <text
                  key={`ft-${fIdx}`}
                  x={xForSlot(visibleCandles.length + fIdx)}
                  y={totalHeight - 8}
                  textAnchor="middle"
                  fill="#38BDF8"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {step.stepLabel}
                </text>
              );
            })}

          {/* Invisible Hover Capture Slices */}
          {visibleCandles.map((c, i) => (
            <rect
              key={`hover-${c.timestamp}`}
              x={xForSlot(i) - slotWidth / 2}
              y={0}
              width={slotWidth}
              height={totalHeight - bottomAxisHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
