import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { enrollmentApi } from '../../lib/api/enrollment'
import PersonalityQuestionnaire from './PersonalityQuestionnaire'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from '../../components/ui'
import WebcamCapture from '../../components/camera/WebcamCapture'
import { UserPlus, CheckCircle, CheckCircle2, XCircle, Camera, Hand, AlertCircle, ArrowRight, User, IdCard, ArrowLeft, Mail, Phone, Calendar, Users, Loader2 } from 'lucide-react'
export default function Enrollment() {
  const navigate = useNavigate()
  const [step, setStep] = useState('form')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [selectedGestures, setSelectedGestures] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [userId, setUserId] = useState(null)
  const [sessionStatus, setSessionStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Estados de validación
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [ageTouched, setAgeTouched] = useState(false)
  const [genderTouched, setGenderTouched] = useState(false)

  const [usernameError, setUsernameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [ageError, setAgeError] = useState('')
  const [genderError, setGenderError] = useState('')

  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false)

  const [emailVerificationPending, setEmailVerificationPending] = useState(false)

  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', ''])
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [codeError, setCodeError] = useState('')

  const [resendingCode, setResendingCode] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendSuccess, setResendSuccess] = useState(false)

  const availableGestures = [
    'Open_Palm',
    'Closed_Fist',
    'Victory',
    'Thumb_Up',
    'Thumb_Down',
    'Pointing_Up',
    'ILoveYou'
  ]

  // Validación de username
  const validateUsername = (value) => {
    if (!value.trim()) {
      return 'El nombre completo es requerido'
    }
    if (value.length < 10) {
      return 'El nombre debe tener al menos 10 caracteres'
    }
    return ''
  }

  const validateEmail = (value) => {
    if (!value.trim()) {
      return 'El email es requerido'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      return 'Email inválido'
    }
    return ''
  }

  const validatePhone = (value) => {
    if (!value.trim()) {
      return 'El teléfono es requerido'
    }
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length !== 10) {
      return 'El teléfono debe tener exactamente 10 dígitos'
    }
    return ''
  }

  const validateAge = (value) => {
    if (!value) {
      return 'La edad es requerida'
    }
    const ageNum = parseInt(value)
    if (isNaN(ageNum) || ageNum < 5 || ageNum > 80) {
      return 'Edad inválida (debe estar entre 5 y 80 años)'
    }
    return ''
  }

  const validateGender = (value) => {
    if (!value) {
      return 'Debe seleccionar un género'
    }
    if (!['Femenino', 'Masculino'].includes(value)) {
      return 'Género inválido'
    }
    return ''
  }

  const validateEmailUnique = async () => {
    const emailValue = email.trim().toLowerCase()
    
    if (!emailValue || !emailValue.includes('@')) {
      setEmailError('Email inválido')
      return false
    }
    
    try {
      const response = await enrollmentApi.validateUnique('email', emailValue)
      
      if (!response.is_unique) {
        setEmailError('Este email ya está registrado')
        return false
      }
      
      setEmailError('')
      return true
      
    } catch (error) {
      console.error('Error validando email:', error)
      setEmailError('Error validando email')
      return false
    }
  }

  const validatePhoneUnique = async () => {
    const phoneValue = phoneNumber.trim()
    
    if (!phoneValue || phoneValue.length < 7) {
      setPhoneError('Teléfono inválido')
      return false
    }
    
    try {
      const response = await enrollmentApi.validateUnique('phone_number', phoneValue)
      
      if (!response.is_unique) {
        setPhoneError('Este teléfono ya está registrado')
        return false
      }
      
      setPhoneError('')
      return true
      
    } catch (error) {
      console.error('Error validando teléfono:', error)
      setPhoneError('Error validando teléfono')
      return false
    }
  }

  const handleUsernameChange = (e) => {
    const value = e.target.value
    setUsername(value)
    if (usernameTouched) {
      setUsernameError(validateUsername(value))
    }
  }

  const handleUsernameBlur = () => {
    setUsernameTouched(true)
    setUsernameError(validateUsername(username))
  }

  const handleEmailChange = (e) => {
    const value = e.target.value
    setEmail(value)
    if (emailTouched) {
      setEmailError(validateEmail(value))
    }
  }

  const handleEmailBlur = () => {
    setEmailTouched(true)
    setEmailError(validateEmail(email))
    if (!validateEmail(email)) {
      validateEmailUnique()
    }
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value
    setPhoneNumber(value)
    if (phoneTouched) {
      setPhoneError(validatePhone(value))
    }
  }

  const handlePhoneBlur = () => {
    setPhoneTouched(true)
    setPhoneError(validatePhone(phoneNumber))
    if (!validatePhone(phoneNumber)) {
      validatePhoneUnique()
    }
  }

  const handleAgeChange = (e) => {
    const value = e.target.value
    setAge(value)
    if (ageTouched) {
      setAgeError(validateAge(value))
    }
  }

  const handleAgeBlur = () => {
    setAgeTouched(true)
    setAgeError(validateAge(age))
  }

  const handleGenderChange = (e) => {
    const value = e.target.value
    setGender(value)
    if (genderTouched) {
      setGenderError(validateGender(value))
    }
  }

  const handleGenderBlur = () => {
    setGenderTouched(true)
    setGenderError(validateGender(gender))
  }

  const handleGestureToggle = (gesture) => {
    if (selectedGestures.includes(gesture)) {
      setSelectedGestures(selectedGestures.filter(g => g !== gesture))
    } else if (selectedGestures.length < 3) {
      setSelectedGestures([...selectedGestures, gesture])
    }
  }

  const handleStartEnrollment = async () => {
    setUsernameTouched(true)
    setEmailTouched(true)
    setPhoneTouched(true)
    setAgeTouched(true)
    setGenderTouched(true)
    
    const usernameErr = validateUsername(username)
    const emailErr = validateEmail(email)
    const phoneErr = validatePhone(phoneNumber)
    const ageErr = validateAge(age)
    const genderErr = validateGender(gender)
    
    setUsernameError(usernameErr)
    setEmailError(emailErr)
    setPhoneError(phoneErr)
    setAgeError(ageErr)
    setGenderError(genderErr)
    
    if (usernameErr || emailErr || phoneErr || ageErr || genderErr || selectedGestures.length !== 3) {
      setError('Por favor completa todos los campos correctamente')
      return
    }
    
    const emailUnique = await validateEmailUnique()
    const phoneUnique = await validatePhoneUnique()
    
    if (!emailUnique || !phoneUnique) {
      setError('Email o teléfono ya registrados')
      return
    }

    try {
      setLoading(true)
      
      // Llamar al backend (enviará email automáticamente)
      const response = await enrollmentApi.startEnrollment(
        username, 
        email, 
        phoneNumber, 
        parseInt(age), 
        gender, 
        selectedGestures
      )
      
      setSessionId(response.session_id)
      
      if (response.user_id) {
        setUserId(response.user_id)
        console.log('✅ User ID guardado:', response.user_id)
      }
      
      console.log('✅ Email de verificación enviado a:', email)
      console.log('Session ID:', response.session_id)
      
      setStep('code-verification')
      setEmailVerificationPending(true)
      setError(null)
      
      // Iniciar cooldown de 60 segundos desde el primer envío
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
      console.error('❌ Error al iniciar enrollment:', err)
      setError(err.response?.data?.detail || 'Error al iniciar enrollment')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    const code = verificationCode.join('')
    
    if (code.length !== 6) {
      setCodeError('Ingresa el código completo')
      return
    }
    
    try {
      setVerifyingCode(true)
      setCodeError('')
      
      const response = await enrollmentApi.verifyCode(userId, code)
      
      if (response.success) {
        console.log('✅ Código verificado correctamente')
        setEmailVerificationPending(false)
        setStep('capture')
      } else {
        setCodeError(response.message || 'Código inválido')
      }
      
    } catch (err) {
      console.error('❌ Error verificando código:', err)
      setCodeError(err.response?.data?.detail || 'Error verificando código')
    } finally {
      setVerifyingCode(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    
    try {
      setResendingCode(true)
      setResendSuccess(false)
      setCodeError('') // Limpiar error anterior
      
      const response = await enrollmentApi.resendCode(userId, username, email)
      
      // Verificar si fue exitoso
      if (response.success) {
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
      } else {
        // Si falló, mostrar el mensaje de error
        setCodeError(response.message || 'Error al reenviar código')
      }
      
    } catch (err) {
      console.error('❌ Error reenviando código:', err)
      setCodeError(err.message || 'Error al reenviar código')
    } finally {
      setResendingCode(false)
    }
  }

  const handleCodeChange = (index, value) => {
    // Solo permitir números
    if (value && !/^\d$/.test(value)) return
    
    const newCode = [...verificationCode]
    newCode[index] = value
    setVerificationCode(newCode)
    
    // Auto-focus al siguiente input
    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`)?.focus()
    }
    
    // Limpiar error al escribir
    if (codeError) setCodeError('')
  }

  const handleCodeKeyDown = (index, e) => {
    // Backspace: volver al input anterior
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus()
    }
    
    // Enter: verificar código
    if (e.key === 'Enter' && verificationCode.join('').length === 6) {
      handleVerifyCode()
    }
  }

  const handleCodePaste = (e) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    
    if (paste.length === 6) {
      setVerificationCode(paste.split(''))
      document.getElementById('code-5')?.focus()
    }
  }

  const handleFrameCapture = async (frameData) => {
    if (!sessionId) return

    try {
      const response = await enrollmentApi.processFrame(sessionId, frameData)
      
      console.log('📊 Respuesta del servidor:', response)
      
      setSessionStatus({
        ...response,
        progress: response.progress_percentage || 
                  ((response.samples_captured || 0) / (response.samples_needed || 21)) * 100,
        current_gesture: response.current_gesture,
        samples_collected: response.samples_captured || 0,
        samples_needed: response.samples_needed || 21,
        message: response.message || response.feedback || 'Procesando...',
        session_completed: response.all_gestures_completed || response.session_completed || false
      })

      // if (response.all_gestures_completed || response.session_completed) {
      //   console.log('🎉 ENROLLMENT COMPLETADO!')
        
      //   try {
      //     const bootstrapStatus = await enrollmentApi.getBootstrapStatus()
      //     setSessionStatus(prev => ({
      //       ...prev,
      //       can_train_now: bootstrapStatus.can_train && !bootstrapStatus.networks_trained
      //     }))
      //   } catch (err) {
      //     console.error('Error checking bootstrap status:', err)
      //   }
        
      //   setStep('success')
      // }
      if (response.all_gestures_completed || response.session_completed) {
        console.log('ENROLLMENT COMPLETADO - Iniciando finalizacion')
        
        try {
          // Verificar que tenemos el userId guardado desde el inicio
          if (!userId) {
            console.error('No se encontro user_id guardado')
            setError('Error: No se pudo obtener el ID de usuario')
            return
          }
          
          console.log('Usando User ID guardado:', userId)
          
          // Verificar bootstrap status
          try {
            const bootstrapStatus = await enrollmentApi.getBootstrapStatus()
            console.log('Bootstrap status:', bootstrapStatus)
            
            setSessionStatus(prev => ({
              ...prev,
              can_train_now: bootstrapStatus.can_train && !bootstrapStatus.networks_trained
            }))
          } catch (err) {
            console.error('Error checking bootstrap status:', err)
            // No detener el flujo si falla el bootstrap check
          }
          
          // Pequeña pausa
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Mostrar mensaje de confirmación
          console.log('Mostrando pagina de confirmacion')
          setStep('confirmation')
          
        } catch (err) {
          console.error('Error en proceso de finalizacion:', err)
          setError(err.response?.data?.detail || 'Error completando el enrollment')
        }
      }

    } catch (err) {
      console.error('❌ Error procesando frame:', err)
      setError(err.message || 'Error procesando frame')
    }
  }

  const handleCancel = async () => {
    if (sessionId) {
      try {
        await enrollmentApi.cancelEnrollment(sessionId)
      } catch (err) {
        console.error('Error cancelando:', err)
      }
    }
    resetForm()
  }

  const resetForm = () => {
    setStep('form')
    setUsername('')
    setEmail('')
    setPhoneNumber('')
    setAge('')
    setGender('')
    setSelectedGestures([])
    setSessionId(null)
    setSessionStatus(null)
    setError(null)
    setUsernameTouched(false)
    setEmailTouched(false)
    setPhoneTouched(false)
    setAgeTouched(false)
    setGenderTouched(false)
    setUsernameError('')
    setEmailError('')
    setPhoneError('')
    setAgeError('')
    setGenderError('')
  }

  const handleGoBack = () => {
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Header con Flecha (izq) y Logo+Nombre (der) */}
        <div className="mb-8 flex items-center justify-between">
          {/* Flecha - Lado Izquierdo */}
          <button
            onClick={handleGoBack}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          
          {/* Logo y Nombre - Lado Derecho */}
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-10 w-10" 
            />
            <span className="text-2xl font-black uppercase tracking-tight bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 bg-clip-text text-transparent">
              Auth-Gesture
            </span>
          </div>
        </div>

        {/* STEP: FORM */}
        {step === 'form' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              
              {/* Header Card - Color más suave */}
              <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 border-b border-gray-200 px-8 py-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <UserPlus className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Información del usuario</h2>
                    <p className="text-gray-600 text-sm mt-0.5">
                      Completa tus datos y selecciona tu secuencia biométrica
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                
                {/* Datos Personales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Input: Nombre Completo */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      Nombre Completo
                    </label>
                    
                    <div className="relative">
                      <div className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300 bg-white
                        ${usernameError && usernameTouched ? 'border-red-300 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100' : ''}
                        ${!usernameError && usernameTouched && username ? 'border-green-300 focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-100' : ''}
                        ${!usernameTouched ? 'border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100' : ''}
                      `}>
                        <User className={`
                          w-5 h-5 flex-shrink-0
                          ${usernameError && usernameTouched ? 'text-red-500' : ''}
                          ${!usernameError && usernameTouched && username ? 'text-green-500' : ''}
                          ${!usernameTouched ? 'text-gray-400' : ''}
                        `} />
                        
                        <input
                          type="text"
                          value={username}
                          onChange={handleUsernameChange}
                          onBlur={handleUsernameBlur}
                          className="flex-1 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                          placeholder="Escribe tu nombre completo..."
                        />
                        
                        {!usernameError && usernameTouched && username && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        {usernameError && usernameTouched && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    
                    {usernameError && usernameTouched && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-600 font-medium">{usernameError}</p>
                      </div>
                    )}
                  </div>

                  {/* Input: Email */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                      Email
                    </label>
                    
                    <div className="relative">
                      <div className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300 bg-white
                        ${emailError && emailTouched ? 'border-red-300 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100' : ''}
                        ${!emailError && emailTouched && email ? 'border-green-300 focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-100' : ''}
                        ${!emailTouched ? 'border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100' : ''}
                      `}>
                        <Mail className={`
                          w-5 h-5 flex-shrink-0
                          ${emailError && emailTouched ? 'text-red-500' : ''}
                          ${!emailError && emailTouched && email ? 'text-green-500' : ''}
                          ${!emailTouched ? 'text-gray-400' : ''}
                        `} />
                        
                        <input
                          type="email"
                          value={email}
                          onChange={handleEmailChange}
                          onBlur={handleEmailBlur}
                          className="flex-1 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                          placeholder="ejemplo@correo.com"
                        />
                        
                        {!emailError && emailTouched && email && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        {emailError && emailTouched && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    
                    {emailError && emailTouched && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-600 font-medium">{emailError}</p>
                      </div>
                    )}
                  </div>

                  {/* Input: Teléfono */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      Teléfono
                    </label>
                    
                    <div className="relative">
                      <div className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300 bg-white
                        ${phoneError && phoneTouched ? 'border-red-300 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100' : ''}
                        ${!phoneError && phoneTouched && phoneNumber ? 'border-green-300 focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-100' : ''}
                        ${!phoneTouched ? 'border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100' : ''}
                      `}>
                        <Phone className={`
                          w-5 h-5 flex-shrink-0
                          ${phoneError && phoneTouched ? 'text-red-500' : ''}
                          ${!phoneError && phoneTouched && phoneNumber ? 'text-green-500' : ''}
                          ${!phoneTouched ? 'text-gray-400' : ''}
                        `} />
                        
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={handlePhoneChange}
                          onBlur={handlePhoneBlur}
                          className="flex-1 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                          placeholder="0999999999"
                        />
                        
                        {!phoneError && phoneTouched && phoneNumber && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        {phoneError && phoneTouched && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    
                    {phoneError && phoneTouched && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-600 font-medium">{phoneError}</p>
                      </div>
                    )}
                  </div>

                  {/* Input: Edad */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                      Edad
                    </label>
                    
                    <div className="relative">
                      <div className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300 bg-white
                        ${ageError && ageTouched ? 'border-red-300 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100' : ''}
                        ${!ageError && ageTouched && age ? 'border-green-300 focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-100' : ''}
                        ${!ageTouched ? 'border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100' : ''}
                      `}>
                        <Calendar className={`
                          w-5 h-5 flex-shrink-0
                          ${ageError && ageTouched ? 'text-red-500' : ''}
                          ${!ageError && ageTouched && age ? 'text-green-500' : ''}
                          ${!ageTouched ? 'text-gray-400' : ''}
                        `} />
                        
                        <input
                          type="number"
                          value={age}
                          onChange={handleAgeChange}
                          onBlur={handleAgeBlur}
                          min="5"
                          max="80"
                          className="flex-1 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                          placeholder="Ingresa tu edad"
                        />
                        
                        {!ageError && ageTouched && age && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        {ageError && ageTouched && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    
                    {ageError && ageTouched && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-600 font-medium">{ageError}</p>
                      </div>
                    )}
                  </div>

                  {/* Input: Género */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div>
                      Género
                    </label>
                    
                    <div className="relative">
                      {/* Botón principal del dropdown */}
                      <button
                        type="button"
                        onClick={() => setGenderDropdownOpen(!genderDropdownOpen)}
                        onBlur={() => {
                          setTimeout(() => setGenderDropdownOpen(false), 200)
                          handleGenderBlur()
                        }}
                        className={`
                          w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 bg-white transition-all duration-300
                          ${genderError && genderTouched ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' : ''}
                          ${!genderError && genderTouched && gender ? 'border-green-300 focus:border-green-500 focus:ring-4 focus:ring-green-100' : ''}
                          ${!genderTouched ? 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100' : ''}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Users className={`
                            w-5 h-5 flex-shrink-0
                            ${genderError && genderTouched ? 'text-red-500' : ''}
                            ${!genderError && genderTouched && gender ? 'text-green-500' : ''}
                            ${!genderTouched ? 'text-gray-400' : ''}
                          `} />
                          
                          <span className={gender ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                            {gender || 'Selecciona tu género'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {!genderError && genderTouched && gender && (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          )}
                          {genderError && genderTouched && (
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          )}
                          
                          {/* Flecha que rota */}
                          <svg 
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${genderDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      
                      {/* Lista desplegable */}
                      {genderDropdownOpen && (
                        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                          {/* Opción Femenino */}
                          <button
                            type="button"
                            onClick={() => {
                              setGender('Femenino')
                              setGenderTouched(true)
                              setGenderError(validateGender('Femenino'))
                              setGenderDropdownOpen(false)
                            }}
                            className={`
                              w-full px-4 py-3 text-left transition-colors
                              ${gender === 'Femenino' ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50 text-gray-700'}
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Femenino</span>
                              {gender === 'Femenino' && (
                                <CheckCircle className="w-5 h-5 text-blue-500" />
                              )}
                            </div>
                          </button>
                          
                          {/* Separador */}
                          <div className="border-t border-gray-100" />
                          
                          {/* Opción Masculino */}
                          <button
                            type="button"
                            onClick={() => {
                              setGender('Masculino')
                              setGenderTouched(true)
                              setGenderError(validateGender('Masculino'))
                              setGenderDropdownOpen(false)
                            }}
                            className={`
                              w-full px-4 py-3 text-left transition-colors
                              ${gender === 'Masculino' ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50 text-gray-700'}
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Masculino</span>
                              {gender === 'Masculino' && (
                                <CheckCircle className="w-5 h-5 text-blue-500" />
                              )}
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Error message */}
                    {genderError && genderTouched && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-600 font-medium">{genderError}</p>
                      </div>
                    )}
                  </div>

                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                      Secuencia biométrica
                    </span>
                  </div>
                </div>

                {/* Selector de Gestos */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 mb-1">
                        Selecciona 3 gestos únicos
                      </h3>
                      <p className="text-sm text-gray-500">
                        Estos gestos formarán tu secuencia de autenticación
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={selectedGestures.length === 3 ? 'success' : 'default'}
                        className="px-3 py-1.5 text-sm font-semibold"
                      >
                        {selectedGestures.length}/3
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {availableGestures.map((gesture) => {
                      const isSelected = selectedGestures.includes(gesture)
                      const position = selectedGestures.indexOf(gesture) + 1
                      const isDisabled = !isSelected && selectedGestures.length >= 3

                      return (
                        <button
                          key={gesture}
                          onClick={() => handleGestureToggle(gesture)}
                          disabled={isDisabled}
                          className={`
                            group relative p-6 rounded-2xl border-2 transition-all duration-300
                            ${isSelected
                              ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-lg shadow-blue-200/50'
                              : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-md'
                            }
                            ${isDisabled
                              ? 'opacity-40 cursor-not-allowed'
                              : 'cursor-pointer hover:scale-105'
                            }
                          `}
                        >
                          {/* Badge de posición */}
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg z-10">
                              {position}
                            </div>
                          )}

                          {/* Icono del gesto */}
                          <div className="text-5xl mb-3 transform group-hover:scale-110 transition-transform">
                            {gesture === 'Open_Palm' && '🖐️'}
                            {gesture === 'Closed_Fist' && '✊'}
                            {gesture === 'Victory' && '✌️'}
                            {gesture === 'Thumb_Up' && '👍'}
                            {gesture === 'Thumb_Down' && '👎'}
                            {gesture === 'Pointing_Up' && '☝️'}
                            {gesture === 'ILoveYou' && '🤟'}
                          </div>

                          {/* Nombre del gesto */}
                          <p className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                            {gesture.replace('_', ' ')}
                          </p>

                          {/* Efecto de selección */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-cyan-400/10 rounded-2xl" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Secuencia seleccionada */}
                  {selectedGestures.length > 0 && (
                    <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 via-cyan-50 to-indigo-50 rounded-2xl border-2 border-blue-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <Hand className="w-4 h-4 text-blue-600" />
                        </div>
                        <p className="text-sm font-bold text-blue-900">
                          Tu Secuencia Biométrica:
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedGestures.map((gesture, index) => (
                          <div key={gesture} className="flex items-center">
                            <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-semibold text-blue-700 shadow-sm border border-blue-100">
                              {gesture.replace('_', ' ')}
                            </span>
                            {index < selectedGestures.length - 1 && (
                              <ArrowRight className="w-4 h-4 text-blue-400 mx-1" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Message General */}
                {error && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                  </div>
                )}

                {/* Botón de inicio */}
                <div className="pt-4">
                  <Button
                    onClick={handleStartEnrollment}
                    disabled={
                      !username || 
                      !email || 
                      !phoneNumber || 
                      !age || 
                      !gender || 
                      selectedGestures.length !== 3 || 
                      loading || 
                      usernameError || 
                      emailError || 
                      phoneError || 
                      ageError || 
                      genderError
                    }
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Iniciando sistema...
                      </div>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        Iniciar captura biométrica
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'code-verification' && (
        <div className="min-h-screen bg-gradient-to-br flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            
            <Card className="shadow-2xl border-0 overflow-hidden">
              <CardContent className="pt-12 pb-12">
                
                {/* Icono */}
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full">
                    <Mail className="w-10 h-10 text-blue-600" />
                  </div>
                </div>

                {/* Título */}
                <h2 className="text-3xl font-bold text-gray-800 mb-3 text-center">
                  Verifica tu email
                </h2>

                {/* Descripción */}
                <p className="text-lg text-gray-600 mb-2 text-center">
                  Enviamos un código a:
                </p>
                <p className="text-xl font-bold text-cyan-600 mb-8 text-center">
                  {email}
                </p>

                {/* Inputs del código */}
                <div className="max-w-md mx-auto mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-4 text-center">
                    Código de 6 dígitos
                  </label>
                  
                  <div className="flex gap-3 justify-center">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        id={`code-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={verificationCode[index]}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        onPaste={index === 0 ? handleCodePaste : undefined}
                        disabled={verifyingCode}
                        className={`
                          w-12 h-14 text-center text-2xl font-bold rounded-lg
                          border-2 transition-all duration-200
                          ${codeError
                            ? 'border-red-400 bg-red-50 text-red-600'
                            : verificationCode[index]
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                            : 'border-gray-300 bg-white text-gray-900'
                          }
                          focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                {/* Error */}
                {codeError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-6">
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">{codeError}</p>
                      
                    </div>
                  </div>
                )}

                {/* Botón verificar */}
                <button
                  onClick={handleVerifyCode}
                  disabled={verifyingCode || verificationCode.some(d => !d)}
                  className="
                    w-full py-4 rounded-xl font-semibold text-white
                    bg-gradient-to-r from-blue-900 to-cyan-600
                    hover:from-blue-800 hover:to-cyan-500
                    focus:outline-none focus:ring-4 focus:ring-cyan-500/50
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                    flex items-center justify-center gap-2
                    shadow-lg hover:shadow-xl
                  "
                >
                  {verifyingCode ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Verificar código</span>
                    </>
                  )}
                </button>

                {/* Reenviar código */}
                <div className="text-center mt-6">
                  <p className="text-sm text-gray-600 mb-2">
                    ¿No recibiste el código?
                  </p>
                  
                  {resendSuccess && (
                    <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700 font-medium">
                        ✓ Código reenviado exitosamente
                      </p>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendingCode || resendCooldown > 0}
                    className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

                {/* Info adicional */}
                <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                  <p className="text-xs text-gray-500">
                    El código expirará en 30 minutos
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>
        </div>
      )}

        {/* STEP: CAPTURE */}
        {step === 'capture' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Cámara */}
            <div className="lg:col-span-2">
              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-800">
                    <Camera className="w-5 h-5 text-blue-600" />
                    Captura en vivo
                  </CardTitle>
                  <CardDescription>
                    Realiza los gestos según las indicaciones
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="rounded-xl overflow-hidden shadow-lg">
                    <WebcamCapture
                      onFrame={handleFrameCapture}
                      isActive={step === 'capture'}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="danger" 
                    onClick={handleCancel} 
                    className="w-full"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Panel de Progreso */}
            <div>
              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800">Progreso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sessionStatus ? (
                    <>
                      {/* Barra de progreso */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Completado</span>
                          <span className="text-sm font-bold text-blue-600">
                            {Math.round(sessionStatus.progress || 0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${sessionStatus.progress || 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Gesto actual */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">
                          Gesto actual:
                        </p>
                        <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border-2 border-cyan-200">
                          {/* Emoji grande arriba */}
                          <div className="text-6xl mb-2">
                            {sessionStatus.current_gesture === 'Open_Palm' && '🖐️'}
                            {sessionStatus.current_gesture === 'Closed_Fist' && '✊'}
                            {sessionStatus.current_gesture === 'Victory' && '✌️'}
                            {sessionStatus.current_gesture === 'Thumb_Up' && '👍'}
                            {sessionStatus.current_gesture === 'Thumb_Down' && '👎'}
                            {sessionStatus.current_gesture === 'Pointing_Up' && '☝️'}
                            {sessionStatus.current_gesture === 'ILoveYou' && '🤟'}
                            {!sessionStatus.current_gesture && '👋'}
                          </div>
                          
                          {/* Nombre abajo */}
                          <p className="text-lg font-bold text-cyan-800">
                            {sessionStatus.current_gesture || 'Esperando...'}
                          </p>
                        </div>
                      </div>

                      {/* Contador de muestras */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">
                          Muestras capturadas:
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {sessionStatus.samples_collected || 0} / {sessionStatus.samples_needed || 21}
                        </p>
                      </div>

                      {/* Mensaje de feedback */}
                      {sessionStatus.message && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-xs text-yellow-800">
                            {sessionStatus.message}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      Inicializando...
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* STEP: CONFIRMATION */}
        {step === 'confirmation' && (
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-2xl">
              <CardContent className="pt-12 pb-12 text-center">

                {/* Icono de éxito */}
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-full shadow-lg">
                    <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                {/* Título */}
                <h2 className="text-3xl sm:text-4xl font-black text-gray-800 mb-3">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                    Secuencia de gestos registrada
                  </span>
                </h2>

                {/* Descripción */}
                <p className="text-lg text-gray-600 mb-2">
                  Tus gestos biométricos han sido capturados exitosamente.
                </p>
                <p className="text-base text-gray-500 mb-8">
                  Para finalizar tu registro, completa un breve cuestionario de personalidad.
                </p>

                {/* Información de gestos capturados */}
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 mb-8 max-w-md mx-auto">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-black text-purple-600 mb-1">
                        {sessionStatus?.samples_collected || 0}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Muestras</div>
                    </div>
                    <div>
                      <div className="text-3xl font-black text-blue-600 mb-1">
                        {sessionStatus?.total_gestures || 3}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Gestos</div>
                    </div>
                    <div>
                      <div className="text-3xl font-black text-green-600 mb-1">100%</div>
                      <div className="text-xs text-gray-600 font-medium">Completo</div>
                    </div>
                  </div>
                </div>

                {/* Botón para continuar */}
                <Button
                  onClick={() => {
                    console.log('Usuario continua al cuestionario')
                    setStep('questionnaire')
                  }}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg h-12 px-8"
                >
                  Continuar al cuestionario
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                <p className="text-sm text-gray-500 mt-4">
                  El cuestionario toma aproximadamente 2 minutos
                </p>

              </CardContent>
            </Card>
          </div>
        )}
        

        {/* STEP: QUESTIONNAIRE */}
        {step === 'questionnaire' && userId && (
          <PersonalityQuestionnaire
            userId={userId}
            username={username}
            onComplete={(result) => {
              console.log('Cuestionario completado:', result)
              console.log('Respuestas guardadas:', result.raw_responses)
              setStep('success')
            }}
          />
        )}

        {/* STEP: SUCCESS */}
        {step === 'success' && (
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-2xl">
              <CardContent className="pt-12 pb-12 text-center">
                
                {/* Icono de éxito */}
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-full shadow-lg">
                    <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                {/* Título */}
                <h2 className="text-3xl sm:text-4xl font-black text-gray-800 mb-3">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                    ¡Registro completado!
                  </span>
                </h2>

                {/* Descripción */}
                <p className="text-lg text-gray-600 mb-8">
                  El usuario <strong className="text-gray-800">{username}</strong> ha sido registrado exitosamente en el sistema biométrico.
                </p>

                {/* Alert de entrenamiento */}
                {sessionStatus?.can_train_now && (
                  <div className="mb-8 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-2xl text-left max-w-md mx-auto">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                          ¡Sistema listo para entrenamiento!
                        </h3>
                        <p className="text-sm text-yellow-700 mb-3">
                          Ya tienes suficientes usuarios registrados. Ahora puedes entrenar las redes neuronales en el Dashboard.
                        </p>
                        <Button 
                          size="sm"
                          className="bg-yellow-600 hover:bg-yellow-700"
                          onClick={() => navigate('/')}
                        >
                          Ir al Dashboard →
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botón de acción */}
                <Button 
                  onClick={resetForm}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg h-12 px-8"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Registrar otro usuario
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}