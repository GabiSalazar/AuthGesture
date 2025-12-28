import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticationApi } from '../../lib/api/authentication'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Spinner } from '../../components/ui'
import { Search, CheckCircle, XCircle, Users, AlertCircle, Clock, Brain, Hand, ArrowLeft, Shield, Info, FileText, Video, Loader2 } from 'lucide-react'
import TimeoutModal from '../../components/TimeoutModal'

export default function Identification() {
  const navigate = useNavigate()
  const [step, setStep] = useState('ready') // 'ready', 'processing', 'result'
  const [sessionId, setSessionId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  
  const [capturedSequence, setCapturedSequence] = useState([])
  const [sequenceComplete, setSequenceComplete] = useState(false)

  const [timeoutInfo, setTimeoutInfo] = useState(null)

  // REFS PARA CÁMARA Y CANVAS
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const intervalRef = useRef(null)
  const isProcessingFrameRef = useRef(false)
  const sessionCompletedRef = useRef(false)
  const sessionIdRef = useRef(null)
  const lastFrameTimeRef = useRef(0) // ✅ THROTTLING

  // CLEANUP
  useEffect(() => {
    return () => {
      console.log('Limpieza al desmontar Identification')
      
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

  const stopProcessing = () => {
    console.log('Deteniendo procesamiento de identificación')
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    stopCamera()
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
      setCapturedSequence([])
      setSequenceComplete(false)
      
      isProcessingFrameRef.current = false
      sessionCompletedRef.current = false

      await startCamera()

      const response = await authenticationApi.startIdentification()
      setSessionId(response.session_id)
      sessionIdRef.current = response.session_id

      setTimeout(() => {
        startFrameProcessing(response.session_id)
      }, 1000)

    } catch (err) {
      console.error('Error iniciando identificación:', err)
      setError(err.response?.data?.detail || 'Error al iniciar identificación')
      setStep('ready')
      setProcessing(false)
      stopCamera()
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

    console.log('Iniciando loop de identificación por secuencia')

    intervalRef.current = setInterval(async () => {
      if (sessionCompletedRef.current) {
        console.log('Sesión ya completada, ignorando tick')
        stopProcessing()
        return
      }

      // THROTTLING
      const now = Date.now()
      if (now - lastFrameTimeRef.current < 500) {
        return
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

      // ✅ MARCAR TIMESTAMP
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

        if (frameResult.captured_sequence && Array.isArray(frameResult.captured_sequence)) {
          setCapturedSequence(frameResult.captured_sequence)
          console.log(`Secuencia capturada: ${frameResult.captured_sequence.join(' → ')}`)
        }

        if (frameResult.sequence_complete !== undefined) {
          setSequenceComplete(frameResult.sequence_complete)
        }

        const gesturesCaptured = frameResult.captured_sequence?.length || 0
        const sequenceProgress = (gesturesCaptured / gesturesNeeded) * 100
        
        setProgress(Math.min(sequenceProgress, 100))
        
        let message = frameResult.message || ''
        if (gesturesCaptured < gesturesNeeded) {
          message = `Capturando gestos (${gesturesCaptured}/${gesturesNeeded})`
        } else if (frameResult.phase === 'template_matching') {
          message = 'Buscando coincidencias en base de datos'
        } else if (frameResult.phase === 'score_fusion') {
          message = 'Analizando características biométricas'
        }
        setStatusMessage(message)

        console.log(`Progreso: ${gesturesCaptured}/${gesturesNeeded} gestos, fase: ${frameResult.phase}`)

        if (frameResult.authentication_result) {
          console.log('Resultado de identificación recibido:', frameResult.authentication_result)
          
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
          console.log('Sesión completada sin authentication_result')
          
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
            console.error('Error obteniendo status final:', statusErr)
            setError('La sesión finalizó pero no se pudo obtener el resultado')
            setStep('ready')
            setProcessing(false)
          }
          return
        }

        isProcessingFrameRef.current = false

      } catch (err) {
        isProcessingFrameRef.current = false

        const errorDetail = err.response?.data?.detail

        // Manejo de timeout 408
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

        // Manejo de timeout 410
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

        // Sesión limpiada
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
          setStep('ready')
          setProcessing(false)
        }
      }
    }, 200)
  }

  const handleIdentificationComplete = (finalStatus) => {
    console.log('Completando identificación:', finalStatus)
    
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

  const handleRetryAfterTimeout = () => {
    setTimeoutInfo(null)
    setError(null)
    setStatusMessage('')
    setStep('ready')
    setProcessing(false)
    setResult(null)
    setCapturedSequence([])
    setSequenceComplete(false)
    sessionCompletedRef.current = false
    isProcessingFrameRef.current = false
  }

  const handleCancelAfterTimeout = () => {
    setTimeoutInfo(null)
    navigate('/')
  }

  const handleReset = () => {
    console.log('Reseteando identificación')
    
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
    setCapturedSequence([])
    setSequenceComplete(false)
    
    isProcessingFrameRef.current = false
    sessionCompletedRef.current = false
  }

  const handleGoBack = () => {
    navigate('/')
  }

  // Mapeo de steps a números para el wizard
  const stepToNumber = {
    'ready': 1,
    'processing': 2,
    'result': 3
  }

  const currentStepNumber = stepToNumber[step] || 1

  // Wizard de 3 pasos
  const wizardSteps = [
    { number: 1, label: 'Preparación' },
    { number: 2, label: 'Identificación' },
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
                    <h3 className="text-sm font-semibold text-red-900 mb-1">Error</h3>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================
              STEP: READY
          ======================================== */}
          {step === 'ready' && (
            <div className="max-w-4xl mx-auto">
              
              {/* Divider */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                    Identificación de usuario 1:N
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                
                {/* Cards de proceso */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div 
                    className="p-5 rounded-2xl border-2"
                    style={{ 
                      backgroundColor: '#EFF6FF',
                      borderColor: '#BFDBFE'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#DBEAFE' }}>
                        <Hand className="w-5 h-5 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-blue-900">Captura de gestos</h3>
                    </div>
                    <p className="text-sm text-blue-700">
                      Realizarás 3 gestos diferentes como tu firma biométrica
                    </p>
                  </div>

                  <div 
                    className="p-5 rounded-2xl border-2"
                    style={{ 
                      backgroundColor: '#F0FDFA',
                      borderColor: '#99F6E4'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#CCFBF1' }}>
                        <Users className="w-5 h-5 text-cyan-600" />
                      </div>
                      <h3 className="font-semibold text-cyan-900">Filtrado por secuencia</h3>
                    </div>
                    <p className="text-sm text-cyan-700">
                      El sistema busca usuarios con tu misma secuencia de gestos
                    </p>
                  </div>

                  <div 
                    className="p-5 rounded-2xl border-2"
                    style={{ 
                      backgroundColor: '#F5F3FF',
                      borderColor: '#DDD6FE'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#EDE9FE' }}>
                        <Brain className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h3 className="font-semibold text-indigo-900">Verificación biométrica</h3>
                    </div>
                    <p className="text-sm text-indigo-700">
                      Verifica tu identidad contra los candidatos filtrados
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex justify-center">
                  <Button
                    onClick={handleStartIdentification}
                    disabled={processing}
                    className="px-8 py-3 text-white font-bold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                      boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                    }}
                  >
                    <Search className="w-4 h-4" />
                    Iniciar Identificación
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
                    Identificando usuario biométricamente
                  </span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Progreso de identificación
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

              {/* Secuencia Capturada */}
              {/* {capturedSequence.length > 0 && (
                <div 
                  className="p-5 rounded-xl border-2 mb-6"
                  style={{ 
                    backgroundColor: '#F0F9FF',
                    borderColor: '#BFDBFE'
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-blue-900">Secuencia capturada</h3>
                    <Badge variant={sequenceComplete ? 'success' : 'default'}>
                      {capturedSequence.length}/3 gestos
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    {capturedSequence.map((gesture, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="px-4 py-3 bg-white border-2 border-blue-300 rounded-lg">
                          <span className="text-sm font-semibold text-blue-900">{gesture}</span>
                        </div>
                        {idx < 2 && (
                          <ArrowLeft className="w-4 h-4 text-blue-400 rotate-180" />
                        )}
                      </div>
                    ))}
                    
                    {capturedSequence.length < 3 && Array.from({ length: 3 - capturedSequence.length }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="flex items-center gap-2">
                        {capturedSequence.length > 0 && (
                          <ArrowLeft className="w-4 h-4 text-gray-300 rotate-180" />
                        )}
                        <div className="px-4 py-3 bg-gray-100 border-2 border-gray-300 rounded-lg">
                          <span className="text-sm text-gray-400">?</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {sequenceComplete && (
                    <div className="flex items-center gap-2 mt-3">
                      <CheckCircle className="w-4 h-4 text-blue-700" />
                      <p className="text-xs text-blue-700 font-medium">
                        Secuencia completa - Buscando coincidencias en base de datos
                      </p>
                    </div>
                  )}
                </div>
              )} */}

              {/* Secuencia Capturada */}
              {capturedSequence.length > 0 && (
                <div 
                  className="p-2 lg:p-5 rounded-lg lg:rounded-xl border lg:border-2 mb-3 lg:mb-6"
                  style={{ 
                    backgroundColor: '#F0F9FF',
                    borderColor: '#BFDBFE'
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5 lg:mb-4">
                    <h3 className="text-[10px] lg:text-sm font-semibold text-blue-900">Secuencia capturada</h3>
                    <Badge variant={sequenceComplete ? 'success' : 'default'}>
                      <span className="text-[10px] lg:text-xs">{capturedSequence.length}/3 gestos</span>
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-center gap-1 lg:gap-3 flex-wrap">
                    {capturedSequence.map((gesture, idx) => (
                      <div key={idx} className="flex items-center gap-0.5 lg:gap-2">
                        <div className="px-1.5 py-1 lg:px-4 lg:py-3 bg-white border lg:border-2 border-blue-300 rounded lg:rounded-lg">
                          <span className="text-[10px] lg:text-sm font-semibold text-blue-900">{gesture}</span>
                        </div>
                        {idx < 2 && (
                          <ArrowLeft className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-blue-400 rotate-180" />
                        )}
                      </div>
                    ))}
                    
                    {/* Placeholders */}
                    {capturedSequence.length < 3 && Array.from({ length: 3 - capturedSequence.length }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="flex items-center gap-0.5 lg:gap-2">
                        {capturedSequence.length > 0 && (
                          <ArrowLeft className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-gray-300 rotate-180" />
                        )}
                        <div className="px-1.5 py-1 lg:px-4 lg:py-3 bg-gray-100 border lg:border-2 border-gray-300 rounded lg:rounded-lg">
                          <span className="text-[10px] lg:text-sm text-gray-400">?</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {sequenceComplete && (
                    <div className="flex items-center gap-1 lg:gap-2 mt-1.5 lg:mt-3">
                      <CheckCircle className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-blue-700" />
                      <p className="text-[10px] lg:text-xs text-blue-700 font-medium">
                        Secuencia completa - Buscando coincidencias
                      </p>
                    </div>
                  )}
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
                <div className="relative bg-gray-900 aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Indicador IDENTIFICANDO */}
                  <div className="absolute top-3 right-4">
                    <div 
                      className="flex items-center gap-2 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg"
                      style={{ backgroundColor: '#EF4444' }}
                    >
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      IDENTIFICANDO
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
              {statusMessage && (
                <div 
                  className="p-4 border-2 rounded-lg mb-6"
                  style={{ 
                    backgroundColor: '#F0F9FF',
                    borderColor: '#BFDBFE'
                  }}
                >
                  <p className="text-sm text-blue-800 font-medium">{statusMessage}</p>
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
            <div className="max-w-2xl mx-auto text-center px-4">
              
              {/* Icono de resultado */}
              <div 
                className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-full shadow-lg mb-4 lg:mb-6"
                style={{ backgroundColor: result.success ? '#10B981' : '#EF4444' }}
              >
                {result.success ? (
                  <svg className="w-10 h-10 lg:w-14 lg:h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <XCircle className="w-10 h-10 lg:w-14 lg:h-14 text-white" />
                )}
              </div>

              {/* Título */}
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-800 mb-3 lg:mb-4">
                <span className={`bg-gradient-to-r ${
                  result.success 
                    ? 'from-green-500 to-emerald-500' 
                    : 'from-red-500 to-red-600'
                } bg-clip-text text-transparent`}>
                  {result.success ? 'Usuario Identificado' : 'Identificación fallida'}
                </span>
              </h2>

              {/* Descripción */}
              <p className="text-sm lg:text-lg text-gray-600 mb-6 lg:mb-8 px-2">
                {result.success 
                  ? `Has sido identificado como: ${result.username}`
                  : 'No se pudo identificar al usuario'
                }
              </p>

              {/* Secuencia capturada */}
              {result.captured_sequence && result.captured_sequence.length > 0 && (
                <div 
                  className="p-3 lg:p-5 rounded-lg lg:rounded-xl border lg:border-2 mb-6 lg:mb-8"
                  style={{ 
                    backgroundColor: '#F0F9FF',
                    borderColor: '#BFDBFE'
                  }}
                >
                  <h3 className="text-xs lg:text-sm font-semibold text-blue-900 mb-2 lg:mb-3">Secuencia capturada</h3>
                  <div className="flex items-center justify-center gap-1 lg:gap-2 flex-wrap">
                    {result.captured_sequence.map((gesture, idx) => (
                      <div key={idx} className="flex items-center gap-1 lg:gap-2">
                        <Badge variant="outline">
                          <span className="text-[10px] lg:text-xs">{gesture}</span>
                        </Badge>
                        {idx < result.captured_sequence.length - 1 && (
                          <ArrowLeft className="w-3 h-3 lg:w-4 lg:h-4 text-gray-400 rotate-180" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalles */}
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 max-w-md mx-auto mb-6 lg:mb-8">
                <div className="space-y-2 lg:space-y-3">
                  <div className="flex items-center justify-between p-2 lg:p-3 bg-white rounded-lg">
                    <span className="text-xs lg:text-sm font-medium text-gray-700">Usuario identificado</span>
                    <span className="text-xs lg:text-sm font-bold text-gray-900 truncate ml-2">{result.username}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 lg:p-3 bg-white rounded-lg">
                    <span className="text-xs lg:text-sm font-medium text-gray-700">ID de usuario</span>
                    <span className="text-xs lg:text-sm text-gray-600 truncate ml-2">{result.user_id}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 lg:p-3 bg-white rounded-lg">
                    <span className="text-xs lg:text-sm font-medium text-gray-700">Confianza</span>
                    <Badge variant={result.success ? 'success' : 'danger'}>
                      <span className="text-[10px] lg:text-xs">{(result.confidence * 100).toFixed(1)}%</span>
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 lg:p-3 bg-white rounded-lg">
                    <span className="text-xs lg:text-sm font-medium text-gray-700">Duración</span>
                    <span className="text-xs lg:text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-3 h-3 lg:w-4 lg:h-4" />
                      {result.duration.toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón */}
              <Button 
                onClick={handleReset} 
                className="px-6 lg:px-8 py-2.5 lg:py-3 text-white text-sm lg:text-base font-bold rounded-full transition-all duration-300 flex items-center gap-2 mx-auto"
                style={{
                  background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                  boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                }}
              >
                <Search className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                Nueva identificación
              </Button>
            </div>
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