import { apiRequest, type ApiEnvelope } from './apiClient';

const API_BASE_URL = 'https://worknest.actualintelligencesolutions.in/api';

export type Plan = {
  id: number;
  plan_code: string;
  name: string;
  price_cents: number;
  currency: string;
  description?: string | null;
  status?: string;
};

export type CompanyLocation = {
  id: number;
  tenant_id: string;
  location_type?: 'main_office' | 'branch';
  office_type?: 'main_office' | 'branch';
  name: string;
  status: string;
  created_at?: string;
  city?: string | null;
  state?: string | null;
};

export type LocationSetupResponse = {
  location: CompanyLocation;
  office?: CompanyLocation;
  admin: {
    id: number | null;
    name: string | null;
    email: string | null;
    role?: string | null;
    status: string | null;
  } | null;
  plan: Plan;
};

export type BranchDetail = {
  location: {
    id: number;
    tenant_id: string;
    location_type?: 'branch' | 'main_office';
    office_type?: 'branch' | 'main_office';
    name: string;
    status: string;
    created_at: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    city?: string | null;
    state?: string | null;
    timezone?: string | null;
  };
  office?: {
    id: number;
    tenant_id: string;
    office_type?: 'branch' | 'main_office';
    name: string;
    status: string;
  };
  plan: {
    id: number | null;
    plan_code: string | null;
    name: string | null;
    price_cents: number | null;
    currency: string | null;
  };
  admin: {
    id: number | null;
    name: string | null;
    email: string | null;
    status: string | null;
  } | null;
};

export type UserRecord = {
  id: number;
  tenant_id: string;
  office_id: number | null;
  employee_id: string | null;
  first_name?: string;
  last_name?: string | null;
  display_name?: string;
  name?: string;
  email: string | null;
  phone: string | null;
  user_type?: 'tenant_owner' | 'branch_admin' | 'employee';
  role?: string;
  status: string;
  created_at?: string;
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
};

export type PayrollBatchRecord = {
  id: number;
  user_id: number;
  employee_id: string;
  employee_name_snapshot: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  currency: string;
  record_status: string;
  earnings: Record<string, unknown>;
  deductions: Record<string, unknown>;
  validation_errors: unknown[];
};

export type PayrollBatchDetail = {
  batch: PayrollBatch & {
    mapping?: Record<string, string>;
    validation_summary?: PayrollValidationSummary | Record<string, unknown>;
    confirmed_by_user_id?: number | null;
    published_by_user_id?: number | null;
    confirmed_at?: string | null;
    published_at?: string | null;
  };
  office: {
    id: number;
    name: string;
    office_type: 'main_office' | 'branch';
    status: string;
    city?: string | null;
    state?: string | null;
  } | null;
  records: PayrollBatchRecord[];
};

export type PayrollBatchUploadResponse = {
  batch: {
    id: number;
    upload_status: string;
  };
  headers: string[];
  sample_rows: Record<string, string>[];
  mapping_suggestions: Record<string, { source: string; confidence: string }>;
};

export type PayrollValidationSummary = {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  critical_errors: string[];
  normalized_rows?: Array<{
    data: Record<string, unknown>;
    errors: string[];
  }>;
};

export type Payslip = {
  id: number;
  employee_code?: string;
  employee_id?: string;
  employee_name?: string;
  employee_name_snapshot?: string;
  gross_pay: string | number;
  total_deductions: string | number;
  net_pay: string | number;
  status: string;
  period_month: number;
  period_year: number;
};

export type AuthSession = {
  token: string;
  tenantId: string;
  userName?: string;
};

export type ActorProfile = {
  id: number;
  tenant_id: string;
  office_id: number | null;
  employee_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  user_type: 'tenant_owner' | 'branch_admin' | 'employee';
  status: string;
  office_ids: number[];
};

function authHeaders(session: AuthSession | null) {
  return session
    ? {
        Authorization: `Bearer ${session.token}`,
      }
    : {};
}

export function listPlans() {
  return apiRequest<{ plans: Plan[] }>('/plans');
}

export function checkWorkspaceAvailability(tenantId: string) {
  return apiRequest<{
    tenant_id: string;
    available: boolean;
    reason: 'reserved' | 'taken' | null;
  }>(`/companies/check-workspace?tenant_id=${encodeURIComponent(tenantId)}`);
}

export function registerCompany(payload: {
  company_name: string;
  tenant_id?: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  admin_password: string;
}) {
  return apiRequest<{
    tenant: { tenant_id: string; name: string };
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
      status: string;
    };
    verification: {
      challenge_id: number;
      channel: 'email';
      destination: string;
      email_sent: boolean;
      dev_otp?: string;
    };
    token?: string;
    next_step: string;
  }>('/companies/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyAdminEmailOtp(challengeId: number, otpCode: string) {
  return apiRequest<{
    token: string;
    tenant: { tenant_id: string };
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
      status: string;
    };
    next_step: string;
  }>('/auth/admin/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challengeId, otp_code: otpCode }),
  });
}

export function loginOwner(
  tenantId: string,
  payload: {
    email: string;
    password: string;
  },
) {
  return apiRequest<{
    token: string;
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
    };
  }>(`/auth/owner-login?tenant=${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginBranchAdmin(
  tenantId: string,
  payload: {
    email: string;
    password: string;
  },
) {
  return apiRequest<{
    token: string;
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
    };
  }>(`/auth/branch-login?tenant=${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginHrAdmin(
  tenantId: string,
  payload: {
    email: string;
    password: string;
  },
) {
  return apiRequest<{
    token: string;
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
    };
  }>(`/auth/hr-login?tenant=${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getCurrentActor(session: AuthSession) {
  return apiRequest<{ actor: ActorProfile }>(
    `/auth/me?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
}

export function logoutSession(session: AuthSession) {
  return apiRequest<{ revoked: boolean }>(
    `/auth/logout?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function submitContactEnquiry(payload: {
  name: string;
  company_name: string;
  email: string;
  phone: string;
  message: string;
}) {
  return apiRequest<{
    submitted: boolean;
    recipient: string;
  }>('/contact-enquiries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createMainOffice(
  session: AuthSession,
  payload: {
    name?: string;
    admin_name?: string;
    admin_email?: string;
    plan_id: number;
    city?: string;
    state?: string;
  },
) {
  return apiRequest<LocationSetupResponse>(
    `/main-office?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify(payload),
    },
  );
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

export function listOffices(session: AuthSession) {
  return apiRequest<{
    offices: CompanyLocation[];
    locations: CompanyLocation[];
    summary: {
      main_offices: number;
      branches: number;
      total: number;
    };
  }>(`/offices?tenant=${encodeURIComponent(session.tenantId)}`, {
    headers: authHeaders(session),
  });
}

export function createBranch(
  session: AuthSession,
  payload: {
    name?: string;
    branch_name?: string;
    office_code?: string;
    admin_name?: string;
    admin_email?: string;
    plan_id: number;
    city?: string;
    state?: string;
  },
) {
  return apiRequest<LocationSetupResponse>(
    `/branches?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify(payload),
    },
  );
}

export function getOffice(session: AuthSession, id: number) {
  return apiRequest<{
    office: BranchDetail['location'];
    location: BranchDetail['location'];
    plan: BranchDetail['plan'];
    admin: BranchDetail['admin'];
  }>(`/offices/${id}?tenant=${encodeURIComponent(session.tenantId)}`, {
    headers: authHeaders(session),
  });
}

export function getBranch(session: AuthSession, id: number) {
  return apiRequest<BranchDetail>(
    `/branches/${id}?tenant=${encodeURIComponent(session.tenantId)}`,
    { headers: authHeaders(session) },
  );
}

export function updateOffice(
  session: AuthSession,
  id: number,
  payload: Record<string, unknown>,
) {
  return apiRequest<{ office: CompanyLocation }>(
    `/offices/${id}?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(session),
      body: JSON.stringify(payload),
    },
  );
}

export function assignOfficePlan(
  session: AuthSession,
  id: number,
  planId: number,
) {
  return apiRequest<{
    office: CompanyLocation;
    plan: Plan;
  }>(`/offices/${id}/plans?tenant=${encodeURIComponent(session.tenantId)}`, {
    method: 'POST',
    headers: authHeaders(session),
    body: JSON.stringify({ plan_id: planId }),
  });
}

export function assignOfficeAdmins(
  session: AuthSession,
  id: number,
  userIds: number[],
) {
  return apiRequest<{
    office: CompanyLocation;
    assigned_user_ids: number[];
  }>(`/offices/${id}/admins?tenant=${encodeURIComponent(session.tenantId)}`, {
    method: 'POST',
    headers: authHeaders(session),
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export function listUsers(
  session: AuthSession,
  filters?: {
    office_id?: number | '';
    user_type?: string;
  },
) {
  const params = new URLSearchParams();
  params.set('tenant', session.tenantId);
  if (filters?.office_id) {
    params.set('office_id', String(filters.office_id));
  }
  if (filters?.user_type) {
    params.set('user_type', filters.user_type);
  }

  return apiRequest<{ users: UserRecord[] }>(`/users?${params.toString()}`, {
    headers: authHeaders(session),
  });
}

export function getUser(session: AuthSession, id: number) {
  return apiRequest<{ user: UserRecord }>(
    `/users/${id}?tenant=${encodeURIComponent(session.tenantId)}`,
    { headers: authHeaders(session) },
  );
}

export function createUser(
  session: AuthSession,
  payload: {
    user_type: 'branch_admin' | 'employee';
    office_id?: number | null;
    first_name: string;
    last_name?: string;
    display_name?: string;
    email?: string;
    phone?: string;
    employee_id?: string;
    password?: string;
    initial_pin?: string;
  },
) {
  return apiRequest<{ user: UserRecord }>(
    `/users?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify(payload),
    },
  );
}

export function updateUser(
  session: AuthSession,
  id: number,
  payload: Record<string, unknown>,
) {
  return apiRequest<{ user: UserRecord }>(
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
  id: number,
  pin: string,
) {
  return apiRequest<{ user: UserRecord; pin_reset: boolean }>(
    `/users/${id}/reset-pin?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({ pin }),
    },
  );
}

export function listPayrollBatches(
  session: AuthSession,
  filters?: { office_id?: number | '' },
) {
  const params = new URLSearchParams();
  params.set('tenant', session.tenantId);
  if (filters?.office_id) {
    params.set('office_id', String(filters.office_id));
  }

  return apiRequest<{ batches: PayrollBatch[] }>(
    `/payroll-batches?${params.toString()}`,
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

export async function uploadPayrollBatch(
  session: AuthSession,
  payload: {
    office_id: number;
    period_month: number;
    period_year: number;
    file: File;
  },
) {
  const formData = new FormData();
  formData.append('office_id', String(payload.office_id));
  formData.append('period_month', String(payload.period_month));
  formData.append('period_year', String(payload.period_year));
  formData.append('file', payload.file);

  const response = await fetch(
    `${API_BASE_URL}/payroll-batches?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: formData,
    },
  );

  const envelope =
    (await response.json()) as ApiEnvelope<PayrollBatchUploadResponse>;
  if (!response.ok || !envelope.success || envelope.data === null) {
    throw new Error(envelope.error?.message ?? 'Payroll upload failed');
  }

  return envelope.data;
}

export function saveBatchMapping(
  session: AuthSession,
  batchId: number,
  mapping: Record<string, string>,
) {
  return apiRequest<{
    batch: { id: number; upload_status: string; mapping: Record<string, string> };
  }>(
    `/payroll-batches/${batchId}/mapping?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({ mapping }),
    },
  );
}

export function validateBatch(session: AuthSession, batchId: number) {
  return apiRequest<{
    batch: { id: number; upload_status: string };
    summary: PayrollValidationSummary;
  }>(
    `/payroll-batches/${batchId}/validate?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function confirmBatch(session: AuthSession, batchId: number) {
  return apiRequest<{
    batch: { id: number; upload_status: string };
    records_created: number;
  }>(
    `/payroll-batches/${batchId}/confirm?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function publishBatch(session: AuthSession, batchId: number) {
  return apiRequest<{
    batch: { id: number; upload_status: string };
    summary: {
      employee_count: number;
      payslips_generated: number;
    };
  }>(
    `/payroll-batches/${batchId}/publish?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function listPayslips(session: AuthSession) {
  return apiRequest<{ payslips: Payslip[] }>(
    `/payslips?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
}

export function getPayslip(session: AuthSession, payslipId: number) {
  return apiRequest<{ payslip: Payslip }>(
    `/payslips/${payslipId}?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
}

export async function downloadPayslip(session: AuthSession, payslipId: number) {
  const response = await fetch(
    `${API_BASE_URL}/payslips/${payslipId}/download?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
  if (!response.ok) {
    throw new Error('Payslip download failed');
  }

  return response.blob();
}

export function loginEmployee(
  tenantId: string,
  payload: {
    employee_id: string;
    pin: string;
  },
) {
  return apiRequest<{
    token: string;
    user: {
      id: number;
      employee_id: string;
      name: string;
      office_id: number | null;
      user_type: 'employee';
    };
  }>(`/auth/employee-login?tenant=${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
