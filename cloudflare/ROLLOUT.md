# Gated rollout and recovery — no authorization implied

Both PRs remain drafts. Aria reviews copy/artwork; Zora reviews integration and
regressions. Captain separately authorizes each merge and production rollout.
GitHub merging does **not** deploy the Cloudflare Worker.

## Preparation (read-only)

Record the current main commit and Cloudflare deployment ID, export the current
Worker source and existing relevant KV records for rollback, and verify the
existing `STATUS_KV` / `ADMIN_TOKEN` binding names. Do not copy secrets into Git
or a public document. Stop all Cockpit schedule editing during a deployment.

## Phase 1 — Task 003, only after explicit approval

1. Merge PR #3 to main; wait for Pages success and verify the new note container.
   The old Worker has no `littleNote`, so the new website safely hides it.
2. Deploy **PR #3's** reviewed Worker to the existing Cloudflare Worker, preserving
   bindings. Check `/admin`, `/little-note`, `/state`, the existing seating and
   operational notice paths. Authorized smoke-test changes require Captain's
   approval; restore the previous note after any test.
3. Retarget PR #4 to main, inspect the resulting diff and rerun Node/browser
   tests. If #3 was squash-merged, rebase/reconcile #4 so its diff contains only
   Task 004. Do not merge #4 merely because its former base branch disappeared.

## Phase 2 — Task 004, only after separate approval

1. Merge the reviewed/retested #4. Wait for Pages, then verify the exact
   versioned `site-data.js`, `calendar-data.js`, `calendar-export.js` and public
   `/kalender/`. Check both schema markers are `1`. Public calendar hides export
   controls; `/kalender/?export` shows them. Do not enter event metadata yet.
2. Deploy **PR #4's** Worker, retaining existing bindings and data. The old
   Worker strips event metadata, so calendar data entry stays paused until this
   step and the verification below are complete.
3. Load `/admin` fresh on the phone and verify the shared scripts, date preload
   and enabled save state. Verify the active Cloudflare deployment ID matches
   the reviewed source. If a script fails or is stale, save stays disabled.
4. Only with approval for the smoke test: load an ordinary future day, record
   its complete baseline, add D&D to the evening, save once, reload and confirm
   the daytime period, event type/title/description and evening times round-trip.
   Verify website, IG and A4 use the same date. Restore the original date record
   exactly (delete the exception if none existed). Then resume normal editing.

## Recovery

Pause edits first. Record which website/Worker versions are active. Revert the
website to the recorded main commit via a reviewed revert; redeploy the prior
Cloudflare deployment separately. Bindings must remain unchanged.

Before rolling the Worker back, preserve any new `little-note` and current-month
event records privately: old Worker clients can overwrite periods without event
metadata, and the old read path deletes dates before today. Keep calendar writes
paused and avoid serving the old cleanup path until records are preserved. A
source rollback cannot reconstruct already-deleted KV data; restore only the
verified records from the private snapshot when explicitly approved. Do not
reset the namespace or run `/reset-current` as a deployment shortcut.
