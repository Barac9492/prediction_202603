import { NextRequest } from "next/server";
import { fromUrl, fromText } from "@/lib/core/collector";
import { extractSignals } from "@/lib/ai/extractor";
import { ensemble } from "@/lib/core/ensemble";
import { savePrediction } from "@/lib/db/queries";
import type { Signal, SourceData, ExtractionResult } from "@/lib/core/types";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const urls: string[] = Array.isArray(body.urls)
    ? body.urls.filter((u: unknown) => typeof u === "string" && u.trim())
    : [];
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!topic) {
    return new Response(JSON.stringify({ error: "topic is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!urls.length && !text) {
    return new Response(
      JSON.stringify({ error: "At least one URL or text input is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: { step: string; detail?: string; result?: unknown }) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // 1. Collect sources
        send({ step: "collecting", detail: "Gathering sources..." });
        const collectedSources: SourceData[] = [];

        if (text.trim()) {
          collectedSources.push(fromText(text));
        }

        const urlResults = await Promise.allSettled(
          urls.filter(Boolean).map((u) => fromUrl(u))
        );
        for (const r of urlResults) {
          if (r.status === "fulfilled") {
            collectedSources.push(r.value);
          }
        }

        if (!collectedSources.length) {
          send({ step: "error", detail: "No valid sources could be collected" });
          controller.close();
          return;
        }

        send({
          step: "collected",
          detail: `${collectedSources.length} source(s) collected`,
        });

        // 2. Extract signals in parallel
        send({ step: "extracting", detail: "Extracting signals via Claude..." });
        const extractions = await Promise.allSettled(
          collectedSources.map((source) => extractSignals(source, topic))
        );

        const allSignals: Signal[] = [];
        const sourceResults: { source: SourceData; result: ExtractionResult }[] = [];

        for (let i = 0; i < extractions.length; i++) {
          const ext = extractions[i];
          if (ext.status === "fulfilled") {
            allSignals.push(...ext.value.signals);
            sourceResults.push({
              source: collectedSources[i],
              result: ext.value,
            });
          }
        }

        send({
          step: "extracted",
          detail: `${allSignals.length} signal(s) from ${sourceResults.length} source(s)`,
        });

        // 3. Ensemble
        send({ step: "analyzing", detail: "Running ensemble analysis..." });
        const prediction = ensemble(allSignals);

        // 4. Save
        send({ step: "saving", detail: "Saving prediction..." });
        const predId = await savePrediction(
          topic,
          prediction,
          allSignals,
          sourceResults
        );

        send({
          step: "done",
          result: {
            id: predId,
            prediction,
            signals: allSignals,
            sources: sourceResults.map(({ source, result }) => ({
              title: source.title,
              url: source.url,
              summary: result.sourceSummary,
              relevanceScore: result.relevanceScore,
            })),
          },
        });
      } catch (err) {
        send({
          step: "error",
          detail: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
