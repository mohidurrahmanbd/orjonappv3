import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AdminOnlyApp from './app/AdminOnlyApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminOnlyApp />
  </StrictMode>,
);
