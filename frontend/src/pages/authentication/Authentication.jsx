// import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui'
// import { Shield } from 'lucide-react'

// export default function Authentication() {
//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-3xl font-bold text-gray-900">Autenticación</h1>
//         <p className="text-gray-600 mt-1">Verificación e identificación biométrica</p>
//       </div>

//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <Shield className="w-5 h-5" />
//             Módulo en Construcción
//           </CardTitle>
//           <CardDescription>
//             Próximamente: Verificación 1:1 e Identificación 1:N
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           <p className="text-gray-600">
//             Este módulo permitirá autenticar usuarios mediante gestos de mano.
//           </p>
//         </CardContent>
//       </Card>
//     </div>
//   )
// }


import { useState, useRef, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui'
import { Button } from '../components/ui/button'
import { Shield, User, Users, Video, VideoOff, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import { authenticationApi } from '../services/api'
import TimeoutModal from '../../components/TimeoutModal'

export default function Authentication() {
  // Estados principales
  const [mode, setMode] = useState(null) // 'verification' | 'identification'
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sessionInfo, setSessionInfo] = useState(null)

  // Referencias
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)

  const [timeoutInfo, setTimeoutInfo] = useState(null)

  // Cargar usuarios disponibles al montar
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await authenticationApi.getAvailableUsers()
      setUsers(data.users || [])
    } catch (err) {
      console.error('Error cargando usuarios:', err)
    }
  }

  // Iniciar cámara
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
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos.')
      console.error('Error accediendo a cámara:', err)
    }
  }

  // Detener cámara
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  // Iniciar verificación 1:1
  const handleStartVerification = async () => {
    if (!selectedUser) {
      setError('Selecciona un usuario')
      return
    }

    try {
      setError('')
      setMessage('Iniciando verificación...')
      const data = await authenticationApi.startVerification(selectedUser)
      setSessionId(data.session_id)
      setSessionInfo(data)
      setMode('verification')
      await startCamera()
      setTimeout(() => startProcessing(), 1000) // Esperar a que la cámara esté lista
    } catch (err) {
      setError('Error iniciando verificación: ' + (err.response?.data?.detail || err.message))
      console.error(err)
    }
  }

  // Iniciar identificación 1:N
  const handleStartIdentification = async () => {
    try {
      setError('')
      setMessage('Iniciando identificación...')
      const data = await authenticationApi.startIdentification()
      setSessionId(data.session_id)
      setSessionInfo(data)
      setMode('identification')
      await startCamera()
      setTimeout(() => startProcessing(), 1000) // Esperar a que la cámara esté lista
    } catch (err) {
      setError('Error iniciando identificación: ' + (err.response?.data?.detail || err.message))
      console.error(err)
    }
  }

  // Procesar frames continuamente
  const startProcessing = () => {
    setIsProcessing(true)
    
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !sessionId) return

      const video = videoRef.current
      const canvas = canvasRef.current

      // Verificar que el video esté listo
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return

      // Capturar frame
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)

      // Convertir a base64
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.95)

      try {
        // Enviar frame al backend
        const response = await authenticationApi.processFrame(sessionId, frameBase64)
        
        // Actualizar mensaje
        setMessage(response.message || 'Procesando...')
        setSessionInfo(response)

        // Si hay resultado de autenticación, detener
        if (response.authentication_result) {
          setResult(response.authentication_result)
          stopProcessing()
        }

        // Si la sesión se completó o expiró, detener
        if (response.status === 'completed' || response.status === 'timeout' || response.status === 'cancelled') {
          stopProcessing()
        }

      // } catch (err) {
      //   console.error('Error procesando frame:', err)
      //   setError('Error procesando frame: ' + (err.response?.data?.detail || err.message))
      //   stopProcessing()
      // }

      } catch (err) {
        console.error('Error procesando frame:', err)
        
        // Detectar errores específicos de timeout
        const errorDetail = err.response?.data?.detail
        
        // Caso 1: Timeout (HTTP 408) - sesión expiró en este frame
        if (err.response?.status === 408 && errorDetail?.error === 'session_timeout') {
          setTimeoutInfo({
            type: errorDetail.error_type || 'timeout_total',
            duration: errorDetail.details?.duration || 0,
            gesturesCaptured: errorDetail.details?.gestures_captured || 0,
            gesturesRequired: errorDetail.details?.gestures_required || 3,
            timeLimit: errorDetail.details?.time_limit || 45
          })
          stopProcessing()
          return
        }
        
        // Caso 2: Sesión limpiada (HTTP 410) - sesión ya fue cerrada
        if (err.response?.status === 410 && 
            (errorDetail?.error === 'session_expired' || errorDetail?.error === 'session_cleaned')) {
          setTimeoutInfo({
            type: 'session_cleaned',
            duration: 0,
            gesturesCaptured: 0,
            gesturesRequired: 3,
            timeLimit: 45,
            message: errorDetail?.message || 'La sesión fue cerrada'
          })
          stopProcessing()
          return
        }
        
        // Caso 3: Otros errores
        setError('Error procesando frame: ' + (errorDetail || err.message))
        stopProcessing()
      }
    }, 100) // Procesar cada 100ms (~10 FPS)
  }

  // Detener procesamiento
  const stopProcessing = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsProcessing(false)
    stopCamera()
  }

  const handleRetryAfterTimeout = () => {
    // Limpiar estado de timeout
    setTimeoutInfo(null)
    setError(null)
    setMessage('')
    
    // Reiniciar autenticación
    setStep('ready')
    setProcessing(false)
    setResult(null)
    setSessionInfo(null)
  }

  const handleCancelAfterTimeout = () => {
    // Limpiar todo y volver al inicio
    setTimeoutInfo(null)
    setError(null)
    setMessage('')
    setStep('ready')
    setProcessing(false)
    setResult(null)
    setSessionInfo(null)
    
    // Navegar de regreso
    navigate('/')
  }

  // Resetear todo
  const handleReset = () => {
    stopProcessing()
    setMode(null)
    setSessionId(null)
    setSelectedUser(null)
    setResult(null)
    setMessage('')
    setError('')
    setSessionInfo(null)
  }

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopProcessing()
    }
  }, [])

  // ========== VISTA DE SELECCIÓN DE MODO ==========
  if (!mode) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Autenticación Biométrica</h1>
          <p className="text-gray-600 mt-1">Selecciona el modo de autenticación</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Verificación 1:1 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Verificación 1:1
              </CardTitle>
              <CardDescription>
                Confirmar la identidad de un usuario específico
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Usuario
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">Seleccionar usuario...</option>
                  {users.map(user => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleStartVerification}
                disabled={!selectedUser}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Shield className="w-4 h-4 mr-2" />
                Iniciar Verificación
              </Button>
            </CardContent>
          </Card>

          {/* Identificación 1:N */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                Identificación 1:N
              </CardTitle>
              <CardDescription>
                Determinar quién es el usuario sin selección previa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                El sistema comparará tus gestos con todos los usuarios registrados para identificarte.
              </p>
              <Button
                onClick={handleStartIdentification}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Users className="w-4 h-4 mr-2" />
                Iniciar Identificación
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ========== VISTA DE PROCESAMIENTO ==========
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            {mode === 'verification' ? (
              <>
                <User className="w-8 h-8 text-blue-600" />
                Verificación en Progreso
              </>
            ) : (
              <>
                <Users className="w-8 h-8 text-green-600" />
                Identificación en Progreso
              </>
            )}
          </h1>
          <p className="text-gray-600 mt-1">{message}</p>
        </div>
        <Button onClick={handleReset} variant="outline">
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video en Vivo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isProcessing ? (
                <Video className="w-5 h-5 text-green-600" />
              ) : (
                <VideoOff className="w-5 h-5 text-gray-400" />
              )}
              Cámara en Vivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg bg-gray-900"
              />
              {isProcessing && (
                <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  GRABANDO
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            {/* Información de sesión */}
            {sessionInfo && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Frames procesados:</span>
                  <span className="font-semibold">{sessionInfo.frames_processed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Capturas válidas:</span>
                  <span className="font-semibold">{sessionInfo.valid_captures || 0}</span>
                </div>
                {sessionInfo.required_sequence && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Secuencia:</span>
                    <span className="font-semibold">{sessionInfo.required_sequence.join(' → ')}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resultado o Estado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result ? (
                result.success ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <X className="w-5 h-5 text-red-600" />
                )
              ) : (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              )}
              {result ? 'Resultado' : 'Procesando...'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result ? (
              // Estado de procesamiento
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">
                  {mode === 'verification' 
                    ? 'Verificando tu identidad...' 
                    : 'Identificando usuario...'}
                </p>
              </div>
            ) : (
              // Resultado de autenticación
              <>
                <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`font-semibold text-lg ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                    {result.success ? '✅ Autenticación Exitosa' : 'Autenticación Fallida'}
                  </p>
                  {result.matched_user_id && (
                    <p className="text-sm text-gray-700 mt-2">
                      <span className="font-medium">Usuario identificado:</span> {result.matched_user_id}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Confianza General:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${result.confidence > 0.8 ? 'bg-green-600' : result.confidence > 0.6 ? 'bg-yellow-600' : 'bg-red-600'}`}
                          style={{ width: `${result.confidence * 100}%` }}
                        />
                      </div>
                      <span className="font-semibold w-12 text-right">
                        {(result.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Score Anatómico:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${result.anatomical_score * 100}%` }}
                        />
                      </div>
                      <span className="font-semibold w-12 text-right">
                        {(result.anatomical_score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Score Dinámico:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-purple-600"
                          style={{ width: `${result.dynamic_score * 100}%` }}
                        />
                      </div>
                      <span className="font-semibold w-12 text-right">
                        {(result.dynamic_score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Duración:</span>
                    <span className="font-semibold">{result.duration?.toFixed(2)}s</span>
                  </div>
                </div>

                <Button onClick={handleReset} className="w-full mt-4">
                  Nueva Autenticación
                </Button>
              </>
            )}
          </CardContent>
        </Card>
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