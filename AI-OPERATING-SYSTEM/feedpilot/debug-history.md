# FeedPilot Debug History

---

# TEMPLATE

Date:
Issue:
Symptoms:
Root Cause:
Files Involved:
Fix Applied:
Verification:
Prevention Rule:
Status:

---

# 2026-05 Shopify Billing Loop

Date:
2026-05

Issue:
Billing redirect loop after subscription approval.

Symptoms:
- User approved subscription
- Returned from Shopify billing
- App still showed Growth or incorrect plan state
- Sometimes redirected repeatedly

Root Cause:
Plan detection logic inconsistent between:
- billing helper
- loader state
- UI rendering state

FORCE_PLAN testing logic also interfered with real billing state.

Files Involved:
- app/routes/app._index.tsx
- app/routes/app.upgrade.tsx
- app/lib/plan.server.ts

Fix Applied:
- unified billing state source
- reduced duplicated plan checks
- separated FORCE_PLAN from production logic

Verification:
- Free user flow tested
- Starter upgrade tested
- Growth upgrade tested
- Return URL verified

Prevention Rule:
Never mix:
- test override state
- real billing state

Always use:
single billing source of truth.

Status:
Resolved

---

# 2026-05 Auto Run Not Triggering

Date:
2026-05

Issue:
Growth auto optimization did not execute.

Symptoms:
- Growth plan active
- automation UI visible
- no optimization executed

Root Cause:
Cooldown logic blocked execution due to:
- incorrect lastRunAt
- settings not initialized

Files Involved:
- auto-run endpoint
- AutoOptimizeSettings table
- index.tsx useEffect

Fix Applied:
- initialized settings on first run
- improved cooldown calculation
- added logging

Verification:
- AUTO CHECK logs verified
- weekly cooldown confirmed
- success toast confirmed

Prevention Rule:
Always initialize:
AutoOptimizeSettings
before checking cooldown.

Status:
Resolved

---

# 2026-05 Prisma Drift

Date:
2026-05

Issue:
Prisma migration drift caused schema mismatch.

Symptoms:
- migration failed
- Prisma schema inconsistent
- missing table errors

Root Cause:
Database schema manually changed outside migration flow.

Files Involved:
- prisma/schema.prisma
- prisma migrations

Fix Applied:
- reset migration state
- regenerated Prisma client
- recreated missing tables

Verification:
- prisma migrate dev successful
- Prisma client generated successfully

Prevention Rule:
Never manually alter production schema.
Always use Prisma migrations.

Status:
Resolved

---

# 2026-05 UI Metric Mismatch

Date:
2026-05

Issue:
Homepage metrics inconsistent.

Symptoms:
- Hero showed different count
- Needs Attention tile mismatched
- Opportunity count inconsistent

Root Cause:
Different calculations used in:
- Hero
- dashboard tiles
- opportunity section

Files Involved:
- app/routes/app._index.tsx

Fix Applied:
- unified opportunityCount source
- reused same computed value

Verification:
- all homepage sections matched

Prevention Rule:
Never duplicate business metric calculations.
Use shared computed values.

Status:
Resolved

---

# CORE ENGINEERING RULES

1.
Never rewrite large UI sections unless necessary.

2.
Always preserve billing integrity.

3.
Never invent fake analytics or ROI.

4.
Always verify:
- Free
- Starter
- Growth
flows separately.

5.
Avoid duplicated business logic.

6.
Use shared helper functions whenever possible.

7.
Preserve Optimization History integrity.

8.
Before modifying automation:
check:
- cooldown
- lastRunAt
- settings existence
- Growth plan status

9.
Before changing billing:
verify:
- returnUrl
- active subscription state
- UI rendering state
- Shopify approval flow

10.
Commercial stability is more important than flashy UI.