# NichiNichi status Worker

OW058: the Cockpit embeds the shared website schedule/model, generated with
`node cloudflare/build-calendar-runtime.cjs`. Wrangler runs this build before
deploying; the regression test checks the committed module against both sources.
The public calendar uses versioned scripts to refresh old browser caches. Daily
notices are retired: the UI and public rendering are removed, legacy reads return
inactive, and authenticated publication returns 410. The existing delete/reset
paths can still purge an old `daily-notice` key.

`worker.mjs` starts from Captain's current production source (SHA-256
`638b438a58405abedae073bd17639fbf536ab7ac23b4413c937f730da1d1f3b6`).
The Worker serves the existing Traditional Chinese Cockpit at `/admin`.

Bindings remain `STATUS_KV` and secret `ADMIN_TOKEN`. No credentials or live
namespace IDs belong in this repository. There is deliberately no deployment
workflow. Merging the static website does not deploy this Worker; Captain must
separately approve any production rollout after review.

Task 003 adds an independent `little-note` KV key and `/little-note` API.
GET returns `{ text }`; authenticated POST accepts `{ text }` (up to 2000 UTF-16
code units), with blank text clearing it. Authenticated DELETE clears it too.
`/state` returns `littleNote` as a string. No TTL or timestamps are stored.
`/reset-current` continues to clear only seating and operational notices.

Validate locally with `node --test tests/worker.test.mjs`. Tests use an in-memory
KV double and dummy token, never production. Frontend first is compatible with
the old Worker (missing note stays hidden); deploy the reviewed Worker only
after explicit approval. Keep the existing KV namespace and secret binding.

Task 004 extends each existing opening period with optional
`event: { type: "dnd" | "other", title, description }`. The Cockpit loads the
same public `site-data.js` weekly baseline and `calendar-data.js` date resolver
as the website. It saves the full day once, preserving daytime and evening.
No second event store or editor exists. Old clients still read period times.

Past dates in the current Berlin month are retained for calendar/export
consistency. Older months are removed as before; there is no historic archive.
Already deleted old records cannot be reconstructed. All KV list pages are read.
The live Worker must be upgraded before enabling calendar data entry. Existing
seating and operational notice APIs remain unchanged. Task 004 is now based on
main after the deployed Task 003 / PR #5 fixes; its diff contains only the
calendar work and preserves the note and take-away behavior already in production.

Before go-live, verify actual `STATUS_KV` and secret binding names in Cloudflare,
review both PRs, and explicitly approve website and Worker rollout separately.
There is no automatic Worker deployment or new authentication mechanism.
