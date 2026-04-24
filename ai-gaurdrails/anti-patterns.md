# Anti-Patterns

Avoid these patterns in every branch of the template.

## Frontend

- Hardcoded visible UI strings.
- Components that bypass page/layout/atomic hierarchy.
- Tenant-specific one-off branches inside reusable components.
- Divergent tenant config inside `ui` that does not come from root `config/`.
- Direct database calls from React.

## Backend

- Creating routes without registry entries.
- Returning inconsistent JSON shapes.
- Ignoring tenant context.
- Adding base URL, route, or tenant assumptions without checking `config/`.
- Exposing database structure as the public contract.

## Database

- Tables without tenant awareness.
- Tables without timestamps and soft-delete fields.
- Tags stored as raw strings instead of relational mapping.

## DAM

- Trusting original filenames for storage.
- Overwriting files during upload.
- Hard-deleting asset metadata in the vanilla baseline.
- Allowing write actions without `X-DEV-KEY`.
