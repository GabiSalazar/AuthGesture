import { useState, useRef, useEffect } from 'react'
import { authenticationApi } from '../../lib/api/authentication'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Spinner } from '../../components/ui'
import { Search, CheckCircle, XCircle, Users, AlertCircle, Clock, Brain, Hand } from 'lucide-react'

export default function Identification() {
  const [step, setStep] = useState('ready') // 'ready', 'processing', 'result'
  const [sessionId, setSessionId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [currentFrame, setCurrentFrame] = useState(null)
  
  // ✅ NUEVO: Estados para secuencia de gestos
  const [capturedSequence, setCapturedSequence] = useState([])
  const [sequenceComplete, setSequenceComplete] = useState(false)

  // Refs para control de intervals
  const intervalRef = useRef(null)
  const isProcessingFrameRef = useRef(false)
  const sessionCompletedRef = useRef(false)

  // Cleanup al desmontar
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

  const stopProcessing = () => {
    console.log('🛑 Deteniendo procesamiento de identificación')
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    isProcessingFrameRef.current = false
    sessionCompletedRef.current = true
  }

  const handleStartIdentification = async () => {
    try {
      setProcessing(true)
      setStep('processing')
      setError(null)
      setProgress(0)
      setStatusMessage('Iniciando identificación...')
      setCurrentFrame(null)
      setCapturedSequence([]) // ✅ RESET SECUENCIA
      setSequenceComplete(false) // ✅ RESET COMPLETADO
      
      isProcessingFrameRef.current = false
      sessionCompletedRef.current = false

      // Iniciar sesión de identificación
      const response = await authenticationApi.startIdentification()
      setSessionId(response.session_id)

      // Comenzar procesamiento de frames
      startFrameProcessing(response.session_id)

    } catch (err) {
      console.error('Error iniciando identificación:', err)
      setError(err.response?.data?.detail || 'Error al iniciar identificación')
      setStep('ready')
      setProcessing(false)
    }
  }

  const startFrameProcessing = async (sessionId) => {
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 10
    const gesturesNeeded = 3 // ✅ 3 GESTOS DIFERENTES

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    console.log('▶️ Iniciando loop de identificación por secuencia')

    intervalRef.current = setInterval(async () => {
      if (sessionCompletedRef.current) {
        console.log('⏹️ Sesión ya completada, ignorando tick')
        stopProcessing()
        return
      }

      if (isProcessingFrameRef.current) {
        console.log('⏸️ Frame anterior aún procesándose, saltando tick')
        return
      }

      isProcessingFrameRef.current = true

      try {
        // Procesar frame
        const frameResult = await authenticationApi.processFrame(sessionId)

        if (sessionCompletedRef.current) {
          console.log('⏹️ Sesión completada durante request, ignorando resultado')
          isProcessingFrameRef.current = false
          return
        }

        consecutiveErrors = 0

        // ✅ ACTUALIZAR FRAME VISUAL
        if (frameResult.frame) {
          setCurrentFrame(frameResult.frame)
        }

        // ✅ ACTUALIZAR SECUENCIA CAPTURADA
        if (frameResult.captured_sequence && Array.isArray(frameResult.captured_sequence)) {
          setCapturedSequence(frameResult.captured_sequence)
          console.log(`📝 Secuencia capturada: ${frameResult.captured_sequence.join(' → ')}`)
        }

        // ✅ ACTUALIZAR ESTADO DE COMPLETADO DE SECUENCIA
        if (frameResult.sequence_complete !== undefined) {
          setSequenceComplete(frameResult.sequence_complete)
        }

        // ✅ CALCULAR PROGRESO BASADO EN GESTOS CAPTURADOS
        const gesturesCaptured = frameResult.captured_sequence?.length || 0
        const sequenceProgress = (gesturesCaptured / gesturesNeeded) * 100
        
        setProgress(Math.min(sequenceProgress, 100))
        
        // ✅ MENSAJE DE ESTADO MEJORADO
        let message = frameResult.message || ''
        if (gesturesCaptured < gesturesNeeded) {
          message = `Capturando gestos... (${gesturesCaptured}/${gesturesNeeded} gestos diferentes)`
        } else if (frameResult.phase === 'template_matching') {
          message = '🔍 Buscando coincidencias en base de datos...'
        } else if (frameResult.phase === 'score_fusion') {
          message = '🧠 Analizando características biométricas...'
        }
        setStatusMessage(message)

        console.log(`📊 Progreso: ${gesturesCaptured}/${gesturesNeeded} gestos, fase: ${frameResult.phase}`)

        // ✅ VERIFICAR SI HAY RESULTADO DE AUTENTICACIÓN
        if (frameResult.authentication_result) {
          console.log('✅ Resultado de identificación recibido:', frameResult.authentication_result)
          
          sessionCompletedRef.current = true
          isProcessingFrameRef.current = false
          stopProcessing()
          
          const authResult = frameResult.authentication_result
          handleIdentificationComplete({
            status: authResult.success ? 'authenticated' : 'rejected',
            user_id: authResult.matched_user_id || authResult.user_id || 'Desconocido',
            username: authResult.username || authResult.matched_user_id || 'Desconocido',
            confidence: authResult.fused_score || authResult.confidence || 0,
            duration: authResult.duration || 0,
            captured_sequence: frameResult.captured_sequence || []
          })
          return
        }

        // Verificar si completado (fallback)
        if (frameResult.session_completed || frameResult.status === 'completed') {
          console.log('⚠️ Sesión completada sin authentication_result')
          
          sessionCompletedRef.current = true
          isProcessingFrameRef.current = false
          stopProcessing()
          
          try {
            const finalStatus = await authenticationApi.getSessionStatus(sessionId)
            handleIdentificationComplete({
              ...finalStatus,
              captured_sequence: frameResult.captured_sequence || []
            })
          } catch (statusErr) {
            console.error('❌ Error obteniendo status final:', statusErr)
            setError('La sesión finalizó pero no se pudo obtener el resultado')
            setStep('ready')
            setProcessing(false)
          }
          return
        }

        isProcessingFrameRef.current = false

      } catch (err) {
        isProcessingFrameRef.current = false

        // Manejar 410 (sesión completada)
        if (err.response?.status === 410) {
          console.log('⚠️ Recibido 410 - sesión completada, deteniendo')
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
          setStep('ready')
          setProcessing(false)
        }
      }
    }, 200)
  }

  const handleIdentificationComplete = (finalStatus) => {
    console.log('🏁 Completando identificación:', finalStatus)
    
    sessionCompletedRef.current = true
    stopProcessing()

    setProcessing(false)
    setStep('result')
    
    const success = finalStatus.status === 'authenticated'
    
    setResult({
      success: success,
      user_id: finalStatus.user_id || 'Desconocido',
      username: finalStatus.username || finalStatus.user_id || 'Desconocido',
      confidence: finalStatus.confidence || 0,
      duration: finalStatus.duration || 0,
      captured_sequence: finalStatus.captured_sequence || [],
      message: success 
        ? '✅ Usuario identificado exitosamente' 
        : '❌ No se pudo identificar al usuario'
    })
  }

  const handleReset = () => {
    console.log('🔄 Reseteando identificación')
    
    sessionCompletedRef.current = true
    stopProcessing()

    setStep('ready')
    setSessionId(null)
    setProcessing(false)
    setResult(null)
    setError(null)
    setProgress(0)
    setStatusMessage('')
    setCurrentFrame(null)
    setCapturedSequence([])
    setSequenceComplete(false)
    
    isProcessingFrameRef.current = false
    sessionCompletedRef.current = false
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Identificación de Usuario</h1>
        <p className="text-gray-600 mt-1">Identificación biométrica 1:N - ¿Quién eres?</p>
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

      {/* PASO 1: Ready - Inicio */}
      {step === 'ready' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Iniciar Identificación
            </CardTitle>
            <CardDescription>
              El sistema determinará tu identidad mediante una secuencia única de gestos
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Información del proceso */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Hand className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-blue-900">Captura de Gestos</h3>
                </div>
                <p className="text-sm text-blue-700">
                  Realizarás 3 gestos diferentes como tu firma biométrica
                </p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-purple-900">Filtrado por Secuencia</h3>
                </div>
                <p className="text-sm text-purple-700">
                  El sistema busca usuarios con tu misma secuencia de gestos
                </p>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Brain className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-green-900">Verificación Biométrica</h3>
                </div>
                <p className="text-sm text-green-700">
                  Verifica tu identidad contra los candidatos filtrados
                </p>
              </div>
            </div>

            {/* Instrucciones */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">📋 Instrucciones:</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Haz clic en "Iniciar Identificación"</li>
                <li>• Realiza 3 gestos diferentes con tu mano</li>
                <li>• El sistema filtrará por tu secuencia de gestos única</li>
                <li>• Luego verificará tu identidad biométricamente</li>
                <li>• Espera el resultado (puede tardar 15-25 segundos)</li>
              </ul>
            </div>

            {/* Info adicional */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">🔐 Seguridad en Dos Capas:</h3>
              <p className="text-sm text-purple-700">
                <strong>Capa 1:</strong> Tu secuencia de gestos actúa como filtro inicial<br/>
                <strong>Capa 2:</strong> Verificación biométrica profunda de características únicas
              </p>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              onClick={handleStartIdentification}
              disabled={processing}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <Search className="w-4 h-4 mr-2" />
              Iniciar Identificación
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* PASO 2: Procesando */}
      {step === 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle>Identificando Usuario</CardTitle>
            <CardDescription>
              Capturando secuencia de gestos y analizando biometría...
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Frame Visual */}
            <div className="relative bg-gray-900 rounded-lg aspect-video overflow-hidden">
              {currentFrame ? (
                <>
                  <img 
                    src={currentFrame} 
                    alt="Procesamiento biométrico" 
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Indicador de captura */}
                  <div className="absolute top-4 right-4">
                    <div className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      IDENTIFICANDO
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-8">
                    <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Search className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Iniciando captura...
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Esperando primer frame del servidor
                    </p>
                    <Spinner className="w-6 h-6 text-purple-400 mx-auto mt-4" />
                  </div>
                </div>
              )}
            </div>

            {/* ✅ NUEVA: Visualización de Secuencia Capturada */}
            {capturedSequence.length > 0 && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-purple-900">Secuencia Capturada</h3>
                  <Badge variant={sequenceComplete ? 'success' : 'default'}>
                    {capturedSequence.length}/3 gestos
                  </Badge>
                </div>
                
                <div className="flex items-center gap-3">
                  {capturedSequence.map((gesture, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="px-3 py-2 bg-white border border-purple-300 rounded-lg">
                        <span className="text-sm font-medium text-purple-900">{gesture}</span>
                      </div>
                      {idx < 2 && (
                        <span className="text-purple-400">→</span>
                      )}
                    </div>
                  ))}
                  
                  {/* Placeholders para gestos faltantes */}
                  {capturedSequence.length < 3 && Array.from({ length: 3 - capturedSequence.length }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="flex items-center gap-2">
                      {capturedSequence.length > 0 && (
                        <span className="text-purple-300">→</span>
                      )}
                      <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg">
                        <span className="text-sm text-gray-400">?</span>
                      </div>
                    </div>
                  ))}
                </div>

                {sequenceComplete && (
                  <p className="text-xs text-purple-700 mt-3">
                    ✅ Secuencia completa - Buscando coincidencias en base de datos...
                  </p>
                )}
              </div>
            )}
          
            {/* Info de captura del servidor */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-xs text-purple-800 text-center">
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
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-800">{statusMessage}</p>
              </div>
            )}

            {/* ✅ ACTUALIZADA: Fases del proceso con secuencia */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  capturedSequence.length > 0 ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {capturedSequence.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span className="text-gray-700">Capturando secuencia de gestos</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  sequenceComplete ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {sequenceComplete ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span className="text-gray-700">Filtrando usuarios por secuencia</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  progress > 60 ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {progress > 60 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span className="text-gray-700">Verificación biométrica 1:1</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  progress > 90 ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {progress > 90 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span className="text-gray-700">Confirmando identidad</span>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 text-center">
                ℹ️ El sistema está procesando tus datos biométricos de forma segura
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
                  ¡Usuario Identificado!
                </h2>
                <p className="text-green-700 mb-6">
                  Has sido identificado como: <strong>{result.username}</strong>
                </p>
              </>
            ) : (
              <>
                <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-red-900 mb-2">
                  Identificación Fallida
                </h2>
                <p className="text-red-700 mb-6">
                  No se pudo identificar al usuario. Posibles razones:<br/>
                  • Secuencia de gestos no registrada<br/>
                  • Características biométricas no coinciden
                </p>
              </>
            )}

            {/* ✅ NUEVA: Mostrar secuencia capturada */}
            {result.captured_sequence && result.captured_sequence.length > 0 && (
              <div className="max-w-md mx-auto mb-6 p-4 bg-white rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Secuencia Capturada:</h3>
                <div className="flex items-center justify-center gap-2">
                  {result.captured_sequence.map((gesture, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Badge variant="outline">{gesture}</Badge>
                      {idx < result.captured_sequence.length - 1 && (
                        <span className="text-gray-400">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detalles */}
            <div className="max-w-md mx-auto space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Usuario Identificado</span>
                <span className="text-sm font-bold text-gray-900">{result.username}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">ID de Usuario</span>
                <span className="text-sm text-gray-600">{result.user_id}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Confianza</span>
                <Badge variant={result.success ? 'success' : 'danger'}>
                  {(result.confidence * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Tiempo de Procesamiento</span>
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {result.duration.toFixed(1)}s
                </span>
              </div>
            </div>

            <Button onClick={handleReset} className="w-full max-w-md bg-purple-600 hover:bg-purple-700">
              <Search className="w-4 h-4 mr-2" />
              Nueva Identificación
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}