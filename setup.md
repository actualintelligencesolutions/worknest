# Worknest — Payslip Organiser MVP Plan

---

## 1. Product Overview

Worknest is a **tenant-aware HR SaaS** designed to solve one core problem:

> **Convert messy payroll data into clean, publishable payslips in minutes.**

The MVP focuses on:

* Fast payroll ingestion (CSV/XLSX)
* Smart + manual column mapping
* Validation and exception handling
* One-click payroll publishing
* Employee self-access via OTP login

---

## 2. Core Product Principles

* **Speed over complexity** — HR should complete payroll in minutes
* **Trust through validation** — no silent data errors
* **Repeatability** — next month should be easier than the last
* **Strict tenant isolation** — all data scoped to company
* **No hard dependencies on perfect input** — system must handle messy data

---

## 3. Onboarding Flow (Tenant Creation)

### Steps

1. **Company Details**
2. **HR Admin Account**
3. **Review & Create Workspace**

---

### Branch Package Selection (later)

Company registration is free and does **not** require plan selection. Packages
are selected later for company branches during branch setup/onboarding.

#### Free Package Card

* **Name**: Free
* **Price**: ₹0 / month
* **Use Case**: Getting a branch started with payroll organization
* **Includes**:

  * Branch workspace
  * Employee records
  * Payroll import (CSV/XLSX)
  * Payslip generation
  * Employee OTP access
* **Note**:
  Future paid plans may unlock limits, reports, and automation features

---

### Post-Registration Behavior

* Do NOT land on dashboard
* Redirect immediately to:

> **“Upload your first payroll file”**

This is the activation moment.

---

## 4. Core Workflow

### Step 1: Payroll Upload

* HR uploads CSV/XLSX file
* System validates:

  * file type
  * size
  * basic structure

---

### Step 2: Column Mapping (Critical Stage)

System must support:

#### Auto Mapping (Baseline Intelligence)

* Suggest mappings based on column names:

  * `Emp Name` → employee_name
  * `Net Amt` → net_pay
* Provide confidence indicators:

  * ✅ High confidence
  * ⚠️ Needs review

#### Manual Mapping

HR can override all mappings.

---

### Step 3: Validation & Exceptions

System processes mapped data and flags:

#### Example Exceptions

* Missing employee code
* Invalid / missing phone number
* Duplicate employee entries
* Negative or inconsistent values
* Net pay mismatch

#### Behavior

* Block publishing if critical errors exist
* Allow fixes inline or via re-upload

---

### Step 4: Processing

Normalized records are created:

* employee profiles (created or updated)
* payroll rows converted into structured data

---

### Step 5: Publish Payroll Period

* Locks payroll data
* Generates payslips (PDF)
* Marks period as **immutable**

---

### Step 6: Employee Access

* Employee logs in via:

  * phone number
  * OTP verification
* Employee can:

  * view payslips
  * download PDF
* Access restricted to:

  * their own records
  * published periods only

---

## 5. Payroll Import Lifecycle

Each import must track state:

```id="9c8qwr"
uploaded → mapped → validated → processed → published
```

### Requirements

* Store `status` in `payroll_imports`
* Allow resuming incomplete imports
* Prevent skipping steps

---

## 6. Public API Interfaces

All endpoints must be defined in the endpoint registry before implementation.

### Required Endpoints

* `GET /api/plans`
* `POST /api/companies/register`
* `POST /api/auth/hr-login`
* `POST /api/auth/employee/request-otp`
* `POST /api/auth/employee/verify-otp`
* `GET /api/auth/me`
* `GET /api/employees`
* `POST /api/payroll-periods`
* `POST /api/payroll-imports`
* `PUT /api/payroll-imports/{id}/mapping`
* `POST /api/payroll-imports/{id}/process`
* `POST /api/payroll-periods/{id}/publish`
* `GET /api/payslips`
* `GET /api/payslips/{id}/download`

---

### Critical Rules

* `POST /api/companies/register` must not require `plan_id`
* Company registration creates only the tenant/company and first HR admin
* Branch package selection is handled later in onboarding

---

## 7. Data Model

### Core Tables

* `plans`
* `tenant_plan_subscriptions`
* `users` (HR admins)
* `employee_profiles`
* `employee_otp_challenges`
* `payroll_periods`
* `payroll_imports`
* `payroll_import_rows`
* `payslip_records`
* `payslip_files`

---

### Key Data Rules

#### Employee Identity

* `employee_code` is primary identifier
* Phone number must be:

  * normalized (`+91XXXXXXXXXX`)
  * validated

---

#### OTP Security

Store:

* `otp_code`
* `expires_at`
* `attempt_count`
* `last_attempt_at`

---

#### Payslip Strategy

* Payslips must be generated **at publish time**
* Store:

  * file path
  * file hash
  * version

---

#### Payroll Continuity

* Each employee can have multiple payslips across periods
* Historical data must remain accessible

---

## 8. Mapping Reusability (Retention Feature)

* Save mapping templates per tenant
* Auto-apply mappings for future uploads
* Allow override

---

## 9. Tenant System

### Requirements

* All data must include `tenant_id`
* Default fallback tenant must exist

---

### Tenant Config Controls

* Branding
* Feature flags
* Enabled modules

Example:

```id="a5a3nq"
{
  enablePayroll: true,
  enableReports: false
}
```

---

## 10. Test Plan

### Registration

* Can proceed without plan selection
* Tenant and HR user must be created

---

### Payroll Upload

* Accept valid CSV/XLSX
* Reject invalid or corrupted files

---

### Mapping

* Auto-mapping suggestions appear
* Manual override works

---

### Validation

* Exceptions are correctly identified
* Blocking rules enforced

---

### Publishing

* Cannot publish with critical errors
* Generates payslips correctly
* Locks data after publish

---

### Employee Access

* OTP login works with normalized phone
* Employee sees only their payslips
* Cannot access unpublished data

---

### Failure Scenarios

* Missing columns
* Duplicate employees
* Invalid phone numbers
* Large file uploads
* Unauthorized access attempts

---

## 11. Assumptions

* Company registration is free and package selection belongs to branch setup
* CSV/XLSX only (no PDF parsing in v1)
* India payroll conventions (PF, ESI, PT, TDS)
* OTP initially works in dev mode (no SMS dependency)
* Paid plans will introduce limits and advanced features

---

## 12. Final Note

This MVP is not a full HR system.

It is a **focused payroll ingestion and distribution engine**.

Success depends on:

* Fast onboarding
* Accurate data normalization
* Minimal manual effort
* Reliable employee access

Everything else is secondary.
