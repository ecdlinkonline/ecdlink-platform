# Prisma Migrations

Run the first migration after configuring `DATABASE_URL` and installing dependencies:

```bash
npm run db:migrate -- --name initial_database
```

This will create the generated SQL migration directory for the initial production database schema.

For Phase 1A membership database integration, run:

```bash
npm run db:migrate -- --name membership_database_integration
```

This migration captures the expanded membership fields, payment status support and membership receipt model.

For Phase 1B user, role and centre ownership integration, run:

```bash
npm run db:migrate -- --name user_role_centre_ownership_integration
```

This migration captures normalized roles, permissions, centre ownership, sessions and invitations.

For Phase 2A procurement database integration, run:

```bash
npm run db:migrate -- --name procurement_database_integration
```

This migration captures scalable product catalogue fields, procurement cycles, order budget snapshots, order item price snapshots, delivery metadata and the one-order-per-centre-per-cycle rule.

For Phase 2B compliance database integration, run:

```bash
npm run db:migrate -- --name compliance_database_integration
```

This migration captures compliance requirement metadata, document lifecycle fields, replacement history, verification workflows and file metadata links.
