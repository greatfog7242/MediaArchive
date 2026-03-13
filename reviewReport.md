# Review Report

Date: 2026-03-12
Project: MediaArchive

## Summary
- Lint executed successfully in `apps/web` after installing deps and adding ESLint config; root still lacks `package.json`.
- No NestJS controllers detected; Hono routes use role-based middleware.
- Potential N+1/per-row DB write patterns in batch update and CSV import paths.
- CORS configuration reflects any origin with credentials; verify production constraints.
- TypeScript diagnostics tool was not available in this session.

## Lint
- Root: `npm run lint` failed because `C:\Work\Project\MediaArchive\package.json` is missing.
- Web app: `apps/web`: `npm run lint` passed after:
  - Upgrading Node to v24.14.0.
  - Installing dependencies.
  - Adding `apps/web/.eslintrc.json` with `next/core-web-vitals` + `next/typescript`.
  - Fixing three `@typescript-eslint/no-empty-object-type` errors in `input.tsx`, `select.tsx`, `textarea.tsx`.

## Security
- No NestJS `@Controller`/`@UseGuards` found in `apps/web/src`. Hono routes appear to enforce `verifyRole(...)` on all non-health endpoints.
- `apps/web/src/server/api/hono.ts`: CORS reflects the request origin and allows credentials for all origins. Ensure this is restricted in production.

## Architecture
- `apps/web/src/server/services/record.service.ts`: `bulkUpdateRecords` performs one update per id. This is N+1 style and can be reduced to `updateMany` + `findMany`.
- `apps/web/src/server/services/csv.service.ts`: `importBatch` performs per-row upsert/create. For large imports, consider chunking and using `createMany` for rows without `kalturaId`, plus a transaction for upserts.
- `apps/web/src/server/typesense.service.ts`: `fullSyncToTypesense` loads all records into memory; for large datasets, consider paging.

## "use client" Placement
- `"use client"` appears in leaf pages and UI components. No obvious server components depend on client-only modules. Keep an eye on shared `lib` modules to avoid server imports.

## Diagnostics
- `getDiagnostics` tool not available; TypeScript workspace diagnostics were not run.

## Suggested Refactors
```ts
// apps/web/src/server/services/record.service.ts
// Replace per-id updates with updateMany + findMany to avoid N+1
const data: Prisma.MediaRecordUpdateManyMutationInput = { ... };
await db.mediaRecord.updateMany({
  where: { id: { in: recordIds } },
  data,
});
const updatedRecords = await db.mediaRecord.findMany({
  where: { id: { in: recordIds } },
});
await bulkUpsertToTypesense(updatedRecords);
```

```ts
// apps/web/src/server/services/csv.service.ts
// Chunk large imports and use createMany where possible
const rowsWithoutKaltura = rows.filter(r => !r.KalturaID);
await db.mediaRecord.createMany({ data: rowsWithoutKaltura.map(toData) });
// For rows with kalturaId, chunk and upsert in a transaction to reduce overhead
for (const batch of chunk(rowsWithKaltura, 200)) {
  await db.$transaction(batch.map(row =>
    db.mediaRecord.upsert({ where: { kalturaId: row.KalturaID }, update: toData(row), create: toData(row) })
  ));
}
```

## Performance Tip
- Add paging to `fullSyncToTypesense` to avoid holding all records in memory on large datasets.
