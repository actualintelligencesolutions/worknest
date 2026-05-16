import { apiRequest } from './apiClient';

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

export type AuthSession = {
  token: string;
  tenantId: string;
  userName?: string;
  userType?: 'tenant_owner' | 'branch_admin' | 'employee';
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

export type RegistrationResult = {
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
    role?: string;
  };
  tenant: {
    tenant_id: string;
  };
  session: {
    token: string;
    session_type: 'web' | 'employee_portal';
  };
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
  plan: Pick<
    Plan,
    'id' | 'plan_code' | 'name' | 'price_cents' | 'currency'
  >;
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
      body: JSON.stringify(payload),
    },
  );
}

export function loginEmployee(
  tenantId: string,
  payload: {
    identifier: string;
    pin: string;
  },
) {
  return apiRequest<{
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
  }>(`/v2/auth/employee/login?tenant=${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getCurrentActor(session: AuthSession) {
  return apiRequest<{ actor: ActorProfile }>(
    `/v2/auth/me?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
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

export function getOffice(session: AuthSession, id: number) {
  return apiRequest<OfficeDetail>(
    `/offices/${id}?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
}

export function listPayrollBatches(session: AuthSession) {
  return apiRequest<{ batches: PayrollBatch[] }>(
    `/payroll-batches?tenant=${encodeURIComponent(session.tenantId)}`,
    {
      headers: authHeaders(session),
    },
  );
}
