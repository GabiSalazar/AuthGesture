import { useState } from 'react'
import { authenticationApi } from '../../lib/api/authentication'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Spinner } from '../../components/ui'
import WebcamCapture from '../../components/camera/WebcamCapture'
import { Search, CheckCircle, XCircle, Users, AlertCircle, Clock, Brain } from 'lucide-react'

export default function Identification() {
  const [step, setStep] = useState('ready') // 'ready', 'processing', 'result'
  const [sessionId, setSessionId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')

  const handleStartIdentification = async () => {
    try {
      setProcessing(true)
      setStep('processing')
      setError(null)
      setProgress(0)
      setStatusMessage('Iniciando identificación...')

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
    const maxValidCaptures = 5 // Número de capturas válidas necesarias

    const processLoop = setInterval(async () => {
        try {
        // Procesar frame
        const frameResult = await authenticationApi.processFrame(sessionId)

        // Resetear contador de errores si hay éxito
        consecutiveErrors = 0

        // ✅ USAR valid_captures en lugar de frameCount
        const validCaptures = frameResult.valid_captures || 0
        const capturesProgress = (validCaptures / maxValidCaptures) * 100
        
        setProgress(Math.min(capturesProgress, 100))
        setStatusMessage(frameResult.message || `Capturando gestos... (${validCaptures}/${maxValidCaptures})`)

        console.log(`📊 Progreso identificación: ${validCaptures}/${maxValidCaptures} capturas válidas`)

        // Verificar si hay resultado
        if (frameResult.session_completed || frameResult.status === 'completed') {
            clearInterval(processLoop)
            
            // Obtener resultado final
            const finalStatus = await authenticationApi.getSessionStatus(sessionId)
            handleIdentificationComplete(finalStatus)
        }

        // ✅ NUEVO: Verificar si llegamos al límite de capturas válidas
        if (validCaptures >= maxValidCaptures && frameResult.phase === 'template_matching') {
            console.log('✅ Capturas completas, identificando usuario...')
            setStatusMessage('Identificando usuario...')
        }

        } catch (err) {
        consecutiveErrors++
        console.error('Error procesando frame:', err)
        
        // Solo fallar después de múltiples errores consecutivos
        if (consecutiveErrors >= maxConsecutiveErrors) {
            clearInterval(processLoop)
            setError(err.response?.data?.detail || 'Error durante el procesamiento')
            setStep('ready')
            setProcessing(false)
        }
        }
    }, 200) // Procesar cada 200ms
    }

  const handleIdentificationComplete = (finalStatus) => {
    setProcessing(false)
    setStep('result')
    
    const success = finalStatus.status === 'authenticated'
    
    setResult({
      success: success,
      user_id: finalStatus.user_id || 'Desconocido',
      username: finalStatus.username || finalStatus.user_id || 'Desconocido',
      confidence: finalStatus.confidence || 0,
      duration: finalStatus.duration || 0,
      message: success 
        ? '✅ Usuario identificado exitosamente' 
        : '❌ No se pudo identificar al usuario'
    })
  }

  const handleReset = () => {
    setStep('ready')
    setSessionId(null)
    setProcessing(false)
    setResult(null)
    setError(null)
    setProgress(0)
    setStatusMessage('')
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
              El sistema determinará tu identidad comparándote con todos los usuarios registrados
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Información del proceso */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Brain className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-blue-900">Análisis Biométrico</h3>
                </div>
                <p className="text-sm text-blue-700">
                  El sistema capturará y analizará tus gestos únicos
                </p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-purple-900">Comparación 1:N</h3>
                </div>
                <p className="text-sm text-purple-700">
                  Comparará con todos los usuarios en la base de datos
                </p>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-green-900">Identificación</h3>
                </div>
                <p className="text-sm text-green-700">
                  Determina tu identidad con alta precisión
                </p>
              </div>
            </div>

            {/* Instrucciones */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">📋 Instrucciones:</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Haz clic en "Iniciar Identificación"</li>
                <li>• El sistema comenzará a capturar tus gestos automáticamente</li>
                <li>• Realiza tus gestos biométricos de forma natural</li>
                <li>• Espera el resultado (puede tardar 10-20 segundos)</li>
              </ul>
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
            <CardTitle>Verificando Identidad</CardTitle>
            <CardDescription>
                Usuario: <strong>{selectedUser?.username}</strong>
            </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* ✅ Preview de estado (sin acceso a cámara) */}
                <div className="relative bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
                    <div className="text-center p-8">
                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Shield className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                        Procesamiento Biométrico
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                        El servidor está capturando y analizando tus gestos
                    </p>
                    <div className="flex items-center justify-center gap-2 text-blue-400 text-sm">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                        <span>Sistema activo</span>
                    </div>
                    </div>
                    
                    {/* Indicador de actividad */}
                    <div className="absolute top-4 right-4">
                    <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        CAPTURANDO
                    </div>
                    </div>
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

            {/* Fases del proceso */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-gray-700">Capturando gestos biométricos</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${progress > 30 ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {progress > 30 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span className="text-gray-700">Extrayendo características</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${progress > 60 ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {progress > 60 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span className="text-gray-700">Comparando con base de datos</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${progress > 90 ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {progress > 90 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span className="text-gray-700">Determinando identidad</span>
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
                  No se pudo identificar al usuario en la base de datos
                </p>
              </>
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