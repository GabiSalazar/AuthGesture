import { useState, useEffect } from 'react'
import { systemApi } from '../../lib/api/system'
import { enrollmentApi } from '../../lib/api/enrollment'
import { adminApi } from '../../lib/api/admin'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Spinner, Button } from '../../components/ui'
import { 
  Activity, Users, Brain, Shield, Clock, AlertCircle, Zap, TrendingUp, 
  CheckCircle, XCircle, Database, Server, RefreshCw, UserPlus, Key, BarChart3
} from 'lucide-react'

export default function Dashboard() {
  const [systemStatus, setSystemStatus] = useState(null)
  const [bootstrapStatus, setBootstrapStatus] = useState(null)
  const [dbStats, setDbStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)
  const [error, setError] = useState(null)
  const [pendingRetrain, setPendingRetrain] = useState(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [system, bootstrap, pending, stats] = await Promise.all([
        systemApi.getStatus(),
        enrollmentApi.getBootstrapStatus(),
        systemApi.getPendingRetrainUsers().catch(() => ({ 
          pending_count: 0, 
          pending_users: [], 
          can_retrain: false,
          message: 'No disponible'
        })),
        adminApi.getDatabaseStats().catch(() => null)
      ])
      
      setSystemStatus(system)
      setBootstrapStatus(bootstrap)
      setPendingRetrain(pending)
      setDbStats(stats)
      setError(null)
    } catch (err) {
      console.error('Error cargando datos del dashboard:', err)
      setError('Error al cargar datos del sistema')
    } finally {
      setLoading(false)
    }
  }

  const handleTrainNetworks = async () => {
    if (!window.confirm('¿Entrenar las redes neuronales con los usuarios actuales?\n\nEste proceso puede tardar 2-5 minutos.')) {
      return
    }
    
    try {
      setTraining(true)
      const result = await systemApi.retrainNetworks(true)
      
      if (result.success) {
        alert('Redes entrenadas exitosamente!\n\nEl sistema ahora está en modo normal.')
        await loadData()
      } else {
        alert('Error: ' + result.message)
      }
    } catch (error) {
      console.error('Error entrenando redes:', error)
      alert('Error entrenando redes:\n\n' + (error.response?.data?.detail || error.message))
    } finally {
      setTraining(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Spinner size="lg" />
          <p className="text-gray-600 text-sm">Cargando información del sistema...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Error al cargar datos</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const systemHealth = systemStatus?.networks_trained && systemStatus?.database_ready && 
                       systemStatus?.enrollment_active ? 'healthy' : 'warning'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full shadow-sm">
              <div className={`w-2 h-2 rounded-full ${systemHealth === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
              <span className="text-xs font-medium text-gray-700">
                {systemHealth === 'healthy' ? 'Operativo' : 'En configuración'}
              </span>
            </div>
          </div>
          <p className="text-gray-600 text-sm">
            Panel de control y monitoreo del sistema biométrico
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Alertas */}
      {!systemStatus?.networks_trained && systemStatus?.users_count >= 2 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
              <Brain className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                Redes neuronales pendientes de entrenamiento
              </h4>
              <p className="text-sm text-yellow-700 mb-3">
                Ya hay {systemStatus.users_count} usuarios registrados. Es necesario entrenar las redes para activar la autenticación.
              </p>
              <button
                onClick={handleTrainNetworks}
                disabled={training}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm font-medium"
              >
                <Brain className={`w-4 h-4 ${training ? 'animate-spin' : ''}`} />
                {training ? 'Entrenando...' : 'Entrenar Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRetrain && pendingRetrain.can_retrain && pendingRetrain.pending_count > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">
                Nuevos usuarios disponibles para reentrenamiento
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                Hay {pendingRetrain.pending_count} usuario(s) nuevo(s) que pueden incluirse en las redes neuronales.
              </p>
              <button
                onClick={handleTrainNetworks}
                disabled={training}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${training ? 'animate-spin' : ''}`} />
                {training ? 'Reentrenando...' : 'Reentrenar Redes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Usuarios */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Usuarios</p>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                  {systemStatus?.users_count || 0}
                </p>
                <p className="text-xs text-gray-500">Registrados en el sistema</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Redes Neuronales */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Redes Neuronales</p>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {systemStatus?.networks_trained ? 'Listas' : 'Pendiente'}
                  </p>
                  {systemStatus?.networks_trained ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {systemStatus?.networks_trained ? 'Sistema operativo' : 'Requiere entrenamiento'}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${systemStatus?.networks_trained ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <Brain className={`w-6 h-6 ${systemStatus?.networks_trained ? 'text-green-600' : 'text-yellow-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Autenticación */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Autenticación</p>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {systemStatus?.authentication_active ? 'Activa' : 'Inactiva'}
                  </p>
                  {systemStatus?.authentication_active ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {systemStatus?.authentication_active ? 'Sistema verificando' : 'No disponible'}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${systemStatus?.authentication_active ? 'bg-green-50' : 'bg-gray-50'}`}>
                <Shield className={`w-6 h-6 ${systemStatus?.authentication_active ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Base de Datos */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Templates</p>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                  {dbStats?.total_templates || 0}
                </p>
                <p className="text-xs text-gray-500">Almacenados en BD</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Información Detallada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado del Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Server className="w-5 h-5 text-gray-700" />
              Estado del Sistema
            </CardTitle>
            <CardDescription>Información detallada del sistema biométrico</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-xs sm:text-sm font-medium text-gray-700">Modo Operación</span>
              <Badge variant={systemStatus?.bootstrap_mode ? 'warning' : 'success'}>
                {systemStatus?.bootstrap_mode ? 'Bootstrap' : 'Normal'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-xs sm:text-sm font-medium text-gray-700">Nivel Inicialización</span>
              <Badge variant="info">{systemStatus?.initialization_level || 'N/A'}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-xs sm:text-sm font-medium text-gray-700">Enrollment</span>
              <Badge variant={systemStatus?.enrollment_active ? 'success' : 'danger'}>
                {systemStatus?.enrollment_active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="text-xs sm:text-sm font-medium text-gray-700">Tiempo Activo</span>
              </div>
              <span className="font-mono text-xs sm:text-sm text-gray-900">{systemStatus?.uptime || '0h 0m 0s'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-xs sm:text-sm font-medium text-gray-700">Versión</span>
              <Badge variant="primary">v{systemStatus?.version || '2.0.0'}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas de Bootstrap */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <BarChart3 className="w-5 h-5 text-gray-700" />
              Estadísticas
            </CardTitle>
            <CardDescription>Métricas de configuración inicial</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-xs sm:text-sm font-medium text-gray-700">Templates Bootstrap</span>
              <span className="text-sm sm:text-base font-bold text-gray-900">
                {bootstrapStatus?.templates_count || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-xs sm:text-sm font-medium text-gray-700">Usuarios Mínimos</span>
              <span className="text-sm sm:text-base font-bold text-gray-900">
                {bootstrapStatus?.min_users_required || 2}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-medium text-gray-700">Progreso Bootstrap</span>
                <span className="text-xs font-medium text-gray-600">
                  {systemStatus?.users_count}/{bootstrapStatus?.min_users_required || 2}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (systemStatus?.users_count / (bootstrapStatus?.min_users_required || 2)) * 100)}%`
                  }}
                />
              </div>
            </div>

            {bootstrapStatus?.message && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-blue-800">
                    {bootstrapStatus.message}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Zap className="w-5 h-5 text-gray-700" />
            Acciones Rápidas
          </CardTitle>
          <CardDescription>Operaciones comunes del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Nuevo Usuario */}
            <button
              onClick={() => window.location.href = '/enrollment'}
              className="group flex items-center gap-3 px-4 py-3 bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 text-left"
            >
              <div className="p-2 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex-shrink-0 transition-colors">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm mb-0.5">Nuevo Usuario</p>
                <p className="text-xs text-gray-500">Registrar en el sistema</p>
              </div>
            </button>

            {/* Verificar */}
            <button
              onClick={() => window.location.href = '/verification'}
              disabled={!systemStatus?.authentication_active}
              className={`group flex items-center gap-3 px-4 py-3 rounded-lg shadow-sm transition-all duration-300 text-left ${
                systemStatus?.authentication_active 
                  ? 'bg-white border-2 border-gray-200 hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-md' 
                  : 'bg-gray-100 border-2 border-gray-200 cursor-not-allowed opacity-50'
              }`}
            >
              <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                systemStatus?.authentication_active 
                  ? 'bg-cyan-100 group-hover:bg-cyan-200' 
                  : 'bg-gray-200'
              }`}>
                <Key className={`w-5 h-5 ${systemStatus?.authentication_active ? 'text-cyan-600' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1">
                <p className={`font-semibold text-sm mb-0.5 ${systemStatus?.authentication_active ? 'text-gray-900' : 'text-gray-500'}`}>
                  Verificar
                </p>
                <p className={`text-xs ${systemStatus?.authentication_active ? 'text-gray-500' : 'text-gray-400'}`}>
                  Autenticación 1:1
                </p>
              </div>
            </button>

            {/* Entrenar IA */}
            <button
              onClick={handleTrainNetworks}
              disabled={training || systemStatus?.users_count < 2}
              className={`group flex items-center gap-3 px-4 py-3 rounded-lg shadow-sm transition-all duration-300 text-left ${
                training || systemStatus?.users_count < 2
                  ? 'bg-gray-100 border-2 border-gray-200 cursor-not-allowed opacity-50'
                  : 'bg-white border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 hover:shadow-md'
              }`}
            >
              <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                training || systemStatus?.users_count < 2
                  ? 'bg-gray-200'
                  : 'bg-green-100 group-hover:bg-green-200'
              }`}>
                <Brain className={`w-5 h-5 ${
                  training 
                    ? 'text-gray-400 animate-spin' 
                    : systemStatus?.users_count < 2 
                      ? 'text-gray-400' 
                      : 'text-green-600'
                }`} />
              </div>
              <div className="flex-1">
                <p className={`font-semibold text-sm mb-0.5 ${
                  training || systemStatus?.users_count < 2 ? 'text-gray-500' : 'text-gray-900'
                }`}>
                  {training ? 'Entrenando...' : 'Entrenar IA'}
                </p>
                <p className={`text-xs ${
                  training || systemStatus?.users_count < 2 ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Redes neuronales
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}