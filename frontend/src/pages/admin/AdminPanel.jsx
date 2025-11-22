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
  X
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header con Logo + Tabs + Salir */}
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

            {/* Botones de acción */}
            <div className="flex items-center gap-2">
              {/* Botón menú móvil */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Botón Salir */}
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="lg:hidden pb-4 space-y-1">
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