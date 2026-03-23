import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SchedulerProvider } from './context/SchedulerContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import AuthGate from './components/Auth/AuthGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <SchedulerProvider>
          <App />
        </SchedulerProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
)
