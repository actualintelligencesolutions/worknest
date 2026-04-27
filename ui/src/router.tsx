import { Navigate, createBrowserRouter } from 'react-router-dom';
import { DashboardPage } from './pages/Dashboard';
import { LocationSetupPage } from './pages/Dashboard/LocationSetupPage';
import { Home } from './pages/Home';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { WorknestPage } from './pages/worknest/WorknestPage';
import { loadHrSession } from './services/hrSession';

function PublicOnlyRoute({ element }: { element: JSX.Element }) {
  return loadHrSession() ? <Navigate replace to="/dashboard" /> : element;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/register',
    element: <PublicOnlyRoute element={<RegisterPage />} />,
  },
  {
    path: '/login',
    element: <PublicOnlyRoute element={<LoginPage />} />,
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
