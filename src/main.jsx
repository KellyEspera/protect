// ============================================================================
//  main.jsx  —  the app's entry point (first file that runs)
// ----------------------------------------------------------------------------
//  Mounts <App/> into the page and wraps it in the providers every page needs:
//    • QueryClientProvider — React Query cache for all server data (5-min stale)
//    • BrowserRouter       — client-side routing (URLs without page reloads)
//    • ToastContainer      — the pop-up success/error notifications
// ============================================================================

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 }, // 5 min cache
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
