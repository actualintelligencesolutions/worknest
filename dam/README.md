# Developer DAM Manager

Plain PHP developer-facing DAM manager for tenant-scoped asset uploads.

## Setup

1. Import `../docs/sql/initialisation.sql` into MySQL.
2. Copy `.env.example` values into your local environment.
3. Start the server:

```sh
php -S localhost:8081 -t dam
```

Uploaded files are stored under:

```text
dam/dam/{tenant}/{generated_filename}
```

Write operations require:

```text
X-DEV-KEY: <DAM_DEV_KEY>
```

## Endpoints

- `GET /health`
- `GET /assets?tenant=default`
- `GET /assets/{id}?tenant=default`
- `GET /assets/{id}/file?tenant=default`
- `GET /{asset-id}?tenant=default`
- `POST /assets`
- `POST /assets/{id}/versions`
- `PUT /assets/{id}`
- `DELETE /assets/{id}`

When hosted from the project root, public asset URLs use:

```text
https://example.com/dam/{asset-id}
```
