# Backend Rules

## Endpoint-First Development

All backend functionality must be exposed through clean endpoint contracts.

Before creating or using an endpoint:

1. Check `api/endpoints.registry.json`.
2. Reuse an existing endpoint if one satisfies the request.
3. If no endpoint exists, add the registry entry first.
4. Implement the route after the contract is clear.

## Response Shape

All API responses must use:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Errors must use:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

## Data Access

- Use PDO for MySQL.
- Do not expose database details to the frontend.
- Validate tenant context before returning tenant-owned data.
- Use soft deletes where the table includes `deleted_at`.
- Read environment and tenant intent from root `config/` before adding deployment-sensitive behavior.
