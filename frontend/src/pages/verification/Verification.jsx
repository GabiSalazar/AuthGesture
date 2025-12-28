import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams} from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'
import { authenticationApi } from '../../lib/api/authentication'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Spinner } from '../../components/ui'
import { Search, Shield, CheckCircle, XCircle, User, AlertCircle, Clock, ArrowLeft, Video, Hand, Loader2 } from 'lucide-react'
import TimeoutModal from '../../components/TimeoutModal'

// Componente para el modal de cuenta bloqueada con countdown
function LockedAccountModal({ result, onBack }) {
  const [timeRemaining, setTimeRemaining] = useState(null)

  useEffect(() => {
    if (!result?.lockout_info?.locked_until) return

    const calculateTimeRemaining = () => {
      const now = new Date().getTime()
      const lockoutTime = new Date(result.lockout_info.locked_until).getTime()
      const diff = lockoutTime - now

      if (diff <= 0) {
        setTimeRemaining({ minutes: 0, seconds: 0, expired: true })
        return
      }

      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeRemaining({ minutes, seconds, expired: false })
    }

    calculateTimeRemaining()
    const interval = setInterval(calculateTimeRemaining, 1000)
    return () => clearInterval(interval)
  }, [result?.lockout_info?.locked_until])

  const formatTime = (time) => {
    if (!time) return '00:00'
    const mins = String(time.minutes).padStart(2, '0')
    const secs = String(time.seconds).padStart(2, '0')
    return `${mins}:${secs}`
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-red-200 overflow-hidden">
        {/* Header */}
        <div 
          className="px-8 py-6"
          style={{ background: 'linear-gradient(to right, #EF4444, #DC2626)' }}
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 rounded-full p-3">
              <svg 
                className="w-8 h-8 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Cuenta bloqueada
              </h2>
              <p className="text-red-100 text-sm mt-1">
                Múltiples intentos fallidos detectados
              </p>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-8 space-y-6">
          {/* Usuario */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <span className="text-gray-600 font-medium">Usuario</span>
            <span className="text-gray-900 font-semibold">{result.username}</span>
          </div>

          {/* Countdown */}
          <div 
            className="p-6 text-center rounded-xl border-2"
            style={{ 
              backgroundColor: '#FEF2F2',
              borderColor: '#FCA5A5'
            }}
          >
            <p className="text-gray-600 text-sm mb-3">
              Tiempo restante de bloqueo
            </p>
            <div className="text-4xl font-bold text-red-500 mb-2 font-mono tracking-wider">
              {timeRemaining ? formatTime(timeRemaining) : '00:00'}
            </div>
            <p className="text-gray-500 text-sm">
              {timeRemaining && !timeRemaining.expired ? 'minutos : segundos' : 'Cuenta desbloqueada'}
            </p>
          </div>

          {/* Desbloqueo automático */}
          {result.lockout_info?.locked_until && (
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Se desbloqueará</span>
              <span className="text-gray-900 font-semibold">
                {new Date(result.lockout_info.locked_until).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            </div>
          )}

          {/* Razón */}
          <div className="flex items-center justify-between py-3">
            <span className="text-gray-600 font-medium">Razón</span>
            <span className="text-red-600 font-semibold">
              {result.lockout_info?.max_attempts} intentos fallidos
            </span>
          </div>

          {/* Mensaje informativo */}
          <div 
            className="border rounded-lg p-4"
            style={{ 
              backgroundColor: '#EFF6FF',
              borderColor: '#BFDBFE'
            }}
          >
            <p className="text-sm text-gray-700 leading-relaxed">
              Por seguridad, tu cuenta ha sido bloqueada temporalmente. El desbloqueo es automático. 
              Asegúrate de realizar correctamente la secuencia de gestos en tu próximo intento.
            </p>
          </div>

          {/* Botón volver */}
          <Button
            onClick={onBack}
            className="w-full h-12 text-white font-bold rounded-full transition-all duration-300"
            style={{
              background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
              boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function Verification() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pluginSessionToken, setPluginSessionToken] = useState(null)
  const [pluginCallbackUrl, setPluginCallbackUrl] = useState(null)
  const [pluginEmail, setPluginEmail] = useState(null)

  const [step, setStep] = useState('select') // 'select', 'processing', 'result', 'locked'
  const [users, setUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [sessionInfo, setSessionInfo] = useState(null)
  const [timeoutInfo, setTimeoutInfo] = useState(null)
  
  // REFS PARA CÁMARA Y CANVAS
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  
  // REFS GLOBALES
  const intervalRef = useRef(null)
  const isProcessingFrameRef = useRef(false)
  const sessionCompletedRef = useRef(false)
  const sessionIdRef = useRef(null)

  const lastFrameTimeRef = useRef(0)

  // Filtrar usuarios por nombre
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    loadUsers()
  }, [])

  // CLEANUP
  useEffect(() => {
    return () => {
      console.log('Limpieza al desmontar Verification')
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      
      stopCamera()
      
      if (sessionIdRef.current) {
        authenticationApi.cancelSession(sessionIdRef.current).catch(err => 
          console.log('Info: Sesión ya finalizada')
        )
      }
      
      isProcessingFrameRef.current = false
      sessionCompletedRef.current = false
    }
  }, [])

  // Detectar datos del plugin desde URL
  // useEffect(() => {
  //   const sessionToken = searchParams.get('session_token')
  //   const email = searchParams.get('email')
    
  //   if (sessionToken && email) {
  //     // Callback URL fijo del plugin
  //     const PLUGIN_CALLBACK_URL = 'https://genia-api-extension-avbke7bhgea4bngk.eastus2-01.azurewebsites.net/generator-init'
      
  //     console.log('Datos del plugin detectados:')
  //     console.log('   Session Token:', sessionToken)
  //     console.log('   Email:', email)
  //     console.log('   Callback URL:', PLUGIN_CALLBACK_URL)
      
  //     setPluginSessionToken(sessionToken)
  //     setPluginEmail(email)
  //     setPluginCallbackUrl(PLUGIN_CALLBACK_URL)
      
  //     // Buscar y auto-seleccionar usuario por email
  //     const findAndSelectUser = () => {
  //       const user = users.find(u => u.email === email)
  //       if (user) {
  //         console.log('Usuario encontrado por email:', user.username)
  //         setSelectedUser(user)
  //         // Auto-iniciar verificación después de un breve delay
  //         setTimeout(() => {
  //           handleStartVerification()
  //         }, 500)
  //       } else {
  //         console.log('Usuario no encontrado con email:', email)
  //         setError(`No se encontró usuario con email: ${email}`)
  //       }
  //     }
      
  //     // Esperar a que se carguen los usuarios antes de buscar
  //     if (users.length > 0) {
  //       findAndSelectUser()
  //     }
  //   } else {
  //     console.log('Acceso directo - sin plugin')
  //   }
  // }, [searchParams, users])

  // Detectar datos del plugin desde URL
  // useEffect(() => {
  //   const sessionToken = searchParams.get('session_token')
  //   const email = searchParams.get('email')
  //   const action = searchParams.get('action')
    
  //   if (sessionToken && email) {
  //     // Determinar callback URL según action
  //     const PLUGIN_BASE_URL = 'https://genia-api-extension-avbke7bhgea4bngk.eastus2-01.azurewebsites.net'
  //     let callbackUrl = ''
      
  //     if (action === 'generation') {
  //       callbackUrl = `${PLUGIN_BASE_URL}/api/biometric-gen-callback`
  //     } else if (action === 'authentication') {
  //       callbackUrl = `${PLUGIN_BASE_URL}/api/biometric-login-callback`
  //     } else {
  //       // Si no viene action o es inválido, usar default (generation)
  //       console.warn('Action no especificado o inválido, usando generation por defecto')
  //       callbackUrl = `${PLUGIN_BASE_URL}/api/biometric-gen-callback`
  //     }
      
  //     console.log('Datos del plugin detectados:')
  //     console.log('   Session Token:', sessionToken)
  //     console.log('   Email:', email)
  //     console.log('   Action:', action)
  //     console.log('   Callback URL:', callbackUrl)
      
  //     setPluginSessionToken(sessionToken)
  //     setPluginEmail(email)
  //     setPluginCallbackUrl(callbackUrl)
      
  //     // Buscar y auto-seleccionar usuario por email
  //     const findAndSelectUser = () => {
  //       const user = users.find(u => u.email === email)
  //       if (user) {
  //         console.log('Usuario encontrado por email:', user.username)
  //         setSelectedUser(user)
  //         // Auto-iniciar verificación después de un breve delay
  //         setTimeout(() => {
  //           handleStartVerification()
  //         }, 500)
  //       } else {
  //         console.log('Usuario no encontrado con email:', email)
  //         setError(`No se encontró usuario con email: ${email}`)
  //       }
  //     }
      
  //     // Esperar a que se carguen los usuarios antes de buscar
  //     // if (users.length > 0) {
  //     //   findAndSelectUser()
  //     // }
  //     // Esperar a que se carguen los usuarios antes de buscar
  //     console.log('Verificando si buscar usuario...')
  //     console.log('   users.length:', users.length)
  //     console.log('   sessionToken:', sessionToken)
  //     console.log('   email:', email)

  //     if (users.length > 0) {
  //       console.log('SI hay usuarios, buscando...')
  //       findAndSelectUser()
  //     } else {
  //       console.log('NO hay usuarios aún, esperando...')
  //     }
  //   } else {
  //     console.log('Acceso directo - sin plugin')
  //   }
  // }, [searchParams, users])

  // Detectar datos del plugin desde URL
  useEffect(() => {
    const token = searchParams.get('t')
    const sessionToken = searchParams.get('session_token')
    const email = searchParams.get('email')
    const action = searchParams.get('action')
    
    // PRIORIDAD 1: Token JWT (nuevo método)
    if (token) {
      validarYUsarTokenPlugin(token)
    }
    // PRIORIDAD 2: Query params directos (método antiguo - retrocompatibilidad)
    else if (sessionToken && email) {
      usarQueryParamsDirectos(sessionToken, email, action)
    }
    // PRIORIDAD 3: Acceso directo sin plugin
    else {
      console.log('Acceso directo - sin plugin')
    }
  }, [searchParams, users])

  // Función para validar JWT del plugin
  const validarYUsarTokenPlugin = (token) => {
    try {
      console.log('Token del plugin detectado, validando...')
      
      // 1. Decodificar JWT
      const payload = jwtDecode(token)
      
      console.log('JWT decodificado:', payload)
      
      // 2. Verificar expiración
      const ahora = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < ahora) {
        console.error('Token expirado')
        setError('El enlace ha expirado. Por favor, solicita uno nuevo.')
        return
      }
      
      // 3. Extraer datos
      const { session_token, email, action } = payload
      
      if (!session_token || !email || !action) {
        console.error('Token incompleto:', payload)
        setError('Token inválido: faltan datos requeridos')
        return
      }
      
      console.log('Datos del plugin detectados:')
      console.log('   Session Token:', session_token)
      console.log('   Email:', email)
      console.log('   Action:', action)
      
      // 4. Determinar callback URL según action
      const PLUGIN_BASE_URL = 'https://genia-api-extension-avbke7bhgea4bngk.eastus2-01.azurewebsites.net'
      const callbackUrl = action === 'generation'
        ? `${PLUGIN_BASE_URL}/api/biometric-gen-callback`
        : `${PLUGIN_BASE_URL}/api/biometric-login-callback`
      
      console.log('   Callback URL:', callbackUrl)
      
      // 5. Configurar estados
      setPluginSessionToken(session_token)
      setPluginEmail(email)
      setPluginCallbackUrl(callbackUrl)
      
      // 6. Buscar y auto-seleccionar usuario
      buscarYSeleccionarUsuario(email)
      
    } catch (error) {
      console.error('Error validando token del plugin:', error)
      setError('Token inválido o corrupto. Verifica el enlace.')
    }
  }

  // Función para usar query params directos (retrocompatibilidad)
  const usarQueryParamsDirectos = (sessionToken, email, action) => {
    console.log('Query params directos detectados (método antiguo):')
    console.log('   Session Token:', sessionToken)
    console.log('   Email:', email)
    console.log('   Action:', action)
    
    // Determinar callback URL según action
    const PLUGIN_BASE_URL = 'https://genia-api-extension-avbke7bhgea4bngk.eastus2-01.azurewebsites.net'
    let callbackUrl = ''
    
    if (action === 'generation') {
      callbackUrl = `${PLUGIN_BASE_URL}/api/biometric-gen-callback`
    } else if (action === 'authentication') {
      callbackUrl = `${PLUGIN_BASE_URL}/api/biometric-login-callback`
    } else {
      console.warn('Action no especificado o invalido, usando generation por defecto')
      callbackUrl = `${PLUGIN_BASE_URL}/api/biometric-gen-callback`
    }
    
    console.log('   Callback URL:', callbackUrl)
    
    // Configurar estados
    setPluginSessionToken(sessionToken)
    setPluginEmail(email)
    setPluginCallbackUrl(callbackUrl)
    
    // Buscar y auto-seleccionar usuario
    buscarYSeleccionarUsuario(email)
  }

  // Función compartida para buscar y seleccionar usuario
  const buscarYSeleccionarUsuario = (email) => {
    console.log('Verificando si buscar usuario...')
    console.log('   users.length:', users.length)
    console.log('   email:', email)
    
    if (users.length > 0) {
      console.log('SI hay usuarios, buscando...')
      
      const user = users.find(u => u.email === email)
      
      if (user) {
        console.log('Usuario encontrado por email:', user.username)
        setSelectedUser(user)
        
        // Auto-iniciar verificación
        setTimeout(() => {
          handleStartVerification()
        }, 500)
      } else {
        console.log('Usuario no encontrado con email:', email)
        setError(`No se encontró usuario con email: ${email}`)
      }
    } else {
      console.log('NO hay usuarios aun, esperando...')
    }
  }
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
      
      console.log('Cámara iniciada')
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos.')
      console.error('Error accediendo a cámara:', err)
      throw err
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
      console.log('Cámara detenida')
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  // const loadUsers = async () => {
  //   try {
  //     const response = await authenticationApi.getAvailableUsers()
  //     setUsers(response.users || [])
  //     setError(null)
  //   } catch (err) {
  //     console.error('Error cargando usuarios:', err)
  //     setError('Error al cargar usuarios disponibles')
  //   }
  // }

  const loadUsers = async () => {
    try {
      console.log('Cargando usuarios...')
      const response = await authenticationApi.getAvailableUsers()
      console.log('Response de usuarios:', response)
      console.log('Usuarios recibidos:', response.users)
      
      const usersList = response.users || []
      console.log('Total usuarios a setear:', usersList.length)
      
      if (usersList.length > 0) {
        console.log('Primer usuario:', usersList[0])
        console.log('Emails de usuarios:', usersList.map(u => u.email))
      }
      
      setUsers(usersList)
      setError(null)
    } catch (err) {
      console.error('Error cargando usuarios:', err)
      setError('Error al cargar usuarios disponibles')
    }
  }

  const handleStartVerification = async () => {
    if (!selectedUser) {
      alert('Por favor selecciona un usuario')
      return
    }

    try {
      setProcessing(true)
      setStep('processing')
      setError(null)
      setProgress(0)
      setStatusMessage('Iniciando verificación...')
      setSessionInfo(null) 

      isProcessingFrameRef.current = false
      sessionCompletedRef.current = false

      await startCamera()

      // const response = await authenticationApi.startVerification(selectedUser.user_id)

      const response = await authenticationApi.startVerification(
        selectedUser.user_id,
        'standard',
        pluginSessionToken,
        pluginCallbackUrl
      )
      setSessionId(response.session_id)
      sessionIdRef.current = response.session_id

      setTimeout(() => {
        startFrameProcessing(response.session_id)
      }, 1000)

    } catch (err) {
      console.error('Error iniciando verificación:', err)
      setError(err.response?.data?.detail || 'Error al iniciar verificación')
      setStep('select')
      setProcessing(false)
      stopCamera()
    }
  }

  const stopProcessing = () => {
    console.log('Deteniendo procesamiento completo')
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    stopCamera()
    isProcessingFrameRef.current = false
    sessionCompletedRef.current = true
  }

  const startFrameProcessing = async (sessionId) => {
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 10
    const maxValidCaptures = 3

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    console.log('Iniciando loop de procesamiento')

    intervalRef.current = setInterval(async () => {
      if (sessionCompletedRef.current) {
        console.log('Sesión ya completada, ignorando tick')
        stopProcessing()
        return
      }

      // AGREGAR THROTTLING
      const now = Date.now()
      if (now - lastFrameTimeRef.current < 500) {
        return // Ignorar frame por throttling
      }

      if (isProcessingFrameRef.current) {
        console.log('Frame anterior aún procesándose, saltando tick')
        return
      }

      if (!videoRef.current || !canvasRef.current) {
        console.log('Video o canvas no disponible')
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current

      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.log('⏳ Video aún no tiene suficientes datos')
        return
      }
      
      lastFrameTimeRef.current = now

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.95)

      isProcessingFrameRef.current = true

      try {
        const frameResult = await authenticationApi.processFrame(sessionId, frameBase64)

        if (sessionCompletedRef.current) {
          console.log('Sesión completada durante request, ignorando resultado')
          isProcessingFrameRef.current = false
          return
        }

        consecutiveErrors = 0

        const validCaptures = frameResult.valid_captures || 0
        const capturesProgress = (validCaptures / maxValidCaptures) * 100
        
        setProgress(Math.min(capturesProgress, 100))
        // setStatusMessage(frameResult.message || `Capturando... (${validCaptures}/${maxValidCaptures})`)

        let displayMessage = frameResult.message || `Capturando... (${validCaptures}/${maxValidCaptures})`

        if (displayMessage.includes('Calidad insuficiente')) {
          displayMessage = 'Verificando...'
        }

        setStatusMessage(displayMessage)

        console.log('frameResult completo:', frameResult)
        console.log('current_gesture recibido:', frameResult.current_gesture)

        setSessionInfo({
          required_sequence: frameResult.required_sequence || [],
          captured_sequence: frameResult.captured_sequence || [],
          sequence_complete: frameResult.sequence_complete || false,
          valid_captures: validCaptures,
          current_gesture: frameResult.current_gesture || 'None',
          gesture_confidence: frameResult.gesture_confidence || 0
        })

        console.log('sessionInfo guardado con current_gesture:', frameResult.current_gesture)

        console.log(`Progreso: ${validCaptures}/${maxValidCaptures} capturas válidas`)

        if (frameResult.authentication_result) {
          console.log('Resultado de autenticación recibido - COMPLETANDO SESIÓN')
          
          sessionCompletedRef.current = true
          isProcessingFrameRef.current = false
          stopProcessing()
          
          const authResult = frameResult.authentication_result
          
          if (authResult.is_locked && authResult.lockout_info) {
            console.log('Cuenta bloqueada detectada')
            setProcessing(false)
            setStep('locked')
            setResult({
              success: false,
              is_locked: true,
              lockout_info: authResult.lockout_info,
              user_id: authResult.user_id || selectedUser.user_id,
              username: selectedUser?.username || authResult.user_id
            })
            return
          }
          
          handleVerificationComplete({
            status: authResult.success ? 'authenticated' : 'rejected',
            user_id: authResult.user_id || selectedUser.user_id,
            confidence: authResult.fused_score || authResult.confidence || 0,
            duration: authResult.duration || 0
          })
          return
        }

        if (frameResult.session_completed || frameResult.status === 'completed') {
          console.log('Sesión completada sin authentication_result')
          
          sessionCompletedRef.current = true
          isProcessingFrameRef.current = false
          stopProcessing()
          
          try {
            const finalStatus = await authenticationApi.getSessionStatus(sessionId)
            handleVerificationComplete(finalStatus)
          } catch (statusErr) {
            console.error('Error obteniendo status final:', statusErr)
            setError('La sesión finalizó pero no se pudo obtener el resultado')
            setStep('select')
            setProcessing(false)
          }
          return
        }

        if (validCaptures >= maxValidCaptures && frameResult.phase === 'template_matching') {
          console.log('Capturas completas, esperando matching...')
          setStatusMessage('Analizando identidad...')
        }

        isProcessingFrameRef.current = false

      // } catch (err) {
      //   isProcessingFrameRef.current = false

      //   const errorDetail = err.response?.data?.detail

      //   if (err.response?.status === 408 && errorDetail?.error === 'session_timeout') {
      //     console.log('Timeout detectado - mostrando modal')
      //     setTimeoutInfo({
      //       type: errorDetail.error_type || 'timeout_total',
      //       duration: errorDetail.details?.duration || 0,
      //       gesturesCaptured: errorDetail.details?.gestures_captured || 0,
      //       gesturesRequired: errorDetail.details?.gestures_required || 3,
      //       timeLimit: errorDetail.details?.time_limit || 45
      //     })
      //     sessionCompletedRef.current = true
      //     stopProcessing()
      //     return
      //   }

      //   if (err.response?.status === 410 && 
      //       (errorDetail?.error === 'session_expired' || errorDetail?.error === 'session_cleaned')) {
      //     console.log('Sesión limpiada - mostrando modal')
      //     setTimeoutInfo({
      //       type: 'session_cleaned',
      //       duration: 0,
      //       gesturesCaptured: 0,
      //       gesturesRequired: 3,
      //       timeLimit: 45,
      //       message: errorDetail?.message || 'La sesión fue cerrada'
      //     })
      //     sessionCompletedRef.current = true
      //     stopProcessing()
      //     return
      //   }

      //   consecutiveErrors++
      
      } catch (err) {
        isProcessingFrameRef.current = false

        const errorDetail = err.response?.data?.detail

        if (err.response?.status === 408 && errorDetail?.error === 'session_timeout') {
          console.log('Timeout detectado - mostrando modal')
          setTimeoutInfo({
            type: errorDetail.error_type || 'timeout_total',
            duration: errorDetail.details?.duration || 0,
            gesturesCaptured: errorDetail.details?.gestures_captured || 0,
            gesturesRequired: errorDetail.details?.gestures_required || 3,
            timeLimit: errorDetail.details?.time_limit || 45
          })
          sessionCompletedRef.current = true
          stopProcessing()
          return
        }

        // NUEVO: Manejo de 410 con session_timeout (inactividad y secuencia incorrecta)
        if (err.response?.status === 410 && errorDetail?.error === 'session_timeout') {
          console.log('Timeout 410 detectado - mostrando modal')
          setTimeoutInfo({
            type: errorDetail.error_type || 'timeout_total',
            duration: errorDetail.details?.duration || 0,
            gesturesCaptured: errorDetail.details?.gestures_captured || 0,
            gesturesRequired: errorDetail.details?.gestures_required || 3,
            timeLimit: errorDetail.details?.time_limit || 45,
            inactivity_limit: errorDetail.details?.inactivity_limit || 15,
            incorrect_gesture_limit: errorDetail.details?.incorrect_gesture_limit || 8,
            message: errorDetail?.message
          })
          sessionCompletedRef.current = true
          stopProcessing()
          return
        }

        if (err.response?.status === 410 && 
            (errorDetail?.error === 'session_expired' || errorDetail?.error === 'session_cleaned')) {
          console.log('Sesión limpiada - mostrando modal')
          setTimeoutInfo({
            type: 'session_cleaned',
            duration: 0,
            gesturesCaptured: 0,
            gesturesRequired: 3,
            timeLimit: 45,
            message: errorDetail?.message || 'La sesión fue cerrada'
          })
          sessionCompletedRef.current = true
          stopProcessing()
          return
        }

        consecutiveErrors++
        
        console.error('Error procesando frame:', err)
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          sessionCompletedRef.current = true
          stopProcessing()
          setError(err.response?.data?.detail || 'Error durante el procesamiento')
          setStep('select')
          setProcessing(false)
        }
      }
    }, 200)
  }

  const handleVerificationComplete = (finalStatus) => {
    console.log('Completando verificación:', finalStatus)
    
    sessionCompletedRef.current = true
    stopProcessing()

    setProcessing(false)
    setStep('result')
    
    const success = finalStatus.status === 'authenticated'
    
    setResult({
      success: success,
      user_id: finalStatus.user_id,
      username: selectedUser?.username || finalStatus.user_id,
      confidence: finalStatus.confidence || 0,
      duration: finalStatus.duration || 0,
      message: success 
        ? 'Identidad verificada exitosamente' 
        : 'Identidad no verificada'
    })
  }

  const handleRetryAfterTimeout = () => {
    setTimeoutInfo(null)
    setError(null)
    setStatusMessage('')
    setStep('select')
    setProcessing(false)
    setResult(null)
    sessionCompletedRef.current = false
    isProcessingFrameRef.current = false
  }

  const handleCancelAfterTimeout = () => {
    setTimeoutInfo(null)
    navigate('/')
  }

  const handleReset = () => {
    console.log('Reseteando componente')
    
    sessionCompletedRef.current = true
    stopProcessing()

    setStep('select')
    setSelectedUser(null)
    setSessionId(null)
    sessionIdRef.current = null
    setProcessing(false)
    setResult(null)
    setError(null)
    setProgress(0)
    setStatusMessage('')
    setSessionInfo(null)
    isProcessingFrameRef.current = false
    sessionCompletedRef.current = false
  }

  const handleGoBack = () => {
    navigate('/')
  }

  // Mapeo de steps a números para el wizard
  const stepToNumber = {
    'select': 1,
    'processing': 2,
    'result': 3,
    'locked': 3
  }

  const currentStepNumber = stepToNumber[step] || 1

  // Wizard de 3 pasos
  const wizardSteps = [
    { number: 1, label: 'Selección' },
    { number: 2, label: 'Verificación' },
    { number: 3, label: 'Resultado' }
  ]

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

        {/* Paso actual - abajo */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full backdrop-blur-sm">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-white">
              Paso {currentStepNumber} de 3
            </span>
          </div>
        </div>
      </div>

      {/* ========================================
          ÁREA DE CONTENIDO PRINCIPAL
      ======================================== */}
      <div className="flex-1 bg-white h-screen overflow-y-auto">
        {/* Header móvil */}
        <div 
          className="lg:hidden flex items-center justify-between px-3 py-2 border-b"
          style={{ backgroundColor: '#0291B9' }}
        >
          <button
            onClick={handleGoBack}
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

          {/* Wizard de progreso */}
          {!['locked'].includes(step) && (
            <div className="max-w-2xl mx-auto mb-12">
              <div className="flex items-center justify-between">
                {wizardSteps.map((s, index) => (
                  <div key={s.number} className="flex items-center">
                    {/* Círculo del paso */}
                    <div className="relative group">
                      <div 
                        className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer
                          ${currentStepNumber > s.number 
                            ? 'text-white shadow-lg' 
                            : currentStepNumber === s.number 
                            ? 'text-white shadow-xl' 
                            : 'bg-gray-200 text-gray-400'
                          }
                        `}
                        style={{ 
                          backgroundColor: currentStepNumber >= s.number ? '#05A8F9' : undefined
                        }}
                      >
                        {currentStepNumber > s.number ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          s.number
                        )}
                      </div>

                      {/* Tooltip */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                        <div 
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shadow-lg"
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

                    {/* Línea conectora */}
                    {index < wizardSteps.length - 1 && (
                      <div 
                        className="w-12 sm:w-16 md:w-24 lg:w-32 mx-2 h-0.5 transition-colors"
                        style={{ 
                          backgroundColor: currentStepNumber > s.number ? '#05A8F9' : '#E5E7EB'
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-6 max-w-4xl mx-auto">
              <div 
                className="border-2 rounded-xl p-4"
                style={{ 
                  backgroundColor: '#FEF2F2',
                  borderColor: '#FCA5A5'
                }}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-900 mb-1 text-left">Error</h3>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================
              STEP: SELECT
          ======================================== */}
          {step === 'select' && (
            <div className="max-w-4xl mx-auto">
              
              {/* Divider */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                    Verificación de identidad 1:1
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                {users.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-2xl mb-4">
                      <User className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-600 mb-4">No hay usuarios disponibles para verificación</p>
                    <Button 
                      onClick={loadUsers}
                      className="px-6 py-3 text-white font-bold rounded-full transition-all duration-300"
                      style={{
                        background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                        boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                      }}
                    >
                      Recargar
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Barra de búsqueda */}
                    <div className="mb-6">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar usuario por nombre..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-all text-gray-900 font-medium"
                          style={{ 
                            borderColor: '#E0F2FE',
                            backgroundColor: '#FFFFFF'
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
                      
                      {searchTerm && (
                        <p className="mt-2 text-sm text-gray-600">
                          {filteredUsers.length} {filteredUsers.length === 1 ? 'usuario encontrado' : 'usuarios encontrados'}
                        </p>
                      )}
                    </div>

                    {filteredUsers.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-4">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 mb-2">No se encontraron usuarios</p>
                        <p className="text-sm text-gray-500">Intenta con otro nombre</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredUsers.map((user) => (
                          <button
                            key={user.user_id}
                            onClick={() => setSelectedUser(user)}
                            className={`
                              group p-5 rounded-2xl border-2 transition-all duration-300
                              ${selectedUser?.user_id === user.user_id
                                ? 'shadow-lg'
                                : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-md'
                              }
                            `}
                            style={{
                              borderColor: selectedUser?.user_id === user.user_id ? '#05A8F9' : undefined,
                              backgroundColor: selectedUser?.user_id === user.user_id ? '#F4FCFF' : undefined,
                              boxShadow: selectedUser?.user_id === user.user_id ? '0 4px 14px 0 rgba(5, 168, 249, 0.2)' : undefined
                            }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div 
                                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ 
                                    backgroundColor: selectedUser?.user_id === user.user_id ? '#E0F2FE' : '#F3F4F6'
                                  }}
                                >
                                  <User 
                                    className="w-6 h-6" 
                                    style={{ 
                                      color: selectedUser?.user_id === user.user_id ? '#05A8F9' : '#6B7280'
                                    }}
                                  />
                                </div>
                                <div className="min-w-0 flex-1 text-left">
                                  <p 
                                    className="font-bold truncate text-base"
                                    style={{ 
                                      color: selectedUser?.user_id === user.user_id ? '#05A8F9' : '#111827'
                                    }}
                                  >
                                    {user.username}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">ID: {user.user_id}</p>
                                </div>
                              </div>
                              {selectedUser?.user_id === user.user_id && (
                                <CheckCircle className="w-5 h-5 flex-shrink-0 ml-2" style={{ color: '#05A8F9' }} />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="pt-4 flex justify-center">
                  <Button
                    onClick={handleStartVerification}
                    disabled={!selectedUser || processing}
                    className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    <Shield className="w-4 h-4" />
                    Verificar identidad
                  </Button>
                </div>
              </div>
            </div>
          )}
          

          {/* ========================================
              STEP: PROCESSING
          ======================================== */}
          {step === 'processing' && (
            <div className="max-w-5xl mx-auto">
              
              {/* Divider */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                    Verificando identidad biométrica
                  </span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Progreso de verificación
                  </span>
                  <span className="text-lg font-black" style={{ color: '#05A8F9' }}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${progress}%`,
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 14px 0 rgba(5, 168, 249, 0.4)'
                    }}
                  />
                </div>
              </div>

              {/* Secuencia de Gestos */}
              {/* {sessionInfo && sessionInfo.required_sequence && (
                <div 
                  className="p-5 rounded-xl border-2 mb-6"
                  style={{ 
                    backgroundColor: '#F0F9FF',
                    borderColor: '#BFDBFE'
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-blue-900">Secuencia de Gestos</h3>
                    <Badge variant={sessionInfo.sequence_complete ? 'success' : 'default'}>
                      {sessionInfo.captured_sequence?.length || 0}/{sessionInfo.required_sequence.length} gestos
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
                    {sessionInfo.required_sequence.map((gesture, idx) => {
                      const isCaptured = idx < (sessionInfo.captured_sequence?.length || 0)
                      const isCurrent = idx === (sessionInfo.captured_sequence?.length || 0)
                      
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <div className={`px-4 py-3 rounded-lg border-2 transition-all ${
                            isCaptured 
                              ? 'bg-green-100 border-green-500' 
                              : isCurrent
                              ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 ring-offset-2 animate-pulse'
                              : 'bg-gray-100 border-gray-300'
                          }`}>
                            <div className="flex items-center gap-2">
                              {isCaptured && (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              )}
                              <span className={`text-sm font-semibold ${
                                isCaptured 
                                  ? 'text-green-900' 
                                  : isCurrent
                                  ? 'text-blue-900'
                                  : 'text-gray-600'
                              }`}>
                                {isCurrent && '→ '}
                                {gesture}
                              </span>
                            </div>
                          </div>
                          
                          {idx < sessionInfo.required_sequence.length - 1 && (
                            <ArrowLeft className={`w-4 h-4 rotate-180 ${
                              isCaptured ? 'text-green-400' : 'text-gray-300'
                            }`} />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {sessionInfo.required_sequence && !sessionInfo.sequence_complete && (
                    <div 
                      className="p-3 border-2 rounded-lg"
                      style={{ 
                        backgroundColor: '#FFFFFF',
                        borderColor: '#BFDBFE'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Hand className="w-4 h-4 text-blue-700" />
                        <p className="text-sm font-medium text-blue-900">
                          Gesto actual: <strong>{sessionInfo.required_sequence[sessionInfo.captured_sequence?.length || 0]}</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {sessionInfo.sequence_complete && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-700" />
                      <p className="text-xs text-green-700 font-medium">
                        Secuencia completa - Analizando identidad biométrica...
                      </p>
                    </div>
                  )}
                </div>
              )} */}

              {/* Secuencia de Gestos */}
              {sessionInfo && sessionInfo.required_sequence && (
                <div 
                  className="p-2 lg:p-5 rounded-lg lg:rounded-xl border lg:border-2 mb-3 lg:mb-6"
                  style={{ 
                    backgroundColor: '#F0F9FF',
                    borderColor: '#BFDBFE'
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5 lg:mb-4">
                    <h3 className="text-[10px] lg:text-sm font-semibold text-blue-900">Secuencia</h3>
                    <Badge variant={sessionInfo.sequence_complete ? 'success' : 'default'}>
                      <span className="text-[10px] lg:text-xs">{sessionInfo.captured_sequence?.length || 0}/{sessionInfo.required_sequence.length}</span>
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-center gap-1 lg:gap-3 flex-wrap mb-1.5 lg:mb-4">
                    {sessionInfo.required_sequence.map((gesture, idx) => {
                      const isCaptured = idx < (sessionInfo.captured_sequence?.length || 0)
                      const isCurrent = idx === (sessionInfo.captured_sequence?.length || 0)
                      
                      return (
                        <div key={idx} className="flex items-center gap-0.5 lg:gap-2">
                          <div className={`px-1.5 py-1 lg:px-4 lg:py-3 rounded lg:rounded-lg border lg:border-2 transition-all ${
                            isCaptured 
                              ? 'bg-green-100 border-green-500' 
                              : isCurrent
                              ? 'bg-blue-100 border-blue-500 ring-1 lg:ring-2 ring-blue-300 animate-pulse'
                              : 'bg-gray-100 border-gray-300'
                          }`}>
                            <div className="flex items-center gap-0.5 lg:gap-2">
                              {isCaptured && (
                                <CheckCircle className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-green-600" />
                              )}
                              <span className={`text-[10px] lg:text-sm font-semibold whitespace-nowrap ${
                                isCaptured 
                                  ? 'text-green-900' 
                                  : isCurrent
                                  ? 'text-blue-900'
                                  : 'text-gray-600'
                              }`}>
                                {isCurrent && '→ '}
                                {/* ============================================== */}
                                {/* CAMBIO: Auto-revelar solo si fue capturado   */}
                                {isCaptured ? gesture : `Gesto ${idx + 1}`}
                                {/* ============================================== */}
                              </span>
                            </div>
                          </div>
                          
                          {idx < sessionInfo.required_sequence.length - 1 && (
                            <ArrowLeft className={`w-2.5 h-2.5 lg:w-4 lg:h-4 rotate-180 ${
                              isCaptured ? 'text-green-400' : 'text-gray-300'
                            }`} />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {sessionInfo.sequence_complete && (
                    <div className="flex items-center gap-1 lg:gap-2">
                      <CheckCircle className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-green-700" />
                      <p className="text-[10px] lg:text-xs font-medium text-green-700">
                        Secuencia completa - Analizando...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Cámara
              <div 
                className="rounded-2xl overflow-hidden border-4 mb-6"
                style={{ 
                  borderColor: '#E0F2FE',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
                }}
              >
                <div className="relative bg-gray-900 aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  /> */}
              {/* Cámara */}
              <div 
                className="rounded-2xl overflow-hidden border-4 mb-6"
                style={{ 
                  borderColor: '#E0F2FE',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
                }}
              >
                <div className="relative bg-gray-900 aspect-[4/3] lg:aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover lg:object-contain"
                  />
                  
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Indicador CAPTURANDO */}
                  <div className="absolute top-3 right-4">
                    <div 
                      className="flex items-center gap-2 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg"
                      style={{ backgroundColor: '#EF4444' }}
                    >
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      CAPTURANDO
                    </div>
                  </div>
                  
                  {/* Icono de cámara */}
                  <div className="absolute top-3 left-4">
                    <div className="p-2 bg-white/90 rounded-lg shadow-lg">
                      <Video className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {/* {statusMessage && (
                <div 
                  className="p-4 border-2 rounded-lg mb-6"
                  style={{ 
                    backgroundColor: '#F0F9FF',
                    borderColor: '#BFDBFE'
                  }}
                >
                  <p className="text-sm text-blue-800 font-medium">{statusMessage}</p>
                </div>
              )} */}

              {statusMessage && (
                <div 
                  className="p-4 border-2 rounded-lg mb-6"
                  style={{ 
                    backgroundColor: '#F0F9FF',
                    borderColor: '#BFDBFE'
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    {statusMessage === 'Verificando...' && (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    )}
                    <p className="text-sm text-blue-800 font-medium">{statusMessage}</p>
                  </div>
                </div>
              )}

              {/* Botón Cancelar */}
              <div className="flex justify-center">
                <Button
                  onClick={() => {
                    if (sessionId) {
                      authenticationApi.cancelSession(sessionId)
                    }
                    handleReset()
                  }}
                  variant="danger"
                  className="px-6 py-3 rounded-full font-bold flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* ========================================
              STEP: RESULT
          ======================================== */}
          {step === 'result' && result && (
            <div className="max-w-2xl mx-auto text-center">
              
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full shadow-lg mb-6"
                style={{ backgroundColor: result.success ? '#10B981' : '#EF4444' }}
              >
                {result.success ? (
                  <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <XCircle className="w-14 h-14 text-white" />
                )}
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-gray-800 mb-4">
                <span className={`bg-gradient-to-r ${
                  result.success 
                    ? 'from-green-500 to-emerald-500' 
                    : 'from-red-500 to-red-600'
                } bg-clip-text text-transparent`}>
                  {result.success ? '¡Verificación Exitosa!' : 'Verificación fallida'}
                </span>
              </h2>

              <p className="text-lg text-gray-600 mb-8">
                {result.success 
                  ? `La identidad de ${result.username} ha sido verificada correctamente`
                  : 'No se pudo verificar la identidad del usuario'
                }
              </p>

              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 max-w-md mx-auto mb-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Usuario</span>
                    <span className="text-sm font-bold text-gray-900">{result.username}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Confianza</span>
                    <Badge variant={result.success ? 'success' : 'danger'}>
                      {(result.confidence * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Duración</span>
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {result.duration.toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleReset} 
                className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 flex items-center gap-2 mx-auto"
                style={{
                  background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                  boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                }}
              >
                <Shield className="w-4 h-4" />
                Nueva verificación
              </Button>
            </div>
          )}

          {/* ========================================
              STEP: LOCKED
          ======================================== */}
          {step === 'locked' && result && (
            <LockedAccountModal 
              result={result}
              onBack={() => {
                setStep('select')
                setResult(null)
                setError(null)
                setSelectedUser(null)
              }}
            />
          )}

        </div>
      </div>

      {/* Modal de Timeout */}
      <TimeoutModal
        timeoutInfo={timeoutInfo}
        onRetry={handleRetryAfterTimeout}
        onCancel={handleCancelAfterTimeout}
      />
    </div>
  )
}