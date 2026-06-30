# FeedPilot V2 Launch Validation — Issue #10

## Summary

This launch validation checks FeedPilot V2 production readiness signals without changing product behavior, billing logic, authentication, installation, plan names, plan prices, quota rules, database schema, Prisma schema, or Shopify write paths.

Overall finding: no code-level launch blocker was found in the inspected areas. The remaining launch decision depends on owner-run Shopify billing and quota smoke tests that Codex cannot perform from this environment.

Final recommendation: **Launch-ready after remaining manual Shopify billing and quota smoke tests.**

## Commands run

| Command | Result | Notes |
| --- | --- | --- |
| `npm run build` | Passed | Production build completed successfully. |
| `npm run typecheck` | Failed | Pre-existing repo-wide TypeScript issues were reported in existing app files; this report-only task did not modify those files. |
| `npm run lint` | Failed | Pre-existing repo-wide ESLint issues were reported in existing app files; this report-only task did not modify those files. |

## Files inspected

- `app/shopify.server.ts` — billing plan definitions and prices.
- `app/routes/app.billing.tsx` — billing request route and return URL.
- `app/utils/plan.server.ts` — Free / Starter / Growth plan detection.
- `app/routes/app._index.tsx` — dashboard loader/action, Free quota query, Optimize Now UI result handling, dashboard value copy, plan prompts, and Growth queue rendering.
- `app/routes/app.auto-run.tsx` — server-side Growth gate for weekly monitoring / automation.
- `app/routes/app.settings.tsx` — Growth-only automation settings access.
- `app/routes/app.upgrade.tsx` — pricing page, plan ladder, and upgrade value copy.
- `app/utils/safeFixPolicy.ts` — safe-fix allowlist, suggestion-only issues, monitor-only issues, sensitive commerce guardrails, and result contract decisions.
- `app/utils/growthAutomationReport.ts` — Growth automation report helper and safe automation field eligibility.
- `app/services/optimizer.server.ts` — manual Optimize Now result contract and APPLIED / SUGGESTION_ONLY / NO_CRITICAL_ISSUE_WITH_REPORT responses.
- `app/services/optimization-apply.server.ts` — supported Shopify write path used for safe title/description writes.
- `app/services/optimization-history.server.ts` — OptimizationHistory recording and weekly insight behavior.
- `app/utils/productGrowthClassifier.ts` — product growth classifier coverage.
- `app/utils/growthOpportunityQueue.ts` — Growth Opportunity Queue prioritization and action types.

## Code-level checklist

### 1. Render deployment / production startup

- Manual finding recorded: Render build succeeded.
- Manual finding recorded: initial deployment failed with `Port scan timeout reached, no open ports detected.`
- Manual finding recorded: root cause was Render Start Command `npm run setup && npm run start`.
- Manual finding recorded: Start Command was changed to `npm run start`.
- Manual finding recorded: Render reached Live state after the Start Command change.
- Status: **Resolved**.
- Launch note: Prisma migration/setup work should not block web service port startup. Keep migrations as a separate release/maintenance step rather than part of the Render web service Start Command.

### 2. Shopify embedded app loading

- Manual smoke test recorded: the app opened successfully inside Shopify Admin at `admin.shopify.com/store/test2-txc1q8ly/apps/feedpilot-app/app`.
- Manual smoke test recorded: the dashboard loaded successfully.
- Status: **Passed based on provided manual observation**.

### 3. Shopify billing flow

- Starter remains `$9/month` in the Shopify billing definition.
- Growth remains `$19/month` in the Shopify billing definition.
- Billing route still maps `starter` to `STARTER_PLAN` and `growth` to `GROWTH_PLAN`.
- Billing route still returns to `/app/upgrade?billing=success` using `SHOPIFY_APP_URL`.
- Plan detection still checks Growth first, then Starter, then falls back to Free.
- Upgrade page copy and pricing cards still present Starter at `$9` and Growth at `$19`.
- No billing prices, plan names, billing return path, or plan detection logic were changed by this validation task.
- Status: **Code-level pass; owner billing smoke tests still required**.

### 4. Plan access rules

- Free plan cannot access weekly monitoring / Growth automation because `/app/auto-run` returns a server-side 403 unless `plan === "growth"`.
- Starter plan cannot access weekly monitoring / Growth automation for the same server-side Growth gate.
- Growth-only automation route has a server-side Growth gate before settings, cooldown, product scanning, or Shopify writes are attempted.
- Automation settings route also requires Growth for mutation; non-Growth plans receive `Growth plan required`.
- No inspected V2 code grants weekly automation or Growth auto-fix to Free or Starter.
- Manual smoke test recorded: on the Free plan dashboard, Weekly Monitoring shows Locked.
- Status: **Passed**.

### 5. Free quota rules

Current code-level behavior:

- Free quota is not consumed by scan-only dashboard loading.
- Free quota is not consumed by `SUGGESTION_ONLY` responses because those paths return `usageConsumed: false` and do not record an applied manual OptimizationHistory row.
- Free quota is not consumed by `NO_CRITICAL_ISSUE_WITH_REPORT` responses because those paths return `usageConsumed: false` and do not record an applied manual OptimizationHistory row.
- Free quota is consumed only when a real manual Shopify write is `APPLIED` and recorded in OptimizationHistory.
- Existing Free limit remains **2 applied manual fixes every 7 days**.
- The Free quota count is based on OptimizationHistory rows where `source = "manual"`, `status = "applied"`, and `createdAt` is within the 7-day window.

Known UI finding:

- Dashboard currently says `Free optimizations left: 2/2`.
- This is technically backed by applied-fix quota, but the wording may confuse merchants because scans, suggestions, and healthy reports do not consume quota.
- Non-blocking wording recommendation: change to `Free applied safe fixes left: 2/2` or `Free safe fixes left: 2/2`.
- Non-blocking clarification recommendation: add `Scans, suggestions, and healthy reports do not consume quota.`

Status: **Code-level pass; owner manual quota smoke tests still required**.

### 6. Safe fix policy

- Sensitive commerce fields are guarded from auto-fix by issue handling and field eligibility:
  - price / compare-at price signals are not write targets;
  - inventory signals are suggestion/report only;
  - SKU and barcode patterns are treated as sensitive if surfaced as issue codes;
  - vendor and product type are suggestion-only / sensitive;
  - tax, shipping, publish status, and status patterns are sensitive;
  - Growth automation report helper only treats `title` and `description` fields as eligible for safe automation.
- The Shopify write path used by safe optimization updates only product `title` and `descriptionHtml` through the existing product update path.
- Suggestion-only remains a valid success state through `SUGGESTION_ONLY`.
- Healthy/no-critical report remains a valid success state through `NO_CRITICAL_ISSUE_WITH_REPORT`.
- Status: **Passed**.

### 7. Optimize Now result contract

- Manual Optimize Now still returns the three required result types:
  - `APPLIED`
  - `SUGGESTION_ONLY`
  - `NO_CRITICAL_ISSUE_WITH_REPORT`
- Missing API key, missing product ID, free applied-fix limit, errors, and unsafe/non-applied conditions produce structured suggestion/report responses instead of a dead no-value result.
- UI result handling displays the per-run growth report and labels suggestion-only and no-critical report outcomes as useful successful outcomes.
- No inspected UI path ends with only a dead message like `No optimization was applied.`
- Status: **Passed**.

### 8. Product growth classifier

- Classifier is not limited to toy title/description checks.
- Coverage includes product growth issues where data is available:
  - title quality;
  - description quality;
  - image signals and image alt signals;
  - product type;
  - vendor;
  - tags;
  - feed readiness signals;
  - catalog completeness signals;
  - pricing signals as review-only/report-only where applicable;
  - inventory signals as review-only/report-only where applicable.
- Status: **Passed**.

### 9. Growth Opportunity Queue

- Queue identifies which product should be fixed first by scoring/sorting opportunities by priority and impact.
- Queue explains why the issue matters through `whyItMatters`.
- Queue includes `recommendedAction`.
- Queue includes action types from the safe-fix decision layer:
  - `apply_safe_fix`
  - `review_suggestion`
  - `monitor`
  - `blocked_by_plan`
- Status: **Passed**.

### 10. Dashboard product value

Manual smoke test recorded:

- Dashboard headline: `FeedPilot SEO & Product Growth Control Center`.
- Main value message: `Find product growth gaps before they cost you traffic.`
- Dashboard includes:
  - Products Checked
  - Visibility Issues
  - Growth Opportunities
  - Product SEO & Catalog Health
- This confirms the app no longer presents mainly as an AI title/description optimizer.

Non-blocking copy note:

- `before they cost you traffic` may be slightly strong.
- Recommend later changing to safer wording such as `before they limit product visibility` or `before they hurt visibility readiness`.

Status: **Passed with non-blocking copy follow-up**.

### 11. Pricing page / upgrade path

- Pricing page preserves the intended value ladder:
  - Free = discover hidden product growth gaps.
  - Starter = manually fix product growth gaps faster.
  - Growth = weekly monitoring + safe auto-fix + reports.
- Upgrade prompts explain merchant value, not only limits, including full issue visibility, manual product growth fixes, weekly monitoring, safe auto-fix, suggestions for review, and automation reports.
- Status: **Passed**.

## Manual smoke tests already performed

These observations were provided as known manual findings and are recorded here without pretending Codex re-tested Shopify Admin access:

- Render build succeeded.
- Render initially failed with `Port scan timeout reached, no open ports detected.`
- Render Start Command root cause was `npm run setup && npm run start`.
- Render Start Command was changed to `npm run start`.
- Render reached Live state after the Start Command change.
- Shopify embedded app opened successfully inside Shopify Admin at `admin.shopify.com/store/test2-txc1q8ly/apps/feedpilot-app/app`.
- Dashboard loaded successfully inside Shopify Admin.
- On Free plan dashboard, Weekly Monitoring shows Locked.
- Dashboard headline and value sections present FeedPilot as an SEO & Product Growth control center rather than a basic AI title/description optimizer.

## Manual smoke tests still required

Owner still needs to complete these Shopify/manual flow checks before calling the launch fully ready:

- Click Scan Products on Free.
- Confirm suggestion-only does not reduce applied-fix quota.
- Confirm healthy report does not reduce applied-fix quota.
- Confirm actual `APPLIED` write reduces quota by 1.
- Confirm Starter upgrade flow.
- Confirm Growth upgrade flow.
- Confirm Growth weekly monitoring after upgrade.

## Blockers

- No code-level blocker found in the inspected launch validation areas.
- `npm run typecheck` currently fails on existing repo-wide TypeScript issues outside this report-only change, including React Router `never` inference, Shopify type duplication, and legacy OptimizationHistory field/type mismatches. Treat as a pre-existing validation blocker to clean up before a fully green launch checklist.
- `npm run lint` currently fails on existing repo-wide lint issues outside this report-only change, including explicit `any`, unused variables, and accessibility lint violations. Treat as a pre-existing validation blocker to clean up before a fully green launch checklist.
- Remaining blocker to a full launch-ready declaration: Shopify billing and quota manual smoke tests have not been completed by the owner in this Codex environment.

## Non-blocking follow-ups

- Improve Free quota wording from `Free optimizations left: 2/2` to `Free applied safe fixes left: 2/2` or `Free safe fixes left: 2/2`.
- Add explanatory quota helper copy: `Scans, suggestions, and healthy reports do not consume quota.`
- Consider changing dashboard copy from `before they cost you traffic` to safer wording such as `before they limit product visibility` or `before they hurt visibility readiness`.

## Final recommendation

**Launch-ready after remaining manual Shopify billing and quota smoke tests.**
