import { RESOLVED_API_BASE_URL, apiRequest } from './apiClient';

export type Plan = {
  id: number;
  plan_code: string;
  name: string;
  price_cents: number;
  currency: string;
  description?: string | null;
  employee_limit?: number | null;
  monthly_payroll_limit?: number | null;
  features_json?: string[] | string | null;
  status?: string;
};

export type CompanyLocation = {
  id: number;
  tenant_id: string;
  office_code?: string;
  location_type?: 'main_office' | 'branch';
  office_type?: 'main_office' | 'branch';
  name: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  city?: string | null;
  state?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  settings_json?: Record<string, unknown> | string | null;
};

export type PayrollBatch = {
  id: number;
  tenant_id: string;
  office_id: number;
  period_year: number;
  period_month: number;
  source_file_name: string;
  source_file_path?: string;
  upload_status: string;
  uploaded_at?: string;
  created_at?: string;
  updated_at?: string;
  validation_summary_json?: string | null;
  mapping_json?: string | null;
  mapping?: Record<string, string>;
  confirmed_by_user_id?: number | null;
  published_by_user_id?: number | null;
  validation_summary?: {
    total_rows?: number;
    valid_rows?: number;
    error_rows?: number;
    critical_errors?: string[];
    employee_rows_skipped?: number;
    employee_sheet_warnings?: Array<{
      row: number;
      employee_id?: string;
      full_name?: string;
      reason: string;
      message: string;
    }>;
    payroll_rows_skipped?: number;
    payroll_row_warnings?: Array<{
      employee_id?: string;
      employee_name?: string;
      reason: string;
      message: string;
    }>;
    normalized_rows?: Array<{
      data: Record<string, unknown>;
      errors: string[];
    }>;
  };
  confirmed_at?: string | null;
  published_at?: string | null;
};

export type PayrollBatchUploadResult = {
  batch: {
    id: number;
    upload_status: string;
  };
  records_created: number;
  employees_created?: number;
  employees_updated?: number;
  employee_rows_skipped?: number;
  employee_sheet_warnings?: Array<{
    row: number;
    employee_id?: string;
    full_name?: string;
    reason: string;
    message: string;
  }>;
  payroll_rows_skipped?: number;
  payroll_row_warnings?: Array<{
    employee_id?: string;
    employee_name?: string;
    reason: string;
    message: string;
  }>;
};

export type PayrollMissingEmployeeImportResult = {
  batch: {
    id: number;
    upload_status: string;
  };
  employees_created: number;
  records_created: number;
  created_employees: Array<{
    id: number;
    employee_id: string;
    display_name: string;
    phone?: string | null;
    pin_seeded: boolean;
  }>;
  summary: {
    total_rows?: number;
    valid_rows?: number;
    error_rows?: number;
    critical_errors?: string[];
  };
};

export type PayrollBatchConfirmResult = {
  batch: {
    id: number;
    upload_status: string;
  };
  records_created: number;
};

export type PayrollBatchPublishResult = {
  batch: {
    id: number;
    upload_status: string;
  };
  summary: {
    employee_count: number;
    payslips_generated: number;
    employee_notifications: string;
  };
};

export type PayrollBatchDetail = {
  batch: PayrollBatch;
  office: {
    id: number;
    name: string;
    office_type: 'main_office' | 'branch';
    status: string;
    city?: string | null;
    state?: string | null;
  } | null;
  records: Array<Record<string, unknown>>;
  headers?: string[];
  sample_rows?: Array<Record<string, string>>;
  mapping_suggestions?: Record<
    string,
    {
      source: string;
      confidence: 'high' | 'medium' | 'low';
    }
  >;
};

export type AuthSession = {
  token: string;
  tenantId: string;
  userName?: string;
  userType?: 'tenant_owner' | 'branch_admin' | 'site_owner' | 'employee';
};

export type ActorProfile = {
  id: number;
  tenant_id: string;
  office_id: number | null;
  employee_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  user_type: 'tenant_owner' | 'branch_admin' | 'site_owner' | 'employee';
  status: string;
  office_ids: number[];
};

export type UserSummary = {
  id: number;
  tenant_id: string;
  office_id: number | null;
  employee_id: string | null;
  first_name: string;
  last_name?: string | null;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  employment_type?: string | null;
  date_of_joining?: string | null;
  uan?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  ifsc?: string | null;
  designation?: string | null;
  basic_rate?: number | null;
  user_type: 'tenant_owner' | 'branch_admin' | 'site_owner' | 'employee';
  status: string;
  has_pin?: boolean;
  employee_pin?: string | null;
  created_at?: string;
};

export type EmployeePinResetResult = {
  user: UserSummary | null;
  pin_reset: boolean;
  revealed_pin: string;
};

export type SiteOwnerInviteSummary = {
  id: number;
  tenant_id: string;
  office_id: number;
  office_name?: string | null;
  office_code?: string | null;
  tenant_name?: string | null;
  invited_email: string;
  invited_name?: string | null;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  expires_at?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
};

export type OfficeEmployeePinBulkResetResult = {
  office_id: number;
  pin_reset_count: number;
  employees: Array<{
    user_id: number;
    employee_id: string | null;
    display_name: string;
    phone?: string | null;
    email?: string | null;
    revealed_pin: string;
  }>;
};

export type RegistrationResult = {
  tenant: { tenant_id: string; name: string };
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
  };
  next_step: string;
};

export type TenantSlugAvailability = {
  tenant_id: string;
  available: boolean;
  reason: string | null;
};

export type AdminAuthResult = {
  actor: {
    id: number;
    name: string;
    email: string | null;
    role?: 'tenant_owner' | 'branch_admin' | 'site_owner';
  };
  tenant: {
    tenant_id: string;
  };
  session: {
    token: string;
    session_type: 'web' | 'employee_portal';
  };
};

export type EmployeeAuthResult = {
  actor: {
    id: number;
    employee_id: string | null;
    name: string;
    office_id: number | null;
    user_type: 'employee';
  };
  tenant: {
    tenant_id: string;
  };
  session: {
    token: string;
    session_type: 'employee_portal';
  };
};

export type SiteOwnerInviteMutationResult = {
  office: CompanyLocation;
  site_owner?: {
    id: number | null;
    name: string | null;
    email: string | null;
    status: string | null;
  } | null;
  pending_site_owner_invite?: SiteOwnerInviteSummary | null;
  status?: 'invite_pending' | 'access_granted';
};

export type SiteOwnerInviteAcceptanceDetail = {
  invite: SiteOwnerInviteSummary;
};

export type SiteOwnerInviteAcceptanceResult = {
  user: {
    id: number;
    name: string;
    email: string | null;
    role: 'tenant_owner' | 'branch_admin' | 'site_owner';
  };
  tenant: {
    tenant_id: string;
  };
  session: {
    token: string;
    session_type: 'web';
  };
};

export type SitePortal = {
  id: number;
  tenant_id: string;
  office_code: string;
  name: string;
  office_type: 'main_office' | 'branch';
  status: string;
  city?: string | null;
  state?: string | null;
};

export type PayslipSummary = {
  id: number;
  tenant_id: string;
  office_id: number | null;
  payroll_record_id: number;
  user_id: number;
  period_year: number;
  period_month: number;
  file_path: string | null;
  file_format: string;
  generated_at: string | null;
  published_at: string | null;
  status: string;
  employee_id: string | null;
  employee_name_snapshot: string | null;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
};

type OfficeDetail = {
  office: CompanyLocation;
  location: CompanyLocation;
  admin: {
    id: number | null;
    name: string | null;
    email: string | null;
    status: string | null;
  } | null;
  site_owner?: {
    id: number | null;
    name: string | null;
    email: string | null;
    status: string | null;
  } | null;
  pending_site_owner_invite?: SiteOwnerInviteSummary | null;
  plan: Pick<
    Plan,
    'id' | 'plan_code' | 'name' | 'price_cents' | 'currency'
  >;
  usage_summary?: {
    employee_count?: number;
    employee_limit?: number | null;
    employee_limit_reached?: boolean;
    monthly_payroll_count?: number;
    monthly_payroll_limit?: number | null;
    monthly_payroll_limit_reached?: boolean;
  };
};

export type OfficeCreationPayload = {
  office_type: 'main_office' | 'branch';
  name: string;
  city: string;
  state: string;
  plan_id: number;
  country?: string;
  contact_email?: string;
  contact_phone?: string;
  admin_name?: string;
  admin_email?: string;
  admin_phone?: string;
  logo?: File | null;
};

export type OfficeCreationResult = {
  office: CompanyLocation;
  location: CompanyLocation;
  admin: {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    status: string;
  } | null;
  plan: Plan;
};

export type OfficeUpdatePayload = {
  name?: string;
  status?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  timezone?: string | null;
  payroll_day?: number | null;
  settings_json?: Record<string, unknown>;
};

function authHeaders(session: AuthSession) {
  return {
    Authorization: `Bearer ${session.token}`,
  };
}

export function registerCompany(payload: {
  company_name: string;
  tenant_id: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  admin_password: string;
}) {
  return apiRequest<RegistrationResult>('/v2/tenants', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function checkWorkspaceSlug(tenantId: string) {
  return apiRequest<TenantSlugAvailability>(
    `/v2/tenants/check-slug?tenant_id=${encodeURIComponent(tenantId)}`,
  );
}

export function loginAdmin(
  tenantId: string,
  payload: {
    email: string;
    password: string;
  },
) {
  return apiRequest<AdminAuthResult>(
    `/v2/auth/admin/login?tenant=${encodeURIComponent(tenantId)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        tenant_id: tenantId,
      }),
    },
  );
}

export function loginEmployee(
  tenantId: string,
  payload: {
    phone: string;
    pin: string;
  },
) {
  return apiRequest<EmployeeAuthResult>(`/v2/auth/employee/login?tenant=${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginEmployeeForSite(
  tenantId: string,
  officeCode: string,
  payload: {
    phone: string;
    pin: string;
  },
) {
  return apiRequest<EmployeeAuthResult>(
    `/v2/auth/employee/login?tenant=${encodeURIComponent(tenantId)}&office_code=${encodeURIComponent(officeCode)}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function getSitePortal(tenantId: string, officeCode: string) {
  return apiRequest<{ site: SitePortal }>(
    `/v2/site?tenant=${encodeURIComponent(tenantId)}&office_code=${encodeURIComponent(officeCode)}`,
  );
}

export function listPayslips(session: AuthSession) {
  return apiRequest<{ payslips: PayslipSummary[] }>(
    `/v2/payslips?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
}

export async function downloadPayslip(session: AuthSession, payslipId: number, filename?: string) {
  const response = await fetch(
    `${RESOLVED_API_BASE_URL}/v2/payslips/${payslipId}/download?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );

  if (!response.ok) {
    throw new Error('Unable to download payslip.');
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename ?? `worknest-payslip-${payslipId}.pdf`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export function buildSitePortalUrl(tenantId: string, officeCode: string) {
  if (typeof window === 'undefined') {
    return `/site/${tenantId}/${officeCode}/login`;
  }

  return `${window.location.origin}/site/${tenantId}/${officeCode}/login`;
}

export function buildTenantLoginUrl(tenantId: string) {
  if (typeof window === 'undefined') {
    return `/login/${tenantId}`;
  }

  return `${window.location.origin}/login/${tenantId}`;
}

export function getOfficeDisplayCode(office?: Pick<CompanyLocation, 'office_code' | 'name'> | null) {
  if (office?.office_code && office.office_code.trim() !== '') {
    return office.office_code;
  }

  return office?.name ?? 'SITE';
}

export function logout(session: AuthSession) {
  return apiRequest<{ revoked: boolean }>(
    `/v2/auth/logout?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function getCurrentActor(session: AuthSession) {
  return apiRequest<{ actor: ActorProfile }>(
    `/v2/auth/me?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
}

export function listPlans() {
  return apiRequest<{ plans: Plan[] }>('/plans');
}

export function listCompanyLocations(session: AuthSession) {
  return apiRequest<{
    locations: CompanyLocation[];
    summary: {
      main_offices: number;
      branches: number;
      total: number;
    };
  }>(`/locations?tenant=${encodeURIComponent(session.tenantId)}`, {
    headers: authHeaders(session),
  });
}

export function getOffice(session: AuthSession, id: number) {
  return apiRequest<OfficeDetail>(
    `/offices/${id}?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
}

export function updateOffice(session: AuthSession, id: number, payload: OfficeUpdatePayload) {
  return apiRequest<{ office: CompanyLocation }>(
    `/offices/${id}?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(session),
      body: JSON.stringify(payload),
    },
  );
}

export function createOffice(session: AuthSession, payload: OfficeCreationPayload) {
  const body = new FormData();
  body.set('office_type', payload.office_type);
  body.set('name', payload.name);
  body.set('city', payload.city);
  body.set('state', payload.state);
  body.set('plan_id', String(payload.plan_id));

  if (payload.country) {
    body.set('country', payload.country);
  }
  if (payload.contact_email) {
    body.set('contact_email', payload.contact_email);
  }
  if (payload.contact_phone) {
    body.set('contact_phone', payload.contact_phone);
  }
  if (payload.admin_name) {
    body.set('admin_name', payload.admin_name);
  }
  if (payload.admin_email) {
    body.set('admin_email', payload.admin_email);
  }
  if (payload.admin_phone) {
    body.set('admin_phone', payload.admin_phone);
  }
  if (payload.logo) {
    body.set('logo', payload.logo);
  }

  return apiRequest<OfficeCreationResult>(
    `/v2/offices?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body,
    },
  );
}

export function listUsers(
  session: AuthSession,
  filters?: {
    office_id?: number;
    user_type?: 'branch_admin' | 'site_owner' | 'employee';
  },
) {
  const search = new URLSearchParams({
    tenant: session.tenantId,
  });

  if (filters?.office_id) {
    search.set('office_id', String(filters.office_id));
  }

  if (filters?.user_type) {
    search.set('user_type', filters.user_type);
  }

  return apiRequest<{ users: UserSummary[] }>(`/users?${search.toString()}`, {
    headers: authHeaders(session),
  });
}

export function inviteSiteOwner(
  session: AuthSession,
  officeId: number,
  payload: {
    email: string;
    name?: string;
  },
) {
  return apiRequest<SiteOwnerInviteMutationResult>(
    `/v2/offices/${officeId}/site-owner-invites?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify(payload),
    },
  );
}

export function resendSiteOwnerInvite(session: AuthSession, officeId: number, inviteId: number) {
  return apiRequest<{ pending_site_owner_invite: SiteOwnerInviteSummary | null }>(
    `/v2/offices/${officeId}/site-owner-invites/${inviteId}/resend?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function cancelSiteOwnerInvite(session: AuthSession, officeId: number, inviteId: number) {
  return apiRequest<{ cancelled: boolean }>(
    `/v2/offices/${officeId}/site-owner-invites/${inviteId}/cancel?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function getSiteOwnerInviteAcceptance(token: string) {
  return apiRequest<SiteOwnerInviteAcceptanceDetail>(
    `/v2/site-owner-invites/accept?token=${encodeURIComponent(token)}`,
  );
}

export function acceptSiteOwnerInvite(payload: {
  token: string;
  name: string;
  password: string;
}) {
  return apiRequest<SiteOwnerInviteAcceptanceResult>('/v2/site-owner-invites/accept', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUser(
  session: AuthSession,
  id: number,
  payload: {
    office_id?: number | null;
    display_name?: string;
    email?: string | null;
    phone?: string | null;
    status?: string;
  },
) {
  return apiRequest<{ user: UserSummary }>(
    `/users/${id}?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(session),
      body: JSON.stringify(payload),
    },
  );
}

export function resetEmployeePin(
  session: AuthSession,
  userId: number,
  payload?: {
    pin?: string;
  },
) {
  return apiRequest<EmployeePinResetResult>(
    `/v2/users/${userId}/pin/reset?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export function resetOfficeEmployeePins(session: AuthSession, officeId: number) {
  return apiRequest<OfficeEmployeePinBulkResetResult>(
    `/v2/offices/${officeId}/employee-pins/reset?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function listPayrollBatches(
  session: AuthSession,
  filters?: {
    office_id?: number;
  },
) {
  const search = new URLSearchParams({
    tenant: session.tenantId,
  });

  if (filters?.office_id) {
    search.set('office_id', String(filters.office_id));
  }

  return apiRequest<{ batches: PayrollBatch[] }>(
    `/payroll-batches?${search.toString()}`,
    {
      headers: authHeaders(session),
    },
  );
}

export function getPayrollBatch(session: AuthSession, batchId: number) {
  return apiRequest<PayrollBatchDetail>(
    `/payroll-batches/${batchId}?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
}

export function uploadPayrollBatch(
  session: AuthSession,
  payload: {
    office_id: number;
    period_month: number;
    period_year: number;
    file: File;
  },
) {
  const body = new FormData();
  body.append('office_id', String(payload.office_id));
  body.append('period_month', String(payload.period_month));
  body.append('period_year', String(payload.period_year));
  body.append('file', payload.file);

  return apiRequest<PayrollBatchUploadResult>(
    `/payroll-batches?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      body,
    },
  );
}

export function savePayrollMapping(
  session: AuthSession,
  batchId: number,
  mapping: Record<string, string>,
) {
  return apiRequest<{
    batch: {
      id: number;
      upload_status: string;
      mapping: Record<string, string>;
    };
  }>(
    `/payroll-batches/${batchId}/mapping?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({ mapping }),
    },
  );
}

export function validatePayrollBatch(session: AuthSession, batchId: number) {
  return apiRequest<{
    batch: {
      id: number;
      upload_status: string;
    };
    summary: {
      total_rows: number;
      valid_rows: number;
      error_rows: number;
      critical_errors: string[];
      normalized_rows: Array<{
        data: Record<string, unknown>;
        errors: string[];
      }>;
    };
  }>(
    `/payroll-batches/${batchId}/validate?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function importMissingEmployeesForPayrollBatch(session: AuthSession, batchId: number) {
  return apiRequest<PayrollMissingEmployeeImportResult>(
    `/payroll-batches/${batchId}/import-missing-employees?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function confirmPayrollBatch(session: AuthSession, batchId: number) {
  return apiRequest<PayrollBatchConfirmResult>(
    `/v2/payroll/batches/${batchId}/confirm?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function publishPayrollBatch(session: AuthSession, batchId: number) {
  return apiRequest<PayrollBatchPublishResult>(
    `/v2/payroll/batches/${batchId}/publish?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}
