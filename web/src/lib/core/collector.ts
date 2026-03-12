import * as cheerio from "cheerio";
import { SourceData } from "./types";

export function fromText(text: string, title = ""): SourceData {
  return {
    content: text.trim(),
    title: title || "Manual Input",
    url: "",
    collectedAt: new Date().toISOString(),
  };
}

export async function fromUrl(url: string): Promise<SourceData> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);

  const html = await resp.text();
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header").remove();

  const title = $("title").text().trim();

  // Extract main content
  const article = $("article").first();
  const main = $("main").first();
  const body = $("body").first();
  const container = article.length ? article : main.length ? main : body;

  if (!container.length) throw new Error("Could not extract content from URL");

  let text = container.text().replace(/\s+/g, " ").trim();
  // Collapse excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n");

  if (text.length < 50) throw new Error("Extracted text too short");

  return {
    content: text,
    title,
    url,
    collectedAt: new Date().toISOString(),
  };
}
