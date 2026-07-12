import "dotenv/config";
import { config } from "dotenv";
import { join } from "path";

config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_URL env var");
    process.exit(1);
  }

  const res = await fetch(`${convexUrl}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "transcripts:listIngestedTranscripts",
      args: {},
    }),
  });

  const data = await res.json();
  if (data.status !== "success") {
    console.error("Error:", data);
    process.exit(1);
  }

  const entries = data.value;
  console.log(`\n${entries.length} transcripts in database:\n`);
  for (const e of entries) {
    console.log(`  ${e.date} | ${e.title} | key: ${e.key || "(empty)"}`);
  }
}

main().catch(console.error);
