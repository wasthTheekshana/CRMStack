import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { TrialExpiredError } from './config/api'
import { useAuthStore } from './store/authStore'

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof TrialExpiredError) {
    useAuthStore.getState().setTrialExpired()
    event.preventDefault()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
