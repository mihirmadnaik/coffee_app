# Community Library Review Log

Record of every inbox-processing pass: what was submitted, what was decided,
and why. Newest entries at the top. This file is the audit trail for
`community/beans.json`, `gear.json`, `recipes.json`, and `vocab.json` — every
change to those files should trace back to an entry here (or to a direct manual
edit noted as such).

## Data shapes

- **bean** submission `payload`: `name`, `roaster`, `origin`, `process`,
  `roastLevel` (0–10), `tastingNotes` (array — the *roaster's printed* notes, not
  the submitter's personal ratings). `origin` and `tastingNotes` are optional; a
  catalog bean item omits any field it lacks.
- **vocab.json**: the canonical, reviewed vocabulary the app pulls in as suggestion
  presets — `{ tastingNotes: [...], processes: [...] }`. This is the feedback loop:
  approved terms here reduce how often users/scan coin new ones.

## Review process

For each pending submission:
1. **Dedup** — check against existing catalog entries and other pending
   rows (case-insensitive name match).
2. **Verify** — web search for the roaster/product/gear; confirm it's real
   and cross-check the submitted fields (process, roast character, grind
   adjustment type, etc.) against what the source says.
3. **Normalize the vocabulary** (beans):
   - **Process** — must be one of `vocab.json.processes`. Map near-synonyms to the
     canonical term ("fully washed"/"wet process" → `Washed`); if a genuinely new,
     legitimate method appears (e.g. "Carbonic Maceration"), add it to
     `vocab.json.processes` and bump that file's version.
   - **Tasting notes** — dedup each term case-insensitively against
     `vocab.json.tastingNotes`; merge near-duplicates to the canonical spelling
     ("blueberries" → `Blueberry`). Promote genuinely-new, sensible terms into
     `vocab.json.tastingNotes` (bump version) so they feed back to the app; drop junk.
4. **Decide** — `included` (confirmed, added as submitted or with corrected
   fields), `included (unverified field)` (source confirms the item exists
   but couldn't confirm every field — noted explicitly), or `rejected`
   (no matching real-world item found, or contradicted by the source).
5. **Apply** — update the relevant JSON file(s), bump their `version`, and mark
   the Supabase row `approved` or `rejected`.

---

## 2026-07-06 — catalog shape extended (manual)

No inbox pass. Extended the bean shape to carry optional `origin` and
`tastingNotes`, and introduced `community/vocab.json` (seeded from the app's
built-in `TASTING_NOTES` + `PROCESS_TYPES`). Enriched the existing **Velvet Blaze**
(Summer Moon) entry with `origin: "Blend (7 origins)"` and
`tastingNotes: ["Walnut","Blackberry","Chocolate"]` — verified during the
2026-07-03 pass (web sources described it as a 7-origin blend with roasted walnut,
blackberry, and milk chocolate). `beans.json` v2 → v3.

---

## 2026-07-03 — bean submissions

Pending rows at time of review: 2 (both type `bean`, both attributed to
"Summer Moon").

### ✅ Included — "Velvet Blaze" (Summer Moon), process: Washed, roastLevel: 6
- Submission id: `ab92ec39-763e-42c7-ac66-e0b8d4599255`
- Summer Moon Coffee confirmed as a real Texas roaster (Austin-based, oak
  wood-fired brick roasters, founded 2002).
- "Velvet Blaze" confirmed as a real, current product — Summer Moon's
  longtime house blend, described on their site and in third-party reviews
  as a 7-origin blend, medium roast, used as the base for most in-store
  drinks. Tasting notes: roasted walnut, blackberry, milk chocolate.
- `roastLevel: 6` (medium, 4–7 band) matches the "medium roast" description
  — kept as submitted.
- `process: Washed` — **not independently confirmed.** No source stated a
  processing method for this blend, and as a 7-origin blend it may mix
  processes across origins anyway. Not contradicted either, so kept as
  submitted rather than rejected outright; flagging here since this is the
  kind of field a future pass (or the submitter) could correct with a
  clearer source.
- Action: added to `beans.json` (v2). Supabase row marked `approved`.

### ❌ Rejected — "Blazed" (Summer Moon), process: Natural, roastLevel: 5
- Submission id: `a4ea7cd4-8858-4428-aed7-464d61f22699`
- No product named "Blazed" found anywhere in Summer Moon's current catalog
  (checked their site's product listing and general web search). Their
  actual "blaze"-family products are **Velvet Blaze**, **Blue Blazes**, and
  **Inferno** — none matches "Blazed" exactly.
- Submitted ~2 hours before the "Velvet Blaze" row above, from the same
  source pattern — most likely an earlier, misremembered/garbled attempt at
  submitting the same real bean, not a distinct product.
- Action: not added to `beans.json`. Supabase row marked `rejected`.

**Net catalog change:** `beans.json` v1 → v2, +1 item (Velvet Blaze).
