import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../lib/api/auth'
import { Button, Modal } from '../../components/ui'
import GestureIcon from '../../components/GestureIcon'
import { 
  Mail, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  Key,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react'

export default function ForgotSequence() {
  const navigate = useNavigate()
  
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [userData, setUserData] = useState(null)
  
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  
  // Estados para reenviar código
  const [resendingCode, setResendingCode] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendSuccess, setResendSuccess] = useState(false)
  
  const handleSendOTP = async () => {
    try {
      setLoading(true)
      setError('')
      
      await authApi.sendForgotSequenceOTP(email)
      setStep(2)
      
      // Iniciar cooldown de 60 segundos
      setResendCooldown(60)
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Error enviando código')
    } finally {
      setLoading(false)
    }
  }
  
  const handleVerifyOTP = async () => {
    try {
      setLoading(true)
      setError('')
      
      const code = otpCode.join('')
      const result = await authApi.verifyForgotSequenceOTP(email, code)
      
      setUserData(result)
      setStep(3)
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Código inválido')
    } finally {
      setLoading(false)
    }
  }
  
  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    
    try {
      setResendingCode(true)
      setResendSuccess(false)
      setError('')
      
      await authApi.resendForgotSequenceOTP(email)
      
      setResendSuccess(true)
      
      // Cooldown de 60 segundos
      setResendCooldown(60)
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      setTimeout(() => setResendSuccess(false), 3000)
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al reenviar código')
    } finally {
      setResendingCode(false)
    }
  }
  
  const handleReenroll = async () => {
    try {
      setLoading(true)
      
      const result = await authApi.initiateReenrollment(userData.user_id)
      
      navigate('/enrollment', {
        state: {
          reenrollment: true,
          original_user_id: result.original_user_id,
          userData: result.user_data,
          personalityProfile: result.personality_profile,
          reusePersonality: result.reuse_personality
        }
      })
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Error iniciando re-registro')
      setLoading(false)
    }
  }
  
  const handleOTPChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    
    const newOTP = [...otpCode]
    newOTP[index] = value
    setOtpCode(newOTP)
    
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }
  
  const handleOTPKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const stepTitles = [
    'Verificar Email',
    'Código de Seguridad',
    'Tu Secuencia'
  ]

  return (
    <div className="fixed inset-0 flex">
      
      {/* ========================================
          PANEL LATERAL CYAN (DESKTOP)
      ======================================== */}
      <div 
        className="hidden lg:flex lg:w-2/5 h-screen sticky top-0 flex-col justify-between p-12"
        style={{ backgroundColor: '#0291B9' }}
      >
        {/* Título centrado - arriba */}
        <div className="flex justify-center">
          <span className="text-2xl font-black uppercase tracking-tight text-white select-none">
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

        {/* Badge paso actual - abajo */}
        <div className="flex justify-center">
          <div 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 rounded-full backdrop-blur-sm border border-white/30 animate-pulse"
          >
            <Key className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">
              Paso {step} de 3
            </span>
          </div>
        </div>
      </div>

      {/* ========================================
          ÁREA DE CONTENIDO
      ======================================== */}
      <div className="flex-1 bg-white h-screen overflow-y-auto">
        
        {/* Header móvil */}
        <div className="lg:hidden flex items-center gap-3 p-4 border-b">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="h-8 w-8" 
          />
          
          <span className="text-lg font-black uppercase tracking-tight bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
            Auth-Gesture
          </span>
        </div>

        {/* Contenido principal centrado */}
        <div className="max-w-4xl mx-auto px-6 py-12">
          
          {/* Wizard de pasos */}
          <div className="flex items-center justify-center mb-12">
            {[1, 2, 3].map((stepNum, index) => (
              <div key={stepNum} className="flex items-center">
                {/* Círculo del paso */}
                <div className="relative group">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                      step >= stepNum
                        ? 'text-white shadow-lg'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                    style={
                      step >= stepNum
                        ? { backgroundColor: '#05A8F9' }
                        : {}
                    }
                  >
                    {stepNum}
                  </div>
                  
                  {/* Tooltip */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-3 px-4 py-2 rounded-lg whitespace-nowrap text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-xl"
                    style={{ 
                      backgroundColor: '#05A8F9',
                      color: 'white'
                    }}
                  >
                    {stepTitles[stepNum - 1]}
                    <div 
                      className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent"
                      style={{ borderBottomColor: '#05A8F9' }}
                    />
                  </div>
                </div>
                
                {/* Línea conectora */}
                {index < 2 && (
                  <div
                    className={`w-24 h-1 mx-2 rounded-full transition-all duration-300 ${
                      step > stepNum ? '' : 'bg-gray-200'
                    }`}
                    style={
                      step > stepNum
                        ? { backgroundColor: '#05A8F9' }
                        : {}
                    }
                  />
                )}
              </div>
            ))}
          </div>

          {/* Card principal */}
          <div 
            className="bg-white rounded-3xl border-2 shadow-2xl p-8 sm:p-10"
            style={{ borderColor: '#E0F2FE' }}
          >
            
            {/* ========================================
                PASO 1: VERIFICAR EMAIL
            ======================================== */}
            {step === 1 && (
              <div className="space-y-8">
                {/* Título del paso */}
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <div 
                      className="p-3 rounded-full"
                      style={{ backgroundColor: '#F4FCFF' }}
                    >
                      <Mail className="w-8 h-8" style={{ color: '#05A8F9' }} />
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-gray-900">
                    Verificar email
                  </h2>
                  <p className="text-gray-600">
                    Ingresa tu email para recibir un código de verificación
                  </p>
                </div>

                {/* Línea divisora */}
                <div 
                  className="relative flex items-center justify-center my-8"
                >
                  <div 
                    className="absolute inset-0 flex items-center"
                    style={{ top: '50%' }}
                  >
                    <div 
                      className="w-full border-t"
                      style={{ borderColor: '#E0F2FE' }}
                    />
                  </div>
                  <div className="relative px-4 bg-white">
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                      Información de contacto
                    </span>
                  </div>
                </div>

                {/* Alerta de error */}
                {error && (
                  <div 
                    className="p-4 rounded-xl border-2 flex items-start gap-3"
                    style={{ 
                      backgroundColor: '#FEF2F2',
                      borderColor: '#FCA5A5'
                    }}
                  >
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-red-800">
                      {error}
                    </p>
                  </div>
                )}

                {/* Input de email */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail 
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      disabled={loading}
                      className="w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-medium"
                      style={{
                        borderColor: '#E0F2FE'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#05A8F9'
                        e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#E0F2FE'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Botón enviar */}
                <button
                  onClick={handleSendOTP}
                  disabled={loading || !email}
                  className="w-full py-4 text-white font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                    boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Enviando código...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar código</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {/* Link volver */}
                <div className="text-center pt-4">
                  <button
                    onClick={() => navigate('/')}
                    className="text-sm font-semibold inline-flex items-center gap-2 transition-colors group"
                    style={{ color: '#05A8F9' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#00ACC1'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#05A8F9'}
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Volver al inicio
                  </button>
                </div>
              </div>
            )}

            {/* ========================================
                PASO 2: CÓDIGO OTP
            ======================================== */}
            {step === 2 && (
              <div className="space-y-8">
                {/* Título del paso */}
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <div 
                      className="p-3 rounded-full"
                      style={{ backgroundColor: '#F4FCFF' }}
                    >
                      <ShieldCheck className="w-8 h-8" style={{ color: '#05A8F9' }} />
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-gray-900">
                    Código de seguridad
                  </h2>
                  <p className="text-gray-600">
                    Ingresa el código de 6 dígitos enviado a tu email
                  </p>
                </div>

                {/* Línea divisora */}
                <div 
                  className="relative flex items-center justify-center my-8"
                >
                  <div 
                    className="absolute inset-0 flex items-center"
                    style={{ top: '50%' }}
                  >
                    <div 
                      className="w-full border-t"
                      style={{ borderColor: '#E0F2FE' }}
                    />
                  </div>
                  <div className="relative px-4 bg-white">
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                      Verificación
                    </span>
                  </div>
                </div>

                {/* Info email */}
                <div 
                  className="text-center p-4 rounded-xl border-2"
                  style={{ 
                    backgroundColor: '#F4FCFF',
                    borderColor: '#6FBFDE'
                  }}
                >
                  <p className="text-sm">
                    Código enviado a:{' '}
                    <span className="font-bold" style={{ color: '#05A8F9' }}>
                      {email}
                    </span>
                  </p>
                </div>

                {/* Alerta de éxito reenvío */}
                {resendSuccess && (
                  <div 
                    className="p-4 rounded-xl border-2 flex items-center gap-3"
                    style={{ 
                      backgroundColor: '#F0FDF4',
                      borderColor: '#86EFAC'
                    }}
                  >
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-green-800">
                      ✓ Código reenviado exitosamente
                    </p>
                  </div>
                )}

                {/* Alerta de error */}
                {error && (
                  <div 
                    className="p-4 rounded-xl border-2 flex items-start gap-3"
                    style={{ 
                      backgroundColor: '#FEF2F2',
                      borderColor: '#FCA5A5'
                    }}
                  >
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-red-800">
                      {error}
                    </p>
                  </div>
                )}

                {/* Inputs OTP */}
                <div className="flex gap-3 justify-center py-4">
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength="1"
                      className="w-14 h-16 text-center text-2xl font-black border-2 rounded-xl focus:outline-none transition-all"
                      style={{
                        borderColor: digit ? '#05A8F9' : '#E0F2FE',
                        color: '#111827'
                      }}
                      value={digit}
                      onChange={(e) => handleOTPChange(index, e.target.value)}
                      onKeyDown={(e) => handleOTPKeyDown(index, e)}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#05A8F9'
                        e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = digit ? '#05A8F9' : '#E0F2FE'
                        e.target.style.boxShadow = 'none'
                      }}
                      disabled={loading}
                    />
                  ))}
                </div>

                {/* Botón reenviar código */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendingCode || resendCooldown > 0}
                    className="text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: '#05A8F9' }}
                    onMouseEnter={(e) => {
                      if (resendCooldown === 0 && !resendingCode) {
                        e.currentTarget.style.color = '#00ACC1'
                      }
                    }}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#05A8F9'}
                  >
                    {resendingCode ? (
                      'Reenviando...'
                    ) : resendCooldown > 0 ? (
                      `Reenviar en ${resendCooldown}s`
                    ) : (
                      'Reenviar código'
                    )}
                  </button>
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="flex-1 py-4 font-bold rounded-full transition-all duration-300 border-2 hover:scale-[1.02]"
                    style={{
                      backgroundColor: 'white',
                      borderColor: '#E0F2FE',
                      color: '#05A8F9'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F4FCFF'
                      e.currentTarget.style.borderColor = '#6FBFDE'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white'
                      e.currentTarget.style.borderColor = '#E0F2FE'
                    }}
                  >
                    <ArrowLeft className="w-5 h-5 inline mr-2" />
                    Atrás
                  </button>

                  <button
                    onClick={handleVerifyOTP}
                    disabled={loading || otpCode.some(d => !d)}
                    className="flex-1 py-4 text-white font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <>
                        <span>Verificar</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ========================================
                PASO 3: SECUENCIA RECUPERADA
            ======================================== */}
            {step === 3 && userData && (
              <div className="space-y-8">
                {/* Título del paso */}
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <div 
                      className="p-3 rounded-full"
                      style={{ backgroundColor: '#F0FDF4' }}
                    >
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-gray-900">
                    Tu secuencia
                  </h2>
                  <p className="text-gray-600">
                    Esta es tu secuencia de gestos registrada
                  </p>
                </div>

                {/* Línea divisora */}
                <div 
                  className="relative flex items-center justify-center my-8"
                >
                  <div 
                    className="absolute inset-0 flex items-center"
                    style={{ top: '50%' }}
                  >
                    <div 
                      className="w-full border-t"
                      style={{ borderColor: '#E0F2FE' }}
                    />
                  </div>
                  <div className="relative px-4 bg-white">
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                      Secuencia Biométrica
                    </span>
                  </div>
                </div>

                {/* Alert success */}
                <div 
                  className="p-4 rounded-xl border-2 flex items-center gap-3"
                  style={{ 
                    backgroundColor: '#F0FDF4',
                    borderColor: '#86EFAC'
                  }}
                >
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-bold text-green-800">
                    Tu secuencia de gestos es:
                  </p>
                </div>

                {/* Secuencia de gestos */}
                <div className="flex justify-center gap-8 py-6">
                  {userData.gesture_sequence.map((gesture, index) => (
                    <div key={index} className="text-center">
                      <div 
                        className="mb-3 text-xs font-bold uppercase tracking-wider"
                        style={{ color: '#6B7280' }}
                      >
                        Paso {index + 1}
                      </div>
                      <GestureIcon 
                        gesture={gesture} 
                        size="large" 
                        showLabel={true}
                      />
                    </div>
                  ))}
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => navigate('/')}
                    className="flex-1 py-4 font-bold rounded-full transition-all duration-300 border-2 hover:scale-[1.02]"
                    style={{
                      backgroundColor: 'white',
                      borderColor: '#E0F2FE',
                      color: '#05A8F9'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F4FCFF'
                      e.currentTarget.style.borderColor = '#6FBFDE'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white'
                      e.currentTarget.style.borderColor = '#E0F2FE'
                    }}
                  >
                    Ir a inicio
                  </button>

                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="flex-1 py-4 text-white font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    <span>Volver a registrarme</span>
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================
          MODAL DE CONFIRMACIÓN
      ======================================== */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
      >
        <div className="p-6 space-y-6">
          {/* Título del modal */}
          <div className="flex items-center gap-3">
            <div 
              className="p-3 rounded-full"
              style={{ backgroundColor: '#FFFBEB' }}
            >
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900">
              Confirmar Re-registro
            </h3>
          </div>

          {/* Alert warning */}
          <div 
            className="p-4 rounded-xl border-2"
            style={{ 
              backgroundColor: '#FFFBEB',
              borderColor: '#FCD34D'
            }}
          >
            <p className="font-bold text-gray-900 mb-2">
              Acción Importante
            </p>
            <p className="text-sm text-gray-700">
              Tu cuenta actual será desactivada y crearás una nueva con los mismos datos personales. 
              Deberás realizar nuevamente la captura biométrica de tus gestos.
            </p>
          </div>

          {/* Info adicional */}
          <p className="text-sm text-gray-600">
            Tu perfil de personalidad será conservado, por lo que no tendrás que completar el cuestionario nuevamente.
          </p>

          {/* Botones del modal */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowConfirmModal(false)}
              disabled={loading}
              className="flex-1 py-3 font-bold rounded-full transition-all duration-300 border-2 hover:scale-[1.02]"
              style={{
                backgroundColor: 'white',
                borderColor: '#E0F2FE',
                color: '#05A8F9'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F4FCFF'
                e.currentTarget.style.borderColor = '#6FBFDE'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white'
                e.currentTarget.style.borderColor = '#E0F2FE'
              }}
            >
              Cancelar
            </button>

            <button
              onClick={handleReenroll}
              disabled={loading}
              className="flex-1 py-3 text-white font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                'Sí, Continuar'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}