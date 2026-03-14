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
