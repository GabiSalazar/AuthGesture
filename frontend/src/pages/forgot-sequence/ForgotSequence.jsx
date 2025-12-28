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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full backdrop-blur-sm">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
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
        <div 
          className="lg:hidden flex items-center justify-between px-3 py-2 border-b"
          style={{ backgroundColor: '#0291B9' }}
        >
          <button
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: '#ffffffff' }} />
          </button>
          
          <span 
            className="absolute left-1/2 transform -translate-x-1/2 text-xl font-black uppercase tracking-tight"
            style={{ color: '#fbfbfbff' }}
          >
            Auth-Gesture
          </span>
          
          <video
            src="/videito.mp4"
            className="hidden sm:block w-25 h-16 object-contain opacity-95"
            autoPlay
            loop
            muted
            playsInline
          />
        </div>

        {/* Contenido principal */}
        <div className="w-full h-full px-8 py-8 lg:px-16 lg:py-12">
          
          {/* Wizard de pasos - CENTRADO SIN FLEX-1 */}
          <div className="w-full mb-6 sm:mb-8 lg:mb-12 px-3 sm:px-4 lg:px-6">
            <div className="max-w-2xl mx-auto">
              <div className="pt-0 lg:pt-8">
                <div className="flex items-center justify-center w-full">
                  {[1, 2, 3].map((stepNum, index) => (
                    <div key={stepNum} className="flex items-center">
                      
                      {/* Círculo del paso */}
                      <div className="relative group flex-shrink-0">
                        <div
                          className={`
                            w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10
                            rounded-full flex items-center justify-center 
                            font-bold transition-all cursor-pointer
                            text-[10px] sm:text-xs md:text-sm
                            ${step > stepNum 
                              ? 'text-white shadow-sm sm:shadow-md lg:shadow-lg' 
                              : step === stepNum 
                              ? 'text-white shadow-md sm:shadow-lg lg:shadow-xl md:scale-105 lg:scale-110' 
                              : 'bg-gray-200 text-gray-400'
                            }
                          `}
                          style={{ 
                            backgroundColor: step >= stepNum ? '#05A8F9' : undefined
                          }}
                        >
                          {step > stepNum ? (
                            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                          ) : (
                            stepNum
                          )}
                        </div>
                        
                        {/* Tooltip - SOLO DESKTOP con HOVER */}
                        <div className="hidden lg:block absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                          <div 
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg"
                            style={{ backgroundColor: '#05A8F9' }}
                          >
                            {stepTitles[stepNum - 1]}
                            <div 
                              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                              style={{ backgroundColor: '#05A8F9' }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Línea conectora */}
                      {index < 2 && (
                        <div 
                          className="w-16 sm:w-20 md:w-24 lg:w-28 h-[2px] sm:h-[2.5px] md:h-0.5 transition-colors mx-1 sm:mx-1.5 md:mx-2 lg:mx-3"
                          style={{ 
                            backgroundColor: step > stepNum ? '#05A8F9' : '#E5E7EB'
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================
              PASO 1: VERIFICAR EMAIL
          ======================================== */}
          {step === 1 && (
            <div className="max-w-4xl mx-auto">
              <div className="space-y-8">
                
                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                      Recuperar secuencia de gestos
                    </span>
                  </div>
                </div>

                {/* Alerta de error */}
                {error && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                  </div>
                )}

                {/* Input de email */}
                <div className="space-y-2">
                  <label className="block text-left text-xs font-semibold text-gray-700">
                    Correo electrónico
                  </label>
                  
                  <div className="relative">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300 bg-white border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                      <Mail className="w-5 h-5 flex-shrink-0 text-gray-400" />
                      
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        className="flex-1 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Botón enviar - ALINEADO A LA DERECHA */}
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleSendOTP}
                    disabled={loading || !email}
                    className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <span>Enviar código</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================
              PASO 2: CÓDIGO OTP
          ======================================== */}
          {step === 2 && (
            <div className="w-full">
              <div className="max-w-xl mx-auto space-y-4 sm:space-y-6 px-4">
                
                {/* Divider superior */}
                <div className="relative mb-6 sm:mb-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 sm:px-4 bg-white text-xs sm:text-sm font-semibold text-gray-500">
                      Verificación de código
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm sm:text-base lg:text-lg text-gray-600 mb-1 sm:mb-2 px-2">
                    Código enviado a:
                  </p>
                  <p className="text-base sm:text-lg lg:text-xl font-bold mb-6 sm:mb-8 break-all px-2" style={{ color: '#05A8F9' }}>
                    {email}
                  </p>
                </div>

                {/* Alerta de éxito reenvío */}
                {resendSuccess && (
                  <div className="mb-3 p-2.5 sm:p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs sm:text-sm text-green-700 font-medium">
                      ✓ Código reenviado exitosamente
                    </p>
                  </div>
                )}

                {/* Alerta de error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm font-semibold text-red-800">{error}</p>
                  </div>
                )}

                <div className="mb-4 sm:mb-6">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-3 sm:mb-4 text-center">
                    Código de 6 dígitos
                  </label>
                  
                  <div className="flex gap-1.5 sm:gap-2 lg:gap-3 justify-center px-2">
                    {otpCode.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                        disabled={loading}
                        className={`
                          w-9 h-11 sm:w-11 sm:h-13 lg:w-12 lg:h-14
                          text-center text-lg sm:text-xl lg:text-2xl font-bold rounded-lg
                          border-2 transition-all duration-200
                          ${digit
                            ? 'bg-cyan-50 text-cyan-700'
                            : 'border-gray-300 bg-white text-gray-900'
                          }
                          focus:outline-none focus:ring-2 sm:focus:ring-4
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        style={{
                          borderColor: digit ? '#05A8F9' : undefined,
                          boxShadow: digit ? '0 0 0 2px rgba(5, 168, 249, 0.1)' : undefined
                        }}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                {/* Botón VERIFICAR - TAMAÑO FIJO */}
                <div className="flex justify-center pt-2 sm:pt-4">
                  <button
                    onClick={handleVerifyOTP}
                    disabled={loading || otpCode.some(d => !d)}
                    className="w-auto max-w-[200px] sm:max-w-[240px] px-6 sm:px-8 py-2.5 sm:py-3 text-white font-bold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verificar</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="border-t-2 mt-6 sm:mt-8 pt-4 sm:pt-6 text-center" style={{ borderColor: '#F4FCFF' }}>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2">
                    ¿No recibiste el código?
                  </p>
                  
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendingCode || resendCooldown > 0}
                    className="text-xs sm:text-sm font-semibold hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: '#05A8F9' }}
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

              </div>
            </div>
          )}

          {/* ========================================
              PASO 3: SECUENCIA RECUPERADA
          ======================================== */}
          {step === 3 && userData && (
            <div className="max-w-4xl mx-auto">
              <div className="space-y-8">
                
                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                      Secuencia recuperada
                    </span>
                  </div>
                </div>

                {/* Alert success */}
                <div 
                  className="p-4 rounded-xl border-2 flex items-center gap-3"
                  style={{ 
                    backgroundColor: '#F0FDF4',
                    borderColor: '#10B981'
                  }}
                >
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-900">
                      Secuencia encontrada
                    </p>
                    <p className="text-xs text-green-700">
                      Esta es tu secuencia de gestos registrada
                    </p>
                  </div>
                </div>

                {/* Secuencia de gestos */}
                {/* <div className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8 py-4 sm:py-6">
                  {userData.gesture_sequence.map((gesture, index) => (
                    <div key={index} className="text-center">
                      <div className="mb-2 sm:mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                        Paso {index + 1}
                      </div>
                      <GestureIcon 
                        gesture={gesture} 
                        size="large" 
                        showLabel={true}
                      />
                    </div>
                  ))}
                </div> */}
                {/* Secuencia de gestos */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-6 py-3 sm:py-4 lg:py-5">
                  {userData.gesture_sequence.map((gesture, index) => (
                    <div key={index} className="text-center">
                      <div className="mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                        Gesto {index + 1}
                      </div>
                      
                      {/* IMAGEN*/}
                      <div className="mb-2">
                        <img 
                          src={`/${gesture}.png`}
                          alt={gesture.replace('_', ' ')}
                          className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-contain mx-auto block"
                        />
                      </div>
                      
                      {/* Nombre del gesto */}
                      <p className="text-[10px] sm:text-xs lg:text-sm font-bold" style={{ color: '#05A8F9' }}>
                        {gesture.replace('_', ' ')}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Botones */}
                <div className="flex flex-col items-center gap-3 pt-4">
                  {/* Botón PRINCIPAL arriba */}
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 text-sm tracking-wide flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    <span>Volver a registrarme</span>
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  {/* Botón SECUNDARIO abajo */}
                  <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 font-bold rounded-full transition-all duration-300 border-2 flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: 'white',
                      borderColor: '#ffffffff',
                      color: '#05A8F9'
                    }}
                  >
                    Ir a inicio
                  </button>
                </div>
              </div>
            </div>
          )}
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
              Acción importante
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
              className="flex-1 py-3 font-bold rounded-full transition-all duration-300 border-2"
              style={{
                backgroundColor: 'white',
                borderColor: '#E0F2FE',
                color: '#05A8F9'
              }}
            >
              Cancelar
            </button>

            <button
              onClick={handleReenroll}
              disabled={loading}
              className="flex-1 py-3 text-white font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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