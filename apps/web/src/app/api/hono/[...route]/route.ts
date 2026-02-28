import { handle } from "hono/vercel";
import { app } from "@/server/api/hono";

// Force dynamic — prevents Next.js from pre-rendering this route at build time.
// Without this, the build fails because server singletons (Typesense, DB) require
// runtime env vars that don't exist during `next build`.
export const dynamic = "force-dynamic";

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
