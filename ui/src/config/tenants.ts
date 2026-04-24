import defaultTenant from '../../../config/tenants/default.json';
import clientA from '../../../config/tenants/client-a.json';
import clientB from '../../../config/tenants/client-b.json';

type PageConfig = {
  enabled: boolean;
  path: string;
  navLabelKey: string;
  titleKey: string;
  descriptionKey: string;
  components: string[];
};

export type TenantConfig = {
  tenantId: string;
  configVersion: number;
  hostnames: string[];
  branding: {
    appNameKey: string;
    taglineKey: string;
  };
  pages: Record<string, PageConfig>;
  components: Record<string, { enabled: boolean; order: number }>;
  featureFlags: {
    enableDAM: boolean;
    enableAnalytics: boolean;
  };
  translationKeys: Record<string, string>;
};

type TenantConfigJson = {
  tenant_id: string;
  config_version: number;
  hostnames: string[];
  branding: {
    app_name_key: string;
    tagline_key: string;
  };
  pages: Record<
    string,
    {
      enabled: boolean;
      path: string;
      nav_label_key: string;
      title_key: string;
      description_key: string;
      components: string[];
    }
  >;
  components: Record<string, { enabled: boolean; order: number }>;
  feature_flags: {
    enableDAM: boolean;
    enableAnalytics: boolean;
  };
  translation_keys: Record<string, string>;
};

function normalizeTenantConfig(config: TenantConfigJson): TenantConfig {
  return {
    tenantId: config.tenant_id,
    configVersion: config.config_version,
    hostnames: config.hostnames,
    branding: {
      appNameKey: config.branding.app_name_key,
      taglineKey: config.branding.tagline_key,
    },
    pages: Object.fromEntries(
      Object.entries(config.pages).map(([key, page]) => [
        key,
        {
          enabled: page.enabled,
          path: page.path,
          navLabelKey: page.nav_label_key,
          titleKey: page.title_key,
          descriptionKey: page.description_key,
          components: page.components,
        },
      ]),
    ) as TenantConfig['pages'],
    components: config.components,
    featureFlags: config.feature_flags,
    translationKeys: config.translation_keys,
  };
}

export const tenantConfigs: Record<string, TenantConfig> = {
  default: normalizeTenantConfig(defaultTenant),
  'client-a': normalizeTenantConfig(clientA),
  'client-b': normalizeTenantConfig(clientB),
};

export function resolveTenantConfig(
  hostname = window.location.hostname,
): TenantConfig {
  const hostTenant = hostname.split('.')[0];
  const hostnameTenant = Object.values(tenantConfigs).find((tenant) =>
    tenant.hostnames.includes(hostname),
  );

  return hostnameTenant ?? tenantConfigs[hostTenant] ?? tenantConfigs.default;
}
