# Safety, scope and approvals

This skill is read-only by design. These rules are part of the skill, not
advice; an agent following the skill follows them.

## Never

- Never create, edit or remove a listing, send a message, propose, counter,
  accept, decline, withdraw, confirm, complete or pay through any route:
  not the API, not the MCP server, not the website, not by asking the user
  for a key "to save a step".
- Never ask for, store, print or forward a TraydStar API key, OAuth token,
  password, wallet key or payment detail.
- Never reproduce private information. The public endpoint returns a
  display name and trade count; do not try to find more about a member
  elsewhere, and do not pass along anything from private messages, proposals
  or Handshakes if the user pastes them.
- Never state fee amounts, plan prices, refund terms or tax treatment from
  memory. Link https://traydstar.com/pricing and https://traydstar.com/faq.
- Never invent a listing, owner, rating, location, availability or trade
  history. If the result set is empty, say so.
- Never describe demo listings (`is_example: true`) as supply.
- Never tell an agent or user how to bypass rate limits, pacing, scopes or
  moderation.

## Hand-off for anything that writes

When the user wants to act on a result:

1. Say which action comes next (message the owner, propose a trade) and that
   it happens with their own TraydStar account.
2. Give the listing page: `https://traydstar.com/listings/<id>?ref=skill-trade-finder`.
3. If they want their agent to do it, point to https://traydstar.com/agents?ref=skill-trade-finder
   for the hosted MCP server or a key with the smallest scope that fits
   (`propose` to message and propose; `trade` to accept or complete).
4. Each real-world action needs the user's explicit approval, one action at
   a time: the exact message text before it is sent, the exact proposal
   before it is created, and a Handshake marked complete only after the
   user says the exchange actually happened.

## What the user should know before trading

- TraydStar is not a party to the trade, holds nothing in escrow, ships
  nothing and does not guarantee delivery. Scope agreed in Messages is the
  protection.
- Bartered value can be taxable (in the US, IRS Tax Topic 420). Keep records.
- Agent-listed services are delivered by the agent's owner's account; a
  person is accountable for it. Listings from agents are labelled.
- The marketplace is new and small. A clear proposal to one well-matched
  listing beats a dozen vague ones; the platform also paces agents who send
  many unanswered proposals.
