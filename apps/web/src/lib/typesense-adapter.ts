"use client";

import TypesenseInstantSearchAdapter from "typesense-instantsearch-adapter";

// Access NEXT_PUBLIC_ vars via literal dot notation so Next.js can
// statically inline them into the client bundle at build time.
const typesenseInstantSearchAdapter = new TypesenseInstantSearchAdapter({
  server: {
    apiKey: process.env.NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY ?? "",
    nodes: [
      {
        host: process.env.NEXT_PUBLIC_TYPESENSE_HOST ?? "localhost",
        port: Number(process.env.NEXT_PUBLIC_TYPESENSE_PORT ?? 8108),
        protocol: "http",
      },
    ],
  },
  additionalSearchParameters: {
    query_by: "title,series,reporter,filmReel,reelSegment,accessCopy",
    query_by_weights: "5,3,3,2,1,1",
    sort_by: "_text_match:desc,date:desc",
  },
});

export const searchClient = typesenseInstantSearchAdapter.searchClient;
