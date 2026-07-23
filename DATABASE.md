# ECDLink Database Foundation

ECDLink is moving from seeded mock data to PostgreSQL using Prisma ORM. The current mock data remains in place so modules can migrate one at a time.

## Required Environment Variables

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require
```

Do not commit real database URLs or passwords.

## Phase 3 Baseline Migration

The current `prisma/schema.prisma` is the combined final schema from all Phase 2 integrations. Earlier planned migration names were not generated successfully, so do not create them separately.

Create one clean baseline migration:

```bash
npm install
npx prisma format
npx prisma validate
npm run db:generate
npm run db:migrate -- --name initial_production_schema
npm run db:seed
npm run build
npm run lint
```

Useful commands:

```bash
npm run db:studio
npm run db:health
npm run db:migrate:deploy
npm run db:reset
```

Health route:

```text
/api/db/health
```

The health route returns only status, provider and check time. It must not expose database URLs, credentials or raw connection strings.

## Neon Setup

1. Create a Neon PostgreSQL project.
2. Create a production database and a development branch.
3. Copy the pooled connection string into `DATABASE_URL`.
4. Copy the direct connection string into `DIRECT_URL`.
5. Ensure SSL is enabled with `sslmode=require`.
6. Run migrations from a trusted local machine or deployment pipeline.

## Clerk Setup

Clerk remains the authentication provider. The database stores only the Clerk user ID and required profile metadata.

Current support:

- Sync-on-login fallback for local development.
- Clerk webhook endpoint scaffold at `/api/clerk/webhook`.

Still pending before production:

- Add svix webhook signature verification.
- Configure Clerk webhook events for `user.created` and `user.updated`.
- Connect Clerk organisation/team roles to server-side database authorisation.

## Database-Backed Modules

Phase 2 database integrations cover Centre Management, Membership, Procurement, Compliance, Funding, Supplier Portal, Donor / CSI Portal and ECDLink Intelligence.

Mock arrays may remain only for seeding, tests and documented development fallback. Production verification should run with `USE_MOCK_DATA=false` and valid PostgreSQL URLs.

## Money And Dates

- Persisted money values use PostgreSQL decimal columns.
- Historical procurement order items store price snapshots.
- DTO mapping converts database `Date` values to ISO date strings before passing data to Client Components.
- Prisma Decimal values should be converted to strings before they reach Client Components.
