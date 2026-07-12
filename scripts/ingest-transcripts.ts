/**
 * Transcript ingestion script
 *
 * Usage:
 *   npx tsx scripts/ingest-transcripts.ts
 *
 * Reads all markdown files from /transcripts/ and ingests them into Convex
 * via the RAG component. Skips files that haven't changed since last ingestion.
 * Rate-limited to avoid hitting Google AI embedding quota (100 req/day free tier).
 *
 * Requires:
 *   - NEXT_PUBLIC_CONVEX_URL in .env.local (or set CONVEX_URL)
 *   - A running Convex deployment (`npx convex dev`)
 */

import "dotenv/config";
import { config } from "dotenv";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

// Load .env.local explicitly
config({ path: join(__dirname, "..", ".env.local") });

// Rate limiting: delay between files (ms) to avoid embedding quota
const DELAY_BETWEEN_FILES_MS = 2000;
const MAX_FILES_PER_RUN = 5;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function main() {
  const transcriptsDir = join(process.cwd(), "transcripts");
  const files = readdirSync(transcriptsDir).filter((f) => f.endsWith(".md"));

  console.log(`Found ${files.length} transcript files (max ${MAX_FILES_PER_RUN} per run)`);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_URL env var");
    process.exit(1);
  }
  console.log(`Using Convex URL: ${convexUrl}`);

  const filesToProcess = files.slice(0, MAX_FILES_PER_RUN);
  let skipped = 0;
  let ingested = 0;
  let failed = 0;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    const content = readFileSync(join(transcriptsDir, file), "utf-8");
    const { meta, body } = parseFrontmatter(content);

    const date = meta.date ?? file.replace(".md", "");
    const title = meta.title ?? file.replace(".md", "");
    const videoUrl = meta.video_url || file.replace(".md", "");
    const contentHash = sha256(body);

    console.log(`[${i + 1}/${filesToProcess.length}] Ingesting: ${title} (${date})...`);

    // Call the Convex mutation via HTTP
    const response = await fetch(`${convexUrl}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "transcripts:ingestTranscript",
        args: { date, title, videoUrl, content: body, contentHash },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`  Failed: ${response.status} ${text}`);
      failed++;
    } else {
      const result = await response.json();
      if (result.status === "success" && result.value?.created === false) {
        console.log(`  Skipped (unchanged).`);
        skipped++;
      } else {
        console.log(`  Done.`);
        ingested++;
      }
    }

    // Delay between files (skip after last file)
    if (i < filesToProcess.length - 1) {
      await delay(DELAY_BETWEEN_FILES_MS);
    }
  }

  const remaining = files.length - filesToProcess.length;
  console.log(
    `\nDone. ${ingested} ingested, ${skipped} skipped, ${failed} failed.`
  );
  if (remaining > 0) {
    console.log(`${remaining} files remaining. Run again to process more.`);
  }
}

main().catch(console.error);
