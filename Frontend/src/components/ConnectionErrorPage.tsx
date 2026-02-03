import { ServerCrash, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ConnectionErrorPage() {
  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
            <div className="relative bg-white dark:bg-gray-800 rounded-full p-6 shadow-xl">
              <ServerCrash className="w-16 h-16 text-red-500" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Connection Failed
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Unable to connect to the server
          </p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            The application server is currently unavailable. This could be due to:
          </p>
          <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside text-left space-y-1">
            <li>Server is offline or restarting</li>
            <li>No internet connection</li>
            <li>Network firewall blocking access</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleRefresh}
            className="w-full"
            size="lg"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            If the problem persists, please contact your system administrator
          </p>
        </div>
      </div>
    </div>
  )
}
