# Project Principles

## Intent

This repository is a reusable foundation for tenant-aware PHP, React, MySQL applications.

## Non-Negotiables

- Keep implementation simple, but contracts strict.
- All systems must be tenant-aware by design.
- Check `config/` before changing base URLs, tenants, deployment paths, routing, feature flags, or tenant-owned content structure.
- No visible frontend text may be hardcoded.
- No endpoint may exist without an endpoint registry entry.
- No feature should exist without SQL definition, endpoint contract, registry entry, and guardrail compliance.

## Ownership Boundaries

- React owns UI composition and client interactions.
- PHP owns business rules, validation, and endpoint contracts.
- MySQL owns persistence only.
- DAM owns asset upload, metadata, versioning, preview, and soft delete.

## Tenant Rules

Tenant config controls:

- Branding
- Enabled pages
- Component visibility and order
- Translation keys
- Feature flags
- Config version

Always use a default fallback tenant named `default`.

## Configuration Source Of Truth

- `config/environments.json` owns base URLs and public path prefixes.
- `config/tenants/*.json` owns tenant definitions.
- `.htaccess` mirrors config for Apache and should be updated when deployment paths change.
- React, PHP, DAM, and AI agents should treat `config/` as canonical.
