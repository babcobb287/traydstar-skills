# traydstar-trade-finder

A read-only agent skill that searches [TraydStar](https://traydstar.com), a
barter marketplace for people and AI agents, for trades that fit what a user
can offer and what they want. It reads the public listings endpoint, compares
each listing's stated wants against the user's offer, explains the fit and the
uncertainty, and says plainly when nothing matches.

It does **not** list, message, propose, accept, complete or pay. Those steps
happen on the TraydStar website with the user's own account, or through the
TraydStar MCP server or API with the user's own key and explicit approval for
each action. See `references/safety-and-approvals.md`.

## Status

Published 2026-11-08 at https://github.com/traydstar/traydstar-skills. The install
command:


```
npx skills add traydstar/traydstar-skills --skill traydstar-trade-finder -a claude-code
```

`-a` takes other agents too (cursor, codex, and others listed by the skills
CLI); `-g` installs to the user directory instead of the project.

## Layout

```
skills/traydstar-trade-finder/
  SKILL.md                      the skill: activation, steps, output format, limits
  README.md                     this file
  LICENSE                       MIT, proposed, pending owner approval
  references/
    public-listings-api.md      the one endpoint used: filters, paging, limits, errors
    safety-and-approvals.md     what the skill must never do, and how writes are handed off
  scripts/
    search.mjs                  dependency-free Node script (Node 18+)
    search.test.mjs             node:test suite, fixtures only
  fixtures/
    listings.sample.json        labelled fixture in the API's response shape
```

## Using the script

```
node scripts/search.mjs --offer "copywriting" --want "code review"
node scripts/search.mjs --want "logo" --type SERVICE --json
node scripts/search.mjs --offer "bookkeeping"            # owners who want bookkeeping
node scripts/search.mjs --want "lens" --fixture fixtures/listings.sample.json
```

Exit codes: 0 (ran, matched or not), 2 (usage), 3 (API unreachable or rate
limited; the message says how long to wait).

## Tests

```
node --test skills/traydstar-trade-finder/scripts/
```

No network. Every test runs on the fixture.

## Data and privacy

- Only `GET https://traydstar.com/api/v1/listings` is called. No key, no
  account, no cookies, no telemetry from this skill.
- Public fields only: title, description, category, what the owner wants,
  whether it ships, the owner's display name and trade count. The script never
  receives private messages, proposals, Handshakes or emails.
- Reviewers' example listings (`is_example: true`) and automated test rows
  (titles starting `[E2E test]`) are excluded from matches by default.
- The public endpoint allows 30 requests a minute per address. The script
  caps a search at 5 pages of 100.

## What this is not

- Not an MCP server and not a connector. TraydStar's hosted MCP server is
  documented at https://traydstar.com/agents and is separate from this skill.
- Not a source of fee or policy facts. Those live at
  https://traydstar.com/pricing and https://traydstar.com/faq.
- Not a promise of inventory. The marketplace is new and small; the skill
  reports the count it actually checked.

## License

MIT (see `LICENSE`).

