import { db } from "./index";
import { recommendations } from "./schema";
import { sql, and, ne } from "drizzle-orm";

type ResolvedRec = {
  id: number;
  action: string;
  asset: string;
  conviction: number;
  status: string;
  brierScore: number | null;
  actualReturn: number | null;
  ticker: string | null;
  priceAtCreation: number | null;
  priceAtResolution: number | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

async function getResolvedRecs(): Promise<ResolvedRec[]> {
  return db
    .select()
    .from(recommendations)
    .where(ne(recommendations.status, "active")) as unknown as Promise<ResolvedRec[]>;
}

export async function getHitRateByConvictionQuintile() {
  const recs = await getResolvedRecs();
  if (recs.length === 0) return [];

  // Sort by conviction and bucket into quintiles
  const sorted = [...recs].sort((a, b) => a.conviction - b.conviction);
  const quintileSize = Math.ceil(sorted.length / 5);

  const quintiles = [];
  for (let i = 0; i < 5; i++) {
    const start = i * quintileSize;
    const bucket = sorted.slice(start, start + quintileSize);
    if (bucket.length === 0) continue;

    const correct = bucket.filter((r) => r.status === "resolved_correct").length;
    const returns = bucket
      .map((r) => r.actualReturn)
      .filter((r): r is number => r !== null);
    const avgReturn =
      returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : null;

    const minConv = Math.round(bucket[0].conviction * 100);
    const maxConv = Math.round(bucket[bucket.length - 1].conviction * 100);

    quintiles.push({
      label: `${minConv}-${maxConv}%`,
      hitRate: correct / bucket.length,
      avgReturn,
      count: bucket.length,
    });
  }

  return quintiles;
}

export async function getReturnsByAction() {
  const recs = await getResolvedRecs();

  const actions = ["BUY", "SELL", "HOLD", "WATCH", "AVOID"];
  return actions
    .map((action) => {
      const actionRecs = recs.filter((r) => r.action === action);
      if (actionRecs.length === 0) return null;

      const correct = actionRecs.filter(
        (r) => r.status === "resolved_correct"
      ).length;
      const returns = actionRecs
        .map((r) => r.actualReturn)
        .filter((r): r is number => r !== null);
      const avgReturn =
        returns.length > 0
          ? returns.reduce((a, b) => a + b, 0) / returns.length
          : null;

      return {
        action,
        count: actionRecs.length,
        winRate: correct / actionRecs.length,
        avgReturn,
      };
    })
    .filter(Boolean);
}

export async function getCumulativeReturns() {
  const recs = await getResolvedRecs();
  const withReturns = recs
    .filter((r) => r.actualReturn !== null && r.resolvedAt !== null)
    .sort(
      (a, b) =>
        new Date(a.resolvedAt!).getTime() - new Date(b.resolvedAt!).getTime()
    );

  let cumulative = 0;
  return withReturns.map((r) => {
    cumulative += r.actualReturn!;
    return {
      date: new Date(r.resolvedAt!).toISOString().slice(0, 10),
      cumReturn: cumulative,
      asset: r.asset,
    };
  });
}

export async function getWorstMisses(limit = 10) {
  const recs = await getResolvedRecs();
  return recs
    .filter((r) => r.status === "resolved_incorrect")
    .sort((a, b) => b.conviction - a.conviction)
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      action: r.action,
      asset: r.asset,
      ticker: r.ticker,
      conviction: r.conviction,
      actualReturn: r.actualReturn,
      brierScore: r.brierScore,
    }));
}

export async function getSharpeRatio() {
  const recs = await getResolvedRecs();
  const returns = recs
    .map((r) => r.actualReturn)
    .filter((r): r is number => r !== null);

  if (returns.length < 2) return null;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const stdev = Math.sqrt(variance);

  if (stdev === 0) return null;

  // Estimate average holding days from resolved recs
  const withDates = recs.filter(
    (r) => r.actualReturn !== null && r.resolvedAt !== null
  );
  const holdingDays =
    withDates.length > 0
      ? withDates.reduce(
          (sum, r) =>
            sum +
            (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()) /
              (1000 * 60 * 60 * 24),
          0,
        ) / withDates.length
      : 30;

  const annualizationFactor = Math.sqrt(252 / Math.max(holdingDays, 1));
  return (mean / stdev) * annualizationFactor;
}

export async function getMaxDrawdown() {
  const recs = await getResolvedRecs();
  const withReturns = recs
    .filter((r) => r.actualReturn !== null && r.resolvedAt !== null)
    .sort(
      (a, b) =>
        new Date(a.resolvedAt!).getTime() - new Date(b.resolvedAt!).getTime()
    );

  if (withReturns.length === 0) return null;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let ddStart = 0;
  let ddEnd = 0;
  let currentStart = 0;

  for (let i = 0; i < withReturns.length; i++) {
    cumulative += withReturns[i].actualReturn!;
    if (cumulative > peak) {
      peak = cumulative;
      currentStart = i;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = peak !== 0 ? drawdown / peak : 0;
      ddStart = currentStart;
      ddEnd = i;
    }
  }

  return {
    maxDrawdown,
    pct: maxDrawdownPct,
    start: withReturns[ddStart]?.resolvedAt
      ? new Date(withReturns[ddStart].resolvedAt!).toISOString().slice(0, 10)
      : null,
    end: withReturns[ddEnd]?.resolvedAt
      ? new Date(withReturns[ddEnd].resolvedAt!).toISOString().slice(0, 10)
      : null,
  };
}

export async function getProfitFactor() {
  const recs = await getResolvedRecs();
  const returns = recs
    .map((r) => r.actualReturn)
    .filter((r): r is number => r !== null);

  const gains = returns.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const losses = Math.abs(returns.filter((r) => r < 0).reduce((a, b) => a + b, 0));

  if (losses === 0) return gains > 0 ? Infinity : null;
  return gains / losses;
}

export async function getMagnitudeAnalysis() {
  const recs = await getResolvedRecs();
  const withReturns = recs.filter(
    (r) => r.actualReturn !== null
  );

  const buckets = [
    { label: "< -5%", min: -Infinity, max: -0.05 },
    { label: "-5% to 0%", min: -0.05, max: 0 },
    { label: "0% to 5%", min: 0, max: 0.05 },
    { label: "5% to 10%", min: 0.05, max: 0.1 },
    { label: "> 10%", min: 0.1, max: Infinity },
  ];

  return buckets.map((bucket) => {
    const inBucket = withReturns.filter(
      (r) => r.actualReturn! >= bucket.min && r.actualReturn! < bucket.max
    );
    const correct = inBucket.filter((r) => r.status === "resolved_correct").length;
    const avgConviction =
      inBucket.length > 0
        ? inBucket.reduce((s, r) => s + r.conviction, 0) / inBucket.length
        : 0;
    const avgReturn =
      inBucket.length > 0
        ? inBucket.reduce((s, r) => s + r.actualReturn!, 0) / inBucket.length
        : 0;

    return {
      label: bucket.label,
      count: inBucket.length,
      avgConviction,
      hitRate: inBucket.length > 0 ? correct / inBucket.length : 0,
      avgReturn,
    };
  });
}

export async function getRollingAccuracy(windows: number[] = [30, 60, 90]) {
  const recs = await getResolvedRecs();
  const now = Date.now();

  return windows.map((days) => {
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const windowRecs = recs.filter(
      (r) => r.resolvedAt && new Date(r.resolvedAt).getTime() > cutoff
    );
    const correct = windowRecs.filter(
      (r) => r.status === "resolved_correct"
    ).length;
    return {
      window: days,
      hitRate: windowRecs.length > 0 ? correct / windowRecs.length : null,
      count: windowRecs.length,
    };
  });
}
