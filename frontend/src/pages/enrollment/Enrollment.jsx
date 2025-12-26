import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams} from 'react-router-dom'
import { enrollmentApi } from '../../lib/api/enrollment'
import PersonalityQuestionnaire from './PersonalityQuestionnaire'
import { Button, Badge } from '../../components/ui'
import WebcamCapture from '../../components/camera/WebcamCapture'
import { UserPlus, CheckCircle, CheckCircle2, XCircle, Camera, Hand, AlertCircle, ArrowRight, User, IdCard, ArrowLeft, Mail, Phone, Calendar, Users, Loader2, RefreshCw, LogIn } from 'lucide-react'
import config from '../../lib/config'

export default function Enrollment() {
  const navigate = useNavigate()
  const location = useLocation()
  const reenrollmentData = location.state?.reenrollment ? location.state : null
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState('personal-info')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [selectedGestures, setSelectedGestures] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [userId, setUserId] = useState(null)
  const [pluginSessionToken, setPluginSessionToken] = useState(null)
  const [pluginCallbackUrl, setPluginCallbackUrl] = useState(null)
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

  const lastFrameTimeRef = useRef(0)
  const processingFrameRef = useRef(false)

  // Leer datos del plugin desde la URL
  useEffect(() => {
    const sessionToken = searchParams.get('session_token')
    
    if (sessionToken) {
      // URL FIJO del plugin para recibir resultado de registro
      const PLUGIN_CALLBACK_URL = 'https://genia-api-extension-avbke7bhgea4bngk.eastus2-01.azurewebsites.net/api/registro-finalizado'
      
      console.log('Datos del plugin detectados:')
      console.log('Session Token:', sessionToken)
      console.log('Callback URL (fijo):', PLUGIN_CALLBACK_URL)
      
      setPluginSessionToken(sessionToken)
      setPluginCallbackUrl(PLUGIN_CALLBACK_URL)
    } else {
      console.log('No hay datos del plugin - Usuario accedió directamente')
    }
  }, [searchParams])

  // Detectar si viene desde forgot-sequence y pre-cargar datos
  useEffect(() => {
    if (reenrollmentData && reenrollmentData.userData) {
      const { userData } = reenrollmentData
      
      setUsername(userData.username || '')
      setEmail(userData.email || '')
      setPhoneNumber(userData.phone_number || '')
      setAge(userData.age?.toString() || '')
      setGender(userData.gender || '')
      setSelectedGestures(userData.gesture_sequence || [])
      
      console.log('Datos pre-cargados para re-registro:', userData)
    }
  }, [reenrollmentData])

  const availableGestures = [
    'Open_Palm',
    'Closed_Fist',
    'Victory',
    'Thumb_Up',
    'Thumb_Down',
    'Pointing_Up',
    'ILoveYou'
  ]

  // Función para limpiar estados de verificación
  const resetVerificationStates = () => {
    setVerificationCode(['', '', '', '', '', ''])
    setCodeError('')
    setVerifyingCode(false)
    setResendingCode(false)
    setResendCooldown(0)
    setResendSuccess(false)
    setEmailVerificationPending(false)
  }

  // Validación de username
  const validateUsername = (value) => {
    if (!value.trim()) {
      return 'Este campo es obligatorio'
    }
    if (value.length < 10) {
      return 'El nombre debe tener una longitud mínima de 10 caracteres'
    }
    return ''
  }

  const validateEmail = (value) => {
    if (!value.trim()) {
      return 'Este campo es obligatorio'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      return 'La dirección de correo electrónico no es válida'
    }
    return ''
  }

  const validatePhone = (value) => {
    if (!value.trim()) {
      return 'Este campo es obligatorio'
    }
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length !== 10) {
      return 'El número de teléfono debe contener exactamente 10 dígitos'
    }
    return ''
  }

  const validateAge = (value) => {
    if (!value) {
      return 'Este campo es obligatorio'
    }
    const ageNum = parseInt(value)
    if (isNaN(ageNum) || ageNum < 5 || ageNum > 80) {
      return 'La edad ingresada no es válida'
    }
    return ''
  }

  const validateGender = (value) => {
    if (!value) {
      return 'Este campo es obligatorio'
    }
    if (!['Femenino', 'Masculino'].includes(value)) {
      return 'Género inválido'
    }
    return ''
  }

  const validateEmailUnique = async () => {
    const emailValue = email.trim().toLowerCase()
    
    if (!emailValue || !emailValue.includes('@')) {
      setEmailError('La dirección de correo electrónico no es válida')
      return false
    }
    
    try {
      const response = await enrollmentApi.validateUnique('email', emailValue)
      
      if (!response.is_unique) {
        setEmailError('Esta dirección de correo electrónico ya se encuentra registrada')
        return false
      }
      
      setEmailError('')
      return true
      
    } catch (error) {
      console.error('Error validando email:', error)
      setEmailError('Se produjo un error al validar la dirección de correo electrónico')
      return false
    }
  }

  const validatePhoneUnique = async () => {
    const phoneValue = phoneNumber.trim()
    
    if (!phoneValue || phoneValue.length < 7) {
      setPhoneError('El número de teléfono no es válido')
      return false
    }
    
    try {
      const response = await enrollmentApi.validateUnique('phone_number', phoneValue)
      
      if (!response.is_unique) {
        setPhoneError('Este número de teléfono ya se encuentra registrado')
        return false
      }
      
      setPhoneError('')
      return true
      
    } catch (error) {
      console.error('Error validando teléfono:', error)
      setPhoneError('Se produjo un error al validar el número de teléfono')
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

  const handleSendVerification = async () => {
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
    
    if (usernameErr || emailErr || phoneErr || ageErr || genderErr) {
      setError('Por favor completa todos los campos correctamente')
      return
    }
    
    const emailUnique = await validateEmailUnique()
    const phoneUnique = await validatePhoneUnique()
    
    if (!emailUnique || !phoneUnique) {
      setError('Email o telefono ya registrados')
      return
    }

    try {
      setLoading(true)
      resetVerificationStates()
      
      const response = await enrollmentApi.sendOTPOnly(email, username)
      
      setUserId(response.user_id)
      console.log('OTP enviado, user_id:', response.user_id)
      
      setStep('code-verification')
      setEmailVerificationPending(true)
      setError(null)
      
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
      console.error('Error enviando OTP:', err)
      setError(err.response?.data?.detail || 'Error enviando codigo')
    } finally {
      setLoading(false)
    }
  }
  // const handleStartEnrollment = async () => {
  //   setUsernameTouched(true)
  //   setEmailTouched(true)
  //   setPhoneTouched(true)
  //   setAgeTouched(true)
  //   setGenderTouched(true)
    
  //   const usernameErr = validateUsername(username)
  //   const emailErr = validateEmail(email)
  //   const phoneErr = validatePhone(phoneNumber)
  //   const ageErr = validateAge(age)
  //   const genderErr = validateGender(gender)
    
  //   setUsernameError(usernameErr)
  //   setEmailError(emailErr)
  //   setPhoneError(phoneErr)
  //   setAgeError(ageErr)
  //   setGenderError(genderErr)
    
  //   if (usernameErr || emailErr || phoneErr || ageErr || genderErr || selectedGestures.length !== 3) {
  //     setError('Por favor completa todos los campos correctamente')
  //     return
  //   }
    
  //   const emailUnique = await validateEmailUnique()
  //   const phoneUnique = await validatePhoneUnique()
    
  //   if (!emailUnique || !phoneUnique) {
  //     setError('La dirección de correo electrónico o el número de teléfono ya se encuentran registrados')
  //     return
  //   }

  //   try {
  //     setLoading(true)
      
  //     resetVerificationStates()

  //     const response = await enrollmentApi.startEnrollment(
  //       username, 
  //       email, 
  //       phoneNumber, 
  //       parseInt(age), 
  //       gender, 
  //       selectedGestures
  //     )
      
  //     setSessionId(response.session_id)
      
  //     if (response.user_id) {
  //       setUserId(response.user_id)
  //       console.log('User ID guardado:', response.user_id)
  //     }
      
  //     console.log('Email de verificación enviado a:', email)
  //     console.log('Session ID:', response.session_id)
      
  //     setStep('code-verification')
  //     setEmailVerificationPending(true)
  //     setError(null)
      
  //     setResendCooldown(60)
  //     const interval = setInterval(() => {
  //       setResendCooldown((prev) => {
  //         if (prev <= 1) {
  //           clearInterval(interval)
  //           return 0
  //         }
  //         return prev - 1
  //       })
  //     }, 1000)

  //   } catch (err) {
  //     console.error('Error al iniciar enrollment:', err)
  //     setError(err.response?.data?.detail || 'Error al iniciar enrollment')
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  const handleStartEnrollment = async () => {
    if (selectedGestures.length !== 3) {
      setError('Debes seleccionar exactamente 3 gestos')
      return
    }

    try {
      setLoading(true)

      console.log('Iniciando enrollment con:')
      console.log('Username:', username)
      console.log('Email:', email)
      console.log('Plugin Session Token:', pluginSessionToken)
      console.log('Plugin Callback URL:', pluginCallbackUrl)
      
      const response = await enrollmentApi.startEnrollment(
        userId,
        username, 
        email, 
        phoneNumber, 
        parseInt(age), 
        gender, 
        selectedGestures,
        pluginSessionToken,
        pluginCallbackUrl
      )
      
      setSessionId(response.session_id)
      
      if (response.user_id) {
        setUserId(response.user_id)
        console.log('User ID confirmado:', response.user_id)
      }
      
      console.log('Sesion de enrollment iniciada:', response.session_id)
      
      setStep('capture')
      setError(null)
      
    } catch (err) {
      console.error('Error al iniciar enrollment:', err)
      setError(err.response?.data?.detail || 'Error al iniciar enrollment')
    } finally {
      setLoading(false)
    }
  }

  // const handleVerifyCode = async () => {
  //   const code = verificationCode.join('')
    
  //   if (code.length !== 6) {
  //     setCodeError('Por favor, ingrese el código de verificación completo')
  //     return
  //   }
    
  //   try {
  //     setVerifyingCode(true)
  //     setCodeError('')
      
  //     const response = await enrollmentApi.verifyCode(userId, code)
      
  //     if (response.success) {
  //       console.log('Código verificado correctamente')
  //       setEmailVerificationPending(false)

  //       try {
  //         await fetch('http://localhost:8000/api/v1/camera/release', { 
  //           method: 'POST' 
  //         })
  //         console.log('Cámara del backend liberada')
  //       } catch (err) {
  //         console.warn('No se pudo liberar cámara del backend:', err)
  //       }
        
  //       await new Promise(resolve => setTimeout(resolve, 800))

  //       setStep('capture')
  //     } else {
  //       setCodeError(response.message || 'El código ingresado no es válido')
  //     }
      
  //   } catch (err) {
  //     console.error('Error verificando código:', err)
  //     setCodeError(err.response?.data?.detail || 'Se produjo un error al verificar el código')
  //   } finally {
  //     setVerifyingCode(false)
  //   }
  // }

  const handleVerifyCode = async () => {
    const code = verificationCode.join('')
    
    if (code.length !== 6) {
      setCodeError('Por favor, ingrese el codigo de verificacion completo')
      return
    }
    
    try {
      setVerifyingCode(true)
      setCodeError('')
      
      const response = await enrollmentApi.verifyCode(userId, code)
      
      if (response.success) {
        console.log('Codigo verificado correctamente')
        setEmailVerificationPending(false)
        
        setStep('gesture-selection')
        
      } else {
        setCodeError(response.message || 'El codigo ingresado no es valido')
      }
      
    } catch (err) {
      console.error('Error verificando codigo:', err)
      setCodeError(err.response?.data?.detail || 'Se produjo un error al verificar el codigo')
    } finally {
      setVerifyingCode(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    
    try {
      setResendingCode(true)
      setResendSuccess(false)
      setCodeError('')
      
      const response = await enrollmentApi.resendCode(userId, username, email)
      
      if (response.success) {
        setResendSuccess(true)
        
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
        setCodeError(response.message || 'Se produjo un error al reenviar el código')
      }
      
    } catch (err) {
      console.error('Error reenviando código:', err)
      setCodeError(err.message || 'Se produjo un error al reenviar el código')
    } finally {
      setResendingCode(false)
    }
  }

  const handleCodeChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return
    
    const newCode = [...verificationCode]
    newCode[index] = value
    setVerificationCode(newCode)
    
    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`)?.focus()
    }
    
    if (codeError) setCodeError('')
  }

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus()
    }
    
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

  // const handleFrameCapture = async (frameData) => {
  //   if (!sessionId) return

  //   try {
  //     const response = await enrollmentApi.processFrame(sessionId, frameData)
      
  //     console.log('Respuesta del servidor:', response)
      
  //     setSessionStatus({
  //       ...response,
  //       progress: response.progress_percentage || 
  //                 ((response.samples_captured || 0) / (response.samples_needed || 21)) * 100,
  //       current_gesture: response.current_gesture,
  //       samples_collected: response.samples_captured || 0,
  //       samples_needed: response.samples_needed || 21,
  //       message: response.message || response.feedback || 'Procesando...',
  //       session_completed: response.all_gestures_completed || response.session_completed || false
  //     })

  //     if (response.all_gestures_completed || response.session_completed) {
  //       console.log('ENROLLMENT COMPLETADO - Iniciando finalizacion')
        
  //       try {
  //         if (!userId) {
  //           console.error('No se encontro user_id guardado')
  //           setError('Error: No se pudo obtener el ID de usuario')
  //           return
  //         }
          
  //         console.log('Usando User ID guardado:', userId)
          
  //         try {
  //           const bootstrapStatus = await enrollmentApi.getBootstrapStatus()
  //           console.log('Bootstrap status:', bootstrapStatus)
            
  //           setSessionStatus(prev => ({
  //             ...prev,
  //             can_train_now: bootstrapStatus.can_train && !bootstrapStatus.networks_trained
  //           }))
  //         } catch (err) {
  //           console.error('Error checking bootstrap status:', err)
  //         }
          
  //         await new Promise(resolve => setTimeout(resolve, 500))
          
  //         console.log('Mostrando pagina de confirmacion')
  //         setStep('confirmation')
          
  //       } catch (err) {
  //         console.error('Error en proceso de finalizacion:', err)
  //         setError(err.response?.data?.detail || 'Error completando el enrollment')
  //       }
  //     }

  //   } catch (err) {
  //     console.error('Error procesando frame:', err)
  //     setError(err.message || 'Error procesando frame')
  //   }
  // }

  const handleFrameCapture = useCallback(async (frameData) => {
    if (!sessionId) return

    // THROTTLING: Solo 1 frame cada 800ms
    const now = Date.now()
    if (now - lastFrameTimeRef.current < 800) {
      return // Ignorar este frame
    }

    // EVITAR procesamiento concurrente
    if (processingFrameRef.current) {
      return // Ya hay un frame procesándose
    }

    lastFrameTimeRef.current = now
    processingFrameRef.current = true

    try {
      const response = await enrollmentApi.processFrame(sessionId, frameData)
      
      console.log('Respuesta del servidor:', response)
      
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

      if (response.all_gestures_completed || response.session_completed) {
        console.log('ENROLLMENT COMPLETADO - Iniciando finalizacion')
        
        try {
          if (!userId) {
            console.error('No se encontro user_id guardado')
            setError('Error: No se pudo obtener el ID de usuario')
            return
          }
          
          console.log('Usando User ID guardado:', userId)
          
          try {
            const bootstrapStatus = await enrollmentApi.getBootstrapStatus()
            console.log('Bootstrap status:', bootstrapStatus)
            
            setSessionStatus(prev => ({
              ...prev,
              can_train_now: bootstrapStatus.can_train && !bootstrapStatus.networks_trained
            }))
          } catch (err) {
            console.error('Error checking bootstrap status:', err)
          }
          
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log('Mostrando pagina de confirmacion')
          setStep('confirmation')
          
        } catch (err) {
          console.error('Error en proceso de finalizacion:', err)
          setError(err.response?.data?.detail || 'Error completando el enrollment')
        }
      }

    } catch (err) {
      console.error('Error procesando frame:', err)
      setError(err.message || 'Error procesando frame')
    } finally {
      processingFrameRef.current = false
    }
  }, [sessionId, userId])

  const handleCancel = async () => {
    if (sessionId) {
      try {
        await enrollmentApi.cancelEnrollment(sessionId)
      } catch (err) {
        console.error('Error cancelando:', err)
      }
    }
    resetVerificationStates()
    resetForm()
  }

  const resetForm = () => {
    resetVerificationStates()
    
    setStep('personal-info')
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

  // Mapeo de steps a números para el wizard
  const stepToNumber = {
    'personal-info': 1,
    'code-verification': 2,
    'gesture-selection': 3,
    'capture': 4,
    'confirmation': 5,
    'questionnaire': 6,
    'success': 7
  }
  const currentStepNumber = stepToNumber[step] || 1

  // Configuración del wizard
  const wizardSteps = [
    { number: 1, label: 'Datos Personales' },
    { number: 2, label: 'Verificacion' },
    { number: 3, label: 'Gestos' },
    { number: 4, label: 'Captura' },
    { number: 5, label: 'Confirmacion' },
    { number: 6, label: 'Cuestionario' },
    { number: 7, label: 'Completado' }
  ]

  return (
    <div className="fixed inset-0 flex"> 
      
      {/* ========================================
          PANEL LATERAL CYAN (SOLO DESKTOP)
      ======================================== */}
      {/* <div 
        className="hidden lg:flex lg:w-2/5 h-screen sticky top-0 flex-col justify-between p-12"
        style={{ backgroundColor: '#00ACC1' }}
      > */}

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

        {/* Logo grande - centrado
        <div className="flex items-center justify-center flex-1">
          <img 
            src="/video.gif" 
            alt="Auth-Gesture" 
            className="w-64 h-64 brightness-0 invert opacity-90" 
          />
        </div> */}

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

        {/* Paso actual - abajo */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full backdrop-blur-sm">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-white">
              Paso {currentStepNumber} de 7
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
          <button
            onClick={handleGoBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          
          <div className="flex items-center gap-2">
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

        {/* Contenido principal */}
        <div className="w-full h-full px-8 py-8 lg:px-16 lg:py-12">

          {/* Wizard de progreso - CENTRADO Y ADAPTATIVO */}
          {!['success'].includes(step) && (
            <div className="w-full mb-8 sm:mb-12 px-4 sm:px-6">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center w-full">
                  {wizardSteps.map((s, index) => (
                    <div key={s.number} className="flex items-center flex-1">
                      
                      {/* Círculo del paso */}
                      <div className="relative group flex-shrink-0">
                        <div 
                          className={`
                            w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10
                            rounded-full flex items-center justify-center 
                            font-bold transition-all cursor-pointer
                            text-xs sm:text-sm
                            ${currentStepNumber > s.number 
                              ? 'text-white shadow-md sm:shadow-lg' 
                              : currentStepNumber === s.number 
                              ? 'text-white shadow-lg sm:shadow-xl md:scale-110' 
                              : 'bg-gray-200 text-gray-400'
                            }
                          `}
                          style={{ 
                            backgroundColor: currentStepNumber >= s.number ? '#05A8F9' : undefined
                          }}
                        >
                          {currentStepNumber > s.number ? (
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            s.number
                          )}
                        </div>

                        {/* Tooltip - solo en desktop */}
                        <div className="hidden md:block absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                          <div 
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg"
                            style={{ backgroundColor: '#05A8F9' }}
                          >
                            {s.label}
                            <div 
                              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                              style={{ backgroundColor: '#05A8F9' }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* Línea conectora - SE ADAPTA AUTOMÁTICAMENTE */}
                      {index < wizardSteps.length - 1 && (
                        <div 
                          className="flex-1 h-0.5 transition-colors mx-1.5 sm:mx-2 md:mx-3"
                          style={{ 
                            backgroundColor: currentStepNumber > s.number ? '#05A8F9' : '#E5E7EB'
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================
              STEP: FORM 
          ======================================== */}
          {step === 'personal-info' && (
            <div className="max-w-4xl mx-auto">
              
              <div className="space-y-8">
                
                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                      Información personal
                    </span>
                  </div>
                </div>

                {/* Input: Nombre completo*/}
                <div className="space-y-2">
                  <label className="block text-left text-xs font-semibold text-gray-700">
                    Nombre completo
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
                        disabled={reenrollmentData !== null}
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

                {/* Input: Email*/}
                <div className="space-y-2">
                  <label className="block text-left text-xs font-semibold text-gray-700">
                    Correo electrónico
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
                        disabled={reenrollmentData !== null}
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

                {/* Resto de campos en grid de 2 columnas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Input: Teléfono */}
                  <div className="space-y-2">
                    <label className="block text-left text-xs font-semibold text-gray-700">
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
                          disabled={reenrollmentData !== null}
                          maxLength={10} 
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
                    <label className="block text-left text-xs font-semibold text-gray-700">
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
                          disabled={reenrollmentData !== null}
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
                  <div className="space-y-2 md:col-span-1">
                    <label className="block text-left text-xs font-semibold text-gray-700">
                      Género
                    </label>
                    
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setGenderDropdownOpen(!genderDropdownOpen)}
                        onBlur={() => {
                          setTimeout(() => setGenderDropdownOpen(false), 200)
                          handleGenderBlur()
                        }}
                        disabled={reenrollmentData !== null}
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
                      
                      {genderDropdownOpen && (
                        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
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
                          
                          <div className="border-t border-gray-100" />
                          
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
                    
                    {genderError && genderTouched && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-600 font-medium">{genderError}</p>
                      </div>
                    )}
                  </div>

                </div>

                

                {error && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                  </div>
                )}

                {/* Botón de inicio */}
                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={handleSendVerification}
                    disabled={
                      !username || 
                      !email || 
                      !phoneNumber || 
                      !age || 
                      !gender || 
                      loading || 
                      usernameError || 
                      emailError || 
                      phoneError || 
                      ageError || 
                      genderError
                    }
                    className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Iniciando...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Registrarse</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================
              STEP: CODE-VERIFICATION
          ======================================== */}
          {step === 'code-verification' && (
            <div className="w-full">
              <div className="max-w-xl mx-auto space-y-6">
                
                {/* Divider superior */}
                <div className="relative mb-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                      Verificación de correo electrónico
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-lg text-gray-600 mb-2">
                    Enviamos un código de verificación a:
                  </p>
                  <p className="text-xl font-bold mb-8" style={{ color: '#05A8F9' }}>
                    {email}
                  </p>
                </div>

                <div className="mb-6">
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
                            ? 'bg-cyan-50 text-cyan-700'
                            : 'border-gray-300 bg-white text-gray-900'
                          }
                          focus:outline-none focus:ring-4
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        style={{
                          borderColor: verificationCode[index] && !codeError ? '#05A8F9' : undefined,
                          boxShadow: verificationCode[index] && !codeError ? '0 0 0 4px rgba(5, 168, 249, 0.1)' : undefined
                        }}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                {codeError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-red-800">{codeError}</p>
                  </div>
                )}

                {/* Botón VERIFICAR*/}
                <div className="flex justify-center pt-4">
                  <button
                    onClick={handleVerifyCode}
                    disabled={verifyingCode || verificationCode.some(d => !d)}
                    className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    {verifyingCode ? (
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

                <div className="border-t-2 mt-8 pt-6 text-center" style={{ borderColor: '#F4FCFF' }}>
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
                    className="text-sm font-semibold hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              STEP: GESTURE-SELECTION
          ======================================== */}
          {step === 'gesture-selection' && (
            <div className="max-w-4xl mx-auto">
              
              <div className="space-y-8">
                
                {/* Badge de email verificado */}
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
                      Email verificado correctamente
                    </p>
                    <p className="text-xs text-green-700">
                      Ahora selecciona tu secuencia de 3 gestos biometricos
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                      Selecciona tu secuencia biometrica
                    </span>
                  </div>
                </div>

                {/* Selector de Gestos */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
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
                              ? 'shadow-lg'
                              : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-md'
                            }
                            ${isDisabled
                              ? 'opacity-40 cursor-not-allowed'
                              : 'cursor-pointer hover:scale-105'
                            }
                          `}
                          style={{
                            borderColor: isSelected ? '#05A8F9' : undefined,
                            backgroundColor: isSelected ? '#F4FCFF' : undefined,
                            boxShadow: isSelected ? '0 4px 14px 0 rgba(5, 168, 249, 0.2)' : undefined
                          }}
                        >
                          {isSelected && (
                            <div 
                              className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg z-10"
                              style={{ backgroundColor: '#05A8F9' }}
                            >
                              {position}
                            </div>
                          )}

                          {/* <div className="text-5xl mb-3 transform group-hover:scale-110 transition-transform">
                            {gesture === 'Open_Palm' && '🖐️'}
                            {gesture === 'Closed_Fist' && '✊'}
                            {gesture === 'Victory' && '✌️'}
                            {gesture === 'Thumb_Up' && '👍'}
                            {gesture === 'Thumb_Down' && '👎'}
                            {gesture === 'Pointing_Up' && '☝️'}
                            {gesture === 'ILoveYou' && '🤟'}
                          </div> */}
                          {/* PASO 3 */}
                          <div className="mb-3 transform group-hover:scale-110 transition-transform">
                            <img 
                              src={`/${gesture}.png`}
                              alt={gesture.replace('_', ' ')}
                              className="w-12 h-12 object-contain mx-auto block"
                            />
                          </div>

                          <p 
                            className={`text-xs font-bold ${isSelected ? '' : 'text-gray-700'}`}
                            style={{ color: isSelected ? '#05A8F9' : undefined }}
                          >
                            {gesture.replace('_', ' ')}
                          </p>
                        </button>
                      )
                    })}
                  </div>

                  {selectedGestures.length > 0 && (
                    <div 
                      className="mt-6 p-5 rounded-2xl border-2"
                      style={{ 
                        backgroundColor: '#F4FCFF',
                        borderColor: '#6FBFDE'
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <Hand className="w-4 h-4" style={{ color: '#05A8F9' }} />
                        </div>
                        <p className="text-sm font-bold" style={{ color: '#05A8F9' }}>
                          Secuencia biometrica:
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedGestures.map((gesture, index) => (
                          <div key={gesture} className="flex items-center">
                            <span 
                              className="px-3 py-1.5 bg-white rounded-lg text-sm font-semibold shadow-sm border"
                              style={{ 
                                color: '#05A8F9',
                                borderColor: '#6FBFDE'
                              }}
                            >
                              {gesture.replace('_', ' ')}
                            </span>
                            {index < selectedGestures.length - 1 && (
                              <ArrowRight className="w-4 h-4 mx-1" style={{ color: '#6FBFDE' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                  </div>
                )}

                {/* Boton de inicio */}
                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={handleStartEnrollment}
                    disabled={selectedGestures.length !== 3 || loading}
                    className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Iniciando...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>Iniciar captura</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {/* ========================================
              STEP: CAPTURE
          ======================================== */}
          {step === 'capture' && (
            <div className="max-w-5xl mx-auto">
              
              {/* Divider superior */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                    Captura de gestos biométricos
                  </span>
                </div>
              </div>

              {/* Barra de progreso única - ARRIBA */}
              {sessionStatus && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Progreso de captura
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600">
                        {sessionStatus.samples_collected || 0} / {sessionStatus.samples_needed || 21} muestras
                      </span>
                      <span className="text-lg font-black" style={{ color: '#05A8F9' }}>
                        {Math.round(sessionStatus.progress || 0)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${sessionStatus.progress || 0}%`,
                        background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                        boxShadow: '0 4px 14px 0 rgba(5, 168, 249, 0.4)'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Secuencia de Gestos*/}
              {sessionStatus && selectedGestures.length > 0 && (
              <div 
                className="p-3 sm:p-5 rounded-xl border-2 mb-4 sm:mb-6"
                style={{ 
                  backgroundColor: '#F0F9FF',
                  borderColor: '#BFDBFE'
                }}
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-xs sm:text-sm font-semibold text-blue-900">Secuencia de gestos</h3>
                  <span className="text-[10px] sm:text-xs font-semibold text-blue-600">
                    {sessionStatus.samples_collected 
                      ? `${Math.floor(sessionStatus.samples_collected / 7)}/${selectedGestures.length} gestos`
                      : `0/${selectedGestures.length} gestos`
                    }
                  </span>
                </div>
                
                {/* Secuencia horizontal con flechas - MÁS COMPACTA */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-3 flex-wrap mb-3 sm:mb-4">
                  {selectedGestures.map((gesture, idx) => {
                    const currentGestureIndex = selectedGestures.findIndex(g => g === sessionStatus.current_gesture)
                    const isCurrent = idx === currentGestureIndex
                    const isCompleted = idx < currentGestureIndex
                    
                    return (
                      <div key={idx} className="flex items-center gap-1 sm:gap-2">
                        <div 
                          className={`
                            px-2 py-2 sm:px-4 sm:py-3 rounded-lg border-2 transition-all duration-300 flex items-center gap-1.5 sm:gap-2
                            ${isCompleted 
                              ? 'bg-green-100 border-green-500' 
                              : isCurrent
                              ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 ring-offset-2 animate-pulse'
                              : 'bg-gray-100 border-gray-300'
                            }
                          `}
                        >
                          <img 
                            src={`/${gesture}.png`}
                            alt={gesture.replace('_', ' ')}
                            className="w-5 h-5 sm:w-8 sm:h-8 object-contain"
                          />
                          <div className="flex items-center gap-1 sm:gap-2">
                            {isCompleted && (
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                            )}
                            <span className={`text-[10px] sm:text-sm font-semibold ${
                              isCompleted 
                                ? 'text-green-900' 
                                : isCurrent
                                ? 'text-blue-900'
                                : 'text-gray-600'
                            }`}>
                              {isCurrent && '→ '}
                              <span className="hidden sm:inline">{gesture.replace('_', ' ')}</span>
                              <span className="sm:hidden">{gesture.replace('_', ' ').split(' ')[0]}</span>
                            </span>
                          </div>
                        </div>
                        
                        {idx < selectedGestures.length - 1 && (
                          <ArrowRight className={`w-3 h-3 sm:w-4 sm:h-4 ${
                            isCompleted ? 'text-green-400' : 'text-gray-300'
                          }`} />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Grid: Gesto esperado + Estado - MÁS COMPACTO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                  
                  {/* Card: Gesto Esperado */}
                  <div 
                    className="p-2 sm:p-3 rounded-lg border-2"
                    style={{ 
                      backgroundColor: '#F0F9FF',
                      borderColor: '#BFDBFE'
                    }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <Hand className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                      <p className="text-[10px] sm:text-xs font-semibold text-blue-700">
                        Gesto Esperado
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <img 
                        src={sessionStatus.current_gesture ? `/${sessionStatus.current_gesture}.png` : '/Hand.png'}
                        alt={sessionStatus.current_gesture?.replace('_', ' ') || 'Esperando'}
                        className="w-10 h-10 sm:w-16 sm:h-16 object-contain"
                      />
                      <p className="text-sm sm:text-base font-bold text-blue-900">
                        {sessionStatus.current_gesture?.replace('_', ' ') || 'Esperando...'}
                      </p>
                    </div>
                  </div>

                  {/* Card: Estado en Tiempo Real */}
                  <div 
                    className="p-2 sm:p-3 rounded-lg border-2 transition-all duration-300"
                    style={{
                      backgroundColor: sessionStatus.message?.includes('Capturada') || sessionStatus.message?.includes('✓')
                        ? '#F0FDF4'
                        : '#FFFFFF',
                      borderColor: sessionStatus.message?.includes('Capturada') || sessionStatus.message?.includes('✓')
                        ? '#10B981'
                        : '#E5E7EB'
                    }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      {sessionStatus.message?.includes('Capturada') || sessionStatus.message?.includes('✓') ? (
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                      ) : (
                        <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                      )}
                      <p className="text-[10px] sm:text-xs font-semibold text-gray-700">
                        Estado en tiempo real
                      </p>
                    </div>
                    
                    {sessionStatus.message ? (
                      <p className="text-xs sm:text-sm font-medium text-gray-900">
                        {sessionStatus.message}
                      </p>
                    ) : (
                      <p className="text-xs sm:text-sm font-medium text-gray-500">
                        Esperando detección...
                      </p>
                    )}
                  </div>

                </div>
              </div>
            )}
              {/* Cámara */}
              <div 
                className="rounded-2xl overflow-hidden border-4 mb-6"
                style={{ 
                  borderColor: '#E0F2FE',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
                }}
              >
                <WebcamCapture
                  onFrame={handleFrameCapture}
                  isActive={step === 'capture'}
                />
              </div>

              {!sessionStatus && (
                <div className="text-center py-8 flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#05A8F9' }} />
                  <p className="text-sm text-gray-500">
                    Inicializando sistema biométrico...
                  </p>
                </div>
              )}

              {/* Botón cancelar */}
              <div className="flex justify-center">
                <Button 
                  variant="danger" 
                  onClick={handleCancel} 
                  className="px-6 py-3 rounded-full font-bold flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* ========================================
              STEP: CONFIRMATION
          ======================================== */}
          {step === 'confirmation' && (
            <div className="max-w-2xl mx-auto text-center space-y-8">

              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-full shadow-lg">
                <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-gray-800">
                <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                  Secuencia de gestos registrada
                </span>
              </h2>

              <p className="text-lg text-gray-600">
                Tus gestos biométricos han sido capturados exitosamente.
              </p>
              <p className="text-base text-gray-500">
                Para finalizar tu registro, completa un breve cuestionario de personalidad.
              </p>

              {/* <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 max-w-md mx-auto">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-black text-green-600 mb-1">
                      {sessionStatus?.samples_collected || 0}
                    </div>
                    <div className="text-xs text-gray-600 font-medium">Muestras</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-green-600 mb-1">
                      {sessionStatus?.total_gestures || 3}
                    </div>
                    <div className="text-xs text-gray-600 font-medium">Gestos</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-green-600 mb-1">100%</div>
                    <div className="text-xs text-gray-600 font-medium">Completo</div>
                  </div>
                </div>
              </div> */}

              <Button
                onClick={() => {
                  console.log('Usuario continua al cuestionario')
                  setStep('questionnaire')
                }}
                className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 text-sm tracking-wide flex items-center gap-2"
                style={{
                  background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                  boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                }}
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <p className="text-sm text-gray-500">
                El cuestionario toma aproximadamente 2 minutos
              </p>

            </div>
          )}

          {/* ========================================
              STEP: QUESTIONNAIRE
          ======================================== */}
          {step === 'questionnaire' && userId && (
            reenrollmentData?.reusePersonality ? (
              <>
                {(() => {
                  console.log('Re-registro detectado: Saltando cuestionario, usando perfil existente')
                  console.log('Perfil de personalidad:', reenrollmentData.personalityProfile)
                  
                  setTimeout(async () => {
                  console.log('Perfil de personalidad reutilizado exitosamente')
                  
                  if (reenrollmentData?.personalityProfile) {
                    try {
                      const responses = reenrollmentData.personalityProfile.raw_responses
                        ? reenrollmentData.personalityProfile.raw_responses.split(',').map(Number)
                        : reenrollmentData.personalityProfile.responses || [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
                      
                      console.log('Guardando personality profile:', responses)
                      
                      // const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
                      // const response = await fetch(`${apiUrl}/personality/submit`, {
                      const response = await fetch(config.endpoints.personality.submit, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          user_id: userId,
                          responses: responses
                        })
                      })
                      
                      if (response.ok) {
                        console.log('Personality profile guardado exitosamente')
                      } else {
                        console.warn('Error guardando personality profile, pero continuando')
                      }
                    } catch (error) {
                      console.error('Error guardando personality profile:', error)
                    }
                  }
                  
                  setStep('success')
                }, 2000)
                  
                  return (
                    <div className="max-w-2xl mx-auto">
                      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 overflow-hidden p-12">
                        <div className="text-center space-y-6">
                          <div className="flex justify-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-8 h-8 text-blue-600" />
                            </div>
                          </div>
                          
                          <div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">
                              Perfil de Personalidad Conservado
                            </h2>
                            <p className="text-gray-600">
                              Estamos reutilizando tu perfil de personalidad existente.
                              <br />
                              No necesitas completar el cuestionario nuevamente.
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <span>Continuando al siguiente paso...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </>
            ) : (
              <PersonalityQuestionnaire
                userId={userId}
                username={username}
                onComplete={(result) => {
                  console.log('Cuestionario completado:', result)
                  console.log('Respuestas guardadas:', result.raw_responses)
                  setStep('success')
                }}
              />
            )
          )}

          {/* ========================================
              STEP: SUCCESS
          ======================================== */}
          {step === 'success' && (
            <div className="h-full flex items-center justify-center">
              <div className="max-w-2xl mx-auto text-center space-y-8">
                
                <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-full shadow-lg">
                  <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <h2 className="text-3xl sm:text-4xl font-black text-gray-800">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                    ¡Registro completado!
                  </span>
                </h2>
                
                <p className="text-lg text-gray-600">
                  El usuario <strong className="text-gray-800">{username}</strong> ha sido registrado exitosamente en el sistema biométrico.
                </p>
                
                {sessionStatus?.can_train_now && (
                  <div className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-2xl text-left max-w-md mx-auto">
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
                
                <Button
                  onClick={() => navigate('/')}
                  className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 text-sm tracking-wide flex items-center gap-2 mx-auto"
                  style={{
                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                    boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                  }}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Iniciar sesión</span>
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}