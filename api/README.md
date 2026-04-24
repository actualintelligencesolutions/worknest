# PHP API

The API keeps public usage endpoint-first. Internal PHP can become structured, but consumers should only need:

- HTTP method
- path
- tenant behavior
- request shape
- response envelope

Every endpoint must be represented in `endpoints.registry.json` before it is implemented.

## Run Locally

```sh
php -S localhost:8080 -t api
```

When hosted from the project root, Apache routes API requests through:

```text
https://example.com/api/...
```

## Endpoint Discovery

Use the registry directly, or call:

```text
GET /endpoints?query=user%20details
```

If an endpoint exists, reuse it. If it does not, define the registry entry first.
