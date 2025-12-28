import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from '../../components/ui'
import { Shield, UserPlus, Key, ArrowRight, Hand, Zap, Search, Sparkles } from 'lucide-react'

function FeatureCard({ icon, title, description, stat, color = 'blue' }) {
  const colorStyles = {
    blue: {
      bg: '#EFF6FF',
      border: '#BFDBFE',
      iconBg: '#DBEAFE',
      iconColor: '#2563EB',
      statBg: '#DBEAFE',
      statBorder: '#93C5FD',
      statText: '#1E40AF'
    },
    cyan: {
      bg: '#ECFEFF',
      border: '#A5F3FC',
      iconBg: '#CFFAFE',
      iconColor: '#0891B2',
      statBg: '#CFFAFE',
      statBorder: '#67E8F9',
      statText: '#0E7490'
    },
    indigo: {
      bg: '#EEF2FF',
      border: '#C7D2FE',
      iconBg: '#E0E7FF',
      iconColor: '#4F46E5',
      statBg: '#E0E7FF',
      statBorder: '#A5B4FC',
      statText: '#3730A3'
    }
  }

  const style = colorStyles[color]

  return (
    <div 
      className="group relative p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:scale-105"
      style={{ 
        backgroundColor: style.bg,
        borderColor: style.border
      }}
    >
      <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
        <div 
          className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex items-center justify-center rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm flex-shrink-0"
          style={{ backgroundColor: style.iconBg }}
        >
          <div style={{ color: style.iconColor }} className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7">
            {icon}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-800 mb-1">
            {title}
          </h3>
          
          {stat && (
            <div className="mb-1.5 sm:mb-2">
              <span 
                className="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm border"
                style={{ 
                  backgroundColor: style.statBg,
                  borderColor: style.statBorder,
                  color: style.statText
                }}
              >
                {stat}
              </span>
            </div>
          )}
          
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

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
        <div 
          className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-full mt-2 px-4 py-2 rounded-lg shadow-xl whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1 duration-200 border-2"
          style={{ 
            background: 'linear-gradient(to right, #E0F2FE, #CFFAFE)',
            borderColor: '#67E8F9',
            color: '#0E7490'
          }}
        >
          <span className="text-xs font-semibold">{tooltip}</span>
          <div 
            className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent"
            style={{ borderBottomColor: '#67E8F9' }}
          />
        </div>
      )}
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [adminClicks, setAdminClicks] = useState(0)

  const handleLogoClick = () => {
    setAdminClicks(prev => prev + 1)
    if (adminClicks + 1 >= 5) {
      navigate('admin/dashboard')
      setAdminClicks(0)
    }
  }

  return (
    <div className="fixed inset-0 flex">
      
      {/* ========================================
          PANEL LATERAL CYAN (SOLO DESKTOP)
      ======================================== */}
      <div 
        className="hidden lg:flex lg:w-2/5 h-screen sticky top-0 flex-col justify-between p-12"
        style={{ backgroundColor: '#0291B9' }}
      >
        {/* Título centrado - arriba */}
        <div className="flex justify-center">
          <span className="text-2xl font-black uppercase tracking-tight text-white">
            Auth-Gesture
          </span>
        </div>

        {/* Logo/Video grande - centrado */}
        <div className="flex items-center justify-center flex-1">
          <video
            src="/videito.mp4"  
            className="w-124 h-124 object opacity-95"
            autoPlay
            loop
            muted
            playsInline
          />
        </div>

        {/* Mensaje informativo - abajo */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
            <span className="text-sm font-semibold text-white">
              Autenticación biométrica IA
            </span>
          </div>
        </div>
      </div>

      {/* ========================================
          ÁREA DE CONTENIDO PRINCIPAL
      ======================================== */}
      <div className="flex-1 bg-white h-screen overflow-y-auto">
        
        {/* Header móvil */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={handleLogoClick}
          >
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-8 w-8" 
            />
            <span className="text-lg font-black uppercase tracking-tight text-[#00ACC1]">
              Auth-Gesture
            </span>
          </div>
        
        </div>

        {/* Contenido principal centrado - RESPONSIVE */}
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] lg:min-h-screen px-4 sm:px-6 md:px-8 lg:px-16 py-8 sm:py-12">
          
          <div className="w-full max-w-5xl space-y-8 sm:space-y-12 md:space-y-16">
            
            {/* ========================================
                HERO SECTION - RESPONSIVE
            ======================================== */}
            <div className="text-center space-y-4 sm:space-y-6 md:space-y-8">
              
              {/* Título RESPONSIVE */}
              <div className="space-y-3 sm:space-y-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black leading-tight text-gray-600 px-2">
                  Sistema Biométrico de Autenticación por Gestos
                </h1>
              </div>

              {/* Descripción RESPONSIVE */}
              <p className="text-sm sm:text-base md:text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto px-4">
                Tecnología biométrica basada en inteligencia artificial. Autenticación segura, rápida y sin contacto mediante el reconocimiento de gestos únicos de tu mano.
              </p>

              {/* Botones principales - RESPONSIVE */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4 max-w-3xl mx-auto px-4">
                <TooltipButton
                  size="lg"
                  onClick={() => navigate('/enrollment')}
                  className="w-full sm:flex-1 text-white shadow-lg transition-all duration-300 px-6 sm:px-8 md:px-12 h-12 sm:h-14 group font-bold rounded-full text-sm sm:text-base"
                  style={{
                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                    boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                  }}
                  tooltip="Crea tu cuenta y vincúlala con tu red social"
                >
                  <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Registrarse
                </TooltipButton>
                
                <TooltipButton
                  size="lg"
                  onClick={() => setShowLoginModal(true)}
                  className="w-full sm:flex-1 text-white shadow-lg transition-all duration-300 px-6 sm:px-8 md:px-12 h-12 sm:h-14 group font-bold rounded-full text-sm sm:text-base"
                  style={{
                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                    boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                  }}
                  tooltip="Accede con tu secuencia de gestos biométricos"
                >
                  <Key className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Iniciar sesión
                </TooltipButton>
              </div>

              {/* LÍNEA + Link RESPONSIVE */}
              <div className="pt-6 sm:pt-8 max-w-3xl mx-auto px-4">
                {/* Línea separadora */}
                <div 
                  className="w-full h-px mb-4 sm:mb-6"
                  style={{ backgroundColor: '#E0F2FE' }}
                />
                
                {/* Link responsive */}
                <div className="text-center sm:text-left">
                  <button
                    onClick={() => navigate('/forgot-sequence')}
                    className="transition-colors text-xs sm:text-sm font-semibold inline-flex items-center gap-2 group"
                    style={{ color: '#0891B2' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#0E7490'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#0891B2'}
                  >
                    <Key className="w-3 h-3 sm:w-4 sm:h-4" />
                    ¿Olvidaste tu secuencia de gestos?
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================
                FEATURE CARDS - RESPONSIVE 1 columna mobile, 3 desktop
            ======================================== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5 2xl:gap-6 max-w-7xl px-4">
              <FeatureCard
                icon={<Hand className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />}
                title="Biométrico"
                stat="99.2% precisión"
                description="Reconocimiento dual: analiza características anatómicas y patrones dinámicos de movimiento de tu mano."
                color="cyan"
              />
              <FeatureCard
                icon={<Shield className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />}
                title="Seguro"
                stat="IA cifrada"
                description="Doble capa de seguridad con redes neuronales que procesan rasgos estáticos y secuencias temporales."
                color="cyan"
              />
              <FeatureCard
                icon={<Zap className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />}
                title="Rápido"
                stat="< 2 segundos"
                description="Procesamiento en tiempo real con detección instantánea y autenticación ultrarrápida."
                color="cyan"
              />
            </div>

          </div>
        </div>
      </div>

      {/* ========================================
          MODAL DE LOGIN - RESPONSIVE
      ======================================== */}
      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Selecciona el método de autenticación"
      >
        <div className="space-y-3 sm:space-y-4">
          
          {/* Opción Verificación - RESPONSIVE */}
          <button
            onClick={() => navigate('/verification')}
            className="w-full p-4 sm:p-6 border-2 rounded-xl sm:rounded-2xl transition-all group text-left hover:scale-105 duration-300"
            style={{ 
              backgroundColor: '#EFF6FF',
              borderColor: '#BFDBFE'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#DBEAFE'
              e.currentTarget.style.borderColor = '#93C5FD'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#EFF6FF'
              e.currentTarget.style.borderColor = '#BFDBFE'
            }}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div 
                className="p-2 sm:p-3 rounded-lg sm:rounded-xl group-hover:scale-110 transition-all shadow-sm flex-shrink-0"
                style={{ backgroundColor: '#DBEAFE' }}
              >
                <Shield className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#2563EB' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-0.5 sm:mb-1">
                  Verificación (1:1)
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Confirma tu identidad ingresando tu ID de usuario
                </p>
              </div>
              <ArrowRight 
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:translate-x-1 transition-all flex-shrink-0" 
                style={{ color: '#2563EB' }}
              />
            </div>
          </button>

          {/* Opción Identificación - RESPONSIVE */}
          <button
            onClick={() => navigate('/identification')}
            className="w-full p-4 sm:p-6 border-2 rounded-xl sm:rounded-2xl transition-all group text-left hover:scale-105 duration-300"
            style={{ 
              backgroundColor: '#ECFDF5',
              borderColor: '#A7F3D0'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#D1FAE5'
              e.currentTarget.style.borderColor = '#6EE7B7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ECFDF5'
              e.currentTarget.style.borderColor = '#A7F3D0'
            }}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div 
                className="p-2 sm:p-3 rounded-lg sm:rounded-xl group-hover:scale-110 transition-all shadow-sm flex-shrink-0"
                style={{ backgroundColor: '#D1FAE5' }}
              >
                <Search className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#059669' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-0.5 sm:mb-1">
                  Identificación (1:N)
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  El sistema identificará automáticamente quién eres
                </p>
              </div>
              <ArrowRight 
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:translate-x-1 transition-all flex-shrink-0" 
                style={{ color: '#059669' }}
              />
            </div>
          </button>
        </div>

        {/* Footer del modal */}
        <div 
          className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t-2"
          style={{ borderColor: '#E0F2FE' }}
        >
          <p className="text-xs sm:text-sm text-gray-600 text-center">
            ¿Primera vez aquí?{' '}
            <button
              onClick={() => {
                setShowLoginModal(false)
                navigate('/enrollment')
              }}
              className="font-bold hover:underline transition-colors"
              style={{ color: '#0891B2' }}
            >
              Regístrate gratis
            </button>
          </p>
        </div>
      </Modal>
    </div>
  )
}