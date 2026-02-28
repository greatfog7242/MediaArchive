// Plain export — no import from "prisma/config" needed since this file is
// excluded from Next.js TS compilation and read directly by the Prisma CLI.
export default {
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
};
