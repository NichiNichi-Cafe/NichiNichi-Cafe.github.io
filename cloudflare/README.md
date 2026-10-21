# NichiNichi status Worker

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
