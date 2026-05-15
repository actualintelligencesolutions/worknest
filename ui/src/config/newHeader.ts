export type NewHeaderNavItem = {
  id: 'dashboard' | 'offices' | 'team' | 'reports' | 'setup';
  path: string;
  labelKey: string;
};

export type NewHeaderProfileItem = {
  id: 'profile' | 'settings' | 'help';
  path: string;
  labelKey: string;
};

export const newHeaderBrandKey = 'newHeader.brand';

export const newHeaderNavItems: NewHeaderNavItem[] = [
  {
    id: 'dashboard',
    path: '/new-dash',
    labelKey: 'newHeader.navigation.dashboard',
  },
  {
    id: 'offices',
    path: '/new-dash/offices',
    labelKey: 'newHeader.navigation.offices',
  },
  {
    id: 'team',
    path: '/new-dash/team',
    labelKey: 'newHeader.navigation.team',
  },
  {
    id: 'reports',
    path: '/new-dash/reports',
    labelKey: 'newHeader.navigation.reports',
  },
];

export const newHeaderSetupNavItems: NewHeaderNavItem[] = [
  {
    id: 'setup',
    path: '/new-dash/setup',
    labelKey: 'newHeader.navigation.setup',
  },
];

export const newHeaderProfileItems: NewHeaderProfileItem[] = [
  {
    id: 'profile',
    path: '/new-dash/profile',
    labelKey: 'newHeader.profileMenu.profile',
  },
  {
    id: 'settings',
    path: '/new-dash/settings',
    labelKey: 'newHeader.profileMenu.settings',
  },
  {
    id: 'help',
    path: '/new-dash/help',
    labelKey: 'newHeader.profileMenu.help',
  },
];

export const newHeaderActionKeys = {
  navigationLabel: 'newHeader.navigation.label',
  mobileMenuLabel: 'newHeader.actions.openMenu',
  closeMenuLabel: 'newHeader.actions.closeMenu',
  searchLabel: 'newHeader.actions.search',
  notificationsLabel: 'newHeader.actions.notifications',
  profileLabel: 'newHeader.actions.profile',
};
