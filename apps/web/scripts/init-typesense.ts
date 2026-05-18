/**
 * Idempotent Typesense bootstrap script.
 * Run once after containers start: npx tsx scripts/init-typesense.ts
 *
 * Creates the media_records collection (skips if already exists) and
 * creates a dedicated search-only API key.
 */

import Typesense from "typesense";

const COLLECTION_NAME = "media_records";
const SEARCH_ONLY_KEY_DESCRIPTION = "mediaarchive_search_only_key";

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

type TypesenseKeySummary = {
  id: number;
  description?: string;
};

function isNonPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !normalized.startsWith("changeme");
}

async function createSearchOnlyKey(): Promise<string> {
  const adminKey = (process.env.TYPESENSE_API_KEY ?? "").trim();
  const desiredSearchKey = (process.env.TYPESENSE_SEARCH_ONLY_KEY ?? "").trim();
  const canUseDesiredKey =
    isNonPlaceholder(desiredSearchKey) && desiredSearchKey !== adminKey;

  // Keep one canonical search key entry by deleting older keys with the same description.
  const existingKeysResponse = (await client.keys().retrieve()) as { keys?: TypesenseKeySummary[] };
  const existingKeys = existingKeysResponse.keys ?? [];
  for (const key of existingKeys) {
    if (key.description === SEARCH_ONLY_KEY_DESCRIPTION) {
      await client.keys(key.id).delete();
    }
  }

  const keyPayload: Typesense.KeyCreateSchema = {
    description: SEARCH_ONLY_KEY_DESCRIPTION,
    actions: ["documents:search"],
    collections: [COLLECTION_NAME],
  };

  if (canUseDesiredKey) {
    keyPayload.value = desiredSearchKey;
  }

  const createdKey = await client.keys().create(keyPayload);
  const keyValue = createdKey.value ?? (canUseDesiredKey ? desiredSearchKey : "");

  if (!keyValue) {
    throw new Error("Typesense did not return the created search-only key value.");
  }

  return keyValue;
}

async function main() {
  // 1. Create collection (idempotent)
  try {
    await client.collections(COLLECTION_NAME).retrieve();
    console.log(`Collection "${COLLECTION_NAME}" already exists - skipping.`);
  } catch {
    await client.collections().create(schema);
    console.log(`Collection "${COLLECTION_NAME}" created.`);
  }

  // 2. Create a real search-only key via Typesense Keys API.
  const searchOnlyKey = await createSearchOnlyKey();

  console.log("\nSearch-only key (set this in TYPESENSE_SEARCH_ONLY_KEY and NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY):");
  console.log(searchOnlyKey);
}

main().catch((err) => {
  console.error("init-typesense failed:", err);
  process.exit(1);
});

