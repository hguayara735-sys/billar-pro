import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <span className="text-gray-400">Cargando...</span>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <DashboardPage />
}
