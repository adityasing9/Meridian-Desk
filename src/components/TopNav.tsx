import { Loader2, Sparkles } from 'lucide-react';

export type NavTab = 'terminal' | 'sentiment' | 'scanner' | 'backtest';

interface TopNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onRunForecast: () => void;
  isPredicting: boolean;
}

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'terminal', label: 'Market Terminal' },
  { id: 'sentiment', label: 'Sentiment Hub' },
  { id: 'scanner', label: 'Signal Matrix' },
  { id: 'backtest', label: 'Backtest & Risk' },
];

export function TopNav({
  activeTab,
  onSelectTab,
  onRunForecast,
  isPredicting,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0B0F17]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-6">
        <a
          href="#terminal"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('terminal');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
        >
          Meridian Desk
        </a>

        <nav
          aria-label="Primary workspace navigation"
          className="hidden md:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded ${
                  active
                    ? 'text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-sky-500"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onRunForecast}
            disabled={isPredicting}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F17]"
          >
            {isPredicting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Run AI Forecast</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Compact single-row mobile navigation */}
      <nav
        aria-label="Mobile workspace navigation"
        className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-800/80 px-4 py-2"
      >
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                active
                  ? 'text-sky-400 border-b-2 border-sky-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
