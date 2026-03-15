import { NextRequest, NextResponse } from "next/server";
import { fromUrl, fromText } from "@/lib/core/collector";
import { extractSignals } from "@/lib/ai/extractor";
import { ensemble } from "@/lib/core/ensemble";
import { savePrediction } from "@/lib/db/queries";
import { getWorkspaceId } from "@/lib/db/workspace";
import type { Signal, SourceData, ExtractionResult } from "@/lib/core/types";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
    /* ---------- 1. Parse & validate input BEFORE opening the stream ---------- */
  let topic: string;
    let urls: string[];
    let text: string;

  try {
        const body = await req.json();
        topic = body.topic ?? "";
        urls = Array.isArray(body.urls) ? body.urls : [];
        text = typeof body.text === "string" ? body.text : "";
  } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
              );
  }

  if (!topic.trim()) {
        return NextResponse.json(
          { error: "Topic is required" },
          { status: 400 }
              );
  }

  if (!urls.filter(Boolean).length && !text.trim()) {
        return NextResponse.json(
          { error: "Provide at least one URL or some text to analyze" },
          { status: 400 }
              );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json(
          { error: "ANTHROPIC_API_KEY is not configured on the server" },
          { status: 500 }
              );
  }

  /* ---------- 2. Resolve workspace ---------- */
  const workspaceId = await getWorkspaceId();

  /* ---------- 3. Stream analysis progress to the client ---------- */
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
        async start(controller) {
                function send(data: { step: string; detail?: string; result?: unknown }) {
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                }

          try {
                    // Collect sources
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
                              send({
                                            step: "error",
                                            detail: "No valid sources could be collected. Check that your URLs are accessible.",
                              });
                              controller.close();
                              return;
                  }

                  send({
                              step: "collected",
                              detail: `${collectedSources.length} source(s) collected`,
                  });

                  // Extract signals in parallel
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
                              } else {
                                            send({
                                                            step: "warning",
                                                            detail: `Failed to extract from "${collectedSources[i].title}": ${ext.reason instanceof Error ? ext.reason.message : "unknown error"}`,
                                            });
                              }
                  }

                  if (!allSignals.length) {
                              send({
                                            step: "error",
                                            detail: "Could not extract any signals from the provided sources.",
                              });
                              controller.close();
                              return;
                  }

                  send({
                              step: "extracted",
                              detail: `${allSignals.length} signal(s) from ${sourceResults.length} source(s)`,
                  });

                  // Ensemble
                  send({ step: "analyzing", detail: "Running ensemble analysis..." });
                    const prediction = ensemble(allSignals);

                  // Save to database
                  send({ step: "saving", detail: "Saving prediction..." });

                  let predId: number;
                    try {
                                predId = await savePrediction(workspaceId, topic, prediction, allSignals, sourceResults);
                    } catch (dbErr) {
                                send({
                                              step: "warning",
                                              detail: `Prediction generated but could not be saved: ${dbErr instanceof Error ? dbErr.message : "database error"}`,
                                });
                                // Still return the result even if saving fails
                      send({
                                    step: "done",
                                    result: {
                                                    id: null,
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
                                controller.close();
                                return;
                    }

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
                                detail: err instanceof Error ? err.message : "Unknown error during analysis",
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
