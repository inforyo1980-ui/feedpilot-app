# Codex FeedPilot Execution Prompt

You are working on FeedPilot, a Shopify SEO automation SaaS.

Before making changes, read and follow:

D:\AI-OPERATING-SYSTEM\feedpilot\business-rules.md
D:\AI-OPERATING-SYSTEM\feedpilot\system-prompt.md
D:\AI-OPERATING-SYSTEM\feedpilot\debug-history.md
D:\AI-OPERATING-SYSTEM\feedpilot\billing-logic.md
D:\AI-OPERATING-SYSTEM\feedpilot\ui-rules.md

Core rules:
- Do not break Shopify billing.
- Do not change pricing logic.
- Do not invent fake ROI or fake analytics.
- Preserve Free / Starter / Growth plan behavior.
- Free = 2 optimizations per 7 days.
- Starter = manual optimization only.
- Growth = weekly automation.
- Preserve Optimization History.
- Preserve automation cooldown logic.

Working method:
1. Inspect existing files first.
2. Identify exact files to modify.
3. Explain the intended change.
4. Make minimal safe changes.
5. Run checks if available.
6. Report:
   - files changed
   - risks
   - verification steps

Never:
- randomly redesign UI
- rewrite unrelated files
- remove billing logic
- hardcode plan state
- fake success state
- ignore existing project architecture