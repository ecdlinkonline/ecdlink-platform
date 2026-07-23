# ECDLink SaaS Platform

Production-ready Next.js, TypeScript and Tailwind CSS application for the ECDLink platform.

For the current audit, cleanup notes, local testing guide, deployment checklist and production roadmap, see [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md).

For PostgreSQL, Prisma, Neon and database migration setup, see [`DATABASE.md`](DATABASE.md).

## Authentication module

Primary provider: Clerk.

Fallback provider: NextAuth/Auth.js credentials fallback for controlled recovery access.

## User roles

- Super Admin
- ECD Centre
- Supplier
- Donor
- Funding Organisation

## Routes

- `/` redirects to `/auth/sign-in`
- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/select-role`
- `/auth/fallback`
- `/api/auth/[...nextauth]`
- `/dashboard`
- `/dashboard/super-admin`
- `/dashboard/super-admin/compliance`
- `/dashboard/super-admin/funding`
- `/dashboard/super-admin/memberships`
- `/dashboard/super-admin/procurement`
- `/dashboard/super-admin/suppliers`
- `/dashboard/super-admin/partners`
- `/dashboard/super-admin/intelligence`
- `/dashboard/ecd-centre`
- `/dashboard/ecd-centre/compliance`
- `/dashboard/ecd-centre/funding`
- `/dashboard/ecd-centre/membership`
- `/dashboard/ecd-centre/procurement`
- `/dashboard/ecd-centre/intelligence`
- `/dashboard/supplier`
- `/dashboard/supplier/products`
- `/dashboard/supplier/orders`
- `/dashboard/supplier/quotations`
- `/dashboard/supplier/deliveries`
- `/dashboard/supplier/invoices`
- `/dashboard/supplier/payments`
- `/dashboard/supplier/reports`
- `/dashboard/supplier/intelligence`
- `/dashboard/donor`
- `/dashboard/donor/centres`
- `/dashboard/donor/projects`
- `/dashboard/donor/partnerships`
- `/dashboard/donor/impact-reports`
- `/dashboard/donor/intelligence`
- `/dashboard/donor/messages`
- `/dashboard/donor/profile`
- `/dashboard/funding-partner`
- `/dashboard/funding-partner/intelligence`

## Phase 3 Production Setup

Copy `.env.example` to `.env.local` and add real Clerk and PostgreSQL values. Keep `USE_MOCK_DATA=false` for production verification.

```bash
npm install
npx prisma format
npx prisma validate
npm run db:generate
npm run db:migrate -- --name initial_production_schema
npm run db:seed
npm run build
npm run lint
npm run dev
```

Open `http://localhost:3000`.

The first successful migration for the combined Phase 2 schema must be a single baseline migration named `initial_production_schema`.

## Browser Smoke-Test Checklist

- Authentication: sign in with Clerk and confirm `/dashboard` redirects by role.
- Super Admin: open dashboard, centres, Centre 360, membership, procurement, compliance, funding, suppliers, partners and Intelligence.
- ECD Centre: confirm only the linked centre profile, membership, procurement, compliance, funding and Intelligence records are visible.
- Supplier: confirm only the linked supplier organisation, products, orders, deliveries, invoices and Intelligence are visible.
- Donor / CSI: confirm approved partner-facing centres/projects plus owned organisation requests, commitments, reports and Intelligence.
- Funding Organisation: confirm only owned funding calls, applications, assessments and Intelligence.
- API health: open `/api/db/health` and confirm it reports connectivity without credentials.
- Error responses: verify unauthenticated requests return 401, unauthorised tenant access returns 403, missing records return 404 and invalid payloads return 400/422.

## Role routing

After Clerk sign-up, users choose a role on `/auth/select-role`. The selected role is stored in Clerk user metadata and `/dashboard` routes to the matching dashboard.

NextAuth fallback users are treated as `super_admin` by default.

## Role-Based Dashboard Architecture

- Shared app shell with responsive sidebar, top navigation, user profile control, notifications, search and breadcrumbs.
- Role-based menu configuration lives in `config/dashboard.ts`.
- Role permissions are defined centrally and filtered before rendering menu items.
- `/dashboard` redirects users to the dashboard for their authenticated role.
- Each role dashboard uses `RoleDashboardShell` and `DashboardLanding`.
- Future menu routes render a polished empty state through `app/dashboard/[...segments]/page.tsx` until their module is implemented.
- Theme support is provided by `ThemeProvider` with light and dark mode.
- Dashboard loading and error states are available in `app/dashboard/loading.tsx` and `app/dashboard/error.tsx`.

## Centre Management

- Super Admin can view all centres, open profiles and edit profile records.
- ECD Centre users can view and update their own centre profile.
- Seeded mock data includes 16 ECD centres in `lib/centres/seed.ts`.
- Mock API functions live in `lib/centres/api.ts` and can later be replaced with database calls.

## Unified ECD Centre Profile

- Super Admin centre detail pages now open a 360 degree centre view at `/dashboard/super-admin/centres/[centreId]`.
- Combines existing centre, membership, compliance, procurement and funding data without duplicating records.
- Includes tabs for overview, membership, compliance, procurement, funding, documents, orders, invoices, notes and timeline.
- Calculates overall health score and risk level from membership, compliance, procurement activity and funding readiness.
- Centre search supports centre name, principal, region, NPO and DBE / partial care status.
- Unified aggregation lives in `lib/centre-360/api.ts`; the working screen lives in `components/centre-360/unified-centre-profile.tsx`.

## Procurement module

- Design system lives in `components/design-system`.
- ECD Centre: ordering notification, R2k/R3k/R5k/R8k/R10k/custom budget, product catalogue, cart, checkout, invoice and PDF placeholder.
- Super Admin: all centre orders, approval states, search/filter surfaces, delivery status and procurement reports.
- Supplier: consolidated orders, required products, centre-level packing instructions and delivery schedule.
- Catalogue includes 100+ seeded products across ECDLink supplier categories.
- Payments are intentionally left as placeholders for future gateway integration.

## Membership & Billing

- Annual ECDLink membership fee is R1,250 per ECD centre.
- Super Admin can view all 16 seeded membership records, search and filter by centre, region, status and payment state.
- ECD Centre users can view their own membership status, dates, invoice, receipt placeholder and renewal reminders.
- Includes active, pending, overdue and expired statuses, membership reports and payment gateway placeholders.
- Mock API functions live in `lib/membership/api.ts` and can later be replaced with database-backed billing workflows.

## Compliance Hub

- Stores the full ECDLink compliance checklist including NPO Certificate, Constitution, DBE / Partial Care, Tax Clearance / PIN, bank records, committee records, staff and children lists, proof of residence, health and safety, fire, kitchen compliance and centre photos.
- Shows uploaded, missing, expired, expiring soon, verified and rejected document states.
- Includes centre-by-centre compliance profiles, traffic-light scores, missing document checklists, expiry reminders, admin verification notes and upload placeholders.
- Super Admin can search and filter by centre, region, document status and traffic-light score.
- Seeded mock data includes compliance records for all 16 ECD centres.
- Available to ECD Centres and Super Admins.

## Funding Readiness

- Includes funding readiness scores, funding opportunity types, project profiles, application checklists, supporting document checklists and application tracking.
- Opportunity types include government, CSI, NGO, donor, equipment, nutrition, infrastructure and training funding.
- Super Admin can search and filter by centre, region, status, readiness score and funder type.
- ECD Centre users can view proposal builder, budget builder and beneficiary list manager placeholders.
- Includes admin notes, funding reports, project profile summaries and future donor portal placeholders.
- Seeded mock data includes funding readiness records for all 16 ECD centres.
- Available to ECD Centres and Super Admins.

## Donor Portal

- Donors, CSI teams, foundations, NGOs, individual donors and government departments can discover verified centres and support partner-ready projects.
- This is an impact and partnership platform, not a crowdfunding platform; sponsorship and payment flows are placeholders.
- Includes dashboard metrics, centre directory, 20 seeded projects, partner profile, partnership request placeholders, messaging placeholders and reports.
- Project categories include nutrition, kitchen upgrades, playground equipment, learning resources, infrastructure repairs, training, furniture and ICT equipment.
- Seeded mock data includes 16 centres, 20 projects, 10 donor organisations and 5 CSI organisations.
- Super Admin partner management is available at `/dashboard/super-admin/partners` for project approval, featuring, hiding, partner approval and engagement monitoring.

## Supplier Dashboard

- Suppliers can manage company profile, product catalogue, consolidated orders, quotations, invoices, payments, deliveries and reports.
- Super Admin can view all suppliers, approve suppliers, search and filter by category, area, status and tax compliance.
- Supplier records include registration details, areas served, product categories, delivery capability, bulk pricing, compliance and status.
- Product catalogue includes product name, category, brand, pack size, unit price, stock availability, minimum order quantity, image placeholder and price update date.
- Orders include consolidated ECDLink quantities, centre-level packing instructions, delivery schedules, status and proof of delivery placeholders.
- Reports include supplier performance score, on-time delivery, fulfilment rate, quote response time, top categories and monthly supplier order value.
- Seeded mock data includes 10 suppliers connected to procurement catalogue categories.

## ECDLink Intelligence

- Adds role-specific AI assistant workspaces for Super Admin, ECD Centres, Suppliers, Donor / CSI Partners and Funding Organisations.
- Super Admin can ask across centres, procurement, compliance, funding, membership, suppliers and donor records.
- Centre, supplier, donor and funding partner assistants include suggested prompts, insight cards, recommendations and chat-style responses.
- Report, proposal, procurement recommendation and compliance analysis outputs are placeholders for future secure AI generation.
- Mock response engine lives in `lib/intelligence/engine.ts` and uses existing seeded platform records without connecting to a real AI API.
