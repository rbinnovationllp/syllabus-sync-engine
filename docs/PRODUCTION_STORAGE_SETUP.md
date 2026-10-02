# Production storage setup

Syllabus Synk stores private file bytes in AWS S3 and object metadata in Supabase. The app server issues ten-minute signed URLs; it must never require a public bucket or permanent object URL.

## Supabase

Apply `supabase/migrations/20261001000100_atomic_school_storage_reservations.sql` after existing storage migrations. Verify it with:

```sql
select routine_name from information_schema.routines where routine_schema = 'public' and routine_name = 'reserve_school_storage_upload';
```

## S3 and IAM

Create or use `<BUCKET_NAME>` in `<AWS_REGION>`. Enable all **Block Public Access** settings and default encryption. Use a server-only IAM identity and set `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` only in Hostinger configuration.

```json
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::<BUCKET_NAME>/schools/*"}]}
```

The application does not require public access, ACL permissions, `ListBucket`, or multipart permissions at present.

## CORS

```json
[{"AllowedOrigins":["https://www.syllabus-synk.in","https://syllabus-synk.in","http://localhost:3000"],"AllowedMethods":["PUT","GET"],"AllowedHeaders":["content-type"],"ExposeHeaders":[],"MaxAgeSeconds":300}]
```

Remove localhost if production and local testing use separate buckets.

## Versioning, lifecycle, and recovery

Enable S3 versioning. Keep school records unless an approved retention policy says otherwise. After approval, configure lifecycle rules to abort incomplete multipart uploads after 7 days, expire temporary exports only after their approved retention, and expire noncurrent versions after an approved recovery window. Enable CloudTrail S3 data events or equivalent logging and AWS Budget alerts. S3 is not a replacement for Supabase PostgreSQL backups/PITR and restore drills.

## Staging verification

Apply the migration, configure private S3/IAM/CORS/server variables, then create School A and School B identities. Test permitted and denied upload/download/delete, malicious cross-school file IDs, invalid types, oversized files, missing S3 objects, concurrent near-quota requests, and anonymous URL access after expiry.

`pending` uploads are authorized but unfinalized; `active` files are verified; `archived` files remain retained by policy; `deleted` records require an approved purge/recovery process. Add an audited reconciliation job before automatic pending/orphan cleanup.
