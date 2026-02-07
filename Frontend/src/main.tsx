import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './i18n'
import App from './App.tsx'
import { ConnectionErrorPage } from './components/ConnectionErrorPage'
import { apiClient } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Never retry 429 rate-limit errors
        if (error?.response?.status === 429) return false
        return failureCount < 1
      },
      staleTime: 0, // Changed from 5 minutes to 0 for fresh data
    },
  },
})

function AppWithConnectionCheck() {
  const [hasConnectionError, setHasConnectionError] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check connection on mount
    const checkConnection = async () => {
      try {
        await apiClient.get('/health')
        setHasConnectionError(false)
      } catch (error: any) {
        // 429 means server is alive — not a connection error
        if (error.response?.status === 429) {
          setHasConnectionError(false)
        } else if (
          error.code === 'ERR_NETWORK' ||
          error.code === 'ERR_CONNECTION_REFUSED' ||
          error.message === 'Network Error' ||
          !error.response
        ) {
          setHasConnectionError(true)
        }
      } finally {
        setIsChecking(false)
      }
    }

    checkConnection()

    // Add response interceptor to detect connection errors
    const interceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.code === 'ERR_NETWORK' ||
          error.code === 'ERR_CONNECTION_REFUSED' ||
          error.message === 'Network Error' ||
          !error.response
        ) {
          setHasConnectionError(true)
        }
        return Promise.reject(error)
      }
    )

    return () => {
      apiClient.interceptors.response.eject(interceptor)
    }
  }, [])

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (hasConnectionError) {
    return <ConnectionErrorPage />
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppWithConnectionCheck />
    </QueryClientProvider>
  </StrictMode>,
)
