// Tests for the read-only search script. Fixtures only: nothing here touches
// the live API. Run: node --test skills/traydstar-trade-finder/scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokens, isReal, score, rankListings, buildQuery, fetchAll, formatReport, main, PAGE_SIZE } from "./search.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, "..", "fixtures", "listings.sample.json"), "utf8"));
const L = fixture.listings;

test("tokens drop stopwords and short words, and stem so forms compare equal", () => {
  const a = tokens("Code reviews for the landing pages, with copywriting");
  const b = tokens("code review landing page copywriter");
  for (const w of b) assert.ok(a.has(w), `expected "${w}" in ${[...a].join(",")}`);
  assert.ok(!a.has("the") && !a.has("for") && !a.has("with"));
});

test("example and [E2E test] listings are not real supply", () => {
  assert.equal(isReal(L[0]), true);
  assert.equal(isReal(L[3]), false, "is_example");
  assert.equal(isReal(L[4]), false, "[E2E test] prefix");
});

test("strong fit when the listing offers the want and the owner wants the offer", () => {
  const s = score(L[0], { offer: "copywriting", want: "code review" });
  assert.equal(s.fit, "strong");
  assert.ok(s.offersWant >= 1 && s.wantsOffer >= 1);
});

test("partial fit when only one side lines up, and open-to-offers is flagged", () => {
  const onlyOffers = score(L[1], { offer: "copywriting", want: "logo" });
  assert.equal(onlyOffers.fit, "partial");
  assert.equal(onlyOffers.wantsOffer, 0);
  const open = score(L[2], { offer: "copywriting", want: "50mm lens" });
  assert.equal(open.openToOffers, true);
  assert.equal(open.fit, "partial");
});

test("ranking excludes examples and tests, orders strong before partial", () => {
  const ranked = rankListings(L, { offer: "code review", want: "copy" });
  const ids = ranked.map((r) => r.listing.id);
  assert.ok(!ids.includes(L[3].id), "example listing excluded even though it wants a code review");
  assert.ok(!ids.includes(L[4].id), "test row excluded");
  const ranked2 = rankListings(L, { offer: "copywriting", want: "code review" });
  assert.equal(ranked2[0].listing.id, L[0].id);
  assert.equal(ranked2[0].score.fit, "strong");
  // A strong fit outranks a partial one even when the partial has more matching terms.
  const many = { ...L[1], id: "many", title: "Code review code review code review", description: "review review review", want_tags: ["welding"], want_description: "" };
  const ranked3 = rankListings([many, L[0]], { offer: "copywriting", want: "code review" });
  assert.equal(ranked3[0].listing.id, L[0].id);
});

test("no matches is reported honestly", () => {
  const ranked = rankListings(L, { offer: "welding", want: "yacht" });
  assert.equal(ranked.length, 0);
  const text = formatReport({ criteria: { offer: "welding", want: "yacht" }, checked: 3, ranked, pages: 1 });
  assert.match(text, /No matches on TraydStar right now/);
  assert.match(text, /listings\/new/);
  assert.doesNotMatch(text, /\$\d/, "the report never states a fee amount");
});

test("query uses the want text, filters, page size and offset", () => {
  const q = buildQuery({ want: "logo design", offer: "bookkeeping", type: "SERVICE", category: "Design Services", ships: true, city: "", kind: "" }, 200);
  assert.equal(q.get("q"), "logo design");
  assert.equal(q.get("type"), "SERVICE");
  assert.equal(q.get("category"), "Design Services");
  assert.equal(q.get("ships"), "true");
  assert.equal(q.get("limit"), String(PAGE_SIZE));
  assert.equal(q.get("offset"), "200");
  assert.equal(buildQuery({ offer: "bookkeeping" }, 0).get("q"), "bookkeeping", "offer-only searches for owners who want it");
});

test("fetchAll pages until has_more is false and stops at the page cap", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const offset = Number(new URL(url).searchParams.get("offset"));
    return { ok: true, status: 200, headers: new Map(), json: async () => ({ listings: [{ id: `p${offset}`, title: "x" }], has_more: true }) };
  };
  const r = await fetchAll({ want: "x" }, { fetchImpl, maxPages: 3 });
  assert.equal(calls.length, 3);
  assert.equal(r.listings.length, 3);
  const short = await fetchAll({ want: "x" }, { fetchImpl: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => ({ listings: [], has_more: false }) }) });
  assert.equal(short.pages, 1);
});

test("a 429 surfaces as a clear error with the retry hint", async () => {
  const fetchImpl = async () => ({ ok: false, status: 429, headers: new Map([["retry-after", "7"]]), json: async () => ({}) });
  await assert.rejects(fetchAll({ want: "x" }, { fetchImpl }), /Rate limited .* 7s/);
});

test("CLI: usage error without criteria, fixture run succeeds, JSON output is structured", async () => {
  const out = [];
  const err = [];
  const io = { log: (s) => out.push(String(s)), error: (s) => err.push(String(s)) };
  assert.equal(await main([], io), 2);
  assert.match(err.join("\n"), /--offer or --want/);
  out.length = 0;
  const fixturePath = path.join(here, "..", "fixtures", "listings.sample.json");
  assert.equal(await main(["--offer", "copywriting", "--want", "code review", "--fixture", fixturePath, "--json"], io), 0);
  const parsed = JSON.parse(out.join("\n"));
  assert.equal(parsed.no_matches, false);
  assert.equal(parsed.checked, 3, "examples and test rows are not counted as checked supply");
  assert.equal(parsed.candidates[0].fit, "strong");
  assert.ok(parsed.candidates.every((c) => c.url.startsWith("https://traydstar.com/listings/")));
  out.length = 0;
  assert.equal(await main(["--want", "yacht", "--fixture", fixturePath], io), 0);
  assert.match(out.join("\n"), /No matches/);
});
