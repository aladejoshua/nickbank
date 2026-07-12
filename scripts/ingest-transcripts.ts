/**
 * Transcript ingestion script
 *
 * Usage:
 *   npx tsx scripts/ingest-transcripts.ts
 *
 * Reads all markdown files from /transcripts/ and ingests them into Convex
 * via the RAG component. Run this once after setting up Convex, or whenever
 * new transcripts are added.
 *
 * Requires:
 *   - NEXT_PUBLIC_CONVEX_URL in .env.local (or set CONVEX_URL)
 *   - A running Convex deployment (`npx convex dev`)
 */

import "dotenv/config";
import { config } from "dotenv";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// Load .env.local explicitly
config({ path: join(__dirname, "..", ".env.local") });

// Simple frontmatter parser
function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: content };

  const raw = match[1];
  const meta: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      meta[key.trim()] = rest.join(":").trim();
    }
  }
  const body = content.slice(match[0].length).trim();
  return { meta, body };
}

async function main() {
  const transcriptsDir = join(process.cwd(), "transcripts");
  const files = readdirSync(transcriptsDir).filter((f) => f.endsWith(".md"));

  console.log(`Found ${files.length} transcript files`);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_URL env var");
    process.exit(1);
  }
  console.log(`Using Convex URL: ${convexUrl}`);

  for (const file of files) {
    const content = readFileSync(join(transcriptsDir, file), "utf-8");
    const { meta, body } = parseFrontmatter(content);

    const date = meta.date ?? file.replace(".md", "");
    const title = meta.title ?? file.replace(".md", "");
    const videoUrl = meta.video_url ?? "";

    console.log(`Ingesting: ${title} (${date})...`);

    // Call the Convex mutation via HTTP
    const response = await fetch(`${convexUrl}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "transcripts:ingestTranscript",
        args: { date, title, videoUrl, content: body },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`  Failed: ${response.status} ${text}`);
    } else {
      console.log(`  Done.`);
    }
  }

  console.log("\nAll transcripts ingested.");
}

main().catch(console.error);
