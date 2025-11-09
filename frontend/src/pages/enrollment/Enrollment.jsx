import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { enrollmentApi } from '../../lib/api/enrollment'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from '../../components/ui'
import WebcamCapture from '../../components/camera/WebcamCapture'
import { UserPlus, CheckCircle, XCircle, Camera, Hand, AlertCircle, ArrowRight, User, IdCard, ArrowLeft } from 'lucide-react'

export default function Enrollment() {
  const navigate = useNavigate()
  const [step, setStep] = useState('form')
  const [userId, setUserId] = useState('')
  const [username, setUsername] = useState('')
  const [selectedGestures, setSelectedGestures] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [sessionStatus, setSessionStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Estados de validación
  const [userIdTouched, setUserIdTouched] = useState(false)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [userIdError, setUserIdError] = useState('')
  const [usernameError, setUsernameError] = useState('')

  const availableGestures = [
    'Open_Palm',
    'Closed_Fist',
    'Victory',
    'Thumb_Up',
    'Thumb_Down',
    'Pointing_Up',
    'ILoveYou'
  ]

  // Validación de userId
  const validateUserId = (value) => {
    if (!value.trim()) {
      return 'El ID de usuario es requerido'
    }
    if (value.length < 3) {
      return 'El ID debe tener al menos 3 caracteres'
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Solo se permiten letras, números y guiones bajos'
    }
    return ''
  }

  // Validación de username
  const validateUsername = (value) => {
    if (!value.trim()) {
      return 'El nombre completo es requerido'
    }
    if (value.length < 3) {
      return 'El nombre debe tener al menos 3 caracteres'
    }
    return ''
  }

  const handleUserIdChange = (e) => {
    const value = e.target.value
    setUserId(value)
    if (userIdTouched) {
      setUserIdError(validateUserId(value))
    }
  }

  const handleUsernameChange = (e) => {
    const value = e.target.value
    setUsername(value)
    if (usernameTouched) {
      setUsernameError(validateUsername(value))
    }
  }

  const handleUserIdBlur = () => {
    setUserIdTouched(true)
    setUserIdError(validateUserId(userId))
  }

  const handleUsernameBlur = () => {
    setUsernameTouched(true)
    setUsernameError(validateUsername(username))
  }

  const handleGestureToggle = (gesture) => {
    if (selectedGestures.includes(gesture)) {
      setSelectedGestures(selectedGestures.filter(g => g !== gesture))
    } else if (selectedGestures.length < 3) {
      setSelectedGestures([...selectedGestures, gesture])
    }
  }

  const handleStartEnrollment = async () => {
    // Validar campos antes de enviar
    const userIdErr = validateUserId(userId)
    const usernameErr = validateUsername(username)
    
    setUserIdTouched(true)
    setUsernameTouched(true)
    setUserIdError(userIdErr)
    setUsernameError(usernameErr)

    if (userIdErr || usernameErr || selectedGestures.length !== 3) {
      setError('Por favor completa todos los campos correctamente')
      return
    }

    try {
      setLoading(true)
      const response = await enrollmentApi.startEnrollment(userId, username, selectedGestures)
      setSessionId(response.session_id)
      
      // ⚠️ AGREGAR DELAY ANTES DE CAMBIAR A STEP 'CAPTURE'
      // Esto da tiempo al backend para liberar recursos
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setStep('capture')
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar enrollment')
    } finally {
      setLoading(false)
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

      if (response.all_gestures_completed || response.session_completed) {
        console.log('🎉 ENROLLMENT COMPLETADO!')
        
        try {
          const bootstrapStatus = await enrollmentApi.getBootstrapStatus()
          setSessionStatus(prev => ({
            ...prev,
            can_train_now: bootstrapStatus.can_train && !bootstrapStatus.networks_trained
          }))
        } catch (err) {
          console.error('Error checking bootstrap status:', err)
        }
        
        setStep('success')
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
    setUserId('')
    setUsername('')
    setSelectedGestures([])
    setSessionId(null)
    setSessionStatus(null)
    setError(null)
    setUserIdTouched(false)
    setUsernameTouched(false)
    setUserIdError('')
    setUsernameError('')
  }

  const handleGoBack = () => {
    navigate('/')
  }

  // Determinar el estado del input
  const getInputState = (value, error, touched) => {
    if (!touched) return 'default'
    if (error) return 'error'
    if (value.trim()) return 'success'
    return 'default'
  }

  const userIdState = getInputState(userId, userIdError, userIdTouched)
  const usernameState = getInputState(username, usernameError, usernameTouched)

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
                    <h2 className="text-2xl font-bold text-gray-800">Información del Usuario</h2>
                    <p className="text-gray-600 text-sm mt-0.5">
                      Completa tus datos y selecciona tu secuencia biométrica
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                
                {/* Datos Personales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Input: ID de Usuario */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      ID de Usuario
                    </label>
                    
                    <div className="relative">
                      <div className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300 bg-white
                        ${userIdState === 'error' ? 'border-red-300 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100' : ''}
                        ${userIdState === 'success' ? 'border-green-300 focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-100' : ''}
                        ${userIdState === 'default' ? 'border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100' : ''}
                      `}>
                        <IdCard className={`
                          w-5 h-5 flex-shrink-0
                          ${userIdState === 'error' ? 'text-red-500' : ''}
                          ${userIdState === 'success' ? 'text-green-500' : ''}
                          ${userIdState === 'default' ? 'text-gray-400' : ''}
                        `} />
                        
                        <input
                          type="text"
                          value={userId}
                          onChange={handleUserIdChange}
                          onBlur={handleUserIdBlur}
                          className="flex-1 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                          placeholder="Escribe tu ID de usuario..."
                        />
                        
                        {userIdState === 'success' && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        {userIdState === 'error' && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    
                    {userIdError && userIdTouched && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-600 font-medium">{userIdError}</p>
                      </div>
                    )}
                  </div>

                  {/* Input: Nombre Completo */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                      Nombre Completo
                    </label>
                    
                    <div className="relative">
                      <div className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300 bg-white
                        ${usernameState === 'error' ? 'border-red-300 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100' : ''}
                        ${usernameState === 'success' ? 'border-green-300 focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-100' : ''}
                        ${usernameState === 'default' ? 'border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100' : ''}
                      `}>
                        <User className={`
                          w-5 h-5 flex-shrink-0
                          ${usernameState === 'error' ? 'text-red-500' : ''}
                          ${usernameState === 'success' ? 'text-green-500' : ''}
                          ${usernameState === 'default' ? 'text-gray-400' : ''}
                        `} />
                        
                        <input
                          type="text"
                          value={username}
                          onChange={handleUsernameChange}
                          onBlur={handleUsernameBlur}
                          className="flex-1 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                          placeholder="Escribe tu nombre completo..."
                        />
                        
                        {usernameState === 'success' && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        {usernameState === 'error' && (
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
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-sm font-semibold text-gray-500">
                      Secuencia Biométrica
                    </span>
                  </div>
                </div>

                {/* Selector de Gestos */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 mb-1">
                        Selecciona 3 Gestos Únicos
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
                    disabled={!userId || !username || selectedGestures.length !== 3 || loading || userIdError || usernameError}
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
                        Iniciar Captura Biométrica
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
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
                    Captura en Vivo
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
                    Cancelar Captura
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
                        <Badge variant="info" className="text-base">
                          <Hand className="w-4 h-4 mr-1" />
                          {sessionStatus.current_gesture || 'Esperando...'}
                        </Badge>
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

        {/* STEP: SUCCESS */}
        {step === 'success' && (
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-2xl">
              <CardContent className="pt-12 pb-12 text-center">
                
                {/* Icono de éxito */}
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-green-400/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative">
                    <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
                  </div>
                </div>

                {/* Título */}
                <h2 className="text-3xl sm:text-4xl font-black text-gray-800 mb-3">
                  ¡Registro{' '}
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                    Completado!
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
                  Registrar Otro Usuario
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}