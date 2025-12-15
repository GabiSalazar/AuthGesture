import { useState, useEffect } from 'react'
import { systemApi } from '../../lib/api/system'
import { enrollmentApi } from '../../lib/api/enrollment'
import { adminApi } from '../../lib/api/admin'
import { 
  Activity, Users, Brain, Shield, Clock, AlertCircle, Zap, TrendingUp, 
  CheckCircle, XCircle, Database, Server, RefreshCw, UserPlus, Key, BarChart3,
  Sparkles
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
          <div 
            className="w-12 h-12 mx-auto border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#05A8F9', borderTopColor: 'transparent' }}
          />
          <p className="text-gray-600 text-sm font-medium">
            Cargando información del sistema...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div 
          className="rounded-xl border-2 p-4"
          style={{ 
            backgroundColor: '#FEF2F2',
            borderColor: '#FCA5A5'
          }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900 mb-1">Error al cargar datos</h3>
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
      
      {/* ========================================
          HEADER
      ======================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
              Panel de control
            </h1>
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border-2"
              style={{ 
                backgroundColor: systemHealth === 'healthy' ? '#F0FDF4' : '#FFFBEB',
                borderColor: systemHealth === 'healthy' ? '#86EFAC' : '#FCD34D'
              }}
            >
              <div 
                className={`w-2 h-2 rounded-full animate-pulse`}
                style={{ 
                  backgroundColor: systemHealth === 'healthy' ? '#10B981' : '#F59E0B'
                }}
              />
              <span 
                className="text-xs font-bold"
                style={{ 
                  color: systemHealth === 'healthy' ? '#065F46' : '#92400E'
                }}
              >
                {systemHealth === 'healthy' ? 'Operativo' : 'En configuración'}
              </span>
            </div>
          </div>
          <p className="text-gray-600 text-sm">
            Monitoreo en tiempo real del sistema biométrico
          </p>
        </div>
        
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          style={{
            background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
            boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
          }}
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* ========================================
          ALERTAS
      ======================================== */}
      
      {/* Alerta: Redes pendientes de entrenamiento */}
      {!systemStatus?.networks_trained && systemStatus?.users_count >= 2 && (
        <div 
          className="rounded-xl border-2 p-5"
          style={{ 
            backgroundColor: '#FFFBEB',
            borderColor: '#FCD34D'
          }}
        >
          <div className="flex items-start gap-4">
            <div 
              className="p-3 rounded-xl flex-shrink-0"
              style={{ backgroundColor: '#FEF3C7' }}
            >
              <Brain className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-black text-yellow-900 mb-2">
                Redes neuronales pendientes de entrenamiento
              </h4>
              <p className="text-sm text-yellow-700 mb-4">
                Ya hay {systemStatus.users_count} usuarios registrados. Es necesario entrenar las redes para activar la autenticación.
              </p>
              <button
                onClick={handleTrainNetworks}
                disabled={training}
                className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: training 
                    ? 'linear-gradient(to right, #9CA3AF, #6B7280)'
                    : 'linear-gradient(to right, #F59E0B, #D97706)',
                  boxShadow: '0 4px 12px 0 rgba(245, 158, 11, 0.4)'
                }}
              >
                <Brain className={`w-4 h-4 ${training ? 'animate-spin' : ''}`} />
                {training ? 'Entrenando...' : 'Entrenar Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta: Reentrenamiento disponible */}
      {pendingRetrain && pendingRetrain.can_retrain && pendingRetrain.pending_count > 0 && (
        <div 
          className="rounded-xl border-2 p-5"
          style={{ 
            backgroundColor: '#EFF6FF',
            borderColor: '#BFDBFE'
          }}
        >
          <div className="flex items-start gap-4">
            <div 
              className="p-3 rounded-xl flex-shrink-0"
              style={{ backgroundColor: '#DBEAFE' }}
            >
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-black text-blue-900 mb-2">
                Nuevos usuarios disponibles para reentrenamiento
              </h4>
              <p className="text-sm text-blue-700 mb-4">
                Hay {pendingRetrain.pending_count} usuario(s) nuevo(s) que pueden incluirse en las redes neuronales.
              </p>
              <button
                onClick={handleTrainNetworks}
                disabled={training}
                className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: training 
                    ? 'linear-gradient(to right, #9CA3AF, #6B7280)'
                    : 'linear-gradient(to right, #00B8D4, #00ACC1)',
                  boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                }}
              >
                <RefreshCw className={`w-4 h-4 ${training ? 'animate-spin' : ''}`} />
                {training ? 'Reentrenando...' : 'Reentrenar Redes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================
          CARDS DE ESTADÍSTICAS
      ======================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Card: Total Usuarios */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:scale-105"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Total Usuarios
              </p>
              <p 
                className="text-4xl font-black mb-2"
                style={{ color: '#05A8F9' }}
              >
                {systemStatus?.users_count || 0}
              </p>
              <p className="text-xs text-gray-600 font-medium">
                Registrados en el sistema
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#F4FCFF' }}
            >
              <Users className="w-7 h-7" style={{ color: '#05A8F9' }} />
            </div>
          </div>
        </div>

        {/* Card: Redes Neuronales */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:scale-105"
          style={{ 
            borderColor: systemStatus?.networks_trained ? '#86EFAC' : '#FCD34D'
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Redes Neuronales
              </p>
              <div className="flex items-center gap-2 mb-2">
                <p 
                  className="text-3xl font-black"
                  style={{ 
                    color: systemStatus?.networks_trained ? '#10B981' : '#F59E0B'
                  }}
                >
                  {systemStatus?.networks_trained ? 'Listas' : 'Pendiente'}
                </p>
                {systemStatus?.networks_trained ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <Clock className="w-6 h-6 text-yellow-500" />
                )}
              </div>
              <p className="text-xs text-gray-600 font-medium">
                {systemStatus?.networks_trained ? 'Sistema operativo' : 'Requiere entrenamiento'}
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ 
                backgroundColor: systemStatus?.networks_trained ? '#F0FDF4' : '#FFFBEB'
              }}
            >
              <Brain 
                className="w-7 h-7"
                style={{ 
                  color: systemStatus?.networks_trained ? '#10B981' : '#F59E0B'
                }}
              />
            </div>
          </div>
        </div>

        {/* Card: Autenticación */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:scale-105"
          style={{ 
            borderColor: systemStatus?.authentication_active ? '#86EFAC' : '#E5E7EB'
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Autenticación
              </p>
              <div className="flex items-center gap-2 mb-2">
                <p 
                  className="text-3xl font-black"
                  style={{ 
                    color: systemStatus?.authentication_active ? '#10B981' : '#9CA3AF'
                  }}
                >
                  {systemStatus?.authentication_active ? 'Activa' : 'Inactiva'}
                </p>
                {systemStatus?.authentication_active ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <p className="text-xs text-gray-600 font-medium">
                {systemStatus?.authentication_active ? 'Sistema verificando' : 'No disponible'}
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ 
                backgroundColor: systemStatus?.authentication_active ? '#F0FDF4' : '#F3F4F6'
              }}
            >
              <Shield 
                className="w-7 h-7"
                style={{ 
                  color: systemStatus?.authentication_active ? '#10B981' : '#9CA3AF'
                }}
              />
            </div>
          </div>
        </div>

        {/* Card: Templates */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:scale-105"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Templates
              </p>
              <p 
                className="text-4xl font-black mb-2"
                style={{ color: '#05A8F9' }}
              >
                {dbStats?.total_templates || 0}
              </p>
              <p className="text-xs text-gray-600 font-medium">
                Almacenados en BD
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#F4FCFF' }}
            >
              <Database className="w-7 h-7" style={{ color: '#05A8F9' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          ACCIONES RÁPIDAS
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5" style={{ color: '#05A8F9' }} />
            <h3 className="text-lg font-black text-gray-900">
              Acciones rápidas
            </h3>
          </div>

        </div>

        {/* Botones de acción */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Botón: Nuevo Usuario */}
          <button
            onClick={() => window.location.href = '/enrollment'}
            className="group flex items-center gap-3 px-4 py-4 bg-white border-2 rounded-xl shadow-sm transition-all duration-300 text-left hover:shadow-lg hover:scale-105"
            style={{ borderColor: '#E0F2FE' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#05A8F9'
              e.currentTarget.style.backgroundColor = '#F4FCFF'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E0F2FE'
              e.currentTarget.style.backgroundColor = 'white'
            }}
          >
            <div 
              className="p-3 rounded-xl flex-shrink-0 transition-all"
              style={{ backgroundColor: '#F4FCFF' }}
            >
              <UserPlus className="w-6 h-6" style={{ color: '#05A8F9' }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm mb-1">
                Nuevo Usuario
              </p>
              <p className="text-xs text-gray-600">
                Registrar en el sistema
              </p>
            </div>
          </button>

          {/* Botón: Verificar */}
          <button
            onClick={() => window.location.href = '/verification'}
            disabled={!systemStatus?.authentication_active}
            className={`group flex items-center gap-3 px-4 py-4 rounded-xl shadow-sm transition-all duration-300 text-left ${
              systemStatus?.authentication_active 
                ? 'bg-white border-2 hover:shadow-lg hover:scale-105' 
                : 'bg-gray-100 border-2 cursor-not-allowed opacity-50'
            }`}
            style={{ 
              borderColor: systemStatus?.authentication_active ? '#E0F2FE' : '#E5E7EB'
            }}
            onMouseEnter={(e) => {
              if (systemStatus?.authentication_active) {
                e.currentTarget.style.borderColor = '#05A8F9'
                e.currentTarget.style.backgroundColor = '#F4FCFF'
              }
            }}
            onMouseLeave={(e) => {
              if (systemStatus?.authentication_active) {
                e.currentTarget.style.borderColor = '#E0F2FE'
                e.currentTarget.style.backgroundColor = 'white'
              }
            }}
          >
            <div 
              className="p-3 rounded-xl flex-shrink-0"
              style={{ 
                backgroundColor: systemStatus?.authentication_active ? '#F4FCFF' : '#F3F4F6'
              }}
            >
              <Key 
                className="w-6 h-6"
                style={{ 
                  color: systemStatus?.authentication_active ? '#05A8F9' : '#9CA3AF'
                }}
              />
            </div>
            <div className="flex-1">
              <p 
                className={`font-bold text-sm mb-1 ${
                  systemStatus?.authentication_active ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                Verificar
              </p>
              <p 
                className={`text-xs ${
                  systemStatus?.authentication_active ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                Autenticación 1:1
              </p>
            </div>
          </button>

          {/* Botón: Entrenar IA */}
          <button
            onClick={handleTrainNetworks}
            disabled={training || systemStatus?.users_count < 2}
            className={`group flex items-center gap-3 px-4 py-4 rounded-xl shadow-sm transition-all duration-300 text-left ${
              training || systemStatus?.users_count < 2
                ? 'bg-gray-100 border-2 cursor-not-allowed opacity-50'
                : 'bg-white border-2 hover:shadow-lg hover:scale-105'
            }`}
            style={{ 
              borderColor: (training || systemStatus?.users_count < 2) ? '#E5E7EB' : '#E0F2FE'
            }}
            onMouseEnter={(e) => {
              if (!training && systemStatus?.users_count >= 2) {
                e.currentTarget.style.borderColor = '#10B981'
                e.currentTarget.style.backgroundColor = '#F0FDF4'
              }
            }}
            onMouseLeave={(e) => {
              if (!training && systemStatus?.users_count >= 2) {
                e.currentTarget.style.borderColor = '#E0F2FE'
                e.currentTarget.style.backgroundColor = 'white'
              }
            }}
          >
            <div 
              className="p-3 rounded-xl flex-shrink-0"
              style={{ 
                backgroundColor: (training || systemStatus?.users_count < 2) 
                  ? '#F3F4F6' 
                  : '#F0FDF4'
              }}
            >
              <Brain 
                className={`w-6 h-6 ${training ? 'animate-spin' : ''}`}
                style={{ 
                  color: (training || systemStatus?.users_count < 2) 
                    ? '#9CA3AF' 
                    : '#10B981'
                }}
              />
            </div>
            <div className="flex-1">
              <p 
                className={`font-bold text-sm mb-1 ${
                  (training || systemStatus?.users_count < 2) ? 'text-gray-500' : 'text-gray-900'
                }`}
              >
                {training ? 'Entrenando...' : 'Entrenar IA'}
              </p>
              <p 
                className={`text-xs ${
                  (training || systemStatus?.users_count < 2) ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Redes neuronales
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}