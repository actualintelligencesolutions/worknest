import { describe, expect, it } from 'vitest';
import { resolveTenantConfig } from './tenants';

describe('resolveTenantConfig', () => {
  it('falls back to the default tenant', () => {
    expect(resolveTenantConfig('unknown.test').tenantId).toBe('default');
  });

  it('resolves a tenant by hostname', () => {
    expect(resolveTenantConfig('example.com').tenantId).toBe('default');
  });
});
