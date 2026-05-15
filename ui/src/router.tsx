import { Navigate, createBrowserRouter } from 'react-router-dom';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { NewDashPage } from './pages/NewDash';
import {
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
    path: '/register',
    element: <RegisterPage />,
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
