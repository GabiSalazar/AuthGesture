import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../lib/api/auth'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Alert,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  DialogClose
} from '../../components/ui'
import GestureIcon from '../../components/GestureIcon'
import { Mail, ArrowRight, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

export default function ForgotSequence() {
  const navigate = useNavigate()
  
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [userData, setUserData] = useState(null)
  
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  
  const handleSendOTP = async () => {
    try {
      setLoading(true)
      setError('')
      
      await authApi.sendForgotSequenceOTP(email)
      setStep(2)
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Error enviando código')
    } finally {
      setLoading(false)
    }
  }
  
  const handleVerifyOTP = async () => {
    try {
      setLoading(true)
      setError('')
      
      const code = otpCode.join('')
      const result = await authApi.verifyForgotSequenceOTP(email, code)
      
      setUserData(result)
      setStep(3)
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Código inválido')
    } finally {
      setLoading(false)
    }
  }
  
  const handleReenroll = async () => {
    try {
      setLoading(true)
      
      const result = await authApi.initiateReenrollment(userData.user_id)
      
      navigate('/enrollment', {
        state: {
          reenrollment: true,
          userData: result.user_data,
          personalityProfile: result.personality_profile,
          reusePersonality: result.reuse_personality
        }
      })
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Error iniciando re-registro')
      setLoading(false)
    }
  }
  
  const handleOTPChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    
    const newOTP = [...otpCode]
    newOTP[index] = value
    setOtpCode(newOTP)
    
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }
  
  const handleOTPKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-6 h-6 text-blue-600" />
              Recuperar Secuencia de Gestos
            </CardTitle>
            <CardDescription>
              {step === 1 && 'Ingresa tu email para recibir un código de verificación'}
              {step === 2 && 'Ingresa el código de 6 dígitos que enviamos a tu email'}
              {step === 3 && 'Esta es tu secuencia de gestos registrada'}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {error && (
              <Alert variant="danger" className="mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </Alert>
            )}
            
            {step === 1 && (
              <div className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  disabled={loading}
                />
              </div>
            )}
            
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Código enviado a: <span className="font-medium">{email}</span>
                </p>
                
                <div className="flex gap-2 justify-center">
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength="1"
                      className="w-12 h-12 text-center text-xl font-bold border-2 rounded-lg focus:border-blue-500 focus:outline-none"
                      value={digit}
                      onChange={(e) => handleOTPChange(index, e.target.value)}
                      onKeyDown={(e) => handleOTPKeyDown(index, e)}
                      disabled={loading}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {step === 3 && userData && (
              <div className="space-y-6">
                <Alert variant="success" className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Tu secuencia de gestos es:
                </Alert>
                
                <div className="flex justify-center gap-8">
                  {userData.gesture_sequence.map((gesture, index) => (
                    <div key={index} className="text-center">
                      <div className="mb-2 text-sm font-medium text-gray-500">
                        Paso {index + 1}
                      </div>
                      <GestureIcon 
                        gesture={gesture} 
                        size="large" 
                        showLabel={true}
                      />
                    </div>
                  ))}
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Consejo:</strong> Toma una captura de pantalla de tu secuencia para no olvidarla.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-between">
            {step > 1 && step < 3 && (
              <Button
                variant="secondary"
                onClick={() => setStep(step - 1)}
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Atrás
              </Button>
            )}
            
            <div className="ml-auto flex gap-2">
              {step === 1 && (
                <Button onClick={handleSendOTP} disabled={loading || !email}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar Código
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
              
              {step === 2 && (
                <Button 
                  onClick={handleVerifyOTP} 
                  disabled={loading || otpCode.some(d => !d)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Verificar Código
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
              
              {step === 3 && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/login')}
                  >
                    Ir a Login
                  </Button>
                  <Button onClick={() => setShowConfirmModal(true)}>
                    Volver a Registrarme
                    <RefreshCw className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
      
      <Dialog open={showConfirmModal} onClose={() => setShowConfirmModal(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-600">
            <AlertTriangle className="w-5 h-5" />
            Confirmar Re-registro
          </DialogTitle>
          <DialogClose onClose={() => setShowConfirmModal(false)} />
        </DialogHeader>
        
        <DialogContent>
          <Alert variant="warning" className="mb-4">
            <div>
              <p className="font-semibold mb-2">Acción Importante</p>
              <p className="text-sm">
                Tu cuenta actual será desactivada y crearás una nueva con los mismos datos personales. 
                Deberás realizar nuevamente la captura biométrica de tus gestos.
              </p>
            </div>
          </Alert>
          
          <p className="text-sm text-gray-600">
            Tu perfil de personalidad será conservado, por lo que no tendrás que completar el cuestionario nuevamente.
          </p>
        </DialogContent>
        
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setShowConfirmModal(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleReenroll}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              'Sí, Continuar'
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
