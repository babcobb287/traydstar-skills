#!/usr/bin/env node
// Read-only search of TraydStar's public listings for a barter match.
//
//   node search.mjs --offer "copywriting" --want "code review"
//   node search.mjs --want "logo" --type SERVICE --json
//   node search.mjs --offer "bookkeeping" --fixture ../fixtures/listings.sample.json
//
// Talks only to GET /api/v1/listings (no key, no account). Pages through
// results up to MAX_PAGES, drops the reviewers' example listings and test
// rows, scores each listing two ways (does it offer what you WANT; does its
// owner want what you OFFER) and prints a ranked, honest report. Exit code 0
// whether or not anything matched; 2 for a usage error; 3 when the API could
// not be reached.
import fs from "node:fs";

export const DEFAULT_BASE = "https://traydstar.com";
export const PAGE_SIZE = 100;
export const MAX_PAGES = 5; // 500 listings; the public endpoint allows 30 requests a minute per address
const STOP = new Set(["the", "and", "for", "with", "that", "this", "your", "you", "our", "one", "two", "from", "into", "about", "will", "can", "any", "all", "per", "are", "its", "has", "have", "not", "but", "out", "get", "got", "need", "needs", "want", "wants", "looking", "something", "someone", "work", "small", "new", "like", "than", "more", "less", "them", "they", "their", "what", "who", "how", "when", "where", "which", "also", "just", "very", "much", "many", "some", "such", "upto", "etc"]);

/** Crude stem so "reviews", "review" and "reviewer" compare equal. */
export function stem(w) {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  for (const suffix of ["ing", "ers", "er", "es", "s"]) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 4) return w.slice(0, -suffix.length);
  }
  return w;
}

export function tokens(text) {
  return new Set(
    String(text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem)
  );
}

function overlap(a, b) {
  let n = 0;
  for (const w of a) if (b.has(w)) n += 1;
  return n;
}

/** Is this a real listing (not a reviewers' example, not a test row)? */
export function isReal(l) {
  return !l.is_example && !/^\[E2E test\]/.test(l.title ?? "");
}

/**
 * Score one listing against the user's criteria.
 * offersWant: how many WANT terms appear in what the listing offers.
 * wantsOffer: how many OFFER terms appear in what the owner wants.
 * openToOffers: the owner stated no wants at all.
 */
export function score(listing, { offer, want }) {
  const offerT = tokens(offer);
  const wantT = tokens(want);
  const offersText = tokens(`${listing.title} ${listing.description} ${listing.category} ${listing.subcategory ?? ""}`);
  const ownerWants = tokens(`${(listing.want_tags ?? []).join(" ")} ${listing.want_description ?? ""}`);
  const offersWant = wantT.size ? overlap(wantT, offersText) : 0;
  const wantsOffer = offerT.size ? overlap(offerT, ownerWants) : 0;
  const openToOffers = ownerWants.size === 0;
  let fit = "weak";
  if (offersWant > 0 && wantsOffer > 0) fit = "strong";
  else if (offersWant > 0 || wantsOffer > 0) fit = "partial";
  // The fit tier decides the order; term counts only break ties within a tier.
  const tier = fit === "strong" ? 100 : fit === "partial" ? 10 : 0;
  return { offersWant, wantsOffer, openToOffers, fit, rank: tier + offersWant * 2 + wantsOffer + (openToOffers && offersWant > 0 ? 0.5 : 0) };
}

export function explain(listing, s, { offer, want }) {
  const parts = [];
  if (want) parts.push(s.offersWant > 0 ? `offers what you want (${s.offersWant} matching term${s.offersWant === 1 ? "" : "s"})` : "does not clearly offer what you asked for");
  if (offer) {
    if (s.wantsOffer > 0) parts.push(`the owner's stated wants include what you offer (${s.wantsOffer} term${s.wantsOffer === 1 ? "" : "s"})`);
    else if (s.openToOffers) parts.push("the owner lists no wants, so they may be open to offers; that is weaker than a stated match");
    else parts.push("the owner wants something other than what you offer");
  }
  if (listing.listed_by_agent) parts.push("listed by an agent acting for its owner");
  if (listing.type === "GOOD") parts.push(listing.ships ? "ships" : listing.location_city ? `local to ${listing.location_city}` : "pickup, location not stated");
  return parts.join("; ") + ". Keyword fit only, not a judgement of quality or value.";
}

export function rankListings(listings, criteria, { includeExamples = false } = {}) {
  const seen = new Set();
  const out = [];
  for (const l of listings) {
    if (!l || seen.has(l.id)) continue;
    seen.add(l.id);
    if (!includeExamples && !isReal(l)) continue;
    const s = score(l, criteria);
    if (s.fit === "weak") continue;
    out.push({ listing: l, score: s });
  }
  out.sort((a, b) => b.score.rank - a.score.rank || (a.listing.title ?? "").localeCompare(b.listing.title ?? ""));
  return out;
}

export function buildQuery({ want, offer, type, category, ships, city, kind }, offset) {
  const p = new URLSearchParams();
  // The endpoint's text search covers titles, descriptions and want tags, so
  // the WANT text (what the listing should offer) is the best single query;
  // with only an OFFER we search for owners who want it.
  const q = (want || offer || "").trim();
  if (q) p.set("q", q.slice(0, 200));
  if (type) p.set("type", type);
  if (category) p.set("category", category);
  if (ships) p.set("ships", "true");
  if (city) p.set("city", city);
  if (kind) p.set("kind", kind);
  p.set("limit", String(PAGE_SIZE));
  p.set("offset", String(offset));
  return p;
}

export async function fetchAll(criteria, { base = DEFAULT_BASE, fetchImpl = globalThis.fetch, maxPages = MAX_PAGES } = {}) {
  const all = [];
  let pages = 0;
  for (let offset = 0; pages < maxPages; offset += PAGE_SIZE, pages += 1) {
    const url = `${base.replace(/\/$/, "")}/api/v1/listings?${buildQuery(criteria, offset)}`;
    const res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": "traydstar-trade-finder/0.1 (read-only skill)" } });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? "10");
      throw new Error(`Rate limited by TraydStar (30 requests a minute per address). Retry in ${wait}s.`);
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg += `: ${j.error}`;
      } catch {
        /* no body */
      }
      throw new Error(msg);
    }
    const body = await res.json();
    all.push(...(body.listings ?? []));
    if (!body.has_more) break;
  }
  return { listings: all, pages: pages + 1 };
}

export function formatReport({ criteria, checked, ranked, pages }) {
  const lines = [];
  const header = `Searched TraydStar for: ${criteria.want || "(anything owners would trade for your offer)"}${criteria.offer ? `  (you offer: ${criteria.offer})` : ""}  —  ${checked} active listing${checked === 1 ? "" : "s"} checked${pages > 1 ? ` across ${pages} pages` : ""}, ${ranked.length} candidate${ranked.length === 1 ? "" : "s"}`;
  lines.push(header, "");
  if (ranked.length === 0) {
    lines.push("No matches on TraydStar right now.");
    lines.push("Next steps: post a listing for what you offer with want tags for what you need, or post a \"wanted\" listing. Both are free: https://traydstar.com/listings/new?ref=skill-trade-finder");
  } else {
    ranked.forEach(({ listing: l, score: s }, i) => {
      const wants = [...(l.want_tags ?? []), l.want_description].filter(Boolean).join("; ") || "open to offers";
      const desc = String(l.description ?? "").replace(/\s+/g, " ").slice(0, 140);
      lines.push(`${i + 1}. ${l.title}  —  https://traydstar.com/listings/${l.id}?ref=skill-trade-finder`);
      lines.push(`   Offers: ${desc}${desc.length === 140 ? "…" : ""}   Category: ${l.category}   ${l.listed_by_agent ? "Agent-listed" : "Person-listed"}`);
      lines.push(`   Owner wants: ${wants}`);
      lines.push(`   Fit: ${s.fit} — ${explain(l, s, criteria)}`);
      lines.push("");
    });
  }
  lines.push("Facts about fees and rules: https://traydstar.com/pricing (not restated here).");
  return lines.join("\n");
}

function parseArgs(argv) {
  const a = { offer: "", want: "", type: "", category: "", ships: false, city: "", kind: "", json: false, fixture: "", base: DEFAULT_BASE, includeExamples: false };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const next = () => argv[++i] ?? "";
    if (k === "--offer") a.offer = next();
    else if (k === "--want") a.want = next();
    else if (k === "--type") a.type = next().toUpperCase();
    else if (k === "--category") a.category = next();
    else if (k === "--ships") a.ships = true;
    else if (k === "--city") a.city = next();
    else if (k === "--kind") a.kind = next();
    else if (k === "--json") a.json = true;
    else if (k === "--fixture") a.fixture = next();
    else if (k === "--base") a.base = next();
    else if (k === "--include-examples") a.includeExamples = true;
    else if (k === "-h" || k === "--help") a.help = true;
    else {
      a.error = `Unknown argument: ${k}`;
      break;
    }
  }
  return a;
}

const USAGE = `Usage: node search.mjs --offer "<what you can give>" --want "<what you are looking for>" [options]
  --type SERVICE|GOOD|BOTH   --category "<TraydStar category>"   --ships   --city "<city>"   --kind offer|wanted
  --json                     machine-readable output
  --fixture <file.json>      read listings from a file instead of the live API (tests, offline)
  --base <url>               API origin (default ${DEFAULT_BASE})
At least one of --offer or --want is required.`;

export async function main(argv = process.argv.slice(2), io = { log: console.log, error: console.error }) {
  const a = parseArgs(argv);
  if (a.help) {
    io.log(USAGE);
    return 0;
  }
  if (a.error || (!a.offer && !a.want)) {
    io.error(a.error ?? "Give at least one of --offer or --want.");
    io.error(USAGE);
    return 2;
  }
  if (a.type && !["SERVICE", "GOOD", "BOTH"].includes(a.type)) {
    io.error("--type must be SERVICE, GOOD or BOTH");
    return 2;
  }
  const criteria = { offer: a.offer, want: a.want, type: a.type, category: a.category, ships: a.ships, city: a.city, kind: a.kind };
  let listings;
  let pages = 1;
  try {
    if (a.fixture) {
      const raw = JSON.parse(fs.readFileSync(a.fixture, "utf8"));
      listings = Array.isArray(raw) ? raw : raw.listings ?? [];
    } else {
      const r = await fetchAll(criteria, { base: a.base });
      listings = r.listings;
      pages = r.pages;
    }
  } catch (e) {
    io.error(`Could not search TraydStar: ${e.message}`);
    return 3;
  }
  const real = listings.filter((l) => a.includeExamples || isReal(l));
  const ranked = rankListings(listings, criteria, { includeExamples: a.includeExamples });
  if (a.json) {
    io.log(
      JSON.stringify(
        {
          criteria,
          checked: real.length,
          pages,
          candidates: ranked.map(({ listing: l, score: s }) => ({
            id: l.id,
            url: `https://traydstar.com/listings/${l.id}?ref=skill-trade-finder`,
            title: l.title,
            category: l.category,
            type: l.type,
            kind: l.kind,
            listed_by_agent: Boolean(l.listed_by_agent),
            ships: Boolean(l.ships),
            location_city: l.location_city ?? null,
            owner_wants: [...(l.want_tags ?? []), l.want_description].filter(Boolean),
            fit: s.fit,
            offers_want_terms: s.offersWant,
            wants_offer_terms: s.wantsOffer,
            open_to_offers: s.openToOffers,
            note: explain(l, s, criteria),
          })),
          no_matches: ranked.length === 0,
          facts: "https://traydstar.com/pricing",
        },
        null,
        2
      )
    );
  } else {
    io.log(formatReport({ criteria, checked: real.length, ranked, pages }));
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === new URL(`file:///${process.argv[1]?.replace(/\\/g, "/")}`).href) {
  // Set the exit code instead of calling process.exit(), which can cut off a
  // piped stdout before the report has been flushed.
  main().then((code) => {
    process.exitCode = code;
  });
}
