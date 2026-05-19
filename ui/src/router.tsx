import { Navigate, createBrowserRouter } from 'react-router-dom';
import { EmployeeLoginPage, EmployeePortalPage } from './pages/EmployeePortal';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { NewDashPage } from './pages/NewDash';
import { SiteOwnerInvitePage } from './pages/SiteOwnerInvite';
import {
  NewDashBranchSetupPage,
  NewDashHelpPage,
  NewDashOfficesPage,
  NewDashProfilePage,
  NewDashReportsPage,
  NewDashSetupWorkspacePage,
  NewDashSettingsPage,
  NewDashTeamPage,
} from './pages/NewDash/routes';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/login/:tenantId',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/invite/site-owner',
    element: <SiteOwnerInvitePage />,
  },
  {
    path: '/site/:tenantId/:officeCode/login',
    element: <EmployeeLoginPage />,
  },
  {
    path: '/site/:tenantId/:officeCode',
    element: <EmployeePortalPage />,
  },
  {
    path: '/new-dash',
    element: <NewDashPage />,
  },
  {
    path: '/new-dash/setup',
    element: <NewDashSetupWorkspacePage />,
  },
  {
    path: '/new-dash/offices',
    element: <NewDashOfficesPage />,
  },
  {
    path: '/new-dash/branches/:officeId/setup',
    element: <NewDashBranchSetupPage />,
  },
  {
    path: '/new-dash/branches/:officeId',
    element: <NewDashBranchSetupPage />,
  },
  {
    path: '/new-dash/branches/:officeId/payroll',
    element: <NewDashBranchSetupPage />,
  },
  {
    path: '/new-dash/branches/:officeId/employees',
    element: <NewDashBranchSetupPage />,
  },
  {
    path: '/new-dash/branches/:officeId/pins',
    element: <NewDashBranchSetupPage />,
  },
  {
    path: '/new-dash/branches/:officeId/access',
    element: <NewDashBranchSetupPage />,
  },
  {
    path: '/new-dash/team',
    element: <NewDashTeamPage />,
  },
  {
    path: '/new-dash/reports',
    element: <NewDashReportsPage />,
  },
  {
    path: '/new-dash/profile',
    element: <NewDashProfilePage />,
  },
  {
    path: '/new-dash/settings',
    element: <NewDashSettingsPage />,
  },
  {
    path: '/new-dash/help',
    element: <NewDashHelpPage />,
  },
  {
    path: '*',
    element: <Navigate replace to="/" />,
  },
]);
