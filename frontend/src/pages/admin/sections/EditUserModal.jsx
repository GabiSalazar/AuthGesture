import { useState, useEffect } from 'react'
import { adminApi } from '../../../lib/api/admin'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  DialogClose,
  Button,
  Input,
  Select,
  Badge,
  Alert
} from '../../../components/ui'
import {
  Edit2,
  Save,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

export default function EditUserModal({ user, open, onClose, onSuccess }) {
  // Estados del formulario
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone_number: '',
    age: '',
    gender: '',
    gesture_sequence: []
  })

  // Estados de UI
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Gestos disponibles
  const availableGestures = [
    { value: 'Open_Palm', label: 'Palma Abierta', emoji: '🖐️' },
    { value: 'Closed_Fist', label: 'Puño Cerrado', emoji: '✊' },
    { value: 'Victory', label: 'Victoria', emoji: '✌️' },
    { value: 'Thumb_Up', label: 'Pulgar Arriba', emoji: '👍' },
    { value: 'Thumb_Down', label: 'Pulgar Abajo', emoji: '👎' },
    { value: 'Pointing_Up', label: 'Señalar Arriba', emoji: '☝️' },
    { value: 'ILoveYou', label: 'Te Amo', emoji: '🤟' }
  ]

  // Cargar datos del usuario cuando se abre el modal
  useEffect(() => {
    if (open && user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        age: user.age || '',
        gender: user.gender || '',
        gesture_sequence: user.gesture_sequence || []
      })
      setErrors({})
      setSuccessMessage('')
      setErrorMessage('')
    }
  }, [open, user])

  // Validar campo individual
  const validateField = (name, value) => {
    const newErrors = { ...errors }

    switch (name) {
      case 'username':
        if (!value || value.trim().length < 3) {
          newErrors.username = 'El nombre debe tener al menos 3 caracteres'
        } else if (value.trim().length > 100) {
          newErrors.username = 'El nombre no puede exceder 100 caracteres'
        } else {
          delete newErrors.username
        }
        break

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!value || !emailRegex.test(value)) {
          newErrors.email = 'Email inválido'
        } else {
          delete newErrors.email
        }
        break

      case 'phone_number':
        const phoneRegex = /^[0-9]{7,15}$/
        const cleaned = value.replace(/\D/g, '')
        if (!cleaned || !phoneRegex.test(cleaned)) {
          newErrors.phone_number = 'Teléfono inválido (7-15 dígitos)'
        } else {
          delete newErrors.phone_number
        }
        break

      case 'age':
        const ageNum = parseInt(value)
        if (!value || isNaN(ageNum) || ageNum < 5 || ageNum > 80) {
          newErrors.age = 'Edad debe estar entre 5 y 80 años'
        } else {
          delete newErrors.age
        }
        break

      case 'gender':
        if (!value || !['Masculino', 'Femenino'].includes(value)) {
          newErrors.gender = 'Género es obligatorio'
        } else {
          delete newErrors.gender
        }
        break

      case 'gesture_sequence':
        if (value.length !== 3) {
          newErrors.gesture_sequence = 'Debe seleccionar exactamente 3 gestos'
        } else {
          delete newErrors.gesture_sequence
        }
        break

      default:
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Manejar cambio en campos
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    validateField(name, value)
  }

  // Manejar selección de gestos
  const handleGestureToggle = (gesture) => {
    setFormData(prev => {
      const currentSequence = [...prev.gesture_sequence]
      const index = currentSequence.indexOf(gesture)

      if (index > -1) {
        // Remover gesto
        currentSequence.splice(index, 1)
      } else {
        // Agregar gesto (máximo 3)
        if (currentSequence.length < 3) {
          currentSequence.push(gesture)
        }
      }

      validateField('gesture_sequence', currentSequence)
      return {
        ...prev,
        gesture_sequence: currentSequence
      }
    })
  }

  // Validar formulario completo
  const validateForm = () => {
    let isValid = true

    // Validar cada campo
    Object.keys(formData).forEach(key => {
      if (!validateField(key, formData[key])) {
        isValid = false
      }
    })

    return isValid
  }

  // Guardar cambios
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Limpiar mensajes previos
    setSuccessMessage('')
    setErrorMessage('')

    // Validar formulario
    if (!validateForm()) {
      setErrorMessage('Por favor corrige los errores en el formulario')
      return
    }

    try {
      setLoading(true)

      // Preparar datos para enviar
      const updates = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        phone_number: formData.phone_number.replace(/\D/g, ''), // Solo números
        age: parseInt(formData.age),
        gender: formData.gender,
        gesture_sequence: formData.gesture_sequence
      }

      // Enviar al backend
      await adminApi.updateUser(user.user_id, updates)

      setSuccessMessage('Usuario actualizado exitosamente')
      
      // Notificar éxito y cerrar después de 1.5 segundos
      setTimeout(() => {
        if (onSuccess) onSuccess()
        onClose()
      }, 1500)

    } catch (err) {
      console.error('Error actualizando usuario:', err)
      
      // Manejar errores específicos
      if (err.response?.status === 400) {
        const detail = err.response.data.detail
        if (detail.includes('email')) {
          setErrors(prev => ({ ...prev, email: 'Este email ya está registrado' }))
          setErrorMessage('El email ya está registrado por otro usuario')
        } else if (detail.includes('teléfono') || detail.includes('phone')) {
          setErrors(prev => ({ ...prev, phone_number: 'Este teléfono ya está registrado' }))
          setErrorMessage('El teléfono ya está registrado por otro usuario')
        } else {
          setErrorMessage(detail || 'Error al actualizar usuario')
        }
      } else {
        setErrorMessage('Error al actualizar usuario. Por favor intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit2 className="w-5 h-5" />
          Editar Usuario
        </DialogTitle>
        <DialogClose onClose={onClose} />
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          <div className="space-y-6">
            {/* Mensajes de éxito/error */}
            {successMessage && (
              <Alert variant="success" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {successMessage}
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="danger" className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </Alert>
            )}

            {/* User ID (no editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 font-mono text-sm">
                {user.user_id}
              </div>
              <p className="text-xs text-gray-500 mt-1">El ID de usuario no puede ser modificado</p>
            </div>

            {/* Nombre completo */}
            <Input
              label="Nombre Completo"
              name="username"
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
              placeholder="Ej: Juan Pérez"
              required
            />

            {/* Email */}
            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="ejemplo@email.com"
              required
            />

            {/* Teléfono */}
            <Input
              label="Teléfono"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              error={errors.phone_number}
              placeholder="987654321"
              required
            />

            {/* Edad y Género en la misma fila */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Edad"
                name="age"
                type="number"
                value={formData.age}
                onChange={handleChange}
                error={errors.age}
                placeholder="25"
                min="5"
                max="80"
                required
              />

              <Select
                label="Género"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                error={errors.gender}
                required
              >
                <option value="">Seleccionar...</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
              </Select>
            </div>

            {/* Secuencia de gestos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secuencia de Gestos
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Selecciona 3 gestos en el orden deseado ({formData.gesture_sequence.length}/3 seleccionados)
              </p>

              {/* Gestos seleccionados */}
              {formData.gesture_sequence.length > 0 && (
                <div className="flex gap-2 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  {formData.gesture_sequence.map((gesture, idx) => {
                    const gestureData = availableGestures.find(g => g.value === gesture)
                    return (
                      <div key={idx} className="flex flex-col items-center">
                        <div className="text-3xl mb-1">{gestureData?.emoji}</div>
                        <Badge variant="primary" size="sm">#{idx + 1}</Badge>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Selector de gestos */}
              <div className="grid grid-cols-4 gap-2">
                {availableGestures.map((gesture) => {
                  const isSelected = formData.gesture_sequence.includes(gesture.value)
                  const position = formData.gesture_sequence.indexOf(gesture.value)

                  return (
                    <button
                      key={gesture.value}
                      type="button"
                      onClick={() => handleGestureToggle(gesture.value)}
                      disabled={!isSelected && formData.gesture_sequence.length >= 3}
                      className={`
                        relative p-3 border-2 rounded-lg transition-all
                        ${isSelected
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                        }
                        ${!isSelected && formData.gesture_sequence.length >= 3
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                        }
                      `}
                    >
                      <div className="text-3xl mb-1">{gesture.emoji}</div>
                      <div className="text-xs text-gray-600 text-center">
                        {gesture.label}
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1">
                          <Badge variant="primary" size="sm">
                            {position + 1}
                          </Badge>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {errors.gesture_sequence && (
                <p className="text-sm text-red-600 mt-2">{errors.gesture_sequence}</p>
              )}
            </div>
          </div>
        </DialogContent>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading || Object.keys(errors).length > 0}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}