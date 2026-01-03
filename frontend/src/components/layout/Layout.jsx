import { Link, useLocation } from 'react-router-dom'
import { Home, UserPlus, Shield, Search, LogOut } from 'lucide-react'
import { cn } from '../../utils/cn'

export default function Layout({ children }) {
  const location = useLocation()

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Registro', href: '/enrollment', icon: UserPlus },
    { name: 'Verificación', href: '/verification', icon: Shield },
    { name: 'Identificación', href: '/identification', icon: Search },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo y título */}
            <div className="flex items-center gap-3">
              <img src="/log.png" alt="Logo AUTH-GESTURE" className="h-10 w-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">AUTH-GESTURE</h1>
                <p className="text-xs text-gray-500">Sistema de Autenticación</p>
              </div>
            </div>

            {/* Navegación */}
            <nav className="flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                )
              })}
              
              {/* Botón de Salir */}
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors ml-2"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}