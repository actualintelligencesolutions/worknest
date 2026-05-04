import { Navigate, createBrowserRouter, useParams } from 'react-router-dom';
import { Home } from './pages/Home';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { OfficeDetailPage } from './pages/app/OfficeDetailPage';
import { OfficesPage } from './pages/app/OfficesPage';
import { OverviewPage } from './pages/app/OverviewPage';
import { PayrollBatchPage } from './pages/app/PayrollBatchPage';
import { PayrollPage } from './pages/app/PayrollPage';
import { SettingsPage } from './pages/app/SettingsPage';
import { UsersPage } from './pages/app/UsersPage';
import { WorknestPage } from './pages/worknest/WorknestPage';
import { loadHrSession } from './services/hrSession';

function PublicOnlyRoute({ element }: { element: JSX.Element }) {
  return loadHrSession() ? <Navigate replace to="/app" /> : element;
}

function AdminRoute({ element }: { element: JSX.Element }) {
  return loadHrSession() ? element : <Navigate replace to="/login" />;
}

function RedirectLegacyBranchDetail() {
  const { id } = useParams();
  return <Navigate replace to={`/app/offices/${id ?? ''}`} />;
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
    path: '/app',
    element: <AdminRoute element={<OverviewPage />} />,
  },
  {
    path: '/app/offices',
    element: <AdminRoute element={<OfficesPage />} />,
  },
  {
    path: '/app/offices/new',
    element: <AdminRoute element={<OfficesPage />} />,
  },
  {
    path: '/app/offices/:id',
    element: <AdminRoute element={<OfficeDetailPage />} />,
  },
  {
    path: '/app/users',
    element: <AdminRoute element={<UsersPage />} />,
  },
  {
    path: '/app/payroll',
    element: <AdminRoute element={<PayrollPage />} />,
  },
  {
    path: '/app/payroll/:id',
    element: <AdminRoute element={<PayrollBatchPage />} />,
  },
  {
    path: '/app/settings',
    element: <AdminRoute element={<SettingsPage />} />,
  },
  {
    path: '/dashboard',
    element: <Navigate replace to="/app" />,
  },
  {
    path: '/dashboard/main-office',
    element: <Navigate replace to="/app/offices/new" />,
  },
  {
    path: '/dashboard/branches/new',
    element: <Navigate replace to="/app/offices/new?type=branch" />,
  },
  {
    path: '/dashboard/branches/:id',
    element: <RedirectLegacyBranchDetail />,
  },
  {
    path: '*',
    element: <WorknestPage />,
  },
]);
