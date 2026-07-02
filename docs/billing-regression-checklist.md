# Billing Regression Checklist

Issue #22 verifies the billing upgrade return fix from Issue #20 and the environment-controlled billing test-mode guard from Issue #21 against real Shopify runtime behavior before App Store preparation.

This checklist is documentation only. Do not change pricing, plan names, billing route logic, quota logic, safe-fix behavior, Shopify product write paths, or Growth automation while running these checks.

## 1. Development / dev store test billing

### Environment

- `NODE_ENV=development`
- `SHOPIFY_BILLING_TEST_MODE=true`
- `SHOPIFY_APP_URL=<current tunnel URL>`

### Starter expected behavior

- [ ] Free user can click **Upgrade to Starter**.
- [ ] Upgrade page sends request to the existing billing route.
- [ ] Billing route returns JSON `{ url }`.
- [ ] Browser redirects to Shopify billing approval.
- [ ] Shopify approval page is test billing.
- [ ] After approval, Shopify returns to `/app/upgrade?billing=success`.
- [ ] Upgrade page forwards to `/app?billing=success`.
- [ ] Dashboard shows **Plan activated**.
- [ ] Plan changes from Free to Starter.
- [ ] Free quota restrictions no longer appear for Starter.

### Growth expected behavior

Repeat the same flow for Growth:

- [ ] Free or Starter user can click **Upgrade to Growth**.
- [ ] Upgrade page sends request to the existing billing route.
- [ ] Billing route returns JSON `{ url }`.
- [ ] Browser redirects to Shopify billing approval.
- [ ] Shopify approval page is test billing.
- [ ] After approval, Shopify returns to `/app/upgrade?billing=success`.
- [ ] Upgrade page forwards to `/app?billing=success`.
- [ ] Dashboard shows **Plan activated**.
- [ ] Plan changes to Growth.
- [ ] Growth-only permissions are available only after Growth is active.

## 2. Production guard test

### Environment

- `NODE_ENV=production`
- `SHOPIFY_BILLING_TEST_MODE=true`

### Expected behavior

- [ ] Billing request fails before creating a Shopify charge.
- [ ] Error includes `SHOPIFY_BILLING_TEST_MODE=true is not allowed in production.`
- [ ] No test charge is created.

## 3. Production real billing test

### Environment

Use either of these production-safe settings:

- `NODE_ENV=production`
- `SHOPIFY_BILLING_TEST_MODE=false`

or:

- `NODE_ENV=production`
- `SHOPIFY_BILLING_TEST_MODE` unset

### Starter expected behavior

- [ ] Billing request uses `isTest=false`.
- [ ] Shopify approval page is not a test charge.
- [ ] After approval, Shopify returns to `/app/upgrade?billing=success`.
- [ ] Upgrade page forwards to `/app?billing=success`.
- [ ] Dashboard shows **Plan activated**.
- [ ] `getPlan` detects Starter correctly.
- [ ] Paid users are not treated as Free.

### Growth expected behavior

Repeat the same production real billing flow for Growth:

- [ ] Billing request uses `isTest=false`.
- [ ] Shopify approval page is not a test charge.
- [ ] After approval, Shopify returns to `/app/upgrade?billing=success`.
- [ ] Upgrade page forwards to `/app?billing=success`.
- [ ] Dashboard shows **Plan activated**.
- [ ] `getPlan` detects Growth correctly.
- [ ] Paid users are not treated as Free.

## 4. Negative checks

Confirm that billing tests did not change:

- [ ] Pricing amounts.
- [ ] Plan names.
- [ ] Free quota logic.
- [ ] Try safe fix.
- [ ] Scan Products.
- [ ] Shopify product write path.
- [ ] Growth automation.

## 5. Evidence to capture

For each run, record:

- [ ] Environment variables used.
- [ ] Plan selected.
- [ ] Shopify billing approval page screenshot.
- [ ] Final app URL.
- [ ] Dashboard plan display.
- [ ] Whether **Plan activated** toast appeared.
- [ ] Whether paid permissions changed correctly.

## Latest manual regression results

- Dev store Starter test billing: PASS
- Dev store Growth test billing: PASS
- Starter plan detection after approval: PASS
- Growth plan detection after approval: PASS
- PR #43 Starter retest: FAIL for return-to-embedded-app UX.
- Return-to-embedded-app UX: FAIL / NEEDS FIX
- Notes: "After Starter test charge approval, the app still landed on standalone `/auth/login` with an empty Shop domain field. Billing/test charge worked, but auth fallback lost shop context."
- Previous notes: "After approval, the browser landed on standalone `/auth/login` and required manual shop-domain login. After re-entry, paid plan detection worked."

## Run log

Use this table to capture each manual regression pass.

| Date | Environment | Plan selected | Approval screenshot | Final app URL | Dashboard plan display | Plan activated toast | Paid permissions correct | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |
