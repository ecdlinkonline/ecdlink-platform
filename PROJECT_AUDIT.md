# ECDLink Project Audit & Readiness Guide

Last audited: 12 July 2026

## Phase 3 Production Verification Status

Phase 3 focuses on install, migration, seed, build, lint and local browser verification. The intended final command sequence is:

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

Current environment limitation: the sandbox could not fetch missing packages from the npm registry, so Prisma CLI, Zod and Svix could not be installed here. The codebase has been prepared for the baseline migration, but migration generation must be completed in a Windows environment with npm registry access.

### Phase 3 Checks Added

- `.env.example` includes `USE_MOCK_DATA=false`.
- `/api/db/health` no longer returns raw database error details.
- ESLint configuration is present to avoid the interactive `next lint` setup wizard.
- ECDLink Intelligence no longer imports `lib/intelligence/data.ts`; it uses database-backed services and APIs.
- Production mock imports are limited to documented development fallback and seeding paths.

## Audit Summary

ECDLink is a Next.js App Router prototype for a multi-role SaaS platform supporting ECD centres, ECDLink administrators, suppliers, donors / CSI partners and funding organisations.

This audit focused on cleanup and local-test readiness, not new feature development.

### Checks Completed

- Local import paths were checked for missing files.
- Role dashboard navigation was reviewed for route coverage.
- Procurement pages were moved back into the shared authenticated dashboard shell.
- Obsolete duplicate dashboard components and their old mock data files were removed.
- Static scans were run for common leftover markers, debug logging, invalid characters and deprecated helper usage.
- Dashboard shell, mobile sidebar, dark mode classes and role menus were reviewed by code inspection.

### Cleanup Completed

- Removed the unused legacy dashboard layer:
  - `components/dashboard/dashboard-shell.tsx`
  - `components/dashboard/super-admin-dashboard.tsx`
  - `components/dashboard/ecd-centre-dashboard.tsx`
  - `lib/dashboard/super-admin-data.ts`
  - `lib/dashboard/ecd-centre-data.ts`
- Updated procurement routes to use `RoleDashboardShell`, matching the rest of the platform.
- Confirmed local `@/` and relative imports resolve to existing files.

### Verification Limitation

The local execution environment used for this audit did not expose `node`, `npm`, `git` or installed `node_modules`, so `npm install`, `npm run build`, `npm run lint` and Git checks could not be executed here. Those commands are included in the local setup guide below.

## 1. Project Structure Summary

```text
ecdlink-homepage/
  app/
    api/auth/[...nextauth]/        NextAuth fallback API route
    auth/                          Clerk auth pages, aliases and fallback login
    dashboard/                     Role-based SaaS application routes
      super-admin/                 Admin modules and 360 centre views
      ecd-centre/                  Centre workspace modules
      supplier/                    Supplier workspace modules
      donor/                       Donor / CSI partner portal
      funding-partner/             Funding organisation workspace
      [...segments]/               Intentional module-shell placeholder route
    globals.css                    Tailwind globals and theme tokens
    layout.tsx                     Clerk, theme and toast providers
  components/
    app-shell/                     Shared dashboard shell, sidebar, top nav, theme
    auth/                          Authentication UI helpers and fallback form
    centre-360/                    Unified centre profile screen
    centres/                       Centre management UI
    charts/                        Lightweight chart components
    compliance/                    Compliance module UI
    design-system/                 Shared ECDLink components and patterns
    donor/                         Donor / CSI portal UI
    funding/                       Funding readiness UI
    intelligence/                  Mock AI assistant UI
    membership/                    Membership and billing UI
    procurement/                   Procurement workflow UI
    states/                        Loading, empty and error states
    supplier/                      Supplier portal UI
    ui/                            shadcn-style primitives
  config/
    dashboard.ts                   Central role navigation and permissions
  lib/
    auth/                          Roles, session and validation helpers
    centre-360/                    Unified centre aggregation
    centres/                       Centre types, seed data and mock API
    compliance/                    Compliance types, seed data and mock API
    donor/                         Donor portal types, seed data and mock API
    funding/                       Funding readiness types, seed data and mock API
    intelligence/                  Mock AI prompt library and response engine
    membership/                    Membership types, seed data and mock API
    procurement/                   Catalogue, orders and mock API
    supplier/                      Supplier types, seed data and mock API
  types/
    next-auth.d.ts                 NextAuth role typing
```

## 2. Full Feature List

### Platform Foundation

- Next.js App Router project using TypeScript and Tailwind CSS.
- Clerk authentication as the primary auth provider.
- NextAuth credentials fallback for controlled recovery access.
- Role selection and role-based dashboard redirection.
- Shared responsive dashboard shell with sidebar, top navigation, breadcrumbs, search placeholder, notifications, user profile control and theme toggle.
- Central role navigation and permission configuration.
- Light and dark mode support.
- Loading, empty and error states.

### Design System

- ECDLink navy, green, white and light-grey brand styling.
- Reusable buttons, badges, cards, form fields, progress bars and state components.
- Shared `PageHeader`, KPI cards, data tables, status badges, alerts, modals, drawers, skeletons, toast provider, product cards, cart summary, invoice layout and delivery tracker.
- Lightweight chart components for bar, line and donut charts.

### Super Admin

- Dashboard landing with role cards and module access.
- Centre management list, filters, profile view and edit form.
- Unified 360 degree centre profile with overview, membership, compliance, procurement, funding, documents, orders, invoices, notes and timeline.
- Membership overview and reports.
- Compliance overview and document tracking.
- Funding readiness overview and application tracking.
- Procurement console for admin order visibility.
- Supplier management, supplier profile, product, order and report views.
- Donor / CSI partner management.
- ECDLink Intelligence command centre.

### ECD Centre

- Dashboard landing.
- Own centre profile view and edit flow.
- Membership status and invoice / receipt placeholders.
- Compliance document view and upload placeholders.
- Funding readiness view with proposal, budget and beneficiary placeholders.
- Monthly procurement workflow with product browsing, cart, checkout and invoice placeholder.
- ECD Centre Intelligence assistant.
- Placeholder shells for applications, downloads, events, SmartKids TV, messages and support.

### Procurement

- 100+ seeded catalogue products across ECDLink supplier categories.
- Monthly budget selection model.
- Product catalogue, cart and checkout workflow.
- Invoice and PDF placeholder generation.
- Admin order console.
- Supplier consolidated order view.
- Delivery status tracking.
- Procurement notifications and reports placeholders.

### Membership & Billing

- Annual membership fee of R1,250 per centre.
- Active, expired, pending and overdue membership states.
- Start and expiry dates.
- Renewal reminders.
- Invoice generation and receipt/payment placeholders.
- Super Admin membership overview and ECD Centre membership view.
- Seed records for the 16 centres.

### Compliance

- Compliance dashboard for Super Admin and ECD Centres.
- Document types include NPO certificate, constitution, DBE / partial care, tax clearance / PIN, bank documents, committee records, staff and children lists, residence proof, health and safety, fire, kitchen and centre photos.
- Uploaded, missing, expired, expiring soon, verified and rejected document states.
- Traffic-light compliance score.
- Missing document checklist, expiry reminders and admin verification notes.
- Seed records for the 16 centres.

### Funding Readiness

- Funding readiness score and dashboard views.
- Proposal builder, budget builder and beneficiary list placeholders.
- Application checklist and supporting document checklist.
- Funding application tracker and project profiles.
- Funding opportunity types for government, CSI, NGO, donor, equipment, nutrition, infrastructure and training funding.
- Seed records for the 16 centres.

### Supplier Portal

- Supplier profile management.
- Product catalogue management.
- Consolidated orders and packing instructions.
- Quotations, invoices, payment placeholders and delivery tracking.
- Supplier performance reports.
- Seed data for 10 suppliers connected to procurement categories.

### Donor / CSI Partner Portal

- Donor dashboard with verified centres, projects, children reached and impact metrics.
- Verified centre directory.
- Project cards and project detail pages.
- Partnership request placeholders.
- Messaging placeholders.
- Impact reports and engagement reports.
- Seed data for 16 centres, 20 projects, 10 donor organisations and 5 CSI organisations.

### ECDLink Intelligence

- Super Admin AI command centre.
- Role-specific assistants for centres, suppliers, donors and funding partners.
- Chat-style UI with suggested prompts.
- Insight cards and action recommendations.
- Mocked report, proposal, procurement and compliance outputs.
- Deterministic mock response engine based on existing seeded data.

## 3. Known Limitations

- Data is stored in TypeScript seed files and mock APIs, not a real database.
- Auth is structurally wired, but role metadata and production invitation flows still need real Clerk configuration.
- NextAuth fallback is intended only for controlled recovery access and should be tightly protected in production.
- Payments are placeholders; no payment gateway is integrated.
- File uploads are placeholders; no object storage or virus scanning is integrated.
- PDF generation is represented as placeholders.
- ECDLink Intelligence does not call a real AI API yet.
- Several lower-priority routes intentionally render module-shell empty states through `app/dashboard/[...segments]/page.tsx`.
- Some older auth preview components remain in the codebase as non-primary prototype UI, while active routes use Clerk pages and aliases.
- No automated test suite is present yet.
- Build and lint were not executed in this audit environment because Node/npm dependencies were unavailable.
- Accessibility has good foundations through semantic buttons and labels, but needs browser-based keyboard, screen-reader and contrast testing.
- Dark mode is broadly supported in the active app shell and module screens, but should still be visually QA-tested route by route.

## 4. Local Development Setup Guide

### Prerequisites

- Node.js 20 LTS or newer.
- npm 10 or newer.
- A Clerk application with publishable and secret keys.

### Setup

```bash
cd outputs/ecdlink-homepage
npm install
cp .env.example .env.local
```

Update `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/auth/select-role
AUTH_SECRET=<generate-a-secure-secret>
AUTH_TRUST_HOST=true
ECDLINK_FALLBACK_ADMIN_EMAIL=admin@ecdlink.co.za
ECDLINK_FALLBACK_ADMIN_PASSWORD=<strong-local-password>
```

Generate `AUTH_SECRET` with one of:

```bash
npx auth secret
openssl rand -base64 32
```

Run locally:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Local Validation Commands

```bash
npm run build
npm run lint
```

Recommended additional checks before handoff:

```bash
npx tsc --noEmit
```

Manual browser smoke test:

- Visit `/auth/sign-in`.
- Sign in or use the fallback route if configured.
- Confirm `/dashboard` redirects to the selected role dashboard.
- Test the mobile sidebar below 768px width.
- Toggle light/dark mode.
- Visit each major role route listed in `README.md`.

## 5. Deployment Checklist

### Environment

- Configure production Clerk keys.
- Configure Clerk allowed redirect URLs.
- Configure `AUTH_SECRET`.
- Use strong fallback admin credentials or disable fallback entirely if not required.
- Set `AUTH_TRUST_HOST=true` only where appropriate for the hosting provider.

### Security

- Protect Super Admin access with Clerk organisation roles or verified metadata.
- Add rate limiting for fallback login and future API routes.
- Add audit logging for admin actions.
- Add server-side permission checks for every future database mutation.
- Replace mock APIs with database-backed services.
- Add file upload validation, virus scanning and object storage permissions.

### Quality

- Run `npm run build`.
- Run `npm run lint`.
- Run `npx tsc --noEmit`.
- Add Playwright smoke tests for auth, dashboard routing, mobile sidebar, dark mode and core module routes.
- Verify keyboard navigation and focus states.
- Verify colour contrast in light and dark mode.
- Test responsive layouts at mobile, tablet and desktop widths.

### Product Readiness

- Replace seed data with real database records.
- Integrate payment gateway for membership and procurement payments.
- Integrate PDF generation for invoices and reports.
- Integrate transactional email/SMS notifications.
- Integrate file uploads and document preview.
- Add production observability, error tracking and analytics.
- Create backup and disaster recovery procedures.

## 6. Roadmap From Prototype To Production

### Phase 1: Stabilise The Prototype

- Install dependencies and run build/lint/type checks.
- Resolve any compiler issues found in a real Node environment.
- Add smoke tests for role routing and the shared dashboard shell.
- Confirm all seeded data relationships are internally consistent.
- Complete visual QA on mobile and dark mode.

### Phase 2: Data Platform

- Introduce a relational database such as PostgreSQL.
- Model organisations, users, roles, centres, suppliers, products, orders, memberships, compliance documents, funding applications and partner projects.
- Replace mock API functions with service-layer database calls.
- Add row-level permission checks by role and organisation.

### Phase 3: Production Workflows

- Build real procurement approvals, consolidated supplier orders and delivery confirmations.
- Add membership invoicing and payment reconciliation.
- Add document upload, preview, expiry workflows and verification queues.
- Add funding proposal, budget and application submission workflows.
- Add donor/CSI partnership request lifecycle management.

### Phase 4: Integrations

- Payment gateway integration.
- Email and SMS reminders.
- Object storage for files and photos.
- PDF generation for invoices, reports and proposal packs.
- Supplier import/export and reporting integrations.

### Phase 5: Intelligence Layer

- Replace mocked intelligence responses with a secure AI service.
- Add retrieval over centre, procurement, compliance, funding and supplier records.
- Add role-based data boundaries for AI responses.
- Add human review for generated proposals and reports.
- Add action execution only after explicit user confirmation.

### Phase 6: Nationwide Rollout

- Add onboarding workflows for 500+ centres.
- Add organisation management and team invitations.
- Add province/region dashboards.
- Add advanced analytics and impact reporting.
- Add monitoring, incident response and compliance governance.
