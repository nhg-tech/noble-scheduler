import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SchedulerProvider } from './context/SchedulerContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SchedulerProvider>
      <App />
    </SchedulerProvider>
  </StrictMode>,
)
