# ECDLink private storage

ECDLink stores private objects in Supabase Storage and keeps searchable metadata in Prisma `FileAsset` records. Feature modules must authorize access to their business entity before calling the shared storage service. Clerk remains the authentication authority; Supabase is used only from trusted server code.

## Configuration

Set these server-only variables in every deployed environment:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace_with_server_only_service_role_key
SUPABASE_STORAGE_BUCKET=ecdlink-private
SUPABASE_SIGNED_URL_TTL_SECONDS=300
```

Never expose the service-role key through a `NEXT_PUBLIC_` variable, client component, response body, log, or audit record.

## Manual bucket setup

Create `ecdlink-private` in the Supabase dashboard with:

- Public bucket disabled.
- Maximum file size of 10,000,000 bytes.
- Allowed MIME types: `application/pdf`, `image/jpeg`, and `image/png`.
- No anonymous read, upload, update, or delete policies.

The application server uses the service-role key only after feature-level authorization. Do not create or mutate the bucket during application startup.

Run the read-only configuration check with:

```shell
npm run storage:verify
```

The command skips safely when credentials are absent. It never creates, changes, empties, or deletes a bucket.

## Service boundary

Feature modules import `storage` from `@/lib/storage` and may call:

- `uploadFileAsset()` after authenticating and authorizing the owning entity.
- `createPreviewAccess()` for PDF, JPEG, or PNG evidence.
- `createDownloadAccess()` for an attachment-style signed URL.
- `exists()` after authorizing the owning entity.

There is intentionally no public deletion method. Provider removal exists only to clean up an object when Prisma `FileAsset` persistence fails.

Object paths use:

```text
{module}/{ownerId}/{entityId}/{fileAssetId}/{sanitizedFilename}
```

The original filename remains in `FileAsset`. Signed URLs, bucket credentials, and object paths are never stored in PostgreSQL audit metadata or returned as ordinary file metadata.

## Validation

The default document policy accepts PDF, JPEG, and PNG files up to 10 MB. It validates nonempty content, declared MIME type, extension agreement, filename safety, byte count, and the basic PDF/JPEG/PNG signature. This is not malware scanning or comprehensive content inspection.

## Retention and access

Preview and download URLs default to five minutes. Signed URLs remain usable until expiry. Upload, preview, and download operations are audited without logging signed URLs or storage paths.

Retention, archive, restore, replacement history, malware scanning, and deletion are deferred to later work. Feature-owned routes must never provide access using a `FileAsset` ID alone; they must authorize the related Funding, Compliance, Supplier, Membership, Procurement, Centre, Donor, or Intelligence entity first.

## Tests

Run isolated tests without Supabase network calls:

```shell
npm run test:storage
```

Tests use a mocked provider and persistence adapter.
