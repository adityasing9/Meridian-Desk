# Meridian Desk — Crypto Market Prediction & Sentiment Intelligence Terminal

Meridian Desk is an institutional-grade crypto market analysis, prediction, and sentiment intelligence terminal. Powered by Google Gemini AI, deterministic technical indicators, and multi-source market telemetry, Meridian Desk synthesizes price action, orderflow imbalances, and macro sentiment into actionable trading setups with risk management bounds.

---

## ⚡ Key Capabilities

### 1. Real-Time Market Terminal & Interactive SVG Charting
- **Supported Assets**: Bitcoin (`BTC`), Ethereum (`ETH`), Solana (`SOL`), Avalanche (`AVAX`), Chainlink (`LINK`), XRP (`XRP`), NEAR Protocol (`NEAR`), BNB (`BNB`), and Ankr (`ANKR`).
- **Multi-Timeframe Analysis**: `15m`, `1H`, `4H`, and `1D` candlestick resolutions.
- **Technical Indicator Suite**:
  - Dual Exponential Moving Averages (**EMA 20** and **EMA 50**)
  - **Bollinger Bands** (20-period, 2-std dev volatility envelope)
  - Classic **Support & Resistance Pivot Levels** (`S1`, `R1`)
  - **RSI (14)** with overbought (70) and oversold (30) reference bounds
  - **MACD (12, 26, 9)** line, signal line, and volume histogram sub-pane
  - **AI Forecast Cone** displaying projected trajectory, upper/lower confidence bands, and price targets
- **Crosshair Telemetry**: Hover inspection displaying OHLCV, moving averages, and indicator states.
- **Live Stream Engine**: Real-time tick simulations maintaining continuous price discovery between exchange polling intervals.

### 2. Gemini AI Trade Prediction Engine
- **Server-Side AI Synthesis**: Integrates `@google/genai` (`gemini-4-hydrogen` with fallback resilience) via secure server-side API endpoints (`/api/ai/predict`).
- **Structured Prediction Model**:
  - Directional Bias: `LONG`, `SHORT`, or `NEUTRAL`
  - Statistical Confidence Rating (0–100%) and Recommended Trading Horizon
  - Precise Entry Zones (`Low` – `High`)
  - Multi-tier Profit Targets (`TP1`, `TP2`) and Invalidation Stop-Loss (`SL`)
  - Computed Risk-Reward Ratio (e.g. `1 : 2.4`)
  - 6-step forward forecast path with upper and lower probability cones
  - Executive Thesis, Weighted Catalyst Drivers, and Invalidation Conditions
- **Custom Catalyst Hypothesis**: Traders can inject custom breaking news or macro hypotheses (e.g., *"CPI print softer than consensus"*) to instantly re-synthesize directional scenarios.

### 3. Integrated Sentiment Hub
- **4-Source Sentiment Attribution**:
  - **Institutional News Wire** (ETF inflows, regulatory updates, custodian announcements)
  - **Social Velocity & Mentions** (Developer forums, retail flow velocity)
  - **Perp Funding & Skew** (8-hour funding rates, options 25-delta skew)
  - **Whale Exchange Netflow** (Cold-storage withdrawals vs. spot deposits)
- **14-Day Fear & Greed Trajectory**: Interactive trendline tracking macro crypto risk sentiment.
- **Divergence Detection Engine**: Automatically flags **Bullish Divergences** (spot pullbacks with expanding on-chain sentiment) and **Bearish Divergences** (spot rallies with deteriorating funding momentum).
- **Catalyst Impact Scorer**: Test any custom news headline to evaluate sentiment polarity, impact tier (`High`/`Medium`/`Low`), and detected catalyst keywords.

### 4. Position Risk Calculator
- Real-time position sizing engine based on:
  - Account Equity ($)
  - Risk per Trade (%)
  - Entry Price & Stop-Loss Distance
- Outputs exact coin units, total notional exposure, maximum dollar risk, and projected profit at `TP2`.

### 5. Cross-Asset Signal Matrix
- Unified 9-asset screener comparing live spot prices, 24-period price changes, RSI(14), EMA trends, sentiment index scores, divergence statuses, and overall composite signal bias.
- Interactive multi-column sorting and filtering by directional bias.

### 6. Strategy Backtest & Risk Lab
- Parameter-driven backtesting engine simulating trades on historical candle series.
- Configurable controls:
  - RSI Oversold Entry threshold
  - RSI Overbought Short threshold
  - Sentiment Signal Weight
  - Stop-Loss ATR Multiplier
  - Take-Profit Target (R-Multiple)
- Real-time simulation metrics: Total Return, Win Rate, Profit Factor, Max Drawdown, full equity curve visualization, and recent trade logs.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion.
- **Build Tooling**: Vite 8.
- **Backend**: Express 4 with server-side `@google/genai` TypeScript SDK.
- **Live Market Integrations**: Binance Public Spot Klines, Alternative.me Crypto Fear & Greed Index, CoinGecko simple price feeds with deterministic fallback streaming.
- **Serverless / Deployment**: Vercel Serverless Functions (`api/index.ts`) with static edge caching for frontend assets.

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/adityasing9/Meridian-Desk.git
   cd Meridian-Desk
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini API Key in `.env`:
   ```env
   GEMINI_API_KEY="your-gemini-api-key-here"
   ```

4. Start development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. Run test suite:
   ```bash
   npm test
   ```

6. Build for production:
   ```bash
   npm run build
   ```

---

## 🌐 Deploying to Vercel

1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` = your Gemini API key.
4. Deploy. Vercel automatically builds the Vite frontend into `dist/` and mounts the Express API via Serverless Functions at `/api/*`.

---

## 📜 Disclaimer

Meridian Desk is an analytical and educational research tool. Quantitative model outputs, algorithmic indicators, and AI forecasts are for informational purposes only and do not constitute financial, investment, or trading advice.
