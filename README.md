# Google Play Monitor

This project monitors explicitly approved application targets. It does not automatically import all gambling applications discovered through search.

## Target Registry

Targets live in the `affiliate_targets` collection and are identified by `platform + appId`. Only `active` targets are fetched. `paused` and `disabled` targets are skipped; disabling is a soft deactivation and preserves app data, reviews, and snapshots.

Discovery stores search results as candidates in `app_candidates`. Candidates require human review and are not fetched or promoted automatically.

## Commands

```bash
npm run dev target:add <appId>
npm run dev targets
npm run dev target:pause <appId>
npm run dev target:disable <appId>
npm run dev apps
npm run dev reviews
npm run dev all
npm run dev discover
```

Add a Google Play target with `target:add`. Its status is `active` by default. The current provider is Google Play; App Store support is reserved for a later phase.

## Database and Environment

MongoDB is the source of truth. Set `MONGODB_URI` and `DB_NAME` in `.env`. App identity uses `(platform, appId)`, and new app writes contain normalized store fields plus provenance (`source`, `sourceUrl`, and `fetchedAt`). Historical `raw` fields are preserved during migration but are not written to new documents.

Migrations are idempotent and non-destructive. Legacy `monitored_apps` records are copied to `affiliate_targets` without inventing operator, program, campaign, or commission data.