import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../../components/ui'
import {
  LayoutDashboard,
  Users,
  Settings,  // ← AGREGADO
  LogOut
} from 'lucide-react'

// Importar secciones
import DashboardSection from '../dashboard/Dashboard'
import UsersManagement from './sections/UsersManagement'
import SystemManagement from './sections/SystemManagement'  // ← AGREGADO

export default function AdminPanel() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')

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
    }  // ← AGREGADO TODO ESTE OBJETO
  ]

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header con Logo + Tabs + Salir */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            
            {/* Logo + Título */}
            <div className="flex items-center gap-3 py-3">
              <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">BiometricAuth</h1>
                <p className="text-xs text-gray-500">Panel de Administración</p>
              </div>
            </div>

            {/* Tabs de navegación */}
            <div className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap
                      border-b-2 transition-all
                      ${isActive
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.name}
                  </button>
                )
              })}
            </div>

            {/* Botón Salir */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>

          </div>
        </div>
      </div>

      {/* Contenido de la sección activa */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  )
}