import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { OrderDraftProvider } from './context/OrderDraftContext.tsx'
import { ToastProvider } from './components/Toast.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* ToastProvider di paling luar agar AuthProvider & semua modul bisa memicu notifikasi */}
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <OrderDraftProvider>
            <App />
          </OrderDraftProvider>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
)