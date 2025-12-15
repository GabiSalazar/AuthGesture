import { useState, useEffect } from 'react'
import { adminApi } from '../../../lib/api/admin'
import {
  Edit2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  User
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

  if (!open || !user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border-2"
        style={{ borderColor: '#E0F2FE' }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b-2"
          style={{ 
            borderColor: '#E0F2FE',
            background: 'linear-gradient(to right, #F4FCFF, #ECFEFF)'
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-xl"
              style={{ backgroundColor: '#05A8F9' }}
            >
              <Edit2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Editar Usuario
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/50"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
            <div className="space-y-6">
              
              {/* Mensajes de éxito/error */}
              {successMessage && (
                <div 
                  className="flex items-center gap-3 p-4 rounded-xl border-2"
                  style={{ 
                    backgroundColor: '#F0FDF4',
                    borderColor: '#86EFAC'
                  }}
                >
                  <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#10B981' }} />
                  <p className="text-sm font-medium" style={{ color: '#065F46' }}>
                    {successMessage}
                  </p>
                </div>
              )}

              {errorMessage && (
                <div 
                  className="flex items-center gap-3 p-4 rounded-xl border-2"
                  style={{ 
                    backgroundColor: '#FEF2F2',
                    borderColor: '#FCA5A5'
                  }}
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#EF4444' }} />
                  <p className="text-sm font-medium" style={{ color: '#991B1B' }}>
                    {errorMessage}
                  </p>
                </div>
              )}

              {/* User ID (no editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User ID
                </label>
                <div 
                  className="px-4 py-3 rounded-xl border-2 text-gray-600 font-mono text-sm"
                  style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}
                >
                  {user.user_id}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  El ID de usuario no puede ser modificado
                </p>
              </div>

              {/* Nombre completo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Ej: Juan Pérez"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 font-medium transition-all duration-300 focus:outline-none"
                  style={{ 
                    borderColor: errors.username ? '#FCA5A5' : '#E0F2FE',
                    backgroundColor: errors.username ? '#FEF2F2' : 'white'
                  }}
                  onFocus={(e) => {
                    if (!errors.username) {
                      e.target.style.borderColor = '#05A8F9'
                      e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.username ? '#FCA5A5' : '#E0F2FE'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                {errors.username && (
                  <p className="text-sm text-red-600 mt-1">{errors.username}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ejemplo@email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 font-medium transition-all duration-300 focus:outline-none"
                  style={{ 
                    borderColor: errors.email ? '#FCA5A5' : '#E0F2FE',
                    backgroundColor: errors.email ? '#FEF2F2' : 'white'
                  }}
                  onFocus={(e) => {
                    if (!errors.email) {
                      e.target.style.borderColor = '#05A8F9'
                      e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.email ? '#FCA5A5' : '#E0F2FE'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                )}
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="987654321"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 font-medium transition-all duration-300 focus:outline-none"
                  style={{ 
                    borderColor: errors.phone_number ? '#FCA5A5' : '#E0F2FE',
                    backgroundColor: errors.phone_number ? '#FEF2F2' : 'white'
                  }}
                  onFocus={(e) => {
                    if (!errors.phone_number) {
                      e.target.style.borderColor = '#05A8F9'
                      e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.phone_number ? '#FCA5A5' : '#E0F2FE'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                {errors.phone_number && (
                  <p className="text-sm text-red-600 mt-1">{errors.phone_number}</p>
                )}
              </div>

              {/* Edad y Género en la misma fila */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Edad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Edad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    placeholder="25"
                    min="5"
                    max="80"
                    required
                    className="w-full px-4 py-3 rounded-xl border-2 font-medium transition-all duration-300 focus:outline-none"
                    style={{ 
                      borderColor: errors.age ? '#FCA5A5' : '#E0F2FE',
                      backgroundColor: errors.age ? '#FEF2F2' : 'white'
                    }}
                    onFocus={(e) => {
                      if (!errors.age) {
                        e.target.style.borderColor = '#05A8F9'
                        e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.age ? '#FCA5A5' : '#E0F2FE'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                  {errors.age && (
                    <p className="text-sm text-red-600 mt-1">{errors.age}</p>
                  )}
                </div>

                {/* Género */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Género <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border-2 font-medium transition-all duration-300 focus:outline-none"
                    style={{ 
                      borderColor: errors.gender ? '#FCA5A5' : '#E0F2FE',
                      backgroundColor: errors.gender ? '#FEF2F2' : 'white'
                    }}
                    onFocus={(e) => {
                      if (!errors.gender) {
                        e.target.style.borderColor = '#05A8F9'
                        e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.gender ? '#FCA5A5' : '#E0F2FE'
                      e.target.style.boxShadow = 'none'
                    }}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                  {errors.gender && (
                    <p className="text-sm text-red-600 mt-1">{errors.gender}</p>
                  )}
                </div>
              </div>

              {/* Secuencia de gestos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secuencia de Gestos <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Selecciona 3 gestos en el orden deseado ({formData.gesture_sequence.length}/3 seleccionados)
                </p>

                {/* Gestos seleccionados */}
                {formData.gesture_sequence.length > 0 && (
                  <div 
                    className="flex gap-4 mb-4 p-4 rounded-xl border-2"
                    style={{ 
                      backgroundColor: '#F4FCFF',
                      borderColor: '#E0F2FE'
                    }}
                  >
                    {formData.gesture_sequence.map((gesture, idx) => {
                      const gestureData = availableGestures.find(g => g.value === gesture)
                      return (
                        <div key={idx} className="flex flex-col items-center gap-2">
                          <div className="text-4xl">{gestureData?.emoji}</div>
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: '#05A8F9', color: 'white' }}
                          >
                            #{idx + 1}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Selector de gestos */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {availableGestures.map((gesture) => {
                    const isSelected = formData.gesture_sequence.includes(gesture.value)
                    const position = formData.gesture_sequence.indexOf(gesture.value)
                    const isDisabled = !isSelected && formData.gesture_sequence.length >= 3

                    return (
                      <button
                        key={gesture.value}
                        type="button"
                        onClick={() => handleGestureToggle(gesture.value)}
                        disabled={isDisabled}
                        className="relative p-4 rounded-xl border-2 transition-all duration-300"
                        style={{
                          borderColor: isSelected ? '#05A8F9' : '#E0F2FE',
                          backgroundColor: isSelected ? '#F4FCFF' : 'white',
                          opacity: isDisabled ? 0.5 : 1,
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          boxShadow: isSelected ? '0 0 0 3px rgba(5, 168, 249, 0.1)' : 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (!isDisabled && !isSelected) {
                            e.currentTarget.style.borderColor = '#6FBFDE'
                            e.currentTarget.style.transform = 'scale(1.05)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isDisabled && !isSelected) {
                            e.currentTarget.style.borderColor = '#E0F2FE'
                            e.currentTarget.style.transform = 'scale(1)'
                          }
                        }}
                      >
                        <div className="text-3xl mb-2">{gesture.emoji}</div>
                        <div className="text-xs text-gray-600 text-center font-medium">
                          {gesture.label}
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <span 
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                              style={{ backgroundColor: '#05A8F9', color: 'white' }}
                            >
                              {position + 1}
                            </span>
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
          </div>

          {/* Footer */}
          <div 
            className="flex items-center justify-end gap-3 px-6 py-4 border-t-2"
            style={{ borderColor: '#E0F2FE', backgroundColor: '#F9FAFB' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 border-2"
              style={{
                backgroundColor: 'white',
                borderColor: '#E0F2FE',
                color: '#6B7280'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#F9FAFB'
                  e.currentTarget.style.borderColor = '#9CA3AF'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white'
                e.currentTarget.style.borderColor = '#E0F2FE'
              }}
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || Object.keys(errors).length > 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 text-white"
              style={{
                background: loading || Object.keys(errors).length > 0
                  ? '#9CA3AF'
                  : 'linear-gradient(to right, #00B8D4, #00ACC1)',
                boxShadow: loading || Object.keys(errors).length > 0
                  ? 'none'
                  : '0 4px 12px 0 rgba(0, 184, 212, 0.4)',
                cursor: loading || Object.keys(errors).length > 0 ? 'not-allowed' : 'pointer',
                opacity: loading || Object.keys(errors).length > 0 ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading && Object.keys(errors).length === 0) {
                  e.currentTarget.style.transform = 'scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 8px 20px 0 rgba(0, 184, 212, 0.5)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = loading || Object.keys(errors).length > 0
                  ? 'none'
                  : '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
              }}
            >
              {loading ? (
                <>
                  <div 
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                  />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}