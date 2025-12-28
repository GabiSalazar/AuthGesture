import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Settings,
  Brain,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

// Importar secciones
import DashboardSection from '../dashboard/Dashboard'
import UsersManagement from './sections/UsersManagement'
import SystemManagement from './sections/SystemManagement'
import AINetworks from './sections/AINetworks'
import AuthenticationLogs from './sections/AuthenticationLogs'

export default function AdminPanel() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
    },
    {
      id: 'auth',
      name: 'Autenticaciones',
      icon: Shield,
      component: AuthenticationLogs
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
    <div className="fixed inset-0 flex bg-gray-50">
      
      {/* ========================================
          SIDEBAR LATERAL (DESKTOP)
      ======================================== */}
      <div 
        className={`hidden lg:flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
        style={{ backgroundColor: '#00ACC1' }}
      >
        {/* Logo y título - arriba */}
        <div className="p-6 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!sidebarCollapsed && (
                <div>
                  <h1 className="text-lg font-black uppercase tracking-tight text-white">
                    Auth-Gesture
                  </h1>
                  <p className="text-xs text-white/80 font-medium">
                    Admin Panel
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navegación - centro */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
                  transition-all duration-200
                  ${isActive
                    ? 'bg-white text-cyan-600 shadow-lg'
                    : 'text-white hover:bg-white/10'
                  }
                `}
                title={sidebarCollapsed ? tab.name : ''}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{tab.name}</span>}
              </button>
            )
          })}
        </nav>

        {/* Info admin y logout - abajo */}
        <div className="border-t border-white/20">
          {/* Info del admin */}
          {!sidebarCollapsed && (
            <div className="p-4 border-b border-white/20">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-cyan-600"
                  style={{ backgroundColor: 'white' }}
                >
                  {adminUsername.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {adminUsername}
                  </p>
                  <p className="text-xs text-white/80">
                    Administrador
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Botón logout */}
          <button
            onClick={handleLogout}
            className={`
              w-full flex items-center gap-3 px-4 py-4 text-sm font-semibold
              text-white hover:bg-red-500/20 transition-all
              ${sidebarCollapsed ? 'justify-center' : ''}
            `}
            title={sidebarCollapsed ? 'Cerrar sesión' : ''}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Cerrar Sesión</span>}
          </button>

          {/* Botón collapse/expand */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full p-3 flex items-center justify-center text-white hover:bg-white/10 transition-all border-t border-white/20"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* ========================================
          CONTENIDO PRINCIPAL
      ======================================== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header superior (móvil y desktop) */}
    
          {/* Título de sección activa */}
          <div className="flex items-center gap-3">
            {/* Botón menú móvil */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          </div>

        {/* Área de contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>

      {/* ========================================
          SIDEBAR MÓVIL (OVERLAY)
      ======================================== */}
      {mobileMenuOpen && (
        <>
          {/* Overlay oscuro */}
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Sidebar móvil */}
          <div 
            className="lg:hidden fixed inset-y-0 left-0 w-72 z-50 flex flex-col shadow-2xl"
            style={{ backgroundColor: '#00ACC1' }}
          >
          
            {/* Navegación móvil */}
            <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
                      transition-all duration-200
                      ${isActive
                        ? 'bg-white text-cyan-600 shadow-lg'
                        : 'text-white hover:bg-white/10'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{tab.name}</span>
                  </button>
                )
              })}
            </nav>

            {/* Footer móvil */}
            <div className="border-t border-white/20">
              {/* Info admin */}
              <div className="p-4 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-cyan-600"
                    style={{ backgroundColor: 'white' }}
                  >
                    {adminUsername.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">
                      {adminUsername}
                    </p>
                    <p className="text-xs text-white/80">
                      Administrador
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-4 text-sm font-semibold text-white hover:bg-red-500/20 transition-all"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}