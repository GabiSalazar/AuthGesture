import { useState, useEffect } from 'react'
import { systemApi } from '../../../lib/api/system'
import {
  Settings,
  Camera,
  Hand,
  Brain,
  Database,
  FileText,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Key,
  Copy,
  RotateCw,
  Zap,
  Shield
} from 'lucide-react'

export default function SystemManagement() {
  const [activeTab, setActiveTab] = useState('config')
  
  // Estado de configuración
  const [config, setConfig] = useState(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [authThresholds, setAuthThresholds] = useState(null)

  // Estado de logs
  const [logs, setLogs] = useState([])
  const [logStats, setLogStats] = useState(null)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logsFilters, setLogsFilters] = useState({
    level: '',
    module: '',
    search: '',
    limit: 100
  })

  // Estado de API Keys
  const [apiKeyData, setApiKeyData] = useState(null)
  const [loadingApiKey, setLoadingApiKey] = useState(false)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Cargar configuración al montar
  useEffect(() => {
    loadConfiguration()
  }, [])

  // Cargar logs cuando se cambia a la tab de logs
  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs()
      loadLogStats()
    }
  }, [activeTab])

  // Cargar API Key cuando se cambia a la tab de api-keys
  useEffect(() => {
    if (activeTab === 'api-keys') {
      loadCurrentApiKey()
    }
  }, [activeTab])

  const loadConfiguration = async () => {
    try {
      setLoadingConfig(true)
      const [configRes, captureRes, thresholdsRes, cameraRes, authThresholdsRes] = await Promise.all([
        systemApi.getFullConfig(),
        systemApi.getCaptureSettings(),
        systemApi.getThresholds(),
        systemApi.getCameraSettings(),
        systemApi.getAuthenticationThresholds()
      ])
      
      setConfig({
        full: configRes.config,
        capture: captureRes,
        thresholds: thresholdsRes,
        camera: cameraRes
      })
      setAuthThresholds(authThresholdsRes.thresholds)
    } catch (err) {
      console.error('Error cargando configuración:', err)
    } finally {
      setLoadingConfig(false)
    }
  }

  const loadLogs = async () => {
    try {
      setLoadingLogs(true)
      const response = await systemApi.getLogs(logsFilters)
      setLogs(response.logs || [])
    } catch (err) {
      console.error('Error cargando logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  const loadLogStats = async () => {
    try {
      const response = await systemApi.getLogStats()
      setLogStats(response.stats)
    } catch (err) {
      console.error('Error cargando estadísticas de logs:', err)
    }
  }

  const loadCurrentApiKey = async () => {
    try {
      setLoadingApiKey(true)
      const response = await fetch('http://localhost:8000/api/v1/api-keys/current')
      const data = await response.json()
      
      setApiKeyData(data.exists ? {
        key: data.key,
        created_at: data.created_at,
        usage_count: data.usage_count,
        last_used_at: data.last_used_at
      } : null)
    } catch (err) {
      console.error('Error cargando API Key:', err)
    } finally {
      setLoadingApiKey(false)
    }
  }

  const handleGenerateApiKey = async () => {
    if (apiKeyData) {
      if (!confirm('Ya existe una API Key. Generar una nueva invalidará la actual. ¿Continuar?')) {
        return
      }
    }

    try {
      setGeneratingKey(true)
      const response = await fetch('http://localhost:8000/api/v1/api-keys/generate', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setApiKeyData({
          key: data.key,
          created_at: data.created_at,
          usage_count: 0,
          last_used_at: null
        })
        alert('API Key generada exitosamente')
      }
    } catch (err) {
      console.error('Error generando API Key:', err)
      alert('Error al generar API Key')
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleRegenerateApiKey = async () => {
    if (!confirm('ADVERTENCIA\n\nAl regenerar la API Key:\n\n• La clave actual dejará de funcionar\n• El Plugin no podrá autenticarse hasta actualizar la nueva clave\n• Esta acción no se puede deshacer\n\n¿Estás seguro de continuar?')) {
      return
    }

    try {
      setGeneratingKey(true)
      const response = await fetch('http://localhost:8000/api/v1/api-keys/regenerate', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setApiKeyData({
          key: data.key,
          created_at: data.created_at,
          usage_count: 0,
          last_used_at: null
        })
        alert('API Key regenerada exitosamente\n\nIMPORTANTE: Actualiza esta nueva clave en el Plugin')
      }
    } catch (err) {
      console.error('Error regenerando API Key:', err)
      alert('Error al regenerar API Key')
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleCopyApiKey = () => {
    if (apiKeyData?.key) {
      navigator.clipboard.writeText(apiKeyData.key)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca'
    const date = new Date(dateString)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const handleFilterChange = (key, value) => {
    setLogsFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleApplyFilters = () => {
    loadLogs()
  }

  const handleClearLogs = async () => {
    if (!confirm('¿Estás seguro de que deseas limpiar todos los logs? Se creará un backup.')) {
      return
    }
    
    try {
      await systemApi.clearLogs()
      loadLogs()
      loadLogStats()
      alert('Logs limpiados exitosamente')
    } catch (err) {
      console.error('Error limpiando logs:', err)
      alert('Error al limpiar logs')
    }
  }

  const exportLogsToCSV = () => {
    const headers = ['Timestamp', 'Module', 'Level', 'Message']
    const rows = logs.map(log => [
      log.timestamp,
      log.module,
      log.level,
      log.message
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system_logs_${new Date().toISOString()}.csv`
    a.click()
  }

  const getLevelBadge = (level) => {
    const styles = {
      INFO: { bg: '#DBEAFE', color: '#1E40AF' },
      WARNING: { bg: '#FEF3C7', color: '#92400E' },
      ERROR: { bg: '#FEE2E2', color: '#991B1B' },
      DEBUG: { bg: '#F3F4F6', color: '#374151' }
    }
    const style = styles[level] || styles.DEBUG
    return (
      <span 
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        {level}
      </span>
    )
  }

  const getLevelIcon = (level) => {
    const icons = {
      INFO: <CheckCircle className="w-4 h-4 text-blue-600" />,
      WARNING: <AlertCircle className="w-4 h-4 text-yellow-600" />,
      ERROR: <XCircle className="w-4 h-4 text-red-600" />
    }
    return icons[level] || <CheckCircle className="w-4 h-4 text-gray-600" />
  }

  return (
    <div className="space-y-6">
      
      {/* ========================================
          HEADER
      ======================================== */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
          Gestión del Sistema
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Configuración, logs y API keys
        </p>
      </div>

      {/* ========================================
          TABS
      ======================================== */}
      <div className="flex items-center gap-2 border-b-2 overflow-x-auto" style={{ borderColor: '#E0F2FE' }}>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4 ${
            activeTab === 'config'
              ? 'text-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          style={
            activeTab === 'config'
              ? { 
                  borderColor: '#05A8F9',
                  backgroundColor: '#F4FCFF',
                  color: '#05A8F9'
                }
              : {}
          }
        >
          <Settings className="w-4 h-4" />
          Configuración
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4 ${
            activeTab === 'logs'
              ? 'text-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          style={
            activeTab === 'logs'
              ? { 
                  borderColor: '#05A8F9',
                  backgroundColor: '#F4FCFF',
                  color: '#05A8F9'
                }
              : {}
          }
        >
          <FileText className="w-4 h-4" />
          Logs del Sistema
        </button>
        <button
          onClick={() => setActiveTab('api-keys')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4 ${
            activeTab === 'api-keys'
              ? 'text-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          style={
            activeTab === 'api-keys'
              ? { 
                  borderColor: '#05A8F9',
                  backgroundColor: '#F4FCFF',
                  color: '#05A8F9'
                }
              : {}
          }
        >
          <Key className="w-4 h-4" />
          API Keys
        </button>
      </div>

      {/* ========================================
          TAB: CONFIGURACIÓN
      ======================================== */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {loadingConfig ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div 
                  className="w-12 h-12 mx-auto border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: '#05A8F9', borderTopColor: 'transparent' }}
                />
                <p className="text-gray-600 text-sm font-medium">
                  Cargando configuración...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Configuración de Captura */}
              <div 
                className="bg-white rounded-2xl border-2 shadow-lg p-6"
                style={{ borderColor: '#E0F2FE' }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Camera className="w-5 h-5" style={{ color: '#05A8F9' }} />
                  <h3 className="text-lg font-black text-gray-900">
                    Configuración de Captura
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Muestras por Gesto
                    </p>
                    <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.capture?.samples_per_gesture || 7}
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Gestos por Usuario
                    </p>
                    <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.capture?.gestures_per_user || 3}
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Total Capturas
                    </p>
                    <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.capture?.total_captures || 21}
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Frames Estabilidad
                    </p>
                    <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.capture?.required_stable_frames || 1}
                    </p>
                  </div>
                </div>
              </div>

              {/* Configuración de Cámara */}
              <div 
                className="bg-white rounded-2xl border-2 shadow-lg p-6"
                style={{ borderColor: '#E0F2FE' }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Camera className="w-5 h-5" style={{ color: '#05A8F9' }} />
                  <h3 className="text-lg font-black text-gray-900">
                    Configuración de Cámara
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Resolución
                    </p>
                    <p className="text-2xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.camera?.width}×{config?.camera?.height}
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      FPS Target
                    </p>
                    <p className="text-2xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.camera?.fps_target || 30}
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Warmup Frames
                    </p>
                    <p className="text-2xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.camera?.warmup_frames || 30}
                    </p>
                  </div>
                </div>
              </div>

              {/* Umbrales MediaPipe */}
              <div 
                className="bg-white rounded-2xl border-2 shadow-lg p-6"
                style={{ borderColor: '#E0F2FE' }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Hand className="w-5 h-5" style={{ color: '#05A8F9' }} />
                  <h3 className="text-lg font-black text-gray-900">
                    Umbrales MediaPipe
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Confidence Mano
                    </p>
                    <p className="text-2xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.thresholds?.hand_confidence || 0.9}
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Confidence Gesto
                    </p>
                    <p className="text-2xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.thresholds?.gesture_confidence || 0.6}
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
                  >
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                      Tamaño Target
                    </p>
                    <p className="text-2xl font-black" style={{ color: '#05A8F9' }}>
                      {config?.thresholds?.target_hand_size || 0.22}
                    </p>
                  </div>
                </div>
              </div>

              {/* Umbrales de Autenticación */}
              <div 
                className="bg-white rounded-2xl border-2 shadow-lg p-6"
                style={{ borderColor: '#E0F2FE' }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Brain className="w-5 h-5" style={{ color: '#05A8F9' }} />
                  <h3 className="text-lg font-black text-gray-900">
                    Umbrales de Autenticación
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
                      Verificación (1:1)
                    </p>
                    <p className="text-3xl font-black text-blue-900">
                      {authThresholds?.verification || '---'}
                    </p>
                    <p className="text-xs text-blue-600 mt-2 font-medium">
                      Umbral optimizado
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
                      Identificación (1:N)
                    </p>
                    <p className="text-3xl font-black text-purple-900">
                      {authThresholds?.identification || '---'}
                    </p>
                    <p className="text-xs text-purple-600 mt-2 font-medium">
                      +7% sobre verificación
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
                      Peso Anatómico
                    </p>
                    <p className="text-3xl font-black text-green-900">
                      {authThresholds?.anatomical_weight ? `${(authThresholds.anatomical_weight * 100).toFixed(0)}%` : '---'}
                    </p>
                    <p className="text-xs text-green-600 mt-2 font-medium">
                      Fusión multimodal
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#ECFEFF', borderColor: '#67E8F9' }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide mb-2 text-cyan-700">
                      Peso Dinámico
                    </p>
                    <p className="text-3xl font-black text-cyan-900">
                      {authThresholds?.dynamic_weight ? `${(authThresholds.dynamic_weight * 100).toFixed(0)}%` : '---'}
                    </p>
                    <p className="text-xs text-cyan-600 mt-2 font-medium">
                      Fusión multimodal
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================
          TAB: LOGS
      ======================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          
          {/* Estadísticas de Logs */}
          {logStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div 
                className="bg-white rounded-2xl border-2 shadow-lg p-6"
                style={{ borderColor: '#E0F2FE' }}
              >
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                  Total Líneas
                </p>
                <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
                  {logStats.total_lines?.toLocaleString()}
                </p>
              </div>
              <div 
                className="bg-white rounded-2xl border-2 shadow-lg p-6"
                style={{ borderColor: '#E0F2FE' }}
              >
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                  Tamaño
                </p>
                <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
                  {logStats.file_size_mb} MB
                </p>
              </div>
              <div 
                className="bg-white rounded-2xl border-2 shadow-lg p-6"
                style={{ borderColor: '#FCA5A5' }}
              >
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                  Errores
                </p>
                <p className="text-3xl font-black text-red-600">
                  {logStats.levels?.ERROR || 0}
                </p>
              </div>
              <div 
                className="bg-white rounded-2xl border-2 shadow-lg p-6"
                style={{ borderColor: '#FCD34D' }}
              >
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                  Warnings
                </p>
                <p className="text-3xl font-black text-yellow-600">
                  {logStats.levels?.WARNING || 0}
                </p>
              </div>
            </div>
          )}

          {/* Card de Filtros */}
          <div 
            className="bg-white rounded-2xl border-2 shadow-lg p-6"
            style={{ borderColor: '#E0F2FE' }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Filter className="w-5 h-5" style={{ color: '#05A8F9' }} />
              <h3 className="text-lg font-black text-gray-900">
                Filtros de Logs
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Nivel */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Nivel
                </label>
                <select
                  value={logsFilters.level}
                  onChange={(e) => handleFilterChange('level', e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all text-gray-900 font-medium"
                  style={{ borderColor: '#E0F2FE' }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#05A8F9'
                    e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E0F2FE'
                    e.target.style.boxShadow = 'none'
                  }}
                >
                  <option value="">Todos</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="ERROR">ERROR</option>
                  <option value="DEBUG">DEBUG</option>
                </select>
              </div>

              {/* Módulo */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Módulo
                </label>
                <input
                  type="text"
                  placeholder="ej: enrollment"
                  value={logsFilters.module}
                  onChange={(e) => handleFilterChange('module', e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all text-gray-900 font-medium"
                  style={{ borderColor: '#E0F2FE' }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#05A8F9'
                    e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E0F2FE'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>

              {/* Buscar */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Buscar
                </label>
                <div className="relative">
                  <Search 
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder="Buscar en logs..."
                    value={logsFilters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-all text-gray-900 font-medium"
                    style={{ borderColor: '#E0F2FE' }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#05A8F9'
                      e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E0F2FE'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              {/* Límite */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Límite
                </label>
                <select
                  value={logsFilters.limit}
                  onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all text-gray-900 font-medium"
                  style={{ borderColor: '#E0F2FE' }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#05A8F9'
                    e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E0F2FE'
                    e.target.style.boxShadow = 'none'
                  }}
                >
                  <option value="50">50 líneas</option>
                  <option value="100">100 líneas</option>
                  <option value="200">200 líneas</option>
                  <option value="500">500 líneas</option>
                </select>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleApplyFilters}
                className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                style={{
                  background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                  boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                }}
              >
                <Search className="w-4 h-4" />
                Aplicar Filtros
              </button>
              <button
                onClick={() => {
                  setLogsFilters({ level: '', module: '', search: '', limit: 100 })
                  loadLogs()
                }}
                className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all duration-300 border-2"
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
                <RefreshCw className="w-4 h-4" />
                Limpiar
              </button>
              <button
                onClick={exportLogsToCSV}
                disabled={logs.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all duration-300 border-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'white',
                  borderColor: '#E0F2FE',
                  color: '#05A8F9'
                }}
                onMouseEnter={(e) => {
                  if (logs.length > 0) {
                    e.currentTarget.style.backgroundColor = '#F4FCFF'
                    e.currentTarget.style.borderColor = '#6FBFDE'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                  e.currentTarget.style.borderColor = '#E0F2FE'
                }}
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
              <button
                onClick={handleClearLogs}
                className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all duration-300 border-2 ml-auto"
                style={{
                  backgroundColor: 'white',
                  borderColor: '#FCA5A5',
                  color: '#EF4444'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FEF2F2'
                  e.currentTarget.style.borderColor = '#F87171'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                  e.currentTarget.style.borderColor = '#FCA5A5'
                }}
              >
                <Trash2 className="w-4 h-4" />
                Limpiar Logs
              </button>
            </div>
          </div>

          {/* Tabla de Logs */}
          <div 
            className="bg-white rounded-2xl border-2 shadow-lg overflow-hidden"
            style={{ borderColor: '#E0F2FE' }}
          >
            <div className="p-6 border-b-2" style={{ borderColor: '#E0F2FE' }}>
              <h3 className="text-lg font-black text-gray-900">
                Logs del Sistema ({logs.length})
              </h3>
            </div>

            <div className="p-6">
              {loadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <div 
                      className="w-12 h-12 mx-auto border-4 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: '#05A8F9', borderTopColor: 'transparent' }}
                    />
                    <p className="text-gray-600 text-sm font-medium">
                      Cargando logs...
                    </p>
                  </div>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: '#E0F2FE' }} />
                  <p className="text-gray-600 font-medium">
                    No se encontraron logs
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
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Módulo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Nivel
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Mensaje
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log, idx) => (
                        <tr 
                          key={idx}
                          className={`border-b transition-colors hover:bg-gray-50 ${
                            idx === logs.length - 1 ? 'border-b-0' : ''
                          }`}
                          style={{ 
                            borderColor: idx === logs.length - 1 ? 'transparent' : '#F3F4F6'
                          }}
                        >
                          <td className="px-4 py-3 text-xs font-mono text-gray-600">
                            {log.timestamp}
                          </td>
                          <td className="px-4 py-3">
                            <span 
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                              style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
                            >
                              {log.module}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {getLevelIcon(log.level)}
                              {getLevelBadge(log.level)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-2xl truncate">
                            {log.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================
          TAB: API KEYS
      ======================================== */}
      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          {loadingApiKey ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div 
                  className="w-12 h-12 mx-auto border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: '#05A8F9', borderTopColor: 'transparent' }}
                />
                <p className="text-gray-600 text-sm font-medium">
                  Cargando API Key...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header info */}
              <div 
                className="rounded-2xl border-2 p-6"
                style={{ 
                  background: 'linear-gradient(to right, #EFF6FF, #F5F3FF)',
                  borderColor: '#BFDBFE'
                }}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-xl flex-shrink-0"
                    style={{ backgroundColor: '#05A8F9' }}
                  >
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-gray-900 mb-2">
                      Gestión de API Key
                    </h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      La API Key permite la comunicación segura entre el Plugin y el Sistema Biométrico. 
                      Solo puede existir una clave activa a la vez. Al regenerar la clave, la anterior 
                      dejará de funcionar inmediatamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* API Key existente */}
              {apiKeyData ? (
                <div 
                  className="bg-white rounded-2xl border-2 shadow-lg p-6"
                  style={{ borderColor: '#E0F2FE' }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    <Key className="w-5 h-5" style={{ color: '#05A8F9' }} />
                    <h3 className="text-lg font-black text-gray-900">
                      API Key Activa
                    </h3>
                  </div>

                  <div className="space-y-6">
                    {/* Clave */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Clave Activa
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={apiKeyData.key}
                          readOnly
                          className="flex-1 px-4 py-3 border-2 rounded-xl font-mono text-sm text-gray-900"
                          style={{ 
                            backgroundColor: '#F9FAFB',
                            borderColor: '#E0F2FE'
                          }}
                        />
                        <button
                          onClick={handleCopyApiKey}
                          className="flex items-center gap-2 px-5 py-3 font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
                          style={{
                            background: copiedKey 
                              ? 'linear-gradient(to right, #10B981, #059669)'
                              : 'linear-gradient(to right, #00B8D4, #00ACC1)',
                            color: 'white'
                          }}
                        >
                          {copiedKey ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Información */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div 
                        className="p-5 rounded-xl border-2"
                        style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
                          Fecha de Creación
                        </p>
                        <p className="text-sm font-bold text-blue-900">
                          {formatDate(apiKeyData.created_at)}
                        </p>
                      </div>
                      <div 
                        className="p-5 rounded-xl border-2"
                        style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
                          Veces Utilizada
                        </p>
                        <p className="text-3xl font-black text-green-900">
                          {apiKeyData.usage_count || 0}
                        </p>
                      </div>
                      <div 
                        className="p-5 rounded-xl border-2"
                        style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
                          Último Uso
                        </p>
                        <p className="text-sm font-bold text-purple-900">
                          {formatDate(apiKeyData.last_used_at)}
                        </p>
                      </div>
                    </div>

                    {/* Botón Regenerar */}
                    <div className="border-t-2 pt-6" style={{ borderColor: '#E0F2FE' }}>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-gray-900 mb-1">
                            Regenerar API Key
                          </h4>
                          <p className="text-sm text-gray-600">
                            Genera una nueva clave e invalida la actual. El Plugin dejará de funcionar 
                            hasta que actualices la nueva clave en su configuración.
                          </p>
                        </div>
                        <button
                          onClick={handleRegenerateApiKey}
                          disabled={generatingKey}
                          className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all duration-300 border-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            backgroundColor: 'white',
                            borderColor: '#FCA5A5',
                            color: '#EF4444'
                          }}
                          onMouseEnter={(e) => {
                            if (!generatingKey) {
                              e.currentTarget.style.backgroundColor = '#FEF2F2'
                              e.currentTarget.style.borderColor = '#F87171'
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white'
                            e.currentTarget.style.borderColor = '#FCA5A5'
                          }}
                        >
                          {generatingKey ? (
                            <>
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                              <span>Regenerando...</span>
                            </>
                          ) : (
                            <>
                              <RotateCw className="w-4 h-4" />
                              <span>Regenerar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // No existe API Key
                <div 
                  className="bg-white rounded-2xl border-2 shadow-lg p-12"
                  style={{ borderColor: '#E0F2FE' }}
                >
                  <div className="text-center max-w-md mx-auto">
                    <div 
                      className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                      style={{ backgroundColor: '#F4FCFF' }}
                    >
                      <Key className="w-10 h-10" style={{ color: '#05A8F9' }} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-3">
                      No hay API Key configurada
                    </h3>
                    <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                      Genera una API Key para permitir la comunicación segura entre el Plugin 
                      y el Sistema Biométrico.
                    </p>
                    <button
                      onClick={handleGenerateApiKey}
                      disabled={generatingKey}
                      className="inline-flex items-center gap-2 px-8 py-3 font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                        color: 'white'
                      }}
                    >
                      {generatingKey ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Generando...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          <span>Autogenerar API Key</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}