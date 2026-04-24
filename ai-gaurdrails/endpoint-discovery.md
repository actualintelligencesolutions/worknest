# Endpoint Discovery

Use `api/endpoints.registry.json` as the source of truth for backend capability.

## Decision Flow

```text
If data or backend behavior is required:
  -> Check endpoint registry
    -> If endpoint exists, reuse it
    -> If endpoint does not exist, define it in the registry
    -> Implement only after the registry contract is present
```

## Expected AI Behavior

When asked for functionality like:

```text
get me the endpoint that can help me get the details of a user
```

The model should:

1. Search the registry.
2. Identify an existing endpoint if present.
3. Explain method, path, inputs, response, and tenant behavior.
4. Ask whether to reuse/include it in the response or implementation.

For user details, the vanilla registry includes:

```text
GET /users/{id}
```
