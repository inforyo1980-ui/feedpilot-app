# AGENTS.md — FeedPilot Codex Workflow Rules

These rules apply to all AI coding agents working in this repository.

FeedPilot is a Shopify SaaS project. The current priority is FeedPilot V2: SEO & Product Growth. Do not treat this app as a toy AI copywriting demo.

## Highest Product Rule

Build for paid merchant value.

Every implementation should support at least one of these merchant outcomes:

- discover hidden product growth gaps
- improve product SEO and visibility readiness
- improve catalog completeness
- identify feed readiness signals
- safely apply supported fixes
- create review suggestions when automatic changes are unsafe
- preserve a clear Free / Starter / Growth paid value ladder

If a task would make FeedPilot look like a basic title/description checker or generic AI writer, stop and report the conflict.

## One Issue, One PR

For each GitHub Issue:

1. Create exactly one PR for that Issue.
2. The PR title should reference the Issue task clearly.
3. Keep all follow-up fixes for that Issue in the same PR branch.
4. Do not create a second PR from `main` to fix review comments.
5. Do not create standalone patch PRs unless the reviewer explicitly asks for a separate PR.

## Review Fix Rule

When a reviewer asks for changes on an existing PR:

- continue on the existing PR branch
- push new commits to that same branch
- do not branch from `main`
- do not open a new PR
- do not close and replace the PR unless explicitly instructed

Example:

If review comments are on PR #11, update PR #11's branch.
Do not create PR #12 or PR #13 from `main` unless explicitly requested.

## Branch Rule

Before making review fixes, identify the current PR branch.

Use the PR branch as the working base.

Do not assume `main` is the right base for review fixes.

## Protected App Foundation

Do not break or rewrite these areas unless the task explicitly requires it:

- Shopify authentication
- Shopify installation flow
- Shopify billing flow
- Free / Starter / Growth plan detection
- billing return URL behavior
- Render deployment compatibility
- PostgreSQL compatibility
- existing OptimizationHistory behavior
- existing Shopify Product API integration

If a change touches these areas, explain why and how it was validated.

## Patch Size Rule

Prefer the smallest safe implementation.

Avoid broad formatting-only changes, large unrelated refactors, or renaming unrelated structures.

If a file is already large, do not reformat the whole file.

## FeedPilot V2 Result Contract

Manual Optimize Now must never end with a dead no-value result.

Every manual optimization path should return one of:

- `APPLIED`
- `SUGGESTION_ONLY`
- `NO_CRITICAL_ISSUE_WITH_REPORT`

Required behavior:

- `APPLIED` means a real safe write occurred and usage may be consumed.
- `SUGGESTION_ONLY` means issues or opportunities were found, but no automatic write was safely applied.
- `NO_CRITICAL_ISSUE_WITH_REPORT` means no critical issue was found, but the merchant still receives a useful report.

Do not return only:

- "No optimization was applied"
- a silent no-op
- a raw 403 before the system knows whether the result is applied or suggestion/report only

## Free Quota Rule

Free quota is for real applied writes only.

Correct behavior:

- `APPLIED` consumes Free quota.
- `SUGGESTION_ONLY` does not consume Free quota.
- `NO_CRITICAL_ISSUE_WITH_REPORT` does not consume Free quota.

When Free quota is exhausted:

- if the result would be `SUGGESTION_ONLY`, return the report with `usageConsumed: false`
- if the result would be `NO_CRITICAL_ISSUE_WITH_REPORT`, return the report with `usageConsumed: false`
- if the result would require an `APPLIED` write, block the write and return an upgrade-required response without writing to Shopify

Do not block the entire manual Optimize Now flow before determining the result type.

## Safe Fix Rule

Do not automatically change sensitive commerce data in V2.

Never auto-change:

- price
- compare-at price
- inventory
- SKU
- barcode
- vendor
- product type
- tax fields
- shipping fields
- product publish status

Safe auto-apply should stay conservative and use only proven existing write paths.

Risky fields should become review suggestions.

## Plan Boundary Rule

Preserve the paid value ladder:

- Free = discover hidden product growth gaps
- Starter = manually fix product growth gaps faster
- Growth = weekly monitoring + safe auto-fix + reports

Do not give Growth-only automation to Free or Starter.

Do not change prices or billing logic unless the Issue explicitly asks for it.

Current validation pricing:

- Starter: $9/month
- Growth: $19/month

## Copy and Claims Rule

Avoid unsupported claims.

Do not claim:

- guaranteed traffic increase
- guaranteed ranking improvement
- guaranteed sales increase
- official Google Shopping approval
- fake ROI
- fake revenue attribution

Use safe language:

- may improve visibility readiness
- may improve catalog completeness
- feed readiness signals
- product growth opportunities
- safe suggestions for review
- internal visibility score

## Testing Requirement

Run available checks before reporting completion:

```bash
npm run build
npm run typecheck
npm run lint
```

If a check fails due to pre-existing unrelated errors, report that clearly.

Always report:

- commands run
- pass/fail result
- files changed
- whether billing/auth/install/deployment were touched
- known risks

## PR Report Format

Every PR summary should include:

1. Issue addressed
2. What changed
3. Files changed
4. Safety notes
5. Plan/billing impact
6. Commands run
7. Known failures or existing unrelated failures

## Merge Rule

Agents must not merge PRs.

Only the repository owner or reviewer decides whether to merge.

## Current Critical Context

For Issue #1, the correct implementation must combine:

1. structured per-run `ProductGrowthReport` result contract
2. `APPLIED` / `SUGGESTION_ONLY` / `NO_CRITICAL_ISSUE_WITH_REPORT`
3. Free quota consumed only for real applied writes
4. no early 403 before determining whether the result is applied or suggestion/report only
5. no standalone dashboard-only report as a substitute for the per-run result contract

If working on Issue #1 review fixes, update the existing PR branch rather than creating new PRs from `main`.
