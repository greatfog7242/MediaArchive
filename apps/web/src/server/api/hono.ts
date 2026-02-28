import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Role } from "@prisma/client";
import { recordsRouter } from "./routes/records";
import { syncRouter } from "./routes/sync";
import { csvRouter } from "./routes/csv";
import { usersRouter } from "./routes/users";

/**
 * Hono context variables available after auth middleware runs.
 */
export type AppVariables = {
  userId: string;
  userRole: Role;
};

export type AppEnv = {
  Variables: AppVariables;
};

/**
 * Base Hono app factory.
 * Mounted under `/api/hono` via the Next.js catch-all route.
 */
const app = new Hono<AppEnv>().basePath("/api/hono");

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin, // reflect requesting origin in dev
    credentials: true,
  })
);

// Mount route modules
app.route("/records", recordsRouter);
app.route("/sync", syncRouter);
app.route("/csv", csvRouter);
app.route("/users", usersRouter);

export { app };
