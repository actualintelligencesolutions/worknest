import { createBrowserRouter } from 'react-router-dom';
import { WorknestPage } from './pages/worknest/WorknestPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <WorknestPage />,
  },
  {
    path: '*',
    element: <WorknestPage />,
  },
]);
