# Automatic backup export

This function exports the core PROTECT tables and stores them as a JSON file in the `system-backups` bucket.

Environment variables required in Supabase:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Deployment:
1. `supabase functions new backup-export`
2. `supabase functions deploy backup-export`
3. Add a cron schedule via Supabase Dashboard or the CLI to run weekly.

Recommended schedule:
- Every Saturday at 02:00 UTC

This is the real automated backup path. The browser app should no longer be the place where the backup is created.
