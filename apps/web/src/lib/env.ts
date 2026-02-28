import { z } from "zod";

// ─── Server-side env schema ────────────────────────────────────────
// These vars are NEVER sent to the browser.
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection URL"),
  TYPESENSE_API_KEY: z.string().min(1, "TYPESENSE_API_KEY is required"),
  TYPESENSE_HOST: z.string().min(1, "TYPESENSE_HOST is required").default("typesense"),
  TYPESENSE_PORT: z.coerce.number().int().positive().default(8108),
  TYPESENSE_SEARCH_ONLY_KEY: z.string().min(1, "TYPESENSE_SEARCH_ONLY_KEY is required"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid Redis connection URL"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters — generate with: openssl rand -base64 32"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// ─── Client-side env schema ───────────────────────────────────────
// NEXT_PUBLIC_ vars are bundled into the browser. Keep secrets out of here.
const clientEnvSchema = z.object({
  NEXT_PUBLIC_TYPESENSE_HOST: z.string().min(1).default("localhost"),
  NEXT_PUBLIC_TYPESENSE_PORT: z.coerce.number().int().positive().default(8108),
  NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY is required"),
});

// ─── Client env object ───────────────────────────────────────────
// Next.js ONLY inlines process.env.NEXT_PUBLIC_* when accessed via
// literal dot notation. Using process.env as a dynamic object does NOT work.
// This object is statically replaceable at build time.
const clientEnvRaw = {
  NEXT_PUBLIC_TYPESENSE_HOST: process.env.NEXT_PUBLIC_TYPESENSE_HOST,
  NEXT_PUBLIC_TYPESENSE_PORT: process.env.NEXT_PUBLIC_TYPESENSE_PORT,
  NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY: process.env.NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY,
};

// ─── Validation ───────────────────────────────────────────────────
// SKIP_ENV_VALIDATION=1 is set in the Dockerfile builder stage so
// `next build` succeeds without runtime secrets available.
function validateEnv() {
  if (process.env["SKIP_ENV_VALIDATION"] === "1") {
    return {
      server: process.env as unknown as z.infer<typeof serverEnvSchema>,
      client: clientEnvRaw as unknown as z.infer<typeof clientEnvSchema>,
    };
  }

  // Skip server-side validation when running in the browser — server vars
  // are never bundled into the client build, so they will always be missing.
  const isClient = typeof window !== "undefined";

  if (!isClient) {
    const serverResult = serverEnvSchema.safeParse(process.env);
    if (!serverResult.success) {
      console.error(
        "❌ Invalid server environment variables:\n",
        serverResult.error.flatten().fieldErrors,
      );
      throw new Error("Invalid server environment variables — check your .env file");
    }
  }

  const clientResult = clientEnvSchema.safeParse(clientEnvRaw);
  if (!clientResult.success) {
    console.error(
      "❌ Invalid client environment variables:\n",
      clientResult.error.flatten().fieldErrors,
    );
    throw new Error("Invalid client environment variables — check your .env file");
  }

  return {
    server: isClient
      ? (process.env as unknown as z.infer<typeof serverEnvSchema>)
      : serverEnvSchema.parse(process.env),
    client: clientResult.data,
  };
}

const env = validateEnv();

export const serverEnv = env.server;
export const clientEnv = env.client;
