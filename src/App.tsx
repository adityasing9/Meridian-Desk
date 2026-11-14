import { useCallback, useEffect, useMemo, useState } from 'react';
import { KpiStrip } from './components/KpiStrip';
import { MarketChart } from './components/MarketChart';
import { SentimentHub } from './components/SentimentHub';
import { SignalMatrix } from './components/SignalMatrix';
import { TopNav, type NavTab } from './components/TopNav';
import { TradeForecastPanel } from './components/TradeForecastPanel';
import {
  type ChartOverlayState,
  WorkspaceToolbar,
} from './components/WorkspaceToolbar';
import { BacktestLab } from './components/BacktestLab';
import { computeTechnicalSnapshot } from './lib/indicators';
import { buildMarketBundle, buildScannerRows } from './lib/marketData';
import type {
  AITradeForecast,
  AssetSymbol,
  MarketBundle,
  ScannerAssetRow,
  SentimentItem,
  Timeframe,
} from './lib/types';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('terminal');
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>('BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('4H');
  const [isLiveStream, setIsLiveStream] = useState<boolean>(true);

  // Seed immediately with deterministic bundle so first paint has zero layout shift
  const [bundle, setBundle] = useState<MarketBundle>(() =>
    buildMarketBundle('BTC', '4H')
  );
  const [scannerRows, setScannerRows] = useState<ScannerAssetRow[]>(() =>
    buildScannerRows('4H')
  );
  const [aiForecast, setAiForecast] = useState<AITradeForecast | null>(null);
  const [customHypothesis, setCustomHypothesis] = useState('');
  const [customSentimentItems, setCustomSentimentItems] = useState<
    SentimentItem[]
  >([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const [overlays, setOverlays] = useState<ChartOverlayState>({
    ema: true,
    bollinger: false,
    pivots: true,
    forecastCone: true,
    rsi: true,
    macd: false,
  });

  const fetchMarketBundle = useCallback(
    async (symbol: AssetSymbol, tf: Timeframe, resetForecast = false) => {
      setIsRefreshing(true);
      setNetworkError(null);
      try {
        const [bundleRes, scannerRes] = await Promise.all([
          fetch(`/api/market/bundle?symbol=${symbol}&timeframe=${tf}`),
          fetch(`/api/market/scanner?timeframe=${tf}`),
        ]);

        if (bundleRes.ok) {
          const data = (await bundleRes.json()) as MarketBundle;
          setBundle(data);
          if (resetForecast) {
            setAiForecast(null);
            setAiError(null);
          }
        } else {
          setNetworkError('Unable to refresh spot market feed; displaying cached desk telemetry.');
        }

        if (scannerRes.ok) {
          const scannerJson = (await scannerRes.json()) as {
            rows: ScannerAssetRow[];
          };
          if (Array.isArray(scannerJson.rows)) {
            setScannerRows(scannerJson.rows);
          }
        }
      } catch {
        setNetworkError('Offline mode: displaying deterministic desk market stream.');
      } finally {
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchMarketBundle(selectedAsset, timeframe, true);
  }, [selectedAsset, timeframe, fetchMarketBundle]);

  // Real-time micro-tick streaming update on the latest candle when Live Feed is enabled
  useEffect(() => {
    if (!isLiveStream) return;
    const interval = setInterval(() => {
      setBundle((prev) => {
        if (!prev || prev.candles.length === 0) return prev;
        const candles = prev.candles.slice();
        const last = { ...candles[candles.length - 1] };
        const driftScale = Math.max(last.close * 0.0012, prev.technicals.atr14 * 0.08);
        const tickDelta = (Math.random() - 0.495) * driftScale;
        const nextClose = Number(
          Math.max(last.close * 0.5, last.close + tickDelta).toFixed(
            prev.asset.decimals
          )
        );
        last.close = nextClose;
        last.high = Number(Math.max(last.high, nextClose).toFixed(prev.asset.decimals));
        last.low = Number(Math.min(last.low, nextClose).toFixed(prev.asset.decimals));
        last.volume = Math.round(last.volume * (1 + Math.random() * 0.004));
        candles[candles.length - 1] = last;

        const technicals = computeTechnicalSnapshot(candles);
        return {
          ...prev,
          lastUpdated: Date.now(),
          candles,
          technicals,
        };
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [isLiveStream]);

  const handleRunForecast = useCallback(async () => {
    setIsPredicting(true);
    setAiError(null);
    setActiveTab('terminal');
    try {
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedAsset,
          timeframe,
          customContext: customHypothesis,
        }),
      });
      const data = (await res.json()) as {
        forecast?: AITradeForecast;
        error?: string;
      };
      if (!res.ok || !data.forecast) {
        setAiError(
          data.error ||
            'AI synthesis returned an unexpected error. Using quantitative baseline setup.'
        );
      } else {
        setAiForecast(data.forecast);
      }
    } catch {
      setAiError(
        'Network failure reaching AI prediction service. Using quantitative baseline setup.'
      );
    } finally {
      setIsPredicting(false);
    }
  }, [selectedAsset, timeframe, customHypothesis]);

  const handleToggleOverlay = useCallback((key: keyof ChartOverlayState) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const activeForecast = useMemo(
    () => aiForecast ?? bundle.baselineForecast,
    [aiForecast, bundle.baselineForecast]
  );

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onRunForecast={() => void handleRunForecast()}
        isPredicting={isPredicting}
      />

      <WorkspaceToolbar
        selectedAsset={selectedAsset}
        onSelectAsset={setSelectedAsset}
        timeframe={timeframe}
        onSelectTimeframe={setTimeframe}
        isLiveStream={isLiveStream}
        onToggleLiveStream={() => setIsLiveStream((s) => !s)}
        onRefresh={() => void fetchMarketBundle(selectedAsset, timeframe, false)}
        isRefreshing={isRefreshing}
        overlays={overlays}
        onToggleOverlay={handleToggleOverlay}
        showChartControls={activeTab === 'terminal'}
        dataOrigin={bundle.dataOrigin}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 sm:px-6 space-y-4">
        {networkError && (
          <div
            role="status"
            className="rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-xs text-slate-300"
          >
            {networkError}
          </div>
        )}

        <KpiStrip
          asset={bundle.asset}
          technicals={bundle.technicals}
          sentiment={bundle.sentiment}
          forecast={activeForecast}
        />

        {activeTab === 'terminal' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
            <div className="lg:col-span-8 space-y-4">
              <MarketChart
                pair={bundle.asset.pair}
                decimals={bundle.asset.decimals}
                timeframe={timeframe}
                candles={bundle.candles}
                technicals={bundle.technicals}
                forecast={activeForecast}
                overlays={overlays}
              />

              {/* Integrated Sentiment Summary Strip below Chart */}
              <section
                aria-label="Integrated sentiment summary"
                className="rounded-xl border border-slate-800 bg-[#111827] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <h2 className="font-display text-sm font-semibold text-slate-100">
                      Integrated Sentiment &amp; Catalyst Pulse
                    </h2>
                    <p className="text-xs text-slate-400">
                      {bundle.sentiment.divergenceNote}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('sentiment')}
                    className="text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap"
                  >
                    Open Full Sentiment Hub
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:divide-x sm:divide-slate-800/80">
                  {bundle.sentiment.sources.map((src, idx) => (
                    <div
                      key={src.id}
                      className={idx > 0 ? 'sm:pl-4' : ''}
                    >
                      <span className="block truncate text-[11px] text-slate-400">
                        {src.label}
                      </span>
                      <div className="mt-1 flex items-baseline justify-between font-mono text-xs tabular-nums">
                        <span className="font-semibold text-slate-100">
                          {src.score}/100
                        </span>
                        <span
                          className={
                            src.bias === 'Bullish'
                              ? 'text-emerald-400'
                              : src.bias === 'Bearish'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }
                        >
                          {src.bias}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <TradeForecastPanel
                forecast={activeForecast}
                decimals={bundle.asset.decimals}
                currentPrice={bundle.technicals.latestPrice}
                orderBook={bundle.orderBook}
                isPredicting={isPredicting}
                aiError={aiError}
                customHypothesis={customHypothesis}
                onChangeHypothesis={setCustomHypothesis}
                onRunForecast={() => void handleRunForecast()}
                onClearAiError={() => setAiError(null)}
              />
            </div>
          </div>
        )}

        {activeTab === 'sentiment' && (
          <SentimentHub
            selectedAsset={selectedAsset}
            sentiment={bundle.sentiment}
            customItems={customSentimentItems}
            onAddCustomItem={(item) =>
              setCustomSentimentItems((prev) => [item, ...prev])
            }
          />
        )}

        {activeTab === 'scanner' && (
          <SignalMatrix
            rows={scannerRows}
            timeframe={timeframe}
            selectedAsset={selectedAsset}
            onInspectAsset={(symbol) => {
              setSelectedAsset(symbol);
              setActiveTab('terminal');
            }}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestLab
            asset={bundle.asset}
            timeframe={timeframe}
            candles={bundle.candles}
            baseSentimentIndex={bundle.sentiment.compositeIndex}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-[#0B0F17] py-3">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:px-6">
          <span>Meridian Desk · Quantitative Crypto Intelligence</span>
          <span>Analytical model output is informational and not financial advice.</span>
        </div>
      </footer>
    </div>
  );
}
