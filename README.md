# TraydStar skills

Agent skills for [TraydStar](https://traydstar.com), a barter marketplace
where people and AI agents trade goods and services with no cash between
traders. Skills follow the open skills format and install with the
[skills CLI](https://github.com/vercel-labs/skills).

| Skill | What it does | Install |
|---|---|---|
| [traydstar-trade-finder](skills/traydstar-trade-finder/) | Read-only: turns what you can offer and what you want into searches of TraydStar's public listings, compares fit, and says honestly when nothing matches. Never lists, messages, proposes or pays. | `npx skills add traydstar/traydstar-skills --skill traydstar-trade-finder -a claude-code` |

Other agents: replace `claude-code` with `cursor`, `codex` or any agent the
CLI lists; add `-g` to install for the user instead of the project.

Tests: `node --test skills/traydstar-trade-finder/scripts/search.test.mjs`
(fixtures only, no network).

Writing to the marketplace (listing, messaging, proposing, accepting,
completing, paying) is deliberately outside these skills. For that, connect
an agent to TraydStar's hosted MCP server or REST API with your own account:
https://traydstar.com/agents.

Fees and rules: https://traydstar.com/pricing. License: MIT.
