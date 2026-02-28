import "server-only";
import { Client } from "typesense";
import { serverEnv } from "@/lib/env";

const globalForTypesense = globalThis as unknown as {
  typesenseClient: Client | undefined;
};

/**
 * Lazy Typesense client getter.
 * The Client constructor validates apiKey eagerly, which crashes during
 * `next build` when SKIP_ENV_VALIDATION=1 is set (no runtime secrets).
 * By deferring instantiation to first access, the build succeeds.
 */
export function getTypesenseClient(): Client {
  if (globalForTypesense.typesenseClient) {
    return globalForTypesense.typesenseClient;
  }

  const client = new Client({
    nodes: [
      {
        host: serverEnv.TYPESENSE_HOST,
        port: Number(serverEnv.TYPESENSE_PORT),
        protocol: "http",
      },
    ],
    apiKey: serverEnv.TYPESENSE_API_KEY,
    connectionTimeoutSeconds: 5,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForTypesense.typesenseClient = client;
  }

  return client;
}
