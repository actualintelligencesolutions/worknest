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

export function getCurrentActor(session: AuthSession) {
  return apiRequest<{ actor: ActorProfile }>(
    `/auth/me?tenant=${encodeURIComponent(session.tenantId)}`,
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
