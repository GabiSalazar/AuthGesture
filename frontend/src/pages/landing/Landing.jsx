import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from '../../components/ui'
import { Shield, UserPlus, Key, ArrowRight, Hand, Zap, Camera } from 'lucide-react'

function FeatureCard({ icon, title, description, stat }) {
  return (
    <div className="group relative p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-100 transition-all duration-300 h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
      
      <div className="relative">
        <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-xl mb-3 group-hover:scale-105 transition-transform duration-300">
          <div className="text-blue-700">
            {icon}
          </div>
        </div>
        
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          {title}
        </h3>
        
        {stat && (
          <div className="mb-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600 border border-green-100">
              {stat}
            </span>
          </div>
        )}
        
        <p className="text-sm text-gray-500 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  )
}

// Componente de Tooltip personalizado
function TooltipButton({ children, tooltip, ...props }) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative inline-block w-full">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Button {...props}>
          {children}
        </Button>
      </div>
      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 text-xs rounded-lg shadow-lg whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1 duration-200 border border-blue-200">
          {tooltip}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-blue-100" />
        </div>
      )}
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [adminClicks, setAdminClicks] = useState(0)
  const [showAccederTooltip, setShowAccederTooltip] = useState(false)

  const handleLogoClick = () => {
    setAdminClicks(prev => prev + 1)
    if (adminClicks + 1 >= 5) {
      navigate('admin/dashboard')
      setAdminClicks(0)
    }
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/20 overflow-auto">
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="px-6 lg:px-12 flex items-center justify-between h-16">
          
          <div 
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={handleLogoClick}
          >
            <div className="relative">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-10 w-10 transition-transform group-hover:scale-110 group-hover:rotate-6 duration-300" 
              />
              <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-xl font-black uppercase tracking-tight bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 bg-clip-text text-transparent">
              Auth-Gesture
            </span>
          </div>
          
          <div className="relative inline-block">
            <Button
              onClick={() => setShowLoginModal(true)}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md shadow-blue-400/20 hover:shadow-lg hover:shadow-blue-400/30 transition-all duration-300"
              onMouseEnter={() => setShowAccederTooltip(true)}
              onMouseLeave={() => setShowAccederTooltip(false)}
            >
              <Key className="w-4 h-4 mr-2" />
              Acceder
            </Button>
            {showAccederTooltip && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 text-xs rounded-lg shadow-lg whitespace-nowrap z-50 border border-blue-200">
                Accede con tu secuencia de gestos biométricos
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-blue-100" />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="min-h-screen flex items-center justify-center px-6 lg:px-12 pt-16">
        <div className="w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-8">
          
          {/* Columna Izquierda */}
          <div className="space-y-6">
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-full border border-blue-100 shadow-sm">
              <Zap className="w-4 h-4 text-blue-700 animate-pulse" />
              <span className="text-sm font-semibold text-blue-700">
                Autenticación Biométrica Inteligente
              </span>
            </div>

            {/* Título */}
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] text-gray-800">
                Sistema de Autenticación
                <span className="block mt-2 bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 bg-clip-text text-transparent">
                  por Gestos de Mano
                </span>
              </h1>
            </div>

            {/* Descripción */}
            <p className="text-lg text-gray-600 leading-relaxed">
              Tecnología biométrica basada en inteligencia artificial. 
              Autenticación segura, rápida y sin contacto mediante el 
              reconocimiento de gestos únicos de tu mano.
            </p>

            {/* Botones con tooltips mejorados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TooltipButton
                size="lg"
                onClick={() => navigate('/enrollment')}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300 h-12 group"
                tooltip="Crea tu cuenta y vincúlala con tu red social"
              >
                <UserPlus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Registrarse
              </TooltipButton>
              
              <TooltipButton
                size="lg"
                onClick={() => setShowLoginModal(true)}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300 h-12 group"
                tooltip="Accede con tu secuencia de gestos biométricos"
              >
                <Key className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Iniciar Sesión
              </TooltipButton>
            </div>

            {/* Link de recuperación */}
            <div className="pt-6 border-t border-gray-100">
              <button
                onClick={() => navigate('/forgot-sequence')}
                className="text-blue-500 hover:text-blue-600 transition-colors text-sm font-semibold flex items-center gap-2 group"
              >
                <Key className="w-4 h-4" />
                ¿Olvidaste tu secuencia de gestos?
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Columna Derecha - Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeatureCard
              icon={<Hand className="w-6 h-6" />}
              title="Biométrico"
              stat="99.2% precisión"
              description="Reconocimiento dual: analiza características anatómicas y patrones dinámicos de movimiento de tu mano."
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Seguro"
              stat="IA cifrada"
              description="Doble capa de seguridad con redes neuronales que procesan rasgos estáticos y secuencias temporales."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Rápido"
              stat="< 2 segundos"
              description="Procesamiento en tiempo real con detección instantánea y autenticación ultrarrápida."
            />
            <FeatureCard
              icon={<Camera className="w-6 h-6" />}
              title="Sin Contacto"
              stat="0 dispositivos"
              description="Solo necesitas tu cámara web. Sin dispositivos adicionales ni contacto físico."
            />
          </div>
        </div>
      </main>

      {/* Modal */}
      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Selecciona el Método de Autenticación"
      >
        <div className="space-y-3">
          <button
            onClick={() => navigate('/verification')}
            className="w-full p-5 border-2 border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-all group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 group-hover:scale-105 transition-all">
                <Shield className="w-5 h-5 text-blue-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-800 mb-0.5">
                  Verificación (1:1)
                </h3>
                <p className="text-sm text-gray-500">
                  Confirma tu identidad ingresando tu ID de usuario
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-700 group-hover:translate-x-1 transition-all" />
            </div>
          </button>

          <button
            onClick={() => navigate('/identification')}
            className="w-full p-5 border-2 border-gray-100 rounded-xl hover:border-green-200 hover:bg-green-50/50 transition-all group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-green-50 rounded-lg group-hover:bg-green-100 group-hover:scale-105 transition-all">
                <Hand className="w-5 h-5 text-green-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-800 mb-0.5">
                  Identificación (1:N)
                </h3>
                <p className="text-sm text-gray-500">
                  El sistema identificará automáticamente quién eres
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-700 group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <p className="text-sm text-gray-500 text-center">
            ¿Primera vez aquí?{' '}
            <button
              onClick={() => {
                setShowLoginModal(false)
                navigate('/enrollment')
              }}
              className="text-blue-500 hover:text-blue-600 font-semibold hover:underline"
            >
              Regístrate gratis
            </button>
          </p>
        </div>
      </Modal>
    </div>
  )
}