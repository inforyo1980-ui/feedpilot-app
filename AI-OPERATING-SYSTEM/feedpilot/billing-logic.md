# FeedPilot Billing Logic

Plans:
- Free
- Starter
- Growth

Free:
- no active paid subscription
- 2 optimizations per 7 days
- after limit reached, user must upgrade

Starter:
- $9/month
- manual optimization enabled
- automation disabled

Growth:
- $19/month
- manual optimization enabled
- weekly automation enabled

Upgrade flow:
- Free user can upgrade to Starter or Growth
- Starter user can upgrade to Growth
- Growth user should see automation active state

Testing rule:
FORCE_PLAN may be used only for local testing.
FORCE_PLAN must never override real billing in production verification.

Return URL:
After Shopify billing approval, app should return to dashboard or upgrade success state and re-check active subscription.

Critical:
There must be one source of truth for plan detection.
Do not duplicate inconsistent plan logic across loader, helper, and UI.