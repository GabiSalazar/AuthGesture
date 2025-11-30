// import { useState, useEffect, useRef } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { authenticationApi } from '../../lib/api/authentication'
// import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Spinner } from '../../components/ui'
// import { Shield, CheckCircle, XCircle, User, AlertCircle, Clock, ArrowLeft } from 'lucide-react'

// export default function Verification() {
//   const navigate = useNavigate()
//   const [step, setStep] = useState('select') // 'select', 'processing', 'result'
//   const [users, setUsers] = useState([])
//   const [selectedUser, setSelectedUser] = useState(null)
//   const [sessionId, setSessionId] = useState(null)
//   const [processing, setProcessing] = useState(false)
//   const [result, setResult] = useState(null)
//   const [error, setError] = useState(null)
//   const [progress, setProgress] = useState(0)
//   const [statusMessage, setStatusMessage] = useState('')
//   const [currentFrame, setCurrentFrame] = useState(null)
  
//   // ✅ REFS GLOBALES
//   const intervalRef = useRef(null)
//   const isProcessingFrameRef = useRef(false)  // ✅ FLAG ANTI-CONCURRENCIA
//   const sessionCompletedRef = useRef(false)   // ✅ FLAG DE SESIÓN COMPLETADA
//   const sessionIdRef = useRef(null) 


//   useEffect(() => {
//     loadUsers()
//   }, [])

//   // ✅ CLEANUP AL DESMONTAR
//   // useEffect(() => {
//   //   return () => {
//   //     if (intervalRef.current) {
//   //       clearInterval(intervalRef.current)
//   //       intervalRef.current = null
//   //     }
//   //     isProcessingFrameRef.current = false
//   //     sessionCompletedRef.current = false
//   //   }
//   // }, [])

//   // ✅ CLEANUP: Cancelar sesión al desmontar (solo al desmontar componente)
//   useEffect(() => {
//     return () => {
//       console.log('🧹 Limpieza al desmontar Verification')
      
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//         intervalRef.current = null
//       }
      
//       // ✅ CANCELAR SESIÓN EN BACKEND usando ref
//       if (sessionIdRef.current) {
//         authenticationApi.cancelSession(sessionIdRef.current).catch(err => 
//           console.log('Info: Sesión ya finalizada')
//         )
//       }
      
//       isProcessingFrameRef.current = false
//       sessionCompletedRef.current = false
//     }
//   }, [])  // ✅ Array vacío - solo ejecutar al montar/desmontar

//   const loadUsers = async () => {
//     try {
//       const response = await authenticationApi.getAvailableUsers()
//       setUsers(response.users || [])
//       setError(null)
//     } catch (err) {
//       console.error('Error cargando usuarios:', err)
//       setError('Error al cargar usuarios disponibles')
//     }
//   }

//   const handleStartVerification = async () => {
//     if (!selectedUser) {
//       alert('Por favor selecciona un usuario')
//       return
//     }

//     try {
//       setProcessing(true)
//       setStep('processing')
//       setError(null)
//       setProgress(0)
//       setStatusMessage('Iniciando verificación...')
      
//       // ✅ RESETEAR FLAGS
//       isProcessingFrameRef.current = false
//       sessionCompletedRef.current = false

//       // Iniciar sesión de verificación
//       const response = await authenticationApi.startVerification(selectedUser.user_id)
//       setSessionId(response.session_id)
//       sessionIdRef.current = response.session_id

//       // Comenzar procesamiento de frames
//       startFrameProcessing(response.session_id)

//     } catch (err) {
//       console.error('Error iniciando verificación:', err)
//       setError(err.response?.data?.detail || 'Error al iniciar verificación')
//       setStep('select')
//       setProcessing(false)
//     }
//   }

//   const stopProcessing = () => {
//     console.log('🛑 Deteniendo procesamiento completo')
    
//     if (intervalRef.current) {
//       clearInterval(intervalRef.current)
//       intervalRef.current = null
//     }
    
//     isProcessingFrameRef.current = false
//     sessionCompletedRef.current = true
//   }

//   const startFrameProcessing = async (sessionId) => {
//     let consecutiveErrors = 0
//     const maxConsecutiveErrors = 10
//     const maxValidCaptures = 3

//     // ✅ LIMPIAR INTERVALO ANTERIOR
//     if (intervalRef.current) {
//       clearInterval(intervalRef.current)
//       intervalRef.current = null
//     }

//     console.log('▶️ Iniciando loop de procesamiento')

//     intervalRef.current = setInterval(async () => {
//       // ✅ VERIFICAR SI YA SE COMPLETÓ LA SESIÓN
//       if (sessionCompletedRef.current) {
//         console.log('⏹️ Sesión ya completada, ignorando tick')
//         stopProcessing()
//         return
//       }

//       // ✅ VERIFICAR SI YA HAY UN FRAME PROCESÁNDOSE
//       if (isProcessingFrameRef.current) {
//         console.log('⏸️ Frame anterior aún procesándose, saltando tick')
//         return
//       }

//       // ✅ MARCAR COMO PROCESANDO
//       isProcessingFrameRef.current = true

//       try {
//         // Procesar frame
//         const frameResult = await authenticationApi.processFrame(sessionId)

//         // ✅ VERIFICAR NUEVAMENTE POR SI SE COMPLETÓ MIENTRAS ESPERÁBAMOS
//         if (sessionCompletedRef.current) {
//           console.log('⏹️ Sesión completada durante request, ignorando resultado')
//           isProcessingFrameRef.current = false
//           return
//         }

//         // Resetear contador de errores
//         consecutiveErrors = 0

//         // Actualizar frame visual si existe
//         if (frameResult.frame) {
//           setCurrentFrame(frameResult.frame)
//         }

//         // Actualizar progreso
//         const validCaptures = frameResult.valid_captures || 0
//         const capturesProgress = (validCaptures / maxValidCaptures) * 100
        
//         setProgress(Math.min(capturesProgress, 100))
//         setStatusMessage(frameResult.message || `Capturando... (${validCaptures}/${maxValidCaptures})`)

//         console.log(`📊 Progreso: ${validCaptures}/${maxValidCaptures} capturas válidas`)

//         // ✅ VERIFICAR SI HAY RESULTADO DE AUTENTICACIÓN
//         if (frameResult.authentication_result) {
//           console.log('✅ Resultado de autenticación recibido - COMPLETANDO SESIÓN')
          
//           // ✅ MARCAR COMO COMPLETADA INMEDIATAMENTE
//           sessionCompletedRef.current = true
//           isProcessingFrameRef.current = false
//           stopProcessing()
          
//           // Usar el resultado directamente del frameResult
//           const authResult = frameResult.authentication_result
//           handleVerificationComplete({
//             status: authResult.success ? 'authenticated' : 'rejected',
//             user_id: authResult.user_id || selectedUser.user_id,
//             confidence: authResult.fused_score || authResult.confidence || 0,
//             duration: authResult.duration || 0
//           })
//           return
//         }

//         // Verificar si completado (método antiguo - fallback)
//         if (frameResult.session_completed || frameResult.status === 'completed') {
//           console.log('⚠️ Sesión completada sin authentication_result')
          
//           sessionCompletedRef.current = true
//           isProcessingFrameRef.current = false
//           stopProcessing()
          
//           try {
//             const finalStatus = await authenticationApi.getSessionStatus(sessionId)
//             handleVerificationComplete(finalStatus)
//           } catch (statusErr) {
//             console.error('❌ Error obteniendo status final:', statusErr)
//             setError('La sesión finalizó pero no se pudo obtener el resultado')
//             setStep('select')
//             setProcessing(false)
//           }
//           return
//         }

//         // Verificar fase de matching
//         if (validCaptures >= maxValidCaptures && frameResult.phase === 'template_matching') {
//           console.log('✅ Capturas completas, esperando matching...')
//           setStatusMessage('Analizando identidad...')
//         }

//         // ✅ LIBERAR FLAG DE PROCESAMIENTO
//         isProcessingFrameRef.current = false

//       } catch (err) {
//         // ✅ LIBERAR FLAG INMEDIATAMENTE
//         isProcessingFrameRef.current = false

//         // ✅ MANEJAR 410 - Sesión ya cerrada
//         if (err.response?.status === 410) {
//           console.log('⚠️ Recibido 410 - sesión ya procesada, deteniendo')
//           sessionCompletedRef.current = true
//           stopProcessing()
//           return  // ✅ NO MOSTRAR ERROR
//         }

//         // Otros errores
//         consecutiveErrors++
//         console.error('Error procesando frame:', err)
        
//         if (consecutiveErrors >= maxConsecutiveErrors) {
//           sessionCompletedRef.current = true
//           stopProcessing()
//           setError(err.response?.data?.detail || 'Error durante el procesamiento')
//           setStep('select')
//           setProcessing(false)
//         }
//       }
//     }, 200)
//   }

//   const handleVerificationComplete = (finalStatus) => {
//     console.log('🏁 Completando verificación:', finalStatus)
    
//     // ✅ DETENER TODO
//     sessionCompletedRef.current = true
//     stopProcessing()

//     setProcessing(false)
//     setStep('result')
    
//     const success = finalStatus.status === 'authenticated'
    
//     setResult({
//       success: success,
//       user_id: finalStatus.user_id,
//       username: selectedUser?.username || finalStatus.user_id,
//       confidence: finalStatus.confidence || 0,
//       duration: finalStatus.duration || 0,
//       message: success 
//         ? '✅ Identidad verificada exitosamente' 
//         : '❌ Identidad no verificada'
//     })
//   }

//   const handleReset = () => {
//     console.log('🔄 Reseteando componente')
    
//     // ✅ DETENER TODO
//     sessionCompletedRef.current = true
//     stopProcessing()

//     setStep('select')
//     setSelectedUser(null)
//     setSessionId(null)
//     sessionIdRef.current = null
//     setProcessing(false)
//     setResult(null)
//     setError(null)
//     setProgress(0)
//     setStatusMessage('')
//     setCurrentFrame(null)
    
//     // ✅ RESETEAR FLAGS
//     isProcessingFrameRef.current = false
//     sessionCompletedRef.current = false
//   }

//   const handleGoBack = () => {
//     navigate('/')
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/20 py-8 px-4 sm:px-6 lg:px-8">
//       <div className="max-w-7xl mx-auto">

//         {/* Header con Flecha (izq) y Logo+Nombre (der) */}
//         <div className="mb-8 flex items-center justify-between">
//           {/* Flecha - Lado Izquierdo */}
//           <button
//             onClick={handleGoBack}
//             className="p-2 hover:bg-white/50 rounded-lg transition-colors"
//           >
//             <ArrowLeft className="w-6 h-6 text-gray-700" />
//           </button>
          
//           {/* Logo y Nombre - Lado Derecho */}
//           <div className="flex items-center gap-3">
//             <img 
//               src="/logo.png" 
//               alt="Logo" 
//               className="h-10 w-10" 
//             />
//             <span className="text-2xl font-black uppercase tracking-tight bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 bg-clip-text text-transparent">
//               Auth-Gesture
//             </span>
//           </div>
//         </div>

//         {/* Error Alert */}
//         {error && (
//           <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 max-w-4xl mx-auto">
//             <div className="flex items-start gap-3">
//               <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
//               <div>
//                 <h3 className="text-sm font-semibold text-red-900 mb-1">Error</h3>
//                 <p className="text-sm text-red-700">{error}</p>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* PASO 1: Seleccionar Usuario */}
//         {step === 'select' && (
//           <div className="max-w-4xl mx-auto">
//             <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              
//               {/* Header Card */}
//               <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 border-b border-gray-200 px-8 py-6">
//                 <div className="flex items-center gap-3 mb-2">
//                   <div className="p-2.5 bg-white rounded-xl shadow-sm">
//                     <Shield className="w-6 h-6 text-blue-600" />
//                   </div>
//                   <div>
//                     <h2 className="text-2xl font-bold text-gray-900">Verificación de Identidad</h2>
//                     <p className="text-sm text-gray-600 mt-0.5">Autenticación biométrica 1:1</p>
//                   </div>
//                 </div>
//               </div>

//               {/* Content */}
//               <div className="p-8">
//                 <div className="mb-6">
//                   <h3 className="text-lg font-semibold text-gray-900 mb-2">Seleccionar Usuario</h3>
//                   <p className="text-sm text-gray-600">Elige el usuario cuya identidad quieres verificar</p>
//                 </div>

//                 {users.length === 0 ? (
//                   <div className="text-center py-16">
//                     <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-2xl mb-4">
//                       <User className="w-10 h-10 text-gray-400" />
//                     </div>
//                     <p className="text-gray-600 mb-4">No hay usuarios disponibles para verificación</p>
//                     <Button 
//                       onClick={loadUsers}
//                       className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg h-10 px-6 rounded-xl"
//                     >
//                       Recargar
//                     </Button>
//                   </div>
//                 ) : (
//                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//                     {users.map((user) => (
//                       <button
//                         key={user.user_id}
//                         onClick={() => setSelectedUser(user)}
//                         className={`
//                           p-4 rounded-lg border-2 transition-all text-left
//                           ${selectedUser?.user_id === user.user_id
//                             ? 'border-blue-500 bg-blue-50'
//                             : 'border-gray-200 hover:border-gray-300'
//                           }
//                         `}
//                       >
//                         <div className="flex items-start justify-between mb-2">
//                           <div className="flex items-center gap-2 min-w-0 flex-1">
//                             <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
//                               <User className="w-5 h-5 text-blue-600" />
//                             </div>
//                             <div className="min-w-0 flex-1">
//                               <p className="font-semibold text-gray-900 truncate">{user.username}</p>
//                               <p className="text-xs text-gray-500 truncate">ID: {user.user_id}</p>
//                             </div>
//                           </div>
//                           {selectedUser?.user_id === user.user_id && (
//                             <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
//                           )}
//                         </div>
//                         <div className="text-xs text-gray-600">
//                           Templates: {user.total_templates || 0}
//                         </div>
//                       </button>
//                     ))}
//                   </div>
//                 )}

//                 {/* Botón de inicio */}
//                 <div className="pt-6">
//                   <Button
//                     onClick={handleStartVerification}
//                     disabled={!selectedUser || processing}
//                     className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     <Shield className="w-4 h-4 mr-2" />
//                     Iniciar Verificación
//                   </Button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* PASO 2: Procesando */}
//         {step === 'processing' && (
//           <div className="max-w-4xl mx-auto">
//             <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              
//               {/* Header Card */}
//               <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 border-b border-gray-200 px-8 py-6">
//                 <div className="flex items-center gap-3">
//                   <div className="p-2.5 bg-white rounded-xl shadow-sm">
//                     <Shield className="w-6 h-6 text-blue-600" />
//                   </div>
//                   <div>
//                     <h2 className="text-2xl font-bold text-gray-900">Verificando Identidad</h2>
//                     <p className="text-sm text-gray-600 mt-0.5">
//                       Usuario: <strong>{selectedUser?.username}</strong>
//                     </p>
//                   </div>
//                 </div>
//               </div>

//               {/* Content */}
//               <div className="p-8 space-y-6">
//                 {/* Frame visual del servidor con overlays */}
//                 <div className="relative bg-gray-900 rounded-lg aspect-video overflow-hidden">
//                   {currentFrame ? (
//                     <>
//                       <img 
//                         src={currentFrame} 
//                         alt="Procesamiento biométrico" 
//                         className="w-full h-full object-contain"
//                       />
                      
//                       {/* Indicador de captura activa */}
//                       <div className="absolute top-2 right-4">
//                         <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
//                           <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
//                           CAPTURANDO
//                         </div>
//                       </div>
//                     </>
//                   ) : (
//                     <div className="flex items-center justify-center h-full">
//                       <div className="text-center p-8">
//                         <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
//                           <Shield className="w-10 h-10 text-blue-400" />
//                         </div>
//                         <h3 className="text-xl font-semibold text-white mb-2">
//                           Iniciando captura...
//                         </h3>
//                         <p className="text-gray-400 text-sm">
//                           Esperando primer frame del servidor
//                         </p>
//                         <Spinner className="w-6 h-6 text-blue-400 mx-auto mt-4" />
//                       </div>
//                     </div>
//                   )}
//                 </div>
              
//                 {/* Info de captura del servidor */}
//                 <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
//                   <p className="text-xs text-blue-800 text-center">
//                     ℹ️ El procesamiento biométrico se realiza en el servidor con su propia cámara
//                   </p>
//                 </div>

//                 {/* Progress Bar */}
//                 <div>
//                   <div className="flex items-center justify-between mb-2">
//                     <span className="text-sm font-medium text-gray-700">Progreso</span>
//                     <span className="text-sm font-bold text-gray-900">{Math.round(progress)}%</span>
//                   </div>
//                   <div className="w-full bg-gray-200 rounded-full h-2">
//                     <div
//                       className="bg-blue-600 h-2 rounded-full transition-all"
//                       style={{ width: `${progress}%` }}
//                     />
//                   </div>
//                 </div>

//                 {/* Status Message */}
//                 {statusMessage && (
//                   <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
//                     <p className="text-sm text-blue-800">{statusMessage}</p>
//                   </div>
//                 )}

//                 {/* Info */}
//                 <div className="p-4 bg-gray-50 rounded-lg">
//                   <p className="text-xs text-gray-600 text-center">
//                     ℹ️ El sistema está capturando y procesando tus gestos biométricos
//                   </p>
//                 </div>

//                 {/* Botón Cancelar */}
//                 <Button
//                   onClick={() => {
//                     if (sessionId) {
//                       authenticationApi.cancelSession(sessionId)
//                     }
//                     handleReset()
//                   }}
//                   className="w-full h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
//                 >
//                   Cancelar
//                 </Button>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* PASO 3: Resultado */}
//         {step === 'result' && result && (
//           <div className="max-w-4xl mx-auto">
//             <div className={`bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border overflow-hidden ${
//               result.success ? 'border-green-200' : 'border-red-200'
//             }`}>
              
//               {/* Header Card */}
//               <div className={`border-b px-8 py-6 ${
//                 result.success 
//                   ? 'bg-green-50 border-green-200' 
//                   : 'bg-red-50 border-red-200'
//               }`}>
//                 <div className="flex items-center gap-3">
//                   <div className={`p-2.5 rounded-xl shadow-sm ${
//                     result.success ? 'bg-green-100' : 'bg-red-100'
//                   }`}>
//                     {result.success ? (
//                       <CheckCircle className="w-6 h-6 text-green-600" />
//                     ) : (
//                       <XCircle className="w-6 h-6 text-red-600" />
//                     )}
//                   </div>
//                   <div>
//                     <h2 className={`text-2xl font-bold ${
//                       result.success ? 'text-green-900' : 'text-red-900'
//                     }`}>
//                       {result.success ? '¡Verificación Exitosa!' : 'Verificación Fallida'}
//                     </h2>
//                     <p className={`text-sm mt-0.5 ${
//                       result.success ? 'text-green-700' : 'text-red-700'
//                     }`}>
//                       {result.success 
//                         ? `La identidad de ${result.username} ha sido verificada correctamente`
//                         : 'No se pudo verificar la identidad del usuario'
//                       }
//                     </p>
//                   </div>
//                 </div>
//               </div>

//               {/* Content */}
//               <div className="p-8">
//                 {/* Detalles */}
//                 <div className="max-w-md mx-auto space-y-3 mb-6">
//                   <div className="flex items-center justify-between p-3 bg-white rounded-lg">
//                     <span className="text-sm font-medium text-gray-700">Usuario</span>
//                     <span className="text-sm font-bold text-gray-900">{result.username}</span>
//                   </div>
//                   <div className="flex items-center justify-between p-3 bg-white rounded-lg">
//                     <span className="text-sm font-medium text-gray-700">Confianza</span>
//                     <Badge variant={result.success ? 'success' : 'danger'}>
//                       {(result.confidence * 100).toFixed(1)}%
//                     </Badge>
//                   </div>
//                   <div className="flex items-center justify-between p-3 bg-white rounded-lg">
//                     <span className="text-sm font-medium text-gray-700">Duración</span>
//                     <span className="text-sm text-gray-600 flex items-center gap-1">
//                       <Clock className="w-4 h-4" />
//                       {result.duration.toFixed(1)}s
//                     </span>
//                   </div>
//                 </div>

//                 <Button 
//                   onClick={handleReset} 
//                   className="w-full max-w-md mx-auto block h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300 font-semibold rounded-xl"
//                 >
//                   <Shield className="w-4 h-4 mr-2" />
//                   Nueva Verificación
//                 </Button>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticationApi } from '../../lib/api/authentication'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Spinner } from '../../components/ui'
import { Shield, CheckCircle, XCircle, User, AlertCircle, Clock, ArrowLeft, Video, Hand } from 'lucide-react'

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

    // Calcular inmediatamente
    calculateTimeRemaining()

    // Actualizar cada segundo
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
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-8 py-6">
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
                Cuenta Bloqueada
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
          <div className="flex items-center justify-between py-3 border-b border-slate-200">
            <span className="text-slate-600 font-medium">Usuario</span>
            <span className="text-slate-900 font-semibold">{result.username}</span>
          </div>

          {/* Countdown - Destacado */}
          <div className="bg-slate-50 rounded-xl p-6 text-center border border-slate-200">
            <p className="text-slate-600 text-sm mb-3">
              Tiempo restante de bloqueo
            </p>
            <div className="text-4xl font-bold text-red-400 mb-2 font-mono tracking-wider">
              {timeRemaining ? formatTime(timeRemaining) : '00:00'}
            </div>
            <p className="text-slate-500 text-sm">
              {timeRemaining && !timeRemaining.expired ? 'minutos : segundos' : 'Cuenta desbloqueada'}
            </p>
          </div>

          {/* Desbloqueo automático */}
          {result.lockout_info?.locked_until && (
            <div className="flex items-center justify-between py-3 border-b border-slate-200">
              <span className="text-slate-600 font-medium">Se desbloqueará</span>
              <span className="text-slate-900 font-semibold">
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
            <span className="text-slate-600 font-medium">Razón</span>
            <span className="text-red-600 font-semibold">
              {result.lockout_info?.max_attempts} intentos fallidos
            </span>
          </div>

          {/* Mensaje informativo */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              Por seguridad, tu cuenta ha sido bloqueada temporalmente. El desbloqueo es automático. 
              Asegúrate de realizar correctamente la secuencia de gestos en tu próximo intento.
            </p>
          </div>

          
        </div>
      </div>
    </div>
  )
}
export default function Verification() {
  const navigate = useNavigate()
  const [step, setStep] = useState('select') // 'select', 'processing', 'result'
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  
  const [sessionInfo, setSessionInfo] = useState(null)

  // ✅ REFS PARA CÁMARA Y CANVAS
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  
  // ✅ REFS GLOBALES
  const intervalRef = useRef(null)
  const isProcessingFrameRef = useRef(false)
  const sessionCompletedRef = useRef(false)
  const sessionIdRef = useRef(null)

  useEffect(() => {
    loadUsers()
  }, [])

  // ✅ CLEANUP: Cancelar sesión y detener cámara al desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 Limpieza al desmontar Verification')
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      
      // Detener cámara
      stopCamera()
      
      // Cancelar sesión en backend
      if (sessionIdRef.current) {
        authenticationApi.cancelSession(sessionIdRef.current).catch(err => 
          console.log('Info: Sesión ya finalizada')
        )
      }
      
      isProcessingFrameRef.current = false
      sessionCompletedRef.current = false
    }
  }, [])

  // ✅ FUNCIÓN PARA INICIAR CÁMARA
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
      
      console.log('✅ Cámara iniciada')
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos.')
      console.error('❌ Error accediendo a cámara:', err)
      throw err
    }
  }

  // ✅ FUNCIÓN PARA DETENER CÁMARA
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
      console.log('🛑 Cámara detenida')
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

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

      // ✅ INICIAR CÁMARA PRIMERO
      await startCamera()

      // Iniciar sesión de verificación
      const response = await authenticationApi.startVerification(selectedUser.user_id)
      setSessionId(response.session_id)
      sessionIdRef.current = response.session_id

      // ✅ ESPERAR A QUE LA CÁMARA ESTÉ LISTA
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
    console.log('🛑 Deteniendo procesamiento completo')
    
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

      // ✅ CAPTURAR FRAME DEL VIDEO
      if (!videoRef.current || !canvasRef.current) {
        console.log('⚠️ Video o canvas no disponible')
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current

      // Verificar que el video esté listo
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.log('⏳ Video aún no tiene suficientes datos')
        return
      }

      // ✅ CAPTURAR Y CONVERTIR A BASE64
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.95)

      // ✅ MARCAR COMO PROCESANDO
      isProcessingFrameRef.current = true

      try {
        // ✅ PROCESAR FRAME CON BASE64
        const frameResult = await authenticationApi.processFrame(sessionId, frameBase64)

        // ✅ VERIFICAR NUEVAMENTE POR SI SE COMPLETÓ MIENTRAS ESPERÁBAMOS
        if (sessionCompletedRef.current) {
          console.log('⏹️ Sesión completada durante request, ignorando resultado')
          isProcessingFrameRef.current = false
          return
        }

        // Resetear contador de errores
        consecutiveErrors = 0

        // Actualizar progreso
        const validCaptures = frameResult.valid_captures || 0
        const capturesProgress = (validCaptures / maxValidCaptures) * 100
        
        setProgress(Math.min(capturesProgress, 100))
        setStatusMessage(frameResult.message || `Capturando... (${validCaptures}/${maxValidCaptures})`)

        // ✅ NUEVO: Actualizar información de sesión para visualización
        setSessionInfo({
          required_sequence: frameResult.required_sequence || [],
          captured_sequence: frameResult.captured_sequence || [],
          sequence_complete: frameResult.sequence_complete || false,
          valid_captures: validCaptures
        })

        console.log(`📊 Progreso: ${validCaptures}/${maxValidCaptures} capturas válidas`)

        // // ✅ VERIFICAR SI HAY RESULTADO DE AUTENTICACIÓN
        // if (frameResult.authentication_result) {
        //   console.log('✅ Resultado de autenticación recibido - COMPLETANDO SESIÓN')
          
        //   // ✅ MARCAR COMO COMPLETADA INMEDIATAMENTE
        //   sessionCompletedRef.current = true
        //   isProcessingFrameRef.current = false
        //   stopProcessing()
          
        //   // Usar el resultado directamente del frameResult
        //   const authResult = frameResult.authentication_result
        //   handleVerificationComplete({
        //     status: authResult.success ? 'authenticated' : 'rejected',
        //     user_id: authResult.user_id || selectedUser.user_id,
        //     confidence: authResult.fused_score || authResult.confidence || 0,
        //     duration: authResult.duration || 0
        //   })
        //   return
        // }

        // ✅ VERIFICAR SI HAY RESULTADO DE AUTENTICACIÓN
        if (frameResult.authentication_result) {
          console.log('✅ Resultado de autenticación recibido - COMPLETANDO SESIÓN')
          
          // ✅ MARCAR COMO COMPLETADA INMEDIATAMENTE
          sessionCompletedRef.current = true
          isProcessingFrameRef.current = false
          stopProcessing()
          
          // Usar el resultado directamente del frameResult
          const authResult = frameResult.authentication_result
          
          // ✅ VERIFICAR SI LA CUENTA ESTÁ BLOQUEADA
          if (authResult.is_locked && authResult.lockout_info) {
            console.log('🔒 Cuenta bloqueada detectada')
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
          
          // ✅ AUTENTICACIÓN NORMAL (NO BLOQUEADA)
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
          return
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
    sessionIdRef.current = null
    setProcessing(false)
    setResult(null)
    setError(null)
    setProgress(0)
    setStatusMessage('')
    
    // ✅ RESETEAR FLAGS
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
          <button
            onClick={handleGoBack}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          
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

        {/* PASO 1: Seleccionar Usuario */}
        {step === 'select' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              
              <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 border-b border-gray-200 px-8 py-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Verificación de Identidad</h2>
                    <p className="text-sm text-gray-600 mt-0.5">Autenticación biométrica 1:1</p>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Seleccionar Usuario</h3>
                  <p className="text-sm text-gray-600">Elige el usuario cuya identidad quieres verificar</p>
                </div>

                {users.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-2xl mb-4">
                      <User className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-600 mb-4">No hay usuarios disponibles para verificación</p>
                    <Button 
                      onClick={loadUsers}
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg h-10 px-6 rounded-xl"
                    >
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
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 truncate">{user.username}</p>
                              <p className="text-xs text-gray-500 truncate">ID: {user.user_id}</p>
                            </div>
                          </div>
                          {selectedUser?.user_id === user.user_id && (
                            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          Templates: {user.total_templates || 0}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-6">
                  <Button
                    onClick={handleStartVerification}
                    disabled={!selectedUser || processing}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Iniciar Verificación
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
              
              <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 border-b border-gray-200 px-8 py-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Verificando Identidad</h2>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Usuario: <strong>{selectedUser?.username}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                {/* ✅ VIDEO EN VIVO DEL FRONTEND */}
                <div className="relative bg-gray-900 rounded-lg aspect-video overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Canvas oculto para captura */}
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Indicador de captura activa */}
                  <div className="absolute top-2 right-4">
                    <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      CAPTURANDO
                    </div>
                  </div>
                  
                  {/* Icono de cámara */}
                  <div className="absolute top-2 left-4">
                    <div className="p-2 bg-white/90 rounded-lg shadow-lg">
                      <Video className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </div>

                {/* ✅ NUEVA SECCIÓN: VISUALIZACIÓN DE SECUENCIA REQUERIDA */}
                {sessionInfo && sessionInfo.required_sequence && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-blue-900">Secuencia de Gestos</h3>
                      <Badge variant={sessionInfo.sequence_complete ? 'success' : 'default'}>
                        {sessionInfo.captured_sequence?.length || 0}/{sessionInfo.required_sequence.length} gestos
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-center gap-3 flex-wrap">
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

                    {/* Instrucción del gesto actual */}
                    {sessionInfo.required_sequence && !sessionInfo.sequence_complete && (
                      <div className="mt-3 p-3 bg-white border border-blue-300 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Hand className="w-4 h-4 text-blue-700" />
                          <p className="text-sm font-medium text-blue-900">
                            Gesto actual: <strong>{sessionInfo.required_sequence[sessionInfo.captured_sequence?.length || 0]}</strong>
                          </p>
                        </div>
                      </div>
                    )}

                    {sessionInfo.sequence_complete && (
                      <div className="flex items-center gap-2 mt-3">
                        <CheckCircle className="w-4 h-4 text-green-700" />
                        <p className="text-xs text-green-700 font-medium">
                          ✅ Secuencia completa - Analizando identidad biométrica...
                        </p>
                      </div>
                    )}
                  </div>
                )}

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
                    ℹ️ El sistema está capturando y procesando tus gestos biométricos desde tu cámara
                  </p>
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
                      {result.success ? '¡Verificación Exitosa!' : 'Verificación Fallida'}
                    </h2>
                    <p className={`text-sm mt-0.5 ${
                      result.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {result.success 
                        ? `La identidad de ${result.username} ha sido verificada correctamente`
                        : 'No se pudo verificar la identidad del usuario'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8">
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

                <Button 
                  onClick={handleReset} 
                  className="w-full max-w-md mx-auto block h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300 font-semibold rounded-xl"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Nueva Verificación
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CUENTA BLOQUEADA */}
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
  )
}