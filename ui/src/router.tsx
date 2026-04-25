import { createBrowserRouter } from 'react-router-dom';
import { Home } from './pages/Home';
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
    path: '*',
    element: <WorknestPage />,
  },
]);
