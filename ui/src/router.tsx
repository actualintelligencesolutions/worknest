import { Navigate, createBrowserRouter } from 'react-router-dom';
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
import { EmployeeLoginPage } from './pages/employee/EmployeeLoginPage';
import { EmployeePayslipDetailPage } from './pages/employee/EmployeePayslipDetailPage';
import { EmployeePayslipsPage } from './pages/employee/EmployeePayslipsPage';
import { loadEmployeeSession } from './services/employeeSession';
import { loadHrSession } from './services/hrSession';

function PublicOnlyRoute({ element }: { element: JSX.Element }) {
  if (loadHrSession()) {
    return <Navigate replace to="/app" />;
  }

  if (loadEmployeeSession()) {
    return <Navigate replace to="/employee/payslips" />;
  }

  return element;
}

function AdminRoute({ element }: { element: JSX.Element }) {
  return loadHrSession() ? element : <Navigate replace to="/login" />;
}

function EmployeePublicRoute({ element }: { element: JSX.Element }) {
  return loadEmployeeSession() ? <Navigate replace to="/employee/payslips" /> : element;
}

function EmployeeRoute({ element }: { element: JSX.Element }) {
  return loadEmployeeSession() ? element : <Navigate replace to="/employee/login" />;
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
    path: '/employee',
    element: <Navigate replace to="/employee/login" />,
  },
  {
    path: '/employee/login',
    element: <EmployeePublicRoute element={<EmployeeLoginPage />} />,
  },
  {
    path: '/employee/payslips',
    element: <EmployeeRoute element={<EmployeePayslipsPage />} />,
  },
  {
    path: '/employee/payslips/:id',
    element: <EmployeeRoute element={<EmployeePayslipDetailPage />} />,
  },
  {
    path: '*',
    element: <Navigate replace to="/" />,
  },
]);
