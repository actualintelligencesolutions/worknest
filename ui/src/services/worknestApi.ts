import { apiRequest, type ApiEnvelope } from './apiClient';

const API_BASE_URL = 'https://worknest.actualintelligencesolutions.in/api';

export type Plan = {
  id: number;
  plan_code: string;
  name: string;
  price_cents: number;
  currency: string;
  description: string | null;
  status: string;
};

export type CompanyLocation = {
  id: number;
  tenant_id: string;
  location_type: 'main_office' | 'branch';
  name: string;
  status: string;
  created_at?: string;
};

export type LocationSetupResponse = {
  location: CompanyLocation;
  admin: {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
  };
  plan: Plan;
};

export type PayrollImportResponse = {
  import: {
    id: number;
    status: string;
    payroll_period_id: number;
  };
  headers: string[];
  sample_rows: Record<string, string>[];
  mapping_suggestions: Record<string, { source: string; confidence: string }>;
};

export type Payslip = {
  id: number;
  employee_code: string;
  employee_name: string;
  gross_pay: string;
  total_deductions: string;
  net_pay: string;
  status: string;
  period_month: number;
  period_year: number;
};

export type AuthSession = {
  token: string;
  tenantId: string;
  userName?: string;
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

export function createMainOffice(
  session: AuthSession,
  payload: {
    admin_name: string;
    admin_email: string;
    plan_id: number;
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

export function createBranch(
  session: AuthSession,
  payload: {
    branch_name: string;
    admin_name: string;
    admin_email: string;
    plan_id: number;
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

export function createPayrollPeriod(
  session: AuthSession,
  payload: { period_month: number; period_year: number },
) {
  return apiRequest<{ period: { id: number; status: string } }>(
    `/payroll-periods?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify(payload),
    },
  );
}

export async function uploadPayrollImport(
  session: AuthSession,
  payrollPeriodId: number,
  file: File,
) {
  const formData = new FormData();
  formData.append('payroll_period_id', String(payrollPeriodId));
  formData.append('payroll_file', file);

  const response = await fetch(
    `${API_BASE_URL}/payroll-imports?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: formData,
    },
  );
  const envelope =
    (await response.json()) as ApiEnvelope<PayrollImportResponse>;
  if (!response.ok || !envelope.success || envelope.data === null) {
    throw new Error(envelope.error?.message ?? 'Payroll upload failed');
  }

  return envelope.data;
}

export function saveImportMapping(
  session: AuthSession,
  importId: number,
  mapping: Record<string, string>,
) {
  return apiRequest<{ import: { id: number; status: string } }>(
    `/payroll-imports/${importId}/mapping?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'PUT',
      headers: authHeaders(session),
      body: JSON.stringify({ mapping }),
    },
  );
}

export function processImport(session: AuthSession, importId: number) {
  return apiRequest<{
    import: { id: number; status: string };
    summary: {
      total_rows: number;
      valid_rows: number;
      error_rows: number;
      critical_errors: string[];
    };
  }>(
    `/payroll-imports/${importId}/process?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function publishPeriod(session: AuthSession, periodId: number) {
  return apiRequest<{
    period: { id: number; status: string };
    generated_files: number;
  }>(
    `/payroll-periods/${periodId}/publish?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({}),
    },
  );
}

export function requestEmployeeOtp(tenantId: string, phone: string) {
  return apiRequest<{ challenge_id: number; dev_otp: string }>(
    `/auth/employee/request-otp?tenant=${encodeURIComponent(tenantId)}`,
    {
      method: 'POST',
      body: JSON.stringify({ phone }),
    },
  );
}

export function verifyEmployeeOtp(
  tenantId: string,
  challengeId: number,
  otpCode: string,
) {
  return apiRequest<{
    token: string;
    employee: {
      id: number;
      employee_code: string;
      name: string;
      phone: string;
    };
  }>(`/auth/employee/verify-otp?tenant=${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challengeId, otp_code: otpCode }),
  });
}

export function listPayslips(session: AuthSession) {
  return apiRequest<{ payslips: Payslip[] }>(
    `/payslips?tenant=${encodeURIComponent(session.tenantId)}`,
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
