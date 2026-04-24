# DAM Rules

The DAM manager is developer-facing. It is not a full CMS.

## Storage

Files must be stored under:

```text
dam/dam/{tenant}/{generated_filename}
```

Public asset URLs should use:

```text
/dam/{asset-id}
```

The DAM server resolves the database asset record and streams the stored file.

## File Rules

- Original filenames must never be trusted for storage.
- Generated filenames must be globally unique.
- File collisions must be impossible.
- Updating a file creates a new version.
- Previous versions remain accessible.

## Security

Write operations require:

```text
X-DEV-KEY: <key>
```

Requests without a valid key must fail.

## Metadata

Tags must use relational tables. Do not store tag lists as comma-separated strings.
