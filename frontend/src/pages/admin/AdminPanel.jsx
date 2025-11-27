import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../../components/ui'
import {
  LayoutDashboard,
  Users,
  Settings,
  Brain,
  LogOut,
  Menu,
  X,
  Shield
} from 'lucide-react'

// Importar secciones
import DashboardSection from '../dashboard/Dashboard'
import UsersManagement from './sections/UsersManagement'
import SystemManagement from './sections/SystemManagement'
import AINetworks from './sections/AINetworks'

export default function AdminPanel() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Obtener username desde sessionStorage
  const adminUsername = sessionStorage.getItem('admin_username') || 'admin'

  // Definición de tabs
  const tabs = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: LayoutDashboard,
      component: DashboardSection
    },
    {
      id: 'users',
      name: 'Usuarios',
      icon: Users,
      component: UsersManagement
    },
    {
      id: 'system',
      name: 'Sistema',
      icon: Settings,
      component: SystemManagement
    },
    {
      id: 'ai',
      name: 'IA y Redes',
      icon: Brain,
      component: AINetworks
    }
  ]

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setMobileMenuOpen(false)
  }

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión?\n\nSerás redirigido a la pantalla de login.')) {
      // Eliminar tokens de sessionStorage
      sessionStorage.removeItem('admin_token')
      sessionStorage.removeItem('admin_username')
      sessionStorage.removeItem('admin_expires_at')
      
      // Redirigir al login
      navigate('/admin/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header con Logo + Tabs + Info Admin + Salir */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo + Título */}
            <div className="flex items-center gap-2 sm:gap-3">
              <img src="/logo.png" alt="Logo" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">AUTH-GESTURE</h1>
                <p className="text-xs text-gray-500">Panel de Administración</p>
              </div>
              <div className="sm:hidden">
                <h1 className="text-base font-bold text-gray-900">Admin</h1>
              </div>
            </div>

            {/* Desktop Tabs - Ocultos en móvil */}
            <div className="hidden lg:flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 xl:px-6 py-3 sm:py-4 text-sm font-medium whitespace-nowrap
                      border-b-2 transition-all
                      ${isActive
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden xl:inline">{tab.name}</span>
                  </button>
                )
              })}
            </div>

            {/* Sección derecha: Info Admin + Botones */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Info del Admin - Visible en desktop */}
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-bold">
                    {adminUsername.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm font-semibold text-gray-900">{adminUsername}</p>
                  <p className="text-xs text-gray-500">Administrador</p>
                </div>
              </div>

              {/* Botón menú móvil */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Botón Salir con confirmación */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-all shadow-sm hover:shadow"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="lg:hidden pb-4 space-y-1 border-t border-gray-100 pt-4">
              {/* Info del admin en móvil */}
              <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold">
                    {adminUsername.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{adminUsername}</p>
                  <p className="text-xs text-gray-500">Administrador</p>
                </div>
              </div>

              {/* Tabs en móvil */}
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                      transition-all
                      ${isActive
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-500'
                        : 'text-gray-600 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contenido de la sección activa */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  )
}