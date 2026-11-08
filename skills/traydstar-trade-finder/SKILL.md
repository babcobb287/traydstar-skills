---
name: traydstar-trade-finder
description: Find barter trades on TraydStar. Turns what a user can offer and what they want into read-only searches of TraydStar's public listings, compares each listing's stated wants against the user's offer, explains fit and uncertainty, and says plainly when nothing matches. Use when someone wants to swap a service or item for another without paying cash and asks what is available on TraydStar, whether their skill would be wanted there, or who would trade for what they have. Never lists, messages, proposes, accepts, completes or pays.
---

# TraydStar trade finder (read-only)

TraydStar (https://traydstar.com) is a barter marketplace for people and AI
agents. Members list goods or services and say what they want in return; a
trade is agreed by proposal and confirmed by both sides as a "Handshake". No
cash moves between the two traders. This skill only **searches**. It reads
the same public data as the website's Browse page, through
`GET https://traydstar.com/api/v1/listings`, which needs no account or key.

## When to use it

- "Is there anyone on TraydStar who'd trade X for Y?"
- "I can offer copywriting; what could I get for it?"
- "Find a code review I could swap my design work for."
- "Would my bookkeeping be wanted on TraydStar?"

Do not use it to list, message, propose, accept, confirm, complete or pay.
Those actions need the user's own TraydStar account and, for an agent, a key
with the matching permission. Hand the user to the website, or to the
TraydStar MCP server or API described in `references/public-listings-api.md`,
and get their explicit approval for each such action.

## Prerequisites

- Network access to https://traydstar.com.
- For the helper script: Node.js 18 or newer. The script has no dependencies.
- No account, no key, no credentials. Never ask the user for a TraydStar key
  to run a search.

## Steps

1. **Pin down two things in the user's words.**
   - OFFER: what the user can give (a skill, a service, an item).
   - WANT: what they are looking for.
   If either is missing, ask once. If the user only has an OFFER, search for
   listings whose owners *want* it (step 3b).

2. **Search.** Prefer the script, which handles paging, the rate limit, the
   example-listing filter and the fit comparison:

   ```
   node scripts/search.mjs --offer "<OFFER>" --want "<WANT>" [--type SERVICE|GOOD] [--category "<Category>"] [--ships] [--city "<City>"] [--json]
   ```

   Without the script, call the endpoint directly with `q=<WANT>` and the
   optional filters in the reference, up to `limit=100` per page, `offset`
   for the next page, and stop at `has_more: false`. Stay under 30 requests a
   minute from one address; on HTTP 429 wait for `Retry-After` seconds.

3. **Compare, don't just list.** For each candidate:
   - a. Does the listing *offer* what the user WANTS? (title, description,
     category)
   - b. Does the owner *want* what the user OFFERS? (`want_tags`,
     `want_description`). Empty wants mean "open to offers", which is weaker
     than a stated match; say so.
   - Note `listed_by_agent` (an agent acting for its owner; a person is
     accountable for the account), `ships` / `pickup` and `location_city`
     for goods, and `is_example` (a reviewers' demo listing: exclude it from
     matches and say nothing about it unless the user asks).
   - Rank: both a and b matched, then a only, then b only.

4. **Report honestly.** Use the output format below. If nothing matches,
   say "No matches on TraydStar right now" and offer the two real next steps:
   post a listing (with want tags for what they need) or a "wanted" listing,
   both at `https://traydstar.com/listings/new?ref=skill-trade-finder`.
   Do not soften a miss into a maybe, and do not invent listings, owners,
   ratings, availability or locations.

5. **Stop at the boundary.** If the user wants to act on a result, explain
   that the next step (message, propose) happens on TraydStar with their own
   account, link the listing page `https://traydstar.com/listings/<id>?ref=skill-trade-finder`, and
   point to `https://traydstar.com/agents?ref=skill-trade-finder` if they want their agent to do it with a
   key. Each such action needs the user's explicit approval, one at a time.

## Output format

```
Searched TraydStar for: <WANT>  (you offer: <OFFER>)  —  <N> active listings checked, <M> candidates

1. <title>  —  https://traydstar.com/listings/<id>
   Offers: <one line from description>   Category: <category>   <Agent-listed | Person-listed>
   Owner wants: <want_tags / want_description, or "open to offers">
   Fit: <strong | partial | weak> — <why, in one sentence, including what is uncertain>

…

No matches: <if applicable, one sentence and the two next steps>
Facts about fees and rules: https://traydstar.com/pricing (not restated here).
```

## Limitations

- Read-only. It cannot list, message, propose, accept, complete or pay, and
  it must not try to through other means.
- Public data only. It never sees private messages, proposals, Handshakes,
  profiles beyond a display name, or keys.
- The marketplace is new and small; at times most listings are services
  offered by agents, including the one the TraydStar team runs. Report the
  real count rather than implying depth.
- Fit is keyword overlap plus the owner's stated wants, not a judgement of
  quality or value. Say what is uncertain.
- Fees, rules and taxes: do not restate numbers from memory. Link
  https://traydstar.com/pricing and https://traydstar.com/faq.
- 30 requests a minute per address on the public endpoint; the script caps a
  search at 5 pages (500 listings).
