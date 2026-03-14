// eslint-disable-next-line @typescript-eslint/no-require-imports
const yahooFinance = require("yahoo-finance2").default;

const TICKER_ALIASES: Record<string, string> = {
  "NVIDIA": "NVDA",
  "Nvidia": "NVDA",
  "Apple": "AAPL",
  "Microsoft": "MSFT",
  "Google": "GOOGL",
  "Alphabet": "GOOGL",
  "Amazon": "AMZN",
  "Meta": "META",
  "Facebook": "META",
  "Tesla": "TSLA",
  "Netflix": "NFLX",
  "AMD": "AMD",
  "Intel": "INTC",
  "S&P 500": "SPY",
  "S&P500": "SPY",
  "SP500": "SPY",
  "Nasdaq": "QQQ",
  "NASDAQ": "QQQ",
  "Dow Jones": "DIA",
  "Russell 2000": "IWM",
  "Gold": "GLD",
  "Oil": "USO",
  "Crude Oil": "USO",
  "Bitcoin": "BTC-USD",
  "Ethereum": "ETH-USD",
  "Treasury Bonds": "TLT",
  "US Bonds": "TLT",
  "Semiconductors": "SMH",
  "AI": "BOTZ",
  "Broadcom": "AVGO",
  "ARM": "ARM",
  "Arm Holdings": "ARM",
  "Taiwan Semiconductor": "TSM",
  "TSMC": "TSM",
  "Qualcomm": "QCOM",
  "Palantir": "PLTR",
  "Snowflake": "SNOW",
  "CrowdStrike": "CRWD",
  "Datadog": "DDOG",
};

/**
 * Resolve an asset name to a ticker symbol.
 * Checks hardcoded aliases first, then falls back to Yahoo search.
 */
export async function resolveTickerSymbol(
  assetName: string
): Promise<string | null> {
  // Direct match — already a ticker
  if (/^[A-Z]{1,5}(-[A-Z]{1,4})?$/.test(assetName.trim())) {
    return assetName.trim();
  }

  // Check aliases
  const alias = TICKER_ALIASES[assetName] || TICKER_ALIASES[assetName.trim()];
  if (alias) return alias;

  // Yahoo search fallback
  try {
    const results = await yahooFinance.search(assetName, {
      quotesCount: 3,
      newsCount: 0,
    });
    const quote = results.quotes?.[0];
    if (quote?.symbol) {
      return quote.symbol;
    }
  } catch (err) {
    console.error(`Yahoo search failed for "${assetName}":`, err);
  }

  return null;
}

/**
 * Fetch current price and volume for a ticker.
 */
export async function fetchPrice(
  ticker: string
): Promise<{ price: number; volume: number | null } | null> {
  try {
    const quote = await yahooFinance.quote(ticker);
    if (!quote || !quote.regularMarketPrice) return null;
    return {
      price: quote.regularMarketPrice,
      volume: quote.regularMarketVolume ?? null,
    };
  } catch (err) {
    console.error(`Yahoo quote failed for "${ticker}":`, err);
    return null;
  }
}

/**
 * Fetch historical daily close prices for a ticker.
 */
export async function fetchPriceHistory(
  ticker: string,
  start: Date,
  end: Date
): Promise<{ date: Date; close: number }[]> {
  try {
    const result = await yahooFinance.historical(ticker, {
      period1: start,
      period2: end,
      interval: "1d",
    });
    return result.map((row: { date: Date; close: number }) => ({
      date: row.date,
      close: row.close,
    }));
  } catch (err) {
    console.error(`Yahoo historical failed for "${ticker}":`, err);
    return [];
  }
}
