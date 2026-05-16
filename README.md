# Worknest

Backend-first multi-tenant payroll SaaS for SMBs.

## Product Summary

Worknest helps a company:
- create a tenant workspace
- configure one main office and multiple branches
- assign plans per office
- manage branch admins and employees
- upload monthly payroll per branch
- publish payslips for employee self-service

This repository is being migrated from a single-file PHP API to a structured OOP backend under `api/src` while preserving the `/api/...` public route surface.
The canonical contract now also lives under `/api/v2/...`, while legacy routes remain as compatibility shims for the current UI.

## Architecture Overview

### Current direction
- Backend first
- PHP + MySQL
- OOP application core under `api/src`
- React frontend remains a consumer of the API
- Endpoint registry remains the machine-readable contract in `api/endpoints.registry.json`

### Backend layers

```text
api/src/
  Application/
    Exceptions/
    Http/
    Middleware/
    Routing/
    Support/
  Domain/
    Audit/
    Auth/
    Office/
    Payroll/
    Payslip/
    Tenant/
    User/
  Infrastructure/
    Database/
    Notifications/
    Repositories/
    Security/
    Storage/
  Presentation/
    Controllers/
    Requests/
    Responses/
    Transformers/
  Bootstrap/
```

### Design rules
- strict typing
- constructor injection
- no SQL in controllers
- no business logic in route registration
- tenant scoping on every tenant-owned read/write
- consistent response envelope:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

## Database Modules

The v2 schema is defined as versioned SQL files under `docs/sql/`.

### Tables
- `tenants`
- `plans`
- `offices`
- `tenant_plans`
- `users`
- `roles`
- `user_roles`
- `auth_sessions`
- `otp_challenges`
- `payroll_batches`
- `payroll_records`
- `payslips`
- `audit_logs`

### Rules
- every tenant-owned table stores `tenant_id`
- every office-scoped business table stores `office_id`
- employees belong to exactly one branch office
- branch admins can be assigned to multiple offices through `user_roles`
- only one active main office per tenant
- only one active plan per office at a time
- only one active payroll batch per office and month in MVP
- published payroll remains immutable

### SQL files
- [001_core_identity.sql](/Volumes/StudioSSD/Users/cainedaniel/Drive/Actual%20Inteligence%20Solutions/worknest/docs/sql/001_core_identity.sql)
- [002_offices_and_plans.sql](/Volumes/StudioSSD/Users/cainedaniel/Drive/Actual%20Inteligence%20Solutions/worknest/docs/sql/002_offices_and_plans.sql)
- [003_auth_and_roles.sql](/Volumes/StudioSSD/Users/cainedaniel/Drive/Actual%20Inteligence%20Solutions/worknest/docs/sql/003_auth_and_roles.sql)
- [004_payroll.sql](/Volumes/StudioSSD/Users/cainedaniel/Drive/Actual%20Inteligence%20Solutions/worknest/docs/sql/004_payroll.sql)
- [005_audit.sql](/Volumes/StudioSSD/Users/cainedaniel/Drive/Actual%20Inteligence%20Solutions/worknest/docs/sql/005_audit.sql)
- [seed_plans.sql](/Volumes/StudioSSD/Users/cainedaniel/Drive/Actual%20Inteligence%20Solutions/worknest/docs/sql/seed_plans.sql)
- [seed_roles.sql](/Volumes/StudioSSD/Users/cainedaniel/Drive/Actual%20Inteligence%20Solutions/worknest/docs/sql/seed_roles.sql)

## API Inventory

Implementation status is tracked in code and mirrored in `api/endpoints.registry.json`.

### System
| Method | Path | Purpose | Auth | Tenant Scope | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/health` | API health check | None | None | Implemented |
| GET | `/api/endpoints` | Search endpoint registry | None | None | Implemented |
| GET | `/api/plans` | List active plans | None | Global | Implemented |

### Auth
| Method | Path | Purpose | Auth | Tenant Scope | Status |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v2/auth/admin/login` | Canonical admin login | None | Required | Implemented |
| POST | `/api/v2/auth/employee/login` | Canonical employee login by email or phone plus PIN | None | Required | Implemented |
| GET | `/api/v2/auth/me` | Canonical current actor summary | Bearer | Required | Implemented |
| POST | `/api/companies/register` | Create tenant owner and OTP challenge | None | Creates tenant | Implemented |
| GET | `/api/companies/check-workspace` | Check workspace slug availability | None | None | Implemented |
| POST | `/api/auth/admin/verify-otp` | Verify owner OTP | None | Challenge scoped | Implemented |
| POST | `/api/auth/owner-login` | Tenant owner login | None | Required | Implemented |
| POST | `/api/auth/branch-login` | Branch admin login | None | Required | Implemented |
| POST | `/api/auth/employee-login` | Employee login by employee ID and PIN | None | Required | Implemented |
| POST | `/api/auth/logout` | Revoke current session | Bearer | Session scoped | Implemented |
| GET | `/api/auth/me` | Current actor session summary | Bearer | Required | Implemented |

### Offices
| Method | Path | Purpose | Auth | Tenant Scope | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v2/offices` | Canonical office list with usage summary | Bearer | Required | Implemented |
| POST | `/api/v2/offices` | Canonical office create route | Bearer | Required | Implemented |
| GET | `/api/v2/offices/{id}/plan-assignments` | List office plan history | Bearer | Required | Implemented |
| GET | `/api/offices` | List offices | Bearer | Required | Implemented |
| GET | `/api/offices/{id}` | Office detail | Bearer | Required | Implemented |
| POST | `/api/main-office` | Create main office | Bearer | Required | Implemented |
| POST | `/api/branches` | Create branch office | Bearer | Required | Implemented |
| PATCH | `/api/offices/{id}` | Update office profile/settings | Bearer | Required | Implemented |
| POST | `/api/offices/{id}/plans` | Assign active plan | Bearer | Required | Implemented |
| POST | `/api/offices/{id}/admins` | Assign branch admins to office | Bearer | Required | Implemented |

### Users
| Method | Path | Purpose | Auth | Tenant Scope | Status |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/users` | Create branch admin or employee | Bearer | Required | Implemented |
| GET | `/api/users` | List users | Bearer | Required | Implemented |
| GET | `/api/users/{id}` | User detail | Bearer | Required | Implemented |
| PATCH | `/api/users/{id}` | Update user profile/status | Bearer | Required | Implemented |
| POST | `/api/users/{id}/reset-pin` | Reset employee PIN | Bearer | Required | Implemented |

### Payroll
| Method | Path | Purpose | Auth | Tenant Scope | Status |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/payroll-batches` | Upload payroll source file | Bearer | Required | Implemented |
| GET | `/api/payroll-batches` | List payroll batches | Bearer | Required | Implemented |
| GET | `/api/payroll-batches/{id}` | Fetch one batch with validation and record detail | Bearer | Required | Implemented |
| POST | `/api/payroll-batches/{id}/mapping` | Save column mapping | Bearer | Required | Implemented |
| POST | `/api/payroll-batches/{id}/validate` | Validate batch rows | Bearer | Required | Implemented |
| POST | `/api/payroll-batches/{id}/confirm` | Create normalized payroll records | Bearer | Required | Implemented |
| POST | `/api/payroll-batches/{id}/publish` | Generate and publish payslips | Bearer | Required | Implemented |

### Payslips
| Method | Path | Purpose | Auth | Tenant Scope | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/payslips` | List accessible payslips | Bearer | Required | Implemented |
| GET | `/api/payslips/{id}` | Payslip detail | Bearer | Required | Implemented |
| GET | `/api/payslips/{id}/download` | Download payslip PDF | Bearer | Required | Implemented |

## Local Setup

### API
1. Configure `api/.env`
2. Apply SQL in `docs/sql/` to MySQL
3. Serve the API root:

```sh
php -S localhost:8080 -t api api/router.php
```

### Frontend
Use the existing Vite application in `ui/`.

## Migration Notes

The old single-file procedural backend is being replaced by:
- `api/index.php` as a bootstrap entrypoint only
- controllers for HTTP concerns
- repositories for persistence
- services for auth, payroll, and tenant rules

Compatibility notes:
- `/api/hr-login` style behavior is superseded by owner and branch login routes
- office APIs replace the old `locations` naming
- employee OTP login is replaced by employee ID plus PIN for MVP

## Security Model

- tenant isolation enforced in every repository query
- office access enforced through `user_roles`
- passwords and PINs are hashed
- sessions are persisted in `auth_sessions`
- payroll files are stored outside the public route tree and downloaded only through authorized endpoints
- audit logs capture sensitive mutations and document access

## Next Milestones

1. Add automated integration tests once PHP CLI is available in the execution environment
2. Add XLSX adapter implementation beyond the CSV-first baseline
3. Connect React admin and employee flows to the new endpoint surface
4. Introduce PDF templating beyond the minimal generated stub
