# Apache Deployment

The canonical deployment values live in:

```text
config/environments.json
```

Apache `.htaccess` files are static on shared hosting, so the root `.htaccess` mirrors the config values instead of reading JSON at request time.

## URL Contract

- `https://example.com` serves `ui/dist/index.html`.
- Frontend deep links fall back to `ui/dist/index.html`.
- `https://example.com/api/...` routes to `api/index.php`.
- `https://example.com/dam/{asset-id}` routes to `dam/index.php` and streams the stored asset.
- DAM management routes such as `https://example.com/dam/assets` also route to `dam/index.php`.

## Build Output

`ui/dist/` is intentionally ignored by Git. For deployment, run:

```sh
cd ui
npm run build
```

Then deploy the generated `ui/dist` directory to the server without committing it.
