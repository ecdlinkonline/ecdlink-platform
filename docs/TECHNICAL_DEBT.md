# Technical debt

## Funding Partner dashboard aggregates

- **Target:** Later performance sprint
- **Current state:** `getFundingPartnerPortal()` loads organisation-scoped application, call, and assessment records and calculates dashboard metrics in memory.
- **Follow-up:** Replace the in-memory dashboard metric calculations with organisation-scoped Prisma `count`, `aggregate`, and `groupBy` queries while preserving the current authorization boundary and response contract.
- **Reason deferred:** Sprint 11A prioritizes the operational workspace and explicitly avoids repository aggregation optimization.
