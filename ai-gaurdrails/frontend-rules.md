# Frontend Rules

## Composition

Frontend composition must follow:

```text
pages -> layouts -> organisms -> molecules -> atoms
```

- Pages import layouts.
- Layouts own shared shell components.
- Pages pass page-specific content through children or named slots.
- Organisms may compose molecules and atoms.
- Molecules may compose atoms.
- Atoms must remain small and presentational.

## Translation

- No visible UI copy may be hardcoded in JSX.
- English must still be treated as a translation.
- Tenant config must store translation keys, not raw user-facing copy.

## State

- Use server-state tooling for API data.
- Use lightweight client stores for UI, tenant, and feature-flag state.
- Do not call MySQL or PHP internals from React.
- React talks only to documented endpoints.

## Tenant Awareness

Every page must be able to operate under tenant context. Components should receive tenant-derived behavior through config, hooks, or props rather than hardcoded branches.

Tenant config must originate from `config/tenants/*.json`. Do not create a divergent frontend-only tenant source unless a generation step keeps it synchronized with root config.
