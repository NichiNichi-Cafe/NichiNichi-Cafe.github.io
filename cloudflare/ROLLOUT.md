# Gated rollout and recovery — no authorization implied

Task 003 (PR #3) and its note/take-away fixes (PR #5) are already live. PR #4
is now based on main and remains a draft. Preserve PR #5's 18px/400 serif note
heading, body type, permanent take-away list and Full-status take-away text.
Aria reviews changed copy/artwork; Zora reviews the integrated diff and regressions.
Captain separately authorizes the PR #4 merge and production rollout.
GitHub merging does **not** deploy the Cloudflare Worker.

## Preparation (read-only)

Record the current main commit and Cloudflare deployment ID, export the current
Worker source and existing relevant KV records for rollback, and verify the
existing `STATUS_KV` / `ADMIN_TOKEN` binding names. Do not copy secrets into Git
or a public document. Stop all Cockpit schedule editing during a deployment.

## Current release baseline (verify again before any later rollout)

PR #5 main commit: `98c038c9d4bfe9b223d0bda3e2b3ac6e4be9c8b5`.
Worker version: `6c35b3bf-69a9-4efa-b4e4-c763fd6d037a`.
These identify the previously verified release, not permission to skip fresh
source/settings/KV backup checks. PR #4 preparation does not deploy either side.

## Task 004 rollout, only after separate approval

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
   Check `/little-note`, `/status`, `/notice` and the existing note/seat controls
   still behave as in PR #5. Existing saved Full messages update on next normal
   publication, not by rewriting records during deployment.
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
