import { createBrowserRouter } from 'react-router-dom';
import { DashboardPage } from './pages/Dashboard';
import { LocationSetupPage } from './pages/Dashboard/LocationSetupPage';
import { Home } from './pages/Home';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { WorknestPage } from './pages/worknest/WorknestPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    path: '/dashboard/main-office',
    element: <LocationSetupPage mode="main-office" />,
  },
  {
    path: '/dashboard/branches/new',
    element: <LocationSetupPage mode="branch" />,
  },
  {
    path: '*',
    element: <WorknestPage />,
  },
]);
