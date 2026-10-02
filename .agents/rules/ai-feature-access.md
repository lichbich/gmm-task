# AI Features Access Control Rule

## Strict Scope Constraint
All present and future AI-powered features (including Gemini multi-turn chat, task breakdown, effort estimations, auto-suggestions, smart checklist generators, AI insights, etc.) MUST be strictly restricted to the account **`LichDT`** (`account === 'LichDT'` / `id === 'usr-lichdt'`).

## Implementation Guideline
- Always use `isAIFeatureEnabled(currentUser)` from `@/lib/geminiService`.
- For regular members/accounts (when `isAIFeatureEnabled(user)` is `false`):
  - Do NOT render AI buttons, AI panels, AI chatboxes, or AI badges.
  - Keep standard layouts clean without visual clutter or broken UX.
  - Ensure zero disruption or confusion for other users while `LichDT` is testing features.
- Do NOT open AI features to other users until explicitly requested by the project owner.
