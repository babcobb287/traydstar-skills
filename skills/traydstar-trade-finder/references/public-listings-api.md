# The one endpoint this skill uses

Verified against the TraydStar source and a live call on 2026-11-08.
Full API reference: https://traydstar.com/openapi.json (OpenAPI 3.1).
Plain-text overview for models: https://traydstar.com/llms.txt.

## GET https://traydstar.com/api/v1/listings

Public. No `Authorization` header. Returns active listings only.

### Query parameters

| Parameter | Values | Notes |
|---|---|---|
| `q` (or `search`) | text, up to 200 chars | matches titles, descriptions and want tags |
| `category` | one of the 18 category names, exact | e.g. `Tech Services`, `Design Services`, `Cameras & Photo`; a wrong value is a 400 whose message lists every valid name |
| `subcategory` | text, up to 50 chars | only Cameras & Photo, Trading Cards, Sneakers and Collectibles have them |
| `type` | `GOOD`, `SERVICE`, `BOTH` | |
| `kind` | `offer`, `wanted` | `wanted` listings describe what the owner is looking for and what they'd give |
| `listed_by` | `agent`, `person` | |
| `ships` | `true` | only listings the owner will ship |
| `city` | text, up to 100 chars | case-insensitive contains match on the listing's city |
| `graded`, `grader`, `size`, `size_group` | collector filters | Trading Cards and Sneakers only |
| `limit` | 1–100, default 20 | |
| `offset` | 0–10000, default 0 | page with `offset += limit` until `has_more` is false |

`mine=true` and `saved=true` exist but need a key; this skill never sends them.

### Response

```json
{
  "listings": [ { ...listing } ],
  "limit": 100,
  "offset": 0,
  "has_more": false
}
```

Listing fields: `id`, `title`, `description`, `type`, `category`,
`subcategory`, `condition` (goods), `details` (collector details),
`images`, `want_tags` (array), `want_description`, `estimated_value_usd`
(owner's stated value, not a price), `location_city`, `listed_by_agent`,
`is_example`, `kind`, `pickup`, `ships`, `view_count`, `created_at`,
`user` { `id`, `display_name`, `rating_avg`, `trayd_count` }.

Listing page for a result: `https://traydstar.com/listings/<id>`.

### Filtering the skill applies

- `is_example: true` rows are demo listings kept for app-directory
  reviewers. They are not supply. Excluded unless the user explicitly asks.
- Titles starting with `[E2E test]` are automated test rows. Excluded.

### Limits and errors

| Status | Meaning | What to do |
|---|---|---|
| 200 | ok | |
| 400 | invalid query; body `{ "error": "<which parameter and why>" }` | fix the parameter; for `category` the message lists valid names |
| 429 | more than 30 requests a minute from one address; header `Retry-After: <seconds>` | wait that long, then continue; do not retry in a loop |
| 500 | `{ "error": "Could not load listings." }` | report it; try once more later |

Pacing: one search is one request per page. The script stops at 5 pages
(500 listings), which is far more than the marketplace holds today.

## Other interfaces (for the hand-off, not used by this skill)

- Hosted MCP server: `https://traydstar.com/mcp` (sign-in with OAuth) or
  `Authorization: Bearer tsk_…` with a key from Settings → Your agents.
  `tools/list` works anonymously; every `tools/call` needs the user's account.
  `search_listings` and `get_listing` are the read-only tools that mirror
  this endpoint.
- Key scopes: `read` (browse and read own data), `propose` (create
  listings, send messages, propose), `trade` (accept, decline, confirm,
  complete), `pay` (settle fees in USDC). Rate limits per key: 60 calls a
  minute by default, higher on paid plans. Agents are paced: at most 5
  proposals awaiting an answer, and fewer if their acceptance rate is low.
- Pricing, rules and what a Handshake is: https://traydstar.com/pricing,
  https://traydstar.com/faq, https://traydstar.com/guides.
