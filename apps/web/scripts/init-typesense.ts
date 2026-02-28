/**
 * Idempotent Typesense bootstrap script.
 * Run once after containers start: npx tsx scripts/init-typesense.ts
 *
 * Creates the media_records collection (skips if already exists) and
 * generates a scoped search-only API key.
 */

import Typesense from "typesense";

const COLLECTION_NAME = "media_records";

const client = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST ?? "localhost",
      port: Number(process.env.TYPESENSE_PORT ?? 8108),
      protocol: "http",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY ?? "",
  connectionTimeoutSeconds: 10,
});

const schema: Typesense.CollectionCreateSchema = {
  name: COLLECTION_NAME,
  fields: [
    // Full-text searchable fields
    { name: "title", type: "string" },
    { name: "series", type: "string", facet: true },
    { name: "reporter", type: "string", facet: true },
    { name: "filmReel", type: "string", facet: true },
    { name: "reelSegment", type: "string", optional: true },
    { name: "accessCopy", type: "string", optional: true },
    // Stored but not indexed for search
    { name: "date", type: "int64" },
    { name: "kalturaId", type: "string", optional: true },
    { name: "viewOnline", type: "string", optional: true },
    { name: "startTime", type: "int32", optional: true },
    { name: "stopTime", type: "int32", optional: true },
  ],
  default_sorting_field: "date",
};

async function main() {
  // 1. Create collection (idempotent)
  try {
    await client.collections(COLLECTION_NAME).retrieve();
    console.log(`Collection "${COLLECTION_NAME}" already exists — skipping.`);
  } catch {
    await client.collections().create(schema);
    console.log(`Collection "${COLLECTION_NAME}" created.`);
  }

  // 2. Generate scoped search-only key
  const searchOnlyKey = client.keys().generateScopedSearchKey(
    process.env.TYPESENSE_API_KEY ?? "",
    {
      collection: COLLECTION_NAME,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10, // 10 years
    }
  );

  console.log("\nSearch-only key (copy to TYPESENSE_SEARCH_ONLY_KEY in .env):");
  console.log(searchOnlyKey);
}

main().catch((err) => {
  console.error("init-typesense failed:", err);
  process.exit(1);
});
