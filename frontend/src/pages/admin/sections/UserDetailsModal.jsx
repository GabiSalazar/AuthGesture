import { useState, useEffect } from 'react'
import { adminApi } from '../../../lib/api/admin'
import {
  User,
  Mail,
  Phone,
  Calendar,
  Users as UsersIcon,
  FileText,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  X as CloseIcon
} from 'lucide-react'

export default function UserDetailsModal({ user, open, onClose }) {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState([])
  const [authAttempts, setAuthAttempts] = useState([])
  const [activeTab, setActiveTab] = useState('info')

  // Estados de filtros para templates
  const [templateTypeFilter, setTemplateTypeFilter] = useState('')
  const [gestureFilter, setGestureFilter] = useState('')

  // Estados para dropdowns personalizados
  const [templateTypeDropdownOpen, setTemplateTypeDropdownOpen] = useState(false)
  const [gestureDropdownOpen, setGestureDropdownOpen] = useState(false)

  useEffect(() => {
    if (open && user) {
      loadUserData()
    }
  }, [open, user])

  const loadUserData = async () => {
    try {
      setLoading(true)
      
      const [templatesRes, attemptsRes] = await Promise.all([
        adminApi.getUserTemplates(user.user_id),
        adminApi.getUserAuthAttempts(user.user_id, 50)
      ])
      
      setTemplates(templatesRes.templates || [])
      setAuthAttempts(attemptsRes.attempts || [])
    } catch (err) {
      console.error('Error cargando datos del usuario:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAuthDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // AGREGAR ESTA FUNCIÓN NUEVA:
  const getFilteredTemplates = () => {
    let filtered = [...templates]
    
    // Filtrar por tipo
    if (templateTypeFilter) {
      filtered = filtered.filter(t => t.template_type === templateTypeFilter)
    }
    
    // Filtrar por gesto
    if (gestureFilter) {
      filtered = filtered.filter(t => t.gesture_name === gestureFilter)
    }
    
    return filtered
  }

  // Obtener gestos únicos
  const getUniqueGestures = () => {
    const gestures = [...new Set(templates.map(t => t.gesture_name))]
    return gestures.sort()
  }

  // const getGestureEmoji = (gesture) => {
  //   const emojis = {
  //     'Open_Palm': '🖐️',
  //     'Closed_Fist': '✊',
  //     'Victory': '✌️',
  //     'Thumb_Up': '👍',
  //     'Thumb_Down': '👎',
  //     'Pointing_Up': '☝️',
  //     'ILoveYou': '🤟'
  //   }
  //   return emojis[gesture] || '👋'
  // }

  const exportToCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Resultado', 'Confidence', 'Anatómico', 'Dinámico', 'Fusionado', 'IP']
    const rows = authAttempts.map(attempt => [
      attempt.date,
      attempt.auth_type,
      attempt.result,
      attempt.confidence,
      attempt.anatomical_score,
      attempt.dynamic_score,
      attempt.fused_score,
      attempt.ip_address || 'N/A'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `user_${user.user_id}_history.csv`
    a.click()
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
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border-2"
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
              <User className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Detalles del usuario
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/50"
          >
            <CloseIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-4">
                <div 
                  className="w-12 h-12 mx-auto border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: '#05A8F9', borderTopColor: 'transparent' }}
                />
                <p className="text-gray-600 text-sm font-medium">
                  Cargando información del usuario...
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              
              {/* ========================================
                  TABS
              ======================================== */}
              <div className="flex items-center gap-2 border-b-2 overflow-x-auto" style={{ borderColor: '#E0F2FE' }}>
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-all whitespace-nowrap border-b-4 ${
                    activeTab === 'info'
                      ? 'text-white'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                  style={
                    activeTab === 'info'
                      ? { 
                          borderColor: '#05A8F9',
                          backgroundColor: '#F4FCFF',
                          color: '#05A8F9'
                        }
                      : {}
                  }
                >
                  <User className="w-4 h-4" />
                  Información
                </button>
                <button
                  onClick={() => setActiveTab('templates')}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-all whitespace-nowrap border-b-4 ${
                    activeTab === 'templates'
                      ? 'text-white'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                  style={
                    activeTab === 'templates'
                      ? { 
                          borderColor: '#05A8F9',
                          backgroundColor: '#F4FCFF',
                          color: '#05A8F9'
                        }
                      : {}
                  }
                >
                  <FileText className="w-4 h-4" />
                  Templates ({templates.length})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-all whitespace-nowrap border-b-4 ${
                    activeTab === 'history'
                      ? 'text-white'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                  style={
                    activeTab === 'history'
                      ? { 
                          borderColor: '#05A8F9',
                          backgroundColor: '#F4FCFF',
                          color: '#05A8F9'
                        }
                      : {}
                  }
                >
                  <Activity className="w-4 h-4" />
                  Historial ({authAttempts.length})
                </button>
              </div>

              {/* ========================================
                  TAB: INFORMACIÓN
              ======================================== */}
              {activeTab === 'info' && (
                <div className="space-y-6">
                  
                  {/* Información Personal */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5" style={{ color: '#05A8F9' }} />
                      Información personal
                    </h3>
                    <div 
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg"
                      style={{ backgroundColor: '#F9FAFB' }}
                    >
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Nombre Completo
                        </p>
                        <p className="text-base font-medium text-gray-900">{user.username}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          User ID
                        </p>
                        <p className="text-base font-mono text-gray-900">{user.user_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                          <Mail className="w-4 h-4" /> Email
                        </p>
                        <p className="text-base text-gray-900">{user.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                          <Phone className="w-4 h-4" /> Teléfono
                        </p>
                        <p className="text-base text-gray-900">{user.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Edad
                        </p>
                        <p className="text-base text-gray-900">{user.age} años</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Género
                        </p>
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                          style={{
                            backgroundColor: user.gender === 'Masculino' ? '#DBEAFE' : '#ECFEFF',
                            color: user.gender === 'Masculino' ? '#1E40AF' : '#0E7490'
                          }}
                        >
                          {user.gender}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                          <Calendar className="w-4 h-4" /> Fecha de Registro
                        </p>
                        <p className="text-base text-gray-900">{formatDate(user.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                          <Clock className="w-4 h-4" /> Última Actividad
                        </p>
                        <p className="text-base text-gray-900">{formatDate(user.last_activity)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Secuencia de Gestos */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Secuencia de gestos
                    </h3>
                    <div 
                      className="flex flex-wrap gap-6 p-6 rounded-lg border-2"
                      style={{ 
                        background: 'linear-gradient(to right, #EFF6FF, #ECFEFF)',
                        borderColor: '#BFDBFE'
                      }}
                    >
                      {user.gesture_sequence?.map((gesture, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                          <img 
                            src={`/${gesture}.png`}
                            alt={gesture.replace('_', ' ')}
                            className="w-16 h-16 object-contain"
                          />
                          <div className="text-xs font-medium text-gray-700">
                            {gesture.replace('_', ' ')}
                          </div>
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: '#05A8F9', color: 'white' }}
                          >
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Estadísticas */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Estadísticas biométricas
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div 
                        className="p-4 rounded-lg border-2"
                        style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
                      >
                        <p className="text-sm text-blue-700 mb-1">
                          Total Templates
                        </p>
                        <p className="text-2xl font-bold text-blue-900">{user.total_templates}</p>
                      </div>
                      <div 
                        className="p-4 rounded-lg border-2"
                        style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
                      >
                        <p className="text-sm text-purple-700 mb-1">
                          Tasa de Éxito
                        </p>
                        <p className="text-2xl font-bold text-purple-900">
                          {user.verification_success_rate?.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================
                  TAB: TEMPLATES
              ======================================== */}
              {activeTab === 'templates' && (
                <div>
                  {/* Header con filtros */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Templates biométricos
                      </h3>
                      <p className="text-sm text-gray-500">
                        Total: <span className="font-semibold">{getFilteredTemplates().length}</span> de {templates.length} templates
                      </p>
                    </div>
                    
                    {/* Filtros */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Filtro por tipo */}
                      {/* Filtro por tipo - CUSTOM DROPDOWN */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">
                          Tipo de template
                        </label>
                        
                        <div className="relative">
                          {/* Trigger del dropdown */}
                          <button
                            type="button"
                            onClick={() => setTemplateTypeDropdownOpen(!templateTypeDropdownOpen)}
                            className="w-full px-3 py-2 border-2 rounded-xl text-left transition-all font-medium text-sm bg-white flex items-center justify-between"
                            style={{ borderColor: templateTypeDropdownOpen ? '#05A8F9' : '#E0F2FE' }}
                            onBlur={() => setTimeout(() => setTemplateTypeDropdownOpen(false), 200)}
                          >
                            <span className="text-gray-700">
                              {templateTypeFilter === '' && 'Todos los tipos'}
                              {templateTypeFilter === 'anatomical' && 'Anatómico'}
                              {templateTypeFilter === 'dynamic' && 'Dinámico'}
                            </span>
                            <svg 
                              className={`w-5 h-5 text-gray-400 transition-transform ${templateTypeDropdownOpen ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Dropdown de opciones */}
                          {templateTypeDropdownOpen && (
                            <div 
                              className="absolute z-10 w-full mt-1 bg-white border-2 rounded-xl shadow-lg overflow-hidden"
                              style={{ borderColor: '#E0F2FE' }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setTemplateTypeFilter('')
                                  setTemplateTypeDropdownOpen(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                Todos los tipos
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTemplateTypeFilter('anatomical')
                                  setTemplateTypeDropdownOpen(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                                style={{ borderColor: '#F3F4F6' }}
                              >
                                Anatómico
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTemplateTypeFilter('dynamic')
                                  setTemplateTypeDropdownOpen(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                                style={{ borderColor: '#F3F4F6' }}
                              >
                                Dinámico
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Filtro por gesto */}
                      {/* Filtro por gesto - CUSTOM DROPDOWN */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">
                          Gesto
                        </label>
                        
                        <div className="relative">
                          {/* Trigger del dropdown */}
                          <button
                            type="button"
                            onClick={() => setGestureDropdownOpen(!gestureDropdownOpen)}
                            className="w-full px-3 py-2 border-2 rounded-xl text-left transition-all font-medium text-sm bg-white flex items-center justify-between"
                            style={{ borderColor: gestureDropdownOpen ? '#05A8F9' : '#E0F2FE' }}
                            onBlur={() => setTimeout(() => setGestureDropdownOpen(false), 200)}
                          >
                            <span className="text-gray-700">
                              {gestureFilter === '' ? 'Todos los gestos' : gestureFilter.replace('_', ' ')}
                            </span>
                            <svg 
                              className={`w-5 h-5 text-gray-400 transition-transform ${gestureDropdownOpen ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Dropdown de opciones */}
                          {gestureDropdownOpen && (
                            <div 
                              className="absolute z-10 w-full mt-1 bg-white border-2 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto"
                              style={{ borderColor: '#E0F2FE' }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setGestureFilter('')
                                  setGestureDropdownOpen(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                Todos los gestos
                              </button>
                              {getUniqueGestures().map(gesture => (
                                <button
                                  key={gesture}
                                  type="button"
                                  onClick={() => {
                                    setGestureFilter(gesture)
                                    setGestureDropdownOpen(false)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                                  style={{ borderColor: '#F3F4F6' }}
                                >
                                  {gesture.replace('_', ' ')}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botón limpiar filtros */}
                    {(templateTypeFilter || gestureFilter) && (
                      <button
                        onClick={() => {
                          setTemplateTypeFilter('')
                          setGestureFilter('')
                        }}
                        className="text-sm font-medium transition-colors"
                        style={{ color: '#05A8F9' }}
                        onMouseEnter={(e) => e.target.style.color = '#0891B2'}
                        onMouseLeave={(e) => e.target.style.color = '#05A8F9'}
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                  
                  {/* Tabla */}
                  {getFilteredTemplates().length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">
                        {templates.length === 0 
                          ? 'No hay templates disponibles'
                          : 'No hay templates que coincidan con los filtros'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr 
                            className="border-b-2"
                            style={{ borderColor: '#E0F2FE' }}
                          >
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Tipo
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Gesto
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Quality Score
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Confidence
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Fecha
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Bootstrap
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {getFilteredTemplates().map((template, idx) => (
                            <tr 
                              key={idx}
                              className={`border-b transition-colors hover:bg-gray-50 ${
                                idx === getFilteredTemplates().length - 1 ? 'border-b-0' : ''
                              }`}
                              style={{ 
                                borderColor: idx === getFilteredTemplates().length - 1 ? 'transparent' : '#F3F4F6'
                              }}
                            >
                              <td className="px-4 py-3">
                                <span 
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: template.template_type === 'anatomical' ? '#DBEAFE' : '#ECFEFF',
                                    color: template.template_type === 'anatomical' ? '#1E40AF' : '#0E7490'
                                  }}
                                >
                                  {template.template_type === 'anatomical' ? 'Anatómico' : 'Dinámico'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <img 
                                    src={`/${template.gesture_name}.png`}
                                    alt={template.gesture_name}
                                    className="w-8 h-8 object-contain"
                                  />
                                  <span className="text-sm">
                                    {template.gesture_name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-24 h-2 rounded-full overflow-hidden"
                                    style={{ backgroundColor: '#E0F2FE' }}
                                  >
                                    <div
                                      className="h-full rounded-full"
                                      style={{ 
                                        width: `${template.quality_score * 100}%`,
                                        backgroundColor: template.quality_score >= 0.8
                                          ? '#10B981'
                                          : template.quality_score >= 0.6
                                            ? '#F59E0B'
                                            : '#EF4444'
                                      }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium">
                                    {(template.quality_score * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm">
                                  {(template.confidence * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {formatDate(template.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                {template.is_bootstrap ? (
                                  <span 
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: '#FFFBEB', color: '#92400E' }}
                                  >
                                    Bootstrap
                                  </span>
                                ) : (
                                  <span 
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: '#F0FDF4', color: '#065F46' }}
                                  >
                                    Normal
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================
                  TAB: HISTORIAL
              ======================================== */}
              {activeTab === 'history' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Historial de autenticaciones
                    </h3>
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 border-2"
                      style={{
                        backgroundColor: 'white',
                        borderColor: '#E0F2FE',
                        color: '#05A8F9'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F4FCFF'
                        e.currentTarget.style.borderColor = '#6FBFDE'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white'
                        e.currentTarget.style.borderColor = '#E0F2FE'
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Exportar CSV
                    </button>
                  </div>

                  {authAttempts.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">
                        No hay intentos de autenticación registrados
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr 
                            className="border-b-2"
                            style={{ borderColor: '#E0F2FE' }}
                          >
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Fecha
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Tipo
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Resultado
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Confidence
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Scores
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              IP
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {authAttempts.map((attempt, idx) => (
                            <tr 
                              key={idx}
                              className={`border-b transition-colors hover:bg-gray-50 ${
                                idx === authAttempts.length - 1 ? 'border-b-0' : ''
                              }`}
                              style={{ 
                                borderColor: idx === authAttempts.length - 1 ? 'transparent' : '#F3F4F6'
                              }}
                            >
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {formatAuthDate(attempt.date)}
                              </td>
                              <td className="px-4 py-3">
                                <span 
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: attempt.auth_type === 'verification' ? '#DBEAFE' : '#ECFEFF',
                                    color: attempt.auth_type === 'verification' ? '#1E40AF' : '#0E7490'
                                  }}
                                >
                                  {attempt.auth_type === 'verification' ? 'Verificación' : 'Identificación'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {attempt.result === 'success' ? (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span 
                                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                      style={{ backgroundColor: '#F0FDF4', color: '#065F46' }}
                                    >
                                      Exitoso
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <XCircle className="w-4 h-4 text-red-600" />
                                    <span 
                                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                      style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
                                    >
                                      Fallido
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm font-medium">
                                  {(attempt.confidence * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500">A:</span>
                                    <span className="font-mono">{attempt.anatomical_score.toFixed(3)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500">D:</span>
                                    <span className="font-mono">{attempt.dynamic_score.toFixed(3)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500">F:</span>
                                    <span className="font-mono font-semibold" style={{ color: '#05A8F9' }}>
                                      {attempt.fused_score.toFixed(3)}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                                {attempt.ip_address || 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}