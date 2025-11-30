import { useState, useEffect } from 'react'
import { systemApi } from '../../../lib/api/system'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Spinner,
  Badge,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Alert
} from '../../../components/ui'
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
  const [activeTab, setActiveTab] = useState('config') // 'config' | 'logs' | 'api-keys'
  
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

  // ============================================
  // FUNCIONES PARA API KEYS
  // ============================================

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
        alert('✅ API Key generada exitosamente')
      }
    } catch (err) {
      console.error('Error generando API Key:', err)
      alert('❌ Error al generar API Key')
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleRegenerateApiKey = async () => {
    if (!confirm('⚠️ ADVERTENCIA\n\nAl regenerar la API Key:\n\n• La clave actual dejará de funcionar\n• El Plugin no podrá autenticarse hasta actualizar la nueva clave\n• Esta acción no se puede deshacer\n\n¿Estás seguro de continuar?')) {
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
        alert('✅ API Key regenerada exitosamente\n\n⚠️ IMPORTANTE: Actualiza esta nueva clave en el Plugin')
      }
    } catch (err) {
      console.error('Error regenerando API Key:', err)
      alert('❌ Error al regenerar API Key')
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

  // ============================================
  // FUNCIONES DE LOGS
  // ============================================

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
    const variants = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'danger',
      DEBUG: 'secondary'
    }
    return <Badge variant={variants[level] || 'secondary'}>{level}</Badge>
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sistema</h1>
        <p className="text-gray-600 mt-1">
          Configuración y logs del sistema
        </p>
      </div>

      {/* Tabs - CON API KEYS */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'config'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Configuración
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Logs del Sistema
        </button>
        <button
          onClick={() => setActiveTab('api-keys')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'api-keys'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Key className="w-4 h-4 inline mr-2" />
          API Key Management
        </button>
      </div>

      {/* Tab: Configuración */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {loadingConfig ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {/* Configuración de Captura */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Captura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Muestras por Gesto</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {config?.capture?.samples_per_gesture || 7}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Gestos por Usuario</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {config?.capture?.gestures_per_user || 3}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Total Capturas</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {config?.capture?.total_captures || 21}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Frames Estabilidad</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {config?.capture?.required_stable_frames || 1}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Configuración de Cámara */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Cámara
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Resolución</p>
                      <p className="text-lg font-bold text-gray-900">
                        {config?.camera?.width}×{config?.camera?.height}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">FPS Target</p>
                      <p className="text-lg font-bold text-gray-900">
                        {config?.camera?.fps_target || 30}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Warmup Frames</p>
                      <p className="text-lg font-bold text-gray-900">
                        {config?.camera?.warmup_frames || 30}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Umbrales MediaPipe */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hand className="w-5 h-5" />
                    Umbrales MediaPipe
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Confidence Mano</p>
                      <p className="text-lg font-bold text-gray-900">
                        {config?.thresholds?.hand_confidence || 0.9}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Confidence Gesto</p>
                      <p className="text-lg font-bold text-gray-900">
                        {config?.thresholds?.gesture_confidence || 0.6}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Tamaño Target</p>
                      <p className="text-lg font-bold text-gray-900">
                        {config?.thresholds?.target_hand_size || 0.22}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Umbrales de IA */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Umbrales de Autenticación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-700 mb-1">Verificación (1:1)</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {authThresholds?.verification || '---'}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">Umbral optimizado</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-700 mb-1">Identificación (1:N)</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {authThresholds?.identification || '---'}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">+7% sobre verificación</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-700 mb-1">Peso Anatómico</p>
                      <p className="text-2xl font-bold text-green-900">
                        {authThresholds?.anatomical_weight ? `${(authThresholds.anatomical_weight * 100).toFixed(0)}%` : '---'}
                      </p>
                      <p className="text-xs text-green-600 mt-1">Fusión multimodal</p>
                    </div>
                    <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                      <p className="text-sm text-cyan-700 mb-1">Peso Dinámico</p>
                      <p className="text-2xl font-bold text-cyan-900">
                        {authThresholds?.dynamic_weight ? `${(authThresholds.dynamic_weight * 100).toFixed(0)}%` : '---'}
                      </p>
                      <p className="text-xs text-cyan-600 mt-1">Fusión multimodal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Tab: Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Estadísticas de Logs */}
          {logStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 mb-1">Total Líneas</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {logStats.total_lines?.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 mb-1">Tamaño</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {logStats.file_size_mb} MB
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 mb-1">Errores</p>
                  <p className="text-2xl font-bold text-red-600">
                    {logStats.levels?.ERROR || 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 mb-1">Warnings</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {logStats.levels?.WARNING || 0}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select
                  label="Nivel"
                  value={logsFilters.level}
                  onChange={(e) => handleFilterChange('level', e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="ERROR">ERROR</option>
                  <option value="DEBUG">DEBUG</option>
                </Select>

                <Input
                  label="Módulo"
                  placeholder="ej: enrollment"
                  value={logsFilters.module}
                  onChange={(e) => handleFilterChange('module', e.target.value)}
                />

                <Input
                  label="Buscar"
                  placeholder="Buscar en logs..."
                  value={logsFilters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />

                <Select
                  label="Límite"
                  value={logsFilters.limit}
                  onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                >
                  <option value="50">50 líneas</option>
                  <option value="100">100 líneas</option>
                  <option value="200">200 líneas</option>
                  <option value="500">500 líneas</option>
                </Select>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={handleApplyFilters} className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Aplicar Filtros
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setLogsFilters({ level: '', module: '', search: '', limit: 100 })
                    loadLogs()
                  }}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Limpiar
                </Button>
                <Button
                  variant="outline"
                  onClick={exportLogsToCSV}
                  disabled={logs.length === 0}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar CSV
                </Button>
                <Button
                  variant="danger"
                  onClick={handleClearLogs}
                  className="flex items-center gap-2 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpiar Logs
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Logs del Sistema ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No se encontraron logs
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead>Mensaje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-mono text-gray-600">
                            {log.timestamp}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{log.module}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getLevelIcon(log.level)}
                              {getLevelBadge(log.level)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm max-w-2xl truncate">
                            {log.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: API Key Management - NUEVO */}
      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          {loadingApiKey ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {/* Header con descripción */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-600 rounded-lg">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Gestión de API Key
                      </h3>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        La API Key permite la comunicación segura entre el Plugin y el Sistema Biométrico. 
                        Solo puede existir una clave activa a la vez. Al regenerar la clave, la anterior 
                        dejará de funcionar inmediatamente.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API key */}
              {apiKeyData ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      API Key
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Clave */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Clave Activa
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={apiKeyData.key}
                          readOnly
                          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm text-gray-900"
                        />
                        <Button
                          onClick={handleCopyApiKey}
                          className="flex items-center gap-2 px-4"
                          title="Copiar al portapapeles"
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
                        </Button>
                      </div>
                    </div>

                    {/* Información */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-700 mb-1">Fecha de Creación</p>
                        <p className="text-sm font-semibold text-blue-900">
                          {formatDate(apiKeyData.created_at)}
                        </p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm text-green-700 mb-1">Veces Utilizada</p>
                        <p className="text-2xl font-bold text-green-900">
                          {apiKeyData.usage_count || 0}
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-sm text-purple-700 mb-1">Último Uso</p>
                        <p className="text-sm font-semibold text-purple-900">
                          {formatDate(apiKeyData.last_used_at)}
                        </p>
                      </div>
                    </div>

                    {/* Botón Regenerar */}
                    <div className="border-t border-gray-200 pt-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">
                            Regenerar API Key
                          </h4>
                          <p className="text-sm text-gray-600">
                            Genera una nueva clave e invalida la actual. El Plugin dejará de funcionar 
                            hasta que actualices la nueva clave en su configuración.
                          </p>
                        </div>
                        <Button
                          onClick={handleRegenerateApiKey}
                          disabled={generatingKey}
                          variant="danger"
                          className="flex items-center gap-2 whitespace-nowrap"
                        >
                          {generatingKey ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Regenerando...</span>
                            </>
                          ) : (
                            <>
                              <RotateCw className="w-4 h-4" />
                              <span>Regenerar</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                // No existe API Key
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                        <Key className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No hay API Key configurada
                      </h3>
                      <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                        Genera una API Key para permitir la comunicación segura entre el Plugin 
                        y el Sistema Biométrico.
                      </p>
                      <Button
                        onClick={handleGenerateApiKey}
                        disabled={generatingKey}
                        className="flex items-center gap-2 mx-auto"
                      >
                        {generatingKey ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Generando...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>Autogenerar API Key</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

            </>
          )}
        </div>
      )}
    </div>
  )
}