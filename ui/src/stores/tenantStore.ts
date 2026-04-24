import { create } from 'zustand';
import { resolveTenantConfig, type TenantConfig } from '../config/tenants';

type TenantState = {
  tenant: TenantConfig;
  setTenant: (tenant: TenantConfig) => void;
};

export const useTenantStore = create<TenantState>((set) => ({
  tenant: resolveTenantConfig(),
  setTenant: (tenant) => set({ tenant }),
}));
