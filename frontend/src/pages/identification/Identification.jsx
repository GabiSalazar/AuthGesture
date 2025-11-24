import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticationApi } from '../../lib/api/authentication'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Spinner } from '../../components/ui'
import { Search, CheckCircle, XCircle, Users, AlertCircle, Clock, Brain, Hand, ArrowLeft, Shield, Info, FileText } from 'lucide-react'

export default function Identification() {
  const navigate = useNavigate()
  const [step, setStep] = useState('ready') // 'ready', 'processing', 'result'
  const [sessionId, setSessionId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [currentFrame, setCurrentFrame] = useState(null)
  
  const [capturedSequence, setCapturedSequence] = useState([])
  const [sequenceComplete, setSequenceComplete] = useState(false)

  const intervalRef = useRef(null)
  const isProcessingFrameRef = useRef(false)
  const sessionCompletedRef = useRef(false)

  const sessionIdRef = useRef(null)

  // useEffect(() => {
  //   return () => {
  //     if (intervalRef.current) {
  //       clearInterval(intervalRef.current)
  //       intervalRef.current = null
  //     }
  //     isProcessingFrameRef.current = false
  //     sessionCompletedRef.current = false
  //   }
  // }, [])

  useEffect(() => {
    return () => {
      console.log('🧹 Limpieza al desmontar Identification')
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      
      // ✅ Usar ref en lugar de state
      if (sessionIdRef.current) {
        authenticationApi.cancelSession(sessionIdRef.current).catch(err => 
          console.log('Info: Sesión ya finalizada')
        )
      }
      
      isProcessingFrameRef.current = false
      sessionCompletedRef.current = false
    }
  }, [])  // ✅ Array vacío

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
      setCapturedSequence([])
      setSequenceComplete(false)
      
      isProcessingFrameRef.current = false
      sessionCompletedRef.current = false

      const response = await authenticationApi.startIdentification()
      setSessionId(response.session_id)
      sessionIdRef.current = response.session_id

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
    const gesturesNeeded = 3

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
        const frameResult = await authenticationApi.processFrame(sessionId)

        if (sessionCompletedRef.current) {
          console.log('⏹️ Sesión completada durante request, ignorando resultado')
          isProcessingFrameRef.current = false
          return
        }

        consecutiveErrors = 0

        if (frameResult.frame) {
          setCurrentFrame(frameResult.frame)
        }

        if (frameResult.captured_sequence && Array.isArray(frameResult.captured_sequence)) {
          setCapturedSequence(frameResult.captured_sequence)
          console.log(`📝 Secuencia capturada: ${frameResult.captured_sequence.join(' → ')}`)
        }

        if (frameResult.sequence_complete !== undefined) {
          setSequenceComplete(frameResult.sequence_complete)
        }

        const gesturesCaptured = frameResult.captured_sequence?.length || 0
        const sequenceProgress = (gesturesCaptured / gesturesNeeded) * 100
        
        setProgress(Math.min(sequenceProgress, 100))
        
        let message = frameResult.message || ''
        if (gesturesCaptured < gesturesNeeded) {
          message = `Capturando gestos (${gesturesCaptured}/${gesturesNeeded} gestos diferentes)`
        } else if (frameResult.phase === 'template_matching') {
          message = 'Buscando coincidencias en base de datos'
        } else if (frameResult.phase === 'score_fusion') {
          message = 'Analizando características biométricas'
        }
        setStatusMessage(message)

        console.log(`📊 Progreso: ${gesturesCaptured}/${gesturesNeeded} gestos, fase: ${frameResult.phase}`)

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
        ? 'Usuario identificado exitosamente' 
        : 'No se pudo identificar al usuario'
    })
  }

  const handleReset = () => {
    console.log('🔄 Reseteando identificación')
    
    sessionCompletedRef.current = true
    stopProcessing()

    setStep('ready')
    setSessionId(null)
    sessionIdRef.current = null 
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

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-900 mb-1">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* PASO 1: Ready - Inicio */}
        {step === 'ready' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              
              {/* Header Card */}
              <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 border-b border-gray-200 px-8 py-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm">
                    <Search className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Identificación de Usuario</h2>
                    <p className="text-sm text-gray-600 mt-0.5">Identificación biométrica 1:N</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                {/* Información del proceso */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
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

                  <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-cyan-100 rounded-lg">
                        <Users className="w-5 h-5 text-cyan-600" />
                      </div>
                      <h3 className="font-semibold text-cyan-900">Filtrado por Secuencia</h3>
                    </div>
                    <p className="text-sm text-cyan-700">
                      El sistema busca usuarios con tu misma secuencia de gestos
                    </p>
                  </div>

                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Brain className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h3 className="font-semibold text-indigo-900">Verificación Biométrica</h3>
                    </div>
                    <p className="text-sm text-indigo-700">
                      Verifica tu identidad contra los candidatos filtrados
                    </p>
                  </div>
                </div>

                {/* Instrucciones */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-gray-700" />
                    <h3 className="font-semibold text-gray-900">Instrucciones</h3>
                  </div>
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                      <span>Haz clic en "Iniciar Identificación"</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                      <span>Realiza 3 gestos diferentes con tu mano</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                      <span>El sistema filtrará por tu secuencia de gestos única</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                      <span>Luego verificará tu identidad biométricamente</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                      <span>Espera el resultado (puede tardar 15-25 segundos)</span>
                    </li>
                  </ul>
                </div>

                {/* Info adicional */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-blue-700" />
                    <h3 className="font-semibold text-blue-900">Seguridad en Dos Capas</h3>
                  </div>
                  <div className="text-sm text-blue-700 space-y-1 text-left">
                    <p><strong>Capa 1:</strong> Tu secuencia de gestos actúa como filtro inicial</p>
                    <p><strong>Capa 2:</strong> Verificación biométrica profunda de características únicas</p>
                  </div>
                </div>

                {/* Botón de inicio */}
                <div className="pt-6">
                  <Button
                    onClick={handleStartIdentification}
                    disabled={processing}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Iniciar Identificación
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASO 2: Procesando */}
        {step === 'processing' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              
              {/* Header Card */}
              <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 border-b border-gray-200 px-8 py-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm">
                    <Search className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Identificando Usuario</h2>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Capturando secuencia de gestos y analizando biometría
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 space-y-6">
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
                      <div className="absolute top-2 right-4">
                        <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          IDENTIFICANDO
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-8">
                        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <Search className="w-10 h-10 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">
                          Iniciando captura
                        </h3>
                        <p className="text-gray-400 text-sm">
                          Esperando primer frame del servidor
                        </p>
                        <Spinner className="w-6 h-6 text-blue-400 mx-auto mt-4" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Visualización de Secuencia Capturada */}
                {capturedSequence.length > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-blue-900">Secuencia Capturada</h3>
                      <Badge variant={sequenceComplete ? 'success' : 'default'}>
                        {capturedSequence.length}/3 gestos
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {capturedSequence.map((gesture, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="px-3 py-2 bg-white border border-blue-300 rounded-lg">
                            <span className="text-sm font-medium text-blue-900">{gesture}</span>
                          </div>
                          {idx < 2 && (
                            <ArrowLeft className="w-4 h-4 text-blue-400 rotate-180" />
                          )}
                        </div>
                      ))}
                      
                      {/* Placeholders para gestos faltantes */}
                      {capturedSequence.length < 3 && Array.from({ length: 3 - capturedSequence.length }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="flex items-center gap-2">
                          {capturedSequence.length > 0 && (
                            <ArrowLeft className="w-4 h-4 text-blue-300 rotate-180" />
                          )}
                          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg">
                            <span className="text-sm text-gray-400">?</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {sequenceComplete && (
                      <div className="flex items-center gap-2 mt-3">
                        <CheckCircle className="w-4 h-4 text-blue-700" />
                        <p className="text-xs text-blue-700">
                          Secuencia completa - Buscando coincidencias en base de datos
                        </p>
                      </div>
                    )}
                  </div>
                )}
              
                {/* Info de captura del servidor */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-center gap-2">
                    <Info className="w-4 h-4 text-blue-700 flex-shrink-0" />
                    <p className="text-xs text-blue-800 text-center">
                      El procesamiento biométrico se realiza en el servidor con su propia cámara
                    </p>
                  </div>
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

                {/* Fases del proceso con secuencia */}
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
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <p className="text-xs text-gray-600 text-center">
                      El sistema está procesando tus datos biométricos de forma segura
                    </p>
                  </div>
                </div>

                {/* Botón Cancelar */}
                <Button
                  onClick={() => {
                    if (sessionId) {
                      authenticationApi.cancelSession(sessionId)
                    }
                    handleReset()
                  }}
                  className="w-full h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PASO 3: Resultado */}
        {step === 'result' && result && (
          <div className="max-w-4xl mx-auto">
            <div className={`bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border overflow-hidden ${
              result.success ? 'border-green-200' : 'border-red-200'
            }`}>
              
              {/* Header Card */}
              <div className={`border-b px-8 py-6 ${
                result.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl shadow-sm ${
                    result.success ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {result.success ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold ${
                      result.success ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {result.success ? 'Usuario Identificado' : 'Identificación Fallida'}
                    </h2>
                    <p className={`text-sm mt-0.5 ${
                      result.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {result.success 
                        ? `Has sido identificado como: ${result.username}`
                        : 'No se pudo identificar al usuario'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                {/* Mostrar secuencia capturada */}
                {result.captured_sequence && result.captured_sequence.length > 0 && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Secuencia Capturada</h3>
                    <div className="flex items-center justify-center gap-2">
                      {result.captured_sequence.map((gesture, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Badge variant="outline">{gesture}</Badge>
                          {idx < result.captured_sequence.length - 1 && (
                            <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detalles */}
                <div className="max-w-md mx-auto space-y-3 mb-6">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Usuario Identificado</span>
                    <span className="text-sm font-bold text-gray-900">{result.username}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">ID de Usuario</span>
                    <span className="text-sm text-gray-600">{result.user_id}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Confianza</span>
                    <Badge variant={result.success ? 'success' : 'danger'}>
                      {(result.confidence * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Tiempo de Procesamiento</span>
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {result.duration.toFixed(1)}s
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={handleReset} 
                  className="w-full max-w-md mx-auto block h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300 font-semibold rounded-xl"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Nueva Identificación
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}