# ECDLink Prototype Demo Script

Target meeting length: 10 minutes  
Audience: investors, implementation partners, developers, ECD sector partners

## Demo Goal

Show ECDLink as a scalable digital operating system for township Early Childhood Development centres, bringing centre management, procurement, compliance, funding readiness, suppliers, donors and reporting into one coordinated platform.

## 1. Opening Script

Say:

"ECDLink is being designed as the operating system for Early Childhood Development centres in South Africa. Today many centres manage procurement, compliance documents, funding applications, supplier coordination and donor reporting manually, often through WhatsApp, spreadsheets and paper files.

ECDLink brings those workflows into one role-based SaaS platform. The goal is to help ECD centres become more organised, compliant, fundable and connected to reliable support systems, while giving ECDLink a scalable command centre to manage 16 centres today and grow toward 500+ centres nationally."

Open:

- `/auth/sign-in`
- Then proceed to `/dashboard`

Explain:

"The prototype starts with authentication and role-based access. Each user type enters a different workspace with the tools relevant to them."

## 2. Role-Based Dashboard Architecture

Open:

- `/dashboard/super-admin`

Say:

"This is the Super Admin workspace for the ECDLink team. It is the operational command centre across centres, memberships, procurement, suppliers, funding, compliance, reports, analytics and notifications."

Point out:

- Responsive sidebar
- Role-based menu
- Top search area
- Notifications
- User profile control
- Breadcrumbs
- Light/dark mode toggle

Say:

"The key architectural point is that every future module plugs into the same dashboard shell. That keeps the product scalable, consistent and easier to maintain."

## 3. Centre Management

Open:

- `/dashboard/super-admin/centres`
- Then open one centre profile from the list

Say:

"ECD Centre Management is the core database module. Each centre has a full profile with registration status, NPO number, DBE or partial care status, region, contact details, children, staff, membership, procurement, compliance and funding readiness status."

Point out:

- Centre list
- Search and filters
- Centre profile
- Status cards
- Activity timeline
- Document, procurement and funding placeholders

Say:

"This creates a single source of truth for every ECD centre. Instead of scattered records, ECDLink staff can open one profile and understand the current state of a centre immediately."

## 4. Unified 360 Degree Centre View

Open:

- `/dashboard/super-admin/centres/little-stars-ecd`

Say:

"This is the 360 degree centre view. It combines centre profile, membership, compliance, procurement, funding, documents, invoices, notes and timeline into one working screen."

Point out:

- Overall health score
- Risk level
- Membership status
- Compliance score
- Funding readiness score
- Procurement activity
- Tabs across the profile
- Outstanding actions

Say:

"This is where the operating system concept becomes clear. ECDLink is not just showing data. It is helping staff decide what to do next: renew membership, follow up on missing documents, support funding readiness or activate procurement."

## 5. Procurement Management

Open:

- `/dashboard/ecd-centre/procurement`
- Then `/dashboard/super-admin/procurement`
- Then `/dashboard/supplier/orders`

Say:

"Procurement is the commercial engine of ECDLink. Centres choose a monthly budget, browse products, add items to a cart and submit an order. ECDLink then consolidates orders across centres and coordinates suppliers."

Point out in ECD Centre view:

- Budget options
- Product catalogue
- Categories
- Cart
- Remaining budget
- Checkout
- Invoice placeholder

Point out in Super Admin view:

- All orders
- Order statuses
- Delivery tracking
- Reports

Point out in Supplier view:

- Consolidated orders
- Product quantities
- Packing instructions per centre
- Delivery statuses

Say:

"The model is powerful because suppliers receive consolidated demand, while each centre still receives separately packed goods. That creates operational efficiency and buying power."

## 6. Membership & Compliance

Open:

- `/dashboard/super-admin/memberships`
- `/dashboard/super-admin/compliance`
- `/dashboard/ecd-centre/compliance`

Say:

"Membership and compliance are essential for centre support and funding readiness. ECDLink tracks the annual membership fee, renewal dates, invoices, receipts and payment placeholders."

Point out:

- Active, pending, overdue and expired membership statuses
- Annual fee of R1,250
- Renewal reminders
- Compliance traffic-light score
- Missing, expired, verified and rejected document states
- Upload placeholders

Say:

"For compliance, the platform stores the documents that funders and government partners often request: NPO certificate, constitution, DBE or partial care registration, tax PIN, bank confirmation, committee IDs, children lists, health and safety documents and centre photos."

## 7. Funding Readiness

Open:

- `/dashboard/super-admin/funding`
- `/dashboard/ecd-centre/funding`

Say:

"Funding Readiness helps centres prepare stronger funding applications. It tracks proposal readiness, budget readiness, beneficiary lists, supporting documents and application status."

Point out:

- Funding readiness score
- Application checklist
- Supporting document checklist
- Project profiles
- Status tracking
- Admin notes
- Reports

Say:

"This is not only about finding opportunities. It is about preparing centres to be fundable before the deadline arrives."

## 8. Supplier Portal

Open:

- `/dashboard/super-admin/suppliers`
- `/dashboard/supplier`
- `/dashboard/supplier/products`
- `/dashboard/supplier/reports`

Say:

"The Supplier Portal manages approved suppliers, product catalogues, quotations, consolidated orders, deliveries, invoices, payments and supplier performance."

Point out:

- Supplier profiles
- Product catalogue
- Delivery capability
- Tax compliance
- Supplier status
- Performance score
- On-time delivery rate
- Fulfilment rate

Say:

"This gives ECDLink a structured way to manage supplier quality as the network grows."

## 9. Donor & CSI Partner Portal

Open:

- `/dashboard/donor`
- `/dashboard/donor/centres`
- `/dashboard/donor/projects`
- Open one project detail page

Say:

"The Donor and CSI Portal is an impact and partnership platform. It allows donors, CSI teams, foundations, NGOs and government partners to discover verified centres and support structured projects."

Point out:

- Verified centre directory
- Project cards
- Current needs
- Children reached
- Photos placeholders
- Project budget and progress
- Partnership request placeholders
- Impact reports

Say:

"This is intentionally not a crowdfunding platform. It is a verified partnership layer that helps funders make informed decisions and track impact."

## 10. ECDLink Intelligence

Open:

- `/dashboard/super-admin/intelligence`
- `/dashboard/ecd-centre/intelligence`
- `/dashboard/donor/intelligence`

Say:

"ECDLink Intelligence is the future AI-powered operations assistant. In this prototype it uses mocked responses from seeded data, but it demonstrates the intended user experience."

Point out:

- Chat interface
- Suggested prompts
- Insight cards
- Action recommendations
- Report and proposal placeholders

Example prompts to show:

- "Which centres have expired compliance documents?"
- "Which centres are funding-ready?"
- "Generate a monthly procurement report"
- "Recommend verified centres to support"

Say:

"The purpose is to help users move from data to decisions. A Super Admin can identify risk. A centre can see next actions. A supplier can plan stock. A donor can find suitable centres to support."

## 11. How To Explain ECDLink As An Operating System

Say:

"ECDLink is an operating system because it connects the core workflows that make an ECD centre function:

- Centre records
- Membership
- Compliance
- Procurement
- Suppliers
- Funding readiness
- Donor partnerships
- Reporting
- Intelligence and recommendations

Each module can work on its own, but the real value comes from the connection between them. A centre's compliance status affects funding readiness. Procurement activity affects operational reporting. Donor projects connect back to verified centre profiles. Supplier performance affects monthly procurement reliability.

That connected data layer is what makes ECDLink more than a dashboard. It becomes the system of record and coordination layer for the ECD network."

## 12. Phased Roadmap Explanation

Say:

"The roadmap moves in phases.

Phase 1 is prototype validation: confirm workflows, user roles, navigation, data model and stakeholder needs.

Phase 2 is production foundation: database, authentication hardening, permissions, file storage, audit logs and real APIs.

Phase 3 is operational workflows: live procurement, membership billing, compliance verification, supplier coordination and funding application management.

Phase 4 is integrations: payment gateway, PDF generation, email and SMS notifications, document storage and reporting exports.

Phase 5 is intelligence: secure AI assistance across platform data, with role-based access controls and human review.

Phase 6 is scale: onboarding hundreds of centres, regional dashboards, national reporting and partner analytics."

## 13. What Still Needs Production Development

Say:

"This prototype demonstrates the product architecture, user experience and module workflows. Before production, we still need to build the live backend and integrations."

Mention:

- Real database
- Production Clerk role management
- Server-side permissions
- File uploads and document storage
- Payment gateway
- PDF generation
- Email and SMS notifications
- Real procurement order processing
- Real supplier quote workflows
- Real donor/partner request workflows
- Audit logs
- Automated tests
- Security review
- Performance testing
- Accessibility QA
- Production AI integration only after data governance is defined

## 14. Developer Questions

Ask:

- What database schema would best support centres, documents, orders, suppliers, funders and donors?
- Which workflows should be built first for a minimum viable product?
- How should role permissions be enforced on both frontend and backend?
- What file storage, document preview and verification process should we use?
- What payment gateway is most suitable for South African membership and procurement payments?
- What reporting exports are essential for ECDLink operations?
- What tests should be added before pilot rollout?
- What data migration process is needed for the existing 16 centres?

## 15. Investor / Partner Questions

Ask:

- Which module creates the strongest immediate value: procurement, compliance, funding or donor reporting?
- What would make this platform compelling for 500+ centres?
- Which partner organisations should be part of the pilot?
- What evidence would investors want to see after a 3-month pilot?
- Which metrics matter most: centres onboarded, procurement value, compliance improvement, funding secured or children reached?
- Should the business model prioritise membership, procurement coordination, supplier fees, donor reporting or a blended model?
- What risks would need to be reduced before national rollout?

## 16. Closing Script

Say:

"ECDLink is designed to become the digital backbone for township ECD centres. The prototype shows how the platform can organise centre data, coordinate procurement, improve compliance, prepare centres for funding, manage suppliers, support donor partnerships and eventually use intelligence to recommend next actions.

The next step is to select the highest-value pilot workflows, connect the platform to a real backend and test it with the existing 16 centres before scaling toward a national rollout."

