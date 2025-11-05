import { useState, useEffect, useRef } from 'react'
import { authenticationApi } from '../../lib/api/authentication'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Spinner } from '../../components/ui'
import WebcamCapture from '../../components/camera/WebcamCapture'
import { Shield, CheckCircle, XCircle, User, AlertCircle, Clock } from 'lucide-react'

export default function Verification() {
  const [step, setStep] = useState('select') // 'select', 'processing', 'result'
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [currentFrame, setCurrentFrame] = useState(null)
  
  // ✅ REFS GLOBALES
  const intervalRef = useRef(null)
  const isProcessingFrameRef = useRef(false)  // ✅ FLAG ANTI-CONCURRENCIA
  const sessionCompletedRef = useRef(false)   // ✅ FLAG DE SESIÓN COMPLETADA


  useEffect(() => {
    loadUsers()
  }, [])

  // ✅ CLEANUP AL DESMONTAR
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      isProcessingFrameRef.current = false
      sessionCompletedRef.current = false
    }
  }, [])

  const loadUsers = async () => {
    try {
      const response = await authenticationApi.getAvailableUsers()
      setUsers(response.users || [])
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
      
      // ✅ RESETEAR FLAGS
      isProcessingFrameRef.current = false
      sessionCompletedRef.current = false

      // Iniciar sesión de verificación
      const response = await authenticationApi.startVerification(selectedUser.user_id)
      setSessionId(response.session_id)

      // Comenzar procesamiento de frames
      startFrameProcessing(response.session_id)

    } catch (err) {
      console.error('Error iniciando verificación:', err)
      setError(err.response?.data?.detail || 'Error al iniciar verificación')
      setStep('select')
      setProcessing(false)
    }
  }

  const stopProcessing = () => {
    console.log('🛑 Deteniendo procesamiento completo')
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    isProcessingFrameRef.current = false
    sessionCompletedRef.current = true
  }

  const startFrameProcessing = async (sessionId) => {
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 10
    const maxValidCaptures = 5

    // ✅ LIMPIAR INTERVALO ANTERIOR
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    console.log('▶️ Iniciando loop de procesamiento')

    intervalRef.current = setInterval(async () => {
      // ✅ VERIFICAR SI YA SE COMPLETÓ LA SESIÓN
      if (sessionCompletedRef.current) {
        console.log('⏹️ Sesión ya completada, ignorando tick')
        stopProcessing()
        return
      }

      // ✅ VERIFICAR SI YA HAY UN FRAME PROCESÁNDOSE
      if (isProcessingFrameRef.current) {
        console.log('⏸️ Frame anterior aún procesándose, saltando tick')
        return
      }

      // ✅ MARCAR COMO PROCESANDO
      isProcessingFrameRef.current = true

      try {
        // Procesar frame
        const frameResult = await authenticationApi.processFrame(sessionId)

        // ✅ VERIFICAR NUEVAMENTE POR SI SE COMPLETÓ MIENTRAS ESPERÁBAMOS
        if (sessionCompletedRef.current) {
          console.log('⏹️ Sesión completada durante request, ignorando resultado')
          isProcessingFrameRef.current = false
          return
        }

        // Resetear contador de errores
        consecutiveErrors = 0

        // Actualizar frame visual si existe
        if (frameResult.frame) {
          setCurrentFrame(frameResult.frame)
        }

        // Actualizar progreso
        const validCaptures = frameResult.valid_captures || 0
        const capturesProgress = (validCaptures / maxValidCaptures) * 100
        
        setProgress(Math.min(capturesProgress, 100))
        setStatusMessage(frameResult.message || `Capturando... (${validCaptures}/${maxValidCaptures})`)

        console.log(`📊 Progreso: ${validCaptures}/${maxValidCaptures} capturas válidas`)

        // ✅ VERIFICAR SI HAY RESULTADO DE AUTENTICACIÓN
        if (frameResult.authentication_result) {
          console.log('✅ Resultado de autenticación recibido - COMPLETANDO SESIÓN')
          
          // ✅ MARCAR COMO COMPLETADA INMEDIATAMENTE
          sessionCompletedRef.current = true
          isProcessingFrameRef.current = false
          stopProcessing()
          
          // Usar el resultado directamente del frameResult
          const authResult = frameResult.authentication_result
          handleVerificationComplete({
            status: authResult.success ? 'authenticated' : 'rejected',
            user_id: authResult.user_id || selectedUser.user_id,
            confidence: authResult.fused_score || authResult.confidence || 0,
            duration: authResult.duration || 0
          })
          return
        }

        // Verificar si completado (método antiguo - fallback)
        if (frameResult.session_completed || frameResult.status === 'completed') {
          console.log('⚠️ Sesión completada sin authentication_result')
          
          sessionCompletedRef.current = true
          isProcessingFrameRef.current = false
          stopProcessing()
          
          try {
            const finalStatus = await authenticationApi.getSessionStatus(sessionId)
            handleVerificationComplete(finalStatus)
          } catch (statusErr) {
            console.error('❌ Error obteniendo status final:', statusErr)
            setError('La sesión finalizó pero no se pudo obtener el resultado')
            setStep('select')
            setProcessing(false)
          }
          return
        }

        // Verificar fase de matching
        if (validCaptures >= maxValidCaptures && frameResult.phase === 'template_matching') {
          console.log('✅ Capturas completas, esperando matching...')
          setStatusMessage('Analizando identidad...')
        }

        // ✅ LIBERAR FLAG DE PROCESAMIENTO
        isProcessingFrameRef.current = false

      } catch (err) {
        // ✅ LIBERAR FLAG INMEDIATAMENTE
        isProcessingFrameRef.current = false

        // ✅ MANEJAR 410 - Sesión ya cerrada
        if (err.response?.status === 410) {
          console.log('⚠️ Recibido 410 - sesión ya procesada, deteniendo')
          sessionCompletedRef.current = true
          stopProcessing()
          return  // ✅ NO MOSTRAR ERROR
        }

        // Otros errores
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
    console.log('🏁 Completando verificación:', finalStatus)
    
    // ✅ DETENER TODO
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
        ? '✅ Identidad verificada exitosamente' 
        : '❌ Identidad no verificada'
    })
  }

  const handleReset = () => {
    console.log('🔄 Reseteando componente')
    
    // ✅ DETENER TODO
    sessionCompletedRef.current = true
    stopProcessing()

    setStep('select')
    setSelectedUser(null)
    setSessionId(null)
    setProcessing(false)
    setResult(null)
    setError(null)
    setProgress(0)
    setStatusMessage('')
    setCurrentFrame(null)
    
    // ✅ RESETEAR FLAGS
    isProcessingFrameRef.current = false
    sessionCompletedRef.current = false
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Verificación de Identidad</h1>
        <p className="text-gray-600 mt-1">Verificación biométrica 1:1</p>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASO 1: Seleccionar Usuario */}
      {step === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Seleccionar Usuario
            </CardTitle>
            <CardDescription>
              Elige el usuario cuya identidad quieres verificar
            </CardDescription>
          </CardHeader>

          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No hay usuarios disponibles para verificación</p>
                <Button onClick={loadUsers} variant="outline">
                  Recargar
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => setSelectedUser(user)}
                    className={`
                      p-4 rounded-lg border-2 transition-all text-left
                      ${selectedUser?.user_id === user.user_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.username}</p>
                          <p className="text-xs text-gray-500">ID: {user.user_id}</p>
                        </div>
                      </div>
                      {selectedUser?.user_id === user.user_id && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      Templates: {user.total_templates || 0}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              onClick={handleStartVerification}
              disabled={!selectedUser || processing}
              className="w-full"
            >
              <Shield className="w-4 h-4 mr-2" />
              Iniciar Verificación
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* PASO 2: Procesando */}
      {step === 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle>Verificando Identidad</CardTitle>
            <CardDescription>
              Usuario: <strong>{selectedUser?.username}</strong>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Frame visual del servidor con overlays */}
            <div className="relative bg-gray-900 rounded-lg aspect-video overflow-hidden">
              {currentFrame ? (
                <>
                  <img 
                    src={currentFrame} 
                    alt="Procesamiento biométrico" 
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Indicador de captura activa */}
                  <div className="absolute top-4 right-4">
                    <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      CAPTURANDO
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-8">
                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Shield className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Iniciando captura...
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Esperando primer frame del servidor
                    </p>
                    <Spinner className="w-6 h-6 text-blue-400 mx-auto mt-4" />
                  </div>
                </div>
              )}
            </div>
          
            {/* Info de captura del servidor */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800 text-center">
                ℹ️ El procesamiento biométrico se realiza en el servidor con su propia cámara
              </p>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progreso</span>
                <span className="text-sm font-bold text-gray-900">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">{statusMessage}</p>
              </div>
            )}

            {/* Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 text-center">
                ℹ️ El sistema está capturando y procesando tus gestos biométricos
              </p>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              onClick={() => {
                if (sessionId) {
                  authenticationApi.cancelSession(sessionId)
                }
                handleReset()
              }}
              variant="outline"
              className="w-full"
            >
              Cancelar
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* PASO 3: Resultado */}
      {step === 'result' && result && (
        <Card className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="pt-12 pb-12 text-center">
            {result.success ? (
              <>
                <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-900 mb-2">
                  ¡Verificación Exitosa!
                </h2>
                <p className="text-green-700 mb-6">
                  La identidad de <strong>{result.username}</strong> ha sido verificada correctamente
                </p>
              </>
            ) : (
              <>
                <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-red-900 mb-2">
                  Verificación Fallida
                </h2>
                <p className="text-red-700 mb-6">
                  No se pudo verificar la identidad del usuario
                </p>
              </>
            )}

            {/* Detalles */}
            <div className="max-w-md mx-auto space-y-3 mb-6">
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

            <Button onClick={handleReset} className="w-full max-w-md">
              <Shield className="w-4 h-4 mr-2" />
              Nueva Verificación
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}