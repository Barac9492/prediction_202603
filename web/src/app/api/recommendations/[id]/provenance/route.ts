import { NextRequest, NextResponse } from "next/server";
import {
  getRecommendation,
  getThesis,
  getThesisConnections,
  getNewsEventsByIds,
  getEntitiesForThesis,
} from "@/lib/db/graph-queries";
import { getWorkspaceId } from "@/lib/db/workspace";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  const recId = parseInt(id, 10);
  if (isNaN(recId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rec = await getRecommendation(workspaceId, recId);
  if (!rec) {
    return NextResponse.json(
      { error: "Recommendation not found" },
      { status: 404 }
    );
  }

  // Get linked thesis
  let thesis = null;
  let thesisConnections: Awaited<ReturnType<typeof getThesisConnections>> = [];
  let sourceNews: Awaited<ReturnType<typeof getNewsEventsByIds>> = [];
  let relatedEntities: Awaited<ReturnType<typeof getEntitiesForThesis>> = [];

  if (rec.thesisId) {
    thesis = await getThesis(workspaceId, rec.thesisId);

    // Get connections to this thesis (signals)
    thesisConnections = await getThesisConnections(workspaceId, rec.thesisId);

    // Get source news articles
    const newsIds = thesisConnections
      .map((c) => c.sourceNewsId)
      .filter((id): id is number => id !== null);
    const uniqueNewsIds = [...new Set(newsIds)];
    sourceNews = await getNewsEventsByIds(workspaceId, uniqueNewsIds);

    // Get related entities
    relatedEntities = await getEntitiesForThesis(workspaceId, rec.thesisId);
  }

  return NextResponse.json({
    recommendation: rec,
    thesis,
    connections: thesisConnections.map((c) => ({
      id: c.id,
      relation: c.relation,
      direction: c.direction,
      confidence: c.confidence,
      reasoning: c.reasoning,
      sourceNewsId: c.sourceNewsId,
    })),
    sourceNews: sourceNews.map((n) => ({
      id: n.id,
      title: n.title,
      url: n.url,
      source: n.source,
      publishedAt: n.publishedAt,
      sentiment: n.sentiment,
    })),
    relatedEntities: relatedEntities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      category: e.category,
    })),
  });
}
