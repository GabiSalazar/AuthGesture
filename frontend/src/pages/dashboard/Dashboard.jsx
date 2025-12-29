// frontend/src/pages/dashboard/Dashboard.jsx

import { useState, useEffect } from 'react'
import { systemApi } from '../../lib/api/system'
import { enrollmentApi } from '../../lib/api/enrollment'
import { adminApi } from '../../lib/api/admin'
import { adminApiClient } from '../../lib/api/client'
import { 
  Activity, Users, Brain, Shield, Clock, AlertCircle, Zap, TrendingUp, 
  CheckCircle, XCircle, RefreshCw, UserPlus, Key, BarChart3, Target,
  PieChart as PieChartIcon, TrendingDown
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'

export default function Dashboard() {
  const [systemStatus, setSystemStatus] = useState(null)
  const [bootstrapStatus, setBootstrapStatus] = useState(null)
  const [dbStats, setDbStats] = useState(null)
  const [authAttempts, setAuthAttempts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)
  const [error, setError] = useState(null)
  const [pendingRetrain, setPendingRetrain] = useState(null)
  
  // Estados para métricas REALES del backend
  const [feedbackMetrics, setFeedbackMetrics] = useState(null)
  const [anatomicalMetrics, setAnatomicalMetrics] = useState(null)
  const [dynamicMetrics, setDynamicMetrics] = useState(null)
  const [fusionMetrics, setFusionMetrics] = useState(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Actualizar cada 30 segundos
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [system, bootstrap, pending, stats, attempts, usersData] = await Promise.all([
        systemApi.getStatus(),
        enrollmentApi.getBootstrapStatus(),
        systemApi.getPendingRetrainUsers().catch(() => ({ 
          pending_count: 0, 
          pending_users: [], 
          can_retrain: false,
          message: 'No disponible'
        })),
        adminApi.getDatabaseStats().catch(() => null),
        adminApi.getAllAuthAttempts(1000).catch(() => ({ attempts: [] })),
        adminApi.getUsers().catch(() => ({ users: [] }))
      ])
      
      setSystemStatus(system)
      setBootstrapStatus(bootstrap)
      setPendingRetrain(pending)
      setDbStats(stats)
      setAuthAttempts(attempts.attempts || [])
      setUsers(usersData.users || [])

      // Cargar métricas REALES si el sistema está entrenado
      if (system?.networks_trained) {
        await loadRealMetrics()
      }
      
      setError(null)
    } catch (err) {
      console.error('Error cargando datos del dashboard:', err)
      setError('Error al cargar datos del sistema')
    } finally {
      setLoading(false)
    }
  }

  const loadRealMetrics = async () => {
    try {
      // Cargar métricas de feedback (TP, FP, TN, FN reales)
      const feedback = await adminApiClient.get('/feedback/metrics/verification')
        .then(res => res.data?.metrics || null)
        .catch(() => null)
      
      // Cargar métricas de redes siamesas (EXTRAER solo biometric_metrics)
      const anatomical = await adminApiClient.get('/siamese-anatomical/metrics')
        .then(res => {
          console.log('=== ANATOMICAL RAW RESPONSE ===', res.data)
          return res.data?.biometric_metrics || null
        })
        .catch(err => {
          console.error('Error cargando anatomical:', err.response?.data)
          return null
        })

      const dynamic = await adminApiClient.get('/siamese-dynamic/metrics')
        .then(res => {
          console.log('=== DYNAMIC RAW RESPONSE ===', res.data)
          return res.data?.biometric_metrics || null
        })
        .catch(err => {
          console.error('Error cargando dynamic:', err.response?.data)
          return null
        })

      // IGNORAR FUSION - no lo necesitamos
      setFeedbackMetrics(feedback)
      setAnatomicalMetrics(anatomical)
      setDynamicMetrics(dynamic)
      setFusionMetrics(null)  // ← Forzar a null

      console.log('=== MÉTRICAS FINALES ===')
      console.log('Feedback:', feedback)
      console.log('Anatomical:', anatomical)
      console.log('Dynamic:', dynamic)
    } catch (error) {
      console.error('Error cargando métricas reales:', error)
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
        alert('¡Redes entrenadas exitosamente!\n\nEl sistema ahora está en modo normal.')
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

  // Determinar qué métricas usar (prioridad: fusión > anatómicas > dinámicas)
  const primaryMetrics = anatomicalMetrics || dynamicMetrics

  return (
    <div className="space-y-6 pb-8">
      
      {/* ========================================
          HEADER
      ======================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
              Dashboard
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
            Métricas biométricas en tiempo real del sistema
          </p>
        </div>
        
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          style={{
            background: 'linear-gradient(to right, #05A8F9, #0291B9)'
          }}
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
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
                className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: training 
                    ? 'linear-gradient(to right, #9CA3AF, #6B7280)'
                    : 'linear-gradient(to right, #F59E0B, #D97706)'
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
                className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: training 
                    ? 'linear-gradient(to right, #9CA3AF, #6B7280)'
                    : 'linear-gradient(to right, #05A8F9, #0291B9)'
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
          CARDS DE ESTADÍSTICAS PRINCIPALES
      ======================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        
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
      </div>

      {/* ========================================
          SECCIÓN: MÉTRICAS BIOMÉTRICAS
      ======================================== */}
      {systemStatus?.networks_trained && (feedbackMetrics || primaryMetrics) && (
        <>
          <div className="pt-4">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2 mb-6">
              <Shield className="w-6 h-6" style={{ color: '#05A8F9' }} />
              Métricas biométricas
            </h2>
          </div>

          <BiometricMetricsSection 
            feedbackMetrics={feedbackMetrics}
            fusionMetrics={fusionMetrics}
            anatomicalMetrics={anatomicalMetrics}
            dynamicMetrics={dynamicMetrics}
          />
        </>
      )}

      {/* ========================================
          SECCIÓN: AUTENTICACIONES
      ======================================== */}
      {authAttempts.length > 0 && (
        <>
          <div className="pt-4">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2 mb-6">
              <Activity className="w-6 h-6" style={{ color: '#05A8F9' }} />
              Autenticaciones
            </h2>
          </div>

          <AuthenticationMetricsSection 
            authAttempts={authAttempts} 
            feedbackMetrics={feedbackMetrics}
          />
        </>
      )}

      {/* ========================================
          SECCIÓN: USUARIOS
      ======================================== */}
      {users.length > 0 && (
        <>
          <div className="pt-4">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2 mb-6">
              <Users className="w-6 h-6" style={{ color: '#05A8F9' }} />
              Distribución demográfica
            </h2>
          </div>

          <UserDemographicsSection users={users} />
        </>
      )}

      {/* ========================================
          ACCIONES RÁPIDAS
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5" style={{ color: '#05A8F9' }} />
            <h3 className="text-lg font-black text-gray-900">
              Acciones rápidas
            </h3>
          </div>
        </div>

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

/* ========================================
   SECCIÓN 1: MÉTRICAS BIOMÉTRICAS
======================================== */
function BiometricMetricsSection({ feedbackMetrics, fusionMetrics, anatomicalMetrics, dynamicMetrics }) {
  // Usar métricas anatómicas como primarias, dynamic como fallback
  const primaryMetrics = anatomicalMetrics || dynamicMetrics
  
  // Determinar qué red se está mostrando
  const activeNetwork = anatomicalMetrics ? 'Anatómica' : dynamicMetrics ? 'Dinámica' : null

  // Si no hay métricas, no renderizar nada
  if (!feedbackMetrics && !primaryMetrics) {
    return (
      <div className="bg-white rounded-2xl border-2 shadow-lg p-6" style={{ borderColor: '#E0F2FE' }}>
        <p className="text-gray-600 text-center">
          No hay métricas biométricas disponibles. Entrena las redes para ver los datos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Panel de FP, VP, FN, VN*/}
      {feedbackMetrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Verdaderos Positivos (VP)"
            value={feedbackMetrics.true_positives || 0}
            color="#10B981"
            icon={<CheckCircle className="w-5 h-5" />}
            description="Sistema aceptó usuario legítimo"
          />
          <MetricCard
            label="Falsos Positivos (FP)"
            value={feedbackMetrics.false_positives || 0}
            color="#EF4444"
            icon={<AlertCircle className="w-5 h-5" />}
            description="Sistema aceptó impostor"
          />
          <MetricCard
            label="Verdaderos Negativos (VN)"
            value={feedbackMetrics.true_negatives || 0}
            color="#10B981"
            icon={<Shield className="w-5 h-5" />}
            description="Sistema rechazó impostor"
          />
          <MetricCard
            label="Falsos Negativos (FN)"
            value={feedbackMetrics.false_negatives || 0}
            color="#F59E0B"
            icon={<XCircle className="w-5 h-5" />}
            description="Sistema rechazó usuario legítimo"
          />
        </div>
      )}

      {/* Confusion Matrix + FAR/FRR/EER */}
      <div className="grid lg:grid-cols-2 gap-6">
        {feedbackMetrics && (
          <ConfusionMatrixChart 
            TP={feedbackMetrics.true_positives || 0}
            FP={feedbackMetrics.false_positives || 0}
            TN={feedbackMetrics.true_negatives || 0}
            FN={feedbackMetrics.false_negatives || 0}
          />
        )}
        
        {primaryMetrics && (
          <BiometricRatesChart 
            FAR={(primaryMetrics.far || 0) * 100}
            FRR={(primaryMetrics.frr || 0) * 100}
            EER={(primaryMetrics.eer || 0) * 100}
          />
        )}
      </div>

      {/* Curva ROC + Métricas de Performance */}
      {(primaryMetrics || feedbackMetrics) && (
        <div className="grid lg:grid-cols-2 gap-6">
          <ROCCurveChart metrics={primaryMetrics} />
          <PerformanceMetricsChart 
            accuracy={(feedbackMetrics?.accuracy || primaryMetrics?.accuracy || 0) * 100}
            precision={(feedbackMetrics?.precision || primaryMetrics?.precision || 0) * 100}
            recall={(feedbackMetrics?.recall || primaryMetrics?.recall || 0) * 100}
            f1={(feedbackMetrics?.f1_score || primaryMetrics?.f1_score || 0) * 100}
            auc={(primaryMetrics?.auc_score || 0) * 100}
          />
        </div>
      )}

    </div>
  )
}

/* ========================================
   SECCIÓN 2: AUTENTICACIONES
======================================== */
function AuthenticationMetricsSection({ authAttempts, feedbackMetrics }) {
  const successRate = calculateSuccessRate(authAttempts, feedbackMetrics)
  const durationStats = calculateDurationStats(authAttempts)
  const confidenceStats = calculateConfidenceStats(authAttempts)

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <SuccessRateChart data={successRate} />
      <DurationChart data={durationStats} />
      <ConfidenceChart data={confidenceStats} />
    </div>
  )
}

/* ========================================
   SECCIÓN 3: USUARIOS
======================================== */
function UserDemographicsSection({ users }) {
  const genderDistribution = calculateGenderDistribution(users)
  const ageDistribution = calculateAgeDistribution(users)

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <GenderDistributionChart data={genderDistribution} />
      <AgeDistributionChart data={ageDistribution} />
    </div>
  )
}

/* ========================================
   COMPONENTES DE GRÁFICOS
======================================== */

function MetricCard({ label, value, color, icon, description }) {
  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-6 hover:scale-105 transition-transform"
      style={{ borderColor: `${color}20` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div 
          className="p-3 rounded-xl"
          style={{ backgroundColor: `${color}10`, color }}
        >
          {icon}
        </div>
        <p className="text-4xl font-black" style={{ color }}>
          {value}
        </p>
      </div>
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-xs text-gray-500">
        {description}
      </p>
    </div>
  )
}

function ConfusionMatrixChart({ TP, FP, TN, FN }) {
  const max = Math.max(TP, FP, TN, FN) || 1

  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-4 sm:p-6"
      style={{ borderColor: '#E0F2FE' }}
    >
      <h3 className="text-base sm:text-lg font-black text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#05A8F9' }} />
        Matriz de confusión
      </h3>
      
      <div className="flex flex-col items-center">
        
        {/* Headers */}
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <div className="w-16 sm:w-24 lg:w-32"></div>
          <div className="text-center font-bold text-xs sm:text-sm text-gray-600 w-16 sm:w-24 lg:w-32">
            Pred: Positivo
          </div>
          <div className="text-center font-bold text-xs sm:text-sm text-gray-600 w-16 sm:w-24 lg:w-32">
            Pred: Negativo
          </div>
        </div>

        {/* Fila 1: Real Positivo */}
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <div className="text-right font-bold text-xs sm:text-sm text-gray-600 w-16 sm:w-24 lg:w-32">
            Real: Positivo
          </div>
          <div 
            className="w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-lg sm:rounded-xl flex flex-col items-center justify-center border-2"
            style={{ 
              backgroundColor: `rgba(16, 185, 129, ${(TP / max) * 0.8})`,
              borderColor: '#10B981'
            }}
          >
            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-white">{TP}</p>
            <p className="text-xs font-bold text-white">VP</p>
          </div>
          <div 
            className="w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-lg sm:rounded-xl flex flex-col items-center justify-center border-2"
            style={{ 
              backgroundColor: `rgba(245, 158, 11, ${(FN / max) * 0.8})`,
              borderColor: '#F59E0B'
            }}
          >
            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-white">{FN}</p>
            <p className="text-xs font-bold text-white">FN</p>
          </div>
        </div>

        {/* Fila 2: Real Negativo */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-right font-bold text-xs sm:text-sm text-gray-600 w-16 sm:w-24 lg:w-32">
            Real: Negativo
          </div>
          <div 
            className="w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-lg sm:rounded-xl flex flex-col items-center justify-center border-2"
            style={{ 
              backgroundColor: `rgba(239, 68, 68, ${(FP / max) * 0.8})`,
              borderColor: '#EF4444'
            }}
          >
            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-white">{FP}</p>
            <p className="text-xs font-bold text-white">FP</p>
          </div>
          <div 
            className="w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-lg sm:rounded-xl flex flex-col items-center justify-center border-2"
            style={{ 
              backgroundColor: `rgba(16, 185, 129, ${(TN / max) * 0.8})`,
              borderColor: '#10B981'
            }}
          >
            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-white">{TN}</p>
            <p className="text-xs font-bold text-white">VN</p>
          </div>
        </div>

      </div>
    </div>
  )
}

function BiometricRatesChart({ FAR, FRR, EER }) {
  const getGaugeColor = (value, metric) => {
    if (metric === 'FAR') return value < 1 ? '#10B981' : value < 3 ? '#F59E0B' : '#EF4444'
    if (metric === 'FRR') return value < 5 ? '#10B981' : value < 10 ? '#F59E0B' : '#EF4444'
    if (metric === 'EER') return value < 3 ? '#10B981' : value < 5 ? '#F59E0B' : '#EF4444'
    return '#6B7280'
  }

  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-6"
      style={{ borderColor: '#E0F2FE' }}
    >
      <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
        <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
        Tasas de error biométrico
      </h3>

      <div className="space-y-6">
        
        {/* FAR */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-700">
              FAR (False Acceptance Rate)
            </p>
            <p 
              className="text-2xl font-black"
              style={{ color: getGaugeColor(FAR, 'FAR') }}
            >
              {FAR.toFixed(2)}%
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-3 rounded-full transition-all"
              style={{ 
                width: `${Math.min(FAR * 10, 100)}%`,
                backgroundColor: getGaugeColor(FAR, 'FAR')
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Impostores aceptados incorrectamente
          </p>
        </div>

        {/* FRR */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-700">
              FRR (False Rejection Rate)
            </p>
            <p 
              className="text-2xl font-black"
              style={{ color: getGaugeColor(FRR, 'FRR') }}
            >
              {FRR.toFixed(2)}%
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-3 rounded-full transition-all"
              style={{ 
                width: `${Math.min(FRR * 5, 100)}%`,
                backgroundColor: getGaugeColor(FRR, 'FRR')
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Usuarios legítimos rechazados
          </p>
        </div>

        {/* EER */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-700">
              EER (Equal Error Rate)
            </p>
            <p 
              className="text-2xl font-black"
              style={{ color: getGaugeColor(EER, 'EER') }}
            >
              {EER.toFixed(2)}%
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-3 rounded-full transition-all"
              style={{ 
                width: `${Math.min(EER * 20, 100)}%`,
                backgroundColor: getGaugeColor(EER, 'EER')
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Punto de equilibrio FAR = FRR
          </p>
        </div>

      </div>
    </div>
  )
}

function ROCCurveChart({ metrics }) {
  // Prioridad: usar curva ROC real si está disponible
  let rocData
  let auc = 0
  
  if (metrics?.roc_curve?.fpr && metrics?.roc_curve?.tpr && metrics.roc_curve.fpr.length > 0) {
    // Usar puntos REALES del backend
    rocData = metrics.roc_curve.fpr.map((fpr, idx) => ({
      fpr: parseFloat(fpr.toFixed(3)),
      tpr: parseFloat(metrics.roc_curve.tpr[idx].toFixed(3)),
      random: parseFloat(fpr.toFixed(3))
    }))
    auc = metrics.auc_score || 0
  } else if (metrics?.auc_score) {
    // Fallback: Generar aproximación matemática
    rocData = []
    auc = metrics.auc_score || 0
    for (let i = 0; i <= 100; i++) {
      const fpr = i / 100
      const tpr = Math.pow(fpr, 1 / (2 * (auc / 100 || 0.5)))
      rocData.push({
        fpr: parseFloat(fpr.toFixed(3)),
        tpr: parseFloat(tpr.toFixed(3)),
        random: parseFloat(fpr.toFixed(3))
      })
    }
  } else {
    // No hay datos
    return null
  }

  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-6"
      style={{ borderColor: '#E0F2FE' }}
    >
      <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" style={{ color: '#05A8F9' }} />
        Curva ROC
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rocData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="fpr" 
            label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -5 }}
            stroke="#6B7280"
            tick={{ fontSize: 11 }}
          />
          <YAxis 
            label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft' }}
            stroke="#6B7280"
            tick={{ fontSize: 11 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '2px solid #05A8F9',
              borderRadius: '12px',
              fontWeight: 'bold'
            }}
          />
          <Legend />
          
          <Line 
            type="monotone" 
            dataKey="random" 
            stroke="#D1D5DB" 
            strokeDasharray="5 5"
            name="Random (AUC=0.5)"
            dot={false}
          />
          
          <Line 
            type="monotone" 
            dataKey="tpr" 
            stroke="#05A8F9" 
            strokeWidth={3}
            name={`ROC (AUC=${(auc / 100).toFixed(3)})`}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
        <p className="text-sm font-bold text-gray-700">
          AUC Score: <span className="text-2xl" style={{ color: '#05A8F9' }}>
            {(auc / 100).toFixed(3)}
          </span>
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Área bajo la curva (1.0 = perfecto, 0.5 = aleatorio)
        </p>
      </div>
    </div>
  )
}

function PerformanceMetricsChart({ accuracy, precision, recall, f1, auc }) {
  const radarData = [
    { metric: 'Accuracy', value: accuracy, fullMark: 100 },
    { metric: 'Precision', value: precision, fullMark: 100 },
    { metric: 'Recall', value: recall, fullMark: 100 },
    { metric: 'F1-Score', value: f1, fullMark: 100 },
    { metric: 'AUC', value: auc, fullMark: 100 }
  ]

  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-6"
      style={{ borderColor: '#E0F2FE' }}
    >
      <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5" style={{ color: '#05A8F9' }} />
        Métricas de rendimiento
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fill: '#374151', fontWeight: 'bold', fontSize: 12 }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} />
          <Radar 
            name="Rendimiento" 
            dataKey="value" 
            stroke="#05A8F9" 
            fill="#05A8F9" 
            fillOpacity={0.6}
            strokeWidth={2}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '2px solid #05A8F9',
              borderRadius: '12px',
              fontWeight: 'bold'
            }}
            formatter={(value) => `${value.toFixed(1)}%`}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-5 gap-2 mt-4">
        {radarData.map((item, idx) => (
          <div 
            key={idx}
            className="text-center p-2 rounded-lg"
            style={{ backgroundColor: '#F0F9FF' }}
          >
            <p className="text-xs font-bold text-gray-600">{item.metric}</p>
            <p className="text-lg font-black" style={{ color: '#05A8F9' }}>
              {item.value.toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SuccessRateChart({ data }) {
  const pieData = [
    { name: 'Exitosas', value: data.successful, color: '#10B981' },
    { name: 'Fallidas', value: data.failed, color: '#EF4444' }
  ]

  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-6"
      style={{ borderColor: '#E0F2FE' }}
    >
      <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
        <PieChartIcon className="w-5 h-5" style={{ color: '#05A8F9' }} />
        Tasa de éxito
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <RechartsPie>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={5}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '2px solid #05A8F9',
              borderRadius: '12px',
              fontWeight: 'bold'
            }}
          />
        </RechartsPie>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div 
          className="p-4 rounded-xl text-center"
          style={{ backgroundColor: '#F0FDF4' }}
        >
          <p className="text-3xl font-black text-green-600">{data.successful}</p>
          <p className="text-xs font-bold text-gray-600 mt-1">Exitosas</p>
        </div>
        <div 
          className="p-4 rounded-xl text-center"
          style={{ backgroundColor: '#FEF2F2' }}
        >
          <p className="text-3xl font-black text-red-600">{data.failed}</p>
          <p className="text-xs font-bold text-gray-600 mt-1">Fallidas</p>
        </div>
      </div>

      <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
        <p className="text-sm font-bold text-gray-700 text-center">
          Tasa de éxito: <span className="text-2xl" style={{ color: '#05A8F9' }}>
            {data.successRate.toFixed(1)}%
          </span>
        </p>
      </div>
    </div>
  )
}

function DurationChart({ data }) {
  // Validar si hay datos
  if (!data || !data.hasData || data.distribution.length === 0) {
    return (
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" style={{ color: '#05A8F9' }} />
          Duración de autenticaciones
        </h3>
        
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 text-sm">
            No hay datos de duración disponibles
          </p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-6"
      style={{ borderColor: '#E0F2FE' }}
    >
      <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5" style={{ color: '#05A8F9' }} />
        Duración de autenticaciones
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data.distribution}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="range" 
            tick={{ fill: '#6B7280', fontSize: 11 }}
          />
          <YAxis tick={{ fill: '#6B7280' }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '2px solid #05A8F9',
              borderRadius: '12px',
              fontWeight: 'bold'
            }}
          />
          <Bar dataKey="count" fill="#05A8F9" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div 
          className="p-3 rounded-xl text-center"
          style={{ backgroundColor: '#F0F9FF' }}
        >
          <p className="text-xs font-bold text-gray-600">Promedio</p>
          <p className="text-xl font-black" style={{ color: '#05A8F9' }}>
            {data.average.toFixed(2)}s
          </p>
        </div>
        <div 
          className="p-3 rounded-xl text-center"
          style={{ backgroundColor: '#F0FDF4' }}
        >
          <p className="text-xs font-bold text-gray-600">Mínimo</p>
          <p className="text-xl font-black text-green-600">
            {data.min.toFixed(2)}s
          </p>
        </div>
        <div 
          className="p-3 rounded-xl text-center"
          style={{ backgroundColor: '#FEF2F2' }}
        >
          <p className="text-xs font-bold text-gray-600">Máximo</p>
          <p className="text-xl font-black text-red-600">
            {data.max.toFixed(2)}s
          </p>
        </div>
      </div>
    </div>
  )
}

function ConfidenceChart({ data }) {
  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-6"
      style={{ borderColor: '#E0F2FE' }}
    >
      <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
        <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
        Confianza de autenticaciones
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data.distribution}>
          <defs>
            <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#05A8F9" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#05A8F9" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="range" 
            tick={{ fill: '#6B7280', fontSize: 11 }}
          />
          <YAxis tick={{ fill: '#6B7280' }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '2px solid #05A8F9',
              borderRadius: '12px',
              fontWeight: 'bold'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="#05A8F9" 
            strokeWidth={2}
            fill="url(#confidenceGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div 
          className="p-3 rounded-xl text-center"
          style={{ backgroundColor: '#F0F9FF' }}
        >
          <p className="text-xs font-bold text-gray-600">Confianza promedio</p>
          <p className="text-2xl font-black" style={{ color: '#05A8F9' }}>
            {(data.average * 100).toFixed(1)}%
          </p>
        </div>
        <div 
          className="p-3 rounded-xl text-center"
          style={{ backgroundColor: '#F0FDF4' }}
        >
          <p className="text-xs font-bold text-gray-600">Alta confianza</p>
          <p className="text-2xl font-black text-green-600">
            {data.highConfidence}
          </p>
          <p className="text-xs text-gray-500">&gt;80%</p>
        </div>
      </div>
    </div>
  )
}

function GenderDistributionChart({ data }) {
  const pieData = [
    { name: 'Masculino', value: data.male, color: '#3B82F6' },
    { name: 'Femenino', value: data.female, color: '#EC4899' },
    { name: 'Otro', value: data.other, color: '#8B5CF6' }
  ].filter(item => item.value > 0)

  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-6"
      style={{ borderColor: '#E0F2FE' }}
    >
      <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
        <Users className="w-5 h-5" style={{ color: '#05A8F9' }} />
        Distribución por género
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <RechartsPie>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '2px solid #05A8F9',
              borderRadius: '12px',
              fontWeight: 'bold'
            }}
          />
          <Legend />
        </RechartsPie>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-3 mt-4">
        {pieData.map((item, idx) => (
          <div 
            key={idx}
            className="p-3 rounded-xl text-center"
            style={{ backgroundColor: `${item.color}10` }}
          >
            <p className="text-2xl font-black" style={{ color: item.color }}>
              {item.value}
            </p>
            <p className="text-xs font-bold text-gray-600 mt-1">{item.name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgeDistributionChart({ data }) {
  const barData = [
    { range: '18-25', count: data.range_18_25, color: '#10B981' },
    { range: '26-35', count: data.range_26_35, color: '#3B82F6' },
    { range: '36-50', count: data.range_36_50, color: '#F59E0B' },
    { range: '51+', count: data.range_51_plus, color: '#EF4444' }
  ]

  return (
    <div 
      className="bg-white rounded-2xl border-2 shadow-lg p-6"
      style={{ borderColor: '#E0F2FE' }}
    >
      <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5" style={{ color: '#05A8F9' }} />
        Distribución por edad
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={barData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="range" 
            tick={{ fill: '#6B7280', fontWeight: 'bold' }}
          />
          <YAxis tick={{ fill: '#6B7280' }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '2px solid #05A8F9',
              borderRadius: '12px',
              fontWeight: 'bold'
            }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {barData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {barData.map((item, idx) => (
          <div 
            key={idx}
            className="p-3 rounded-xl text-center"
            style={{ backgroundColor: `${item.color}10` }}
          >
            <p className="text-2xl font-black" style={{ color: item.color }}>
              {item.count}
            </p>
            <p className="text-xs font-bold text-gray-600 mt-1">{item.range}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
        <p className="text-sm font-bold text-gray-700 text-center">
          Edad Promedio: <span className="text-2xl" style={{ color: '#05A8F9' }}>
            {data.average.toFixed(0)} años
          </span>
        </p>
      </div>
    </div>
  )
}

/* ========================================
   FUNCIONES DE CÁLCULO PARA DATOS DE AUTENTICACIÓN
======================================== */

function calculateSuccessRate(authAttempts, feedbackMetrics = null) {
  // PRIORIDAD 1: Usar feedbackMetrics si están disponibles (más precisas)
  if (feedbackMetrics && feedbackMetrics.total_samples > 0) {
    const successful = (feedbackMetrics.true_positives || 0) + (feedbackMetrics.true_negatives || 0)
    const failed = (feedbackMetrics.false_positives || 0) + (feedbackMetrics.false_negatives || 0)
    const total = feedbackMetrics.total_samples
    const successRate = total > 0 ? (successful / total) * 100 : 0
    
    return { successful, failed, successRate, source: 'feedback_metrics' }
  }
  
  // FALLBACK: Usar authAttempts si no hay feedbackMetrics
  if (!authAttempts || authAttempts.length === 0) {
    return { successful: 0, failed: 0, successRate: 0, source: 'no_data' }
  }
  
  const successful = authAttempts.filter(a => 
    a.result === 'authenticated' || a.result === 'success'
  ).length
  const failed = authAttempts.length - successful
  const successRate = authAttempts.length > 0 ? (successful / authAttempts.length) * 100 : 0

  return { successful, failed, successRate, source: 'auth_attempts' }
}

function calculateDurationStats(authAttempts) {
  console.log('=== DEBUGGING DURATION STATS ===')
  console.log('Total auth attempts:', authAttempts?.length || 0)
  
  // Validar entrada
  if (!authAttempts || authAttempts.length === 0) {
    console.log('No hay authAttempts')
    return {
      average: 0,
      min: 0,
      max: 0,
      distribution: [],
      hasData: false
    }
  }

  // VER TODOS LOS INTENTOS
  console.log('=== ANALIZANDO TODOS LOS INTENTOS ===')
  authAttempts.forEach((attempt, i) => {
    console.log(`[${i}] Intento:`, {
      result: attempt.result,
      has_metadata: !!attempt.metadata,
      'metadata.duration': attempt.metadata?.duration,
      'metadata.duration_ms': attempt.metadata?.duration_ms,
      'metadata.processing_time': attempt.metadata?.processing_time,
      'duration': attempt.duration,
      user_id: attempt.user_id,
      timestamp: attempt.timestamp
    })
  })

  // Filtrar y validar duraciones
  console.log('=== FILTRANDO DURACIONES ===')
  const durations = authAttempts
    .filter((a, idx) => {
      const duration = a.metadata?.duration
      const isValid = duration !== null && 
             duration !== undefined && 
             typeof duration === 'number' && 
             !isNaN(duration) && 
             duration >= 0
      
      if (!isValid) {
        console.log(`[${idx}] Duracion invalida o inexistente`)
      } else {
        console.log(`[${idx}] Duracion valida: ${duration}s`)
      }
      
      return isValid
    })
    .map(a => a.metadata.duration)
  
  console.log('=== RESULTADO FINAL ===')
  console.log('Duraciones validas:', durations)
  console.log('Total validas:', durations.length)
  
  if (durations.length > 0) {
    const min = Math.min(...durations)
    const max = Math.max(...durations)
    const avg = durations.reduce((a,b) => a+b, 0) / durations.length
    
    console.log('Min:', min, 's')
    console.log('Max:', max, 's <- ESTE ES EL PROBLEMA')
    console.log('Average:', avg, 's')
    
    // Encontrar el intento con el maximo
    const maxIndex = authAttempts.findIndex(a => a.metadata?.duration === max)
    console.log('=== INTENTO CON DURACION MAXIMA ===')
    console.log('Indice:', maxIndex)
    console.log('Objeto completo:', authAttempts[maxIndex])
  }
  
  // Si no hay duraciones validas
  if (durations.length === 0) {
    return {
      average: 0,
      min: 0,
      max: 0,
      distribution: [],
      hasData: false
    }
  }

  // Calcular estadisticas
  const average = durations.reduce((a, b) => a + b, 0) / durations.length
  const min = Math.min(...durations)
  const max = Math.max(...durations)
  
  // Crear distribucion de rangos
  // const ranges = [
  //   { range: '<1s', count: durations.filter(d => d < 1).length },
  //   { range: '1-2s', count: durations.filter(d => d >= 1 && d < 2).length },
  //   { range: '2-3s', count: durations.filter(d => d >= 2 && d < 3).length },
  //   { range: '3-5s', count: durations.filter(d => d >= 3 && d < 5).length },
  //   { range: '>5s', count: durations.filter(d => d >= 5).length }
  // ]

  // Crear distribucion de rangos (de 10 en 10 segundos)
  const ranges = [
    { range: '0-10s', count: durations.filter(d => d >= 0 && d < 10).length },
    { range: '10-20s', count: durations.filter(d => d >= 10 && d < 20).length },
    { range: '20-30s', count: durations.filter(d => d >= 20 && d < 30).length },
    { range: '30-40s', count: durations.filter(d => d >= 30 && d < 40).length },
    { range: '>40s', count: durations.filter(d => d >= 40).length }
  ]

  return { 
    average, 
    min, 
    max, 
    distribution: ranges,
    hasData: true,
    totalSamples: durations.length
  }
}

// function calculateConfidenceStats(authAttempts) {
//   const confidences = authAttempts.map(a => a.confidence || a.fused_score || 0)
  
//   if (confidences.length === 0) {
//     return {
//       average: 0,
//       highConfidence: 0,
//       distribution: []
//     }
//   }

//   const average = confidences.reduce((a, b) => a + b, 0) / confidences.length
//   const highConfidence = confidences.filter(c => c >= 0.9).length
  
//   const ranges = [
//     { range: '0-20%', count: confidences.filter(c => c < 0.2).length },
//     { range: '20-40%', count: confidences.filter(c => c >= 0.2 && c < 0.4).length },
//     { range: '40-60%', count: confidences.filter(c => c >= 0.4 && c < 0.6).length },
//     { range: '60-80%', count: confidences.filter(c => c >= 0.6 && c < 0.8).length },
//     { range: '80-100%', count: confidences.filter(c => c >= 0.8).length }
//   ]

//   return { average, highConfidence, distribution: ranges }
// }

function calculateConfidenceStats(authAttempts) {
  console.log('=== DEBUGGING CONFIDENCE STATS ===')
  console.log('Total auth attempts:', authAttempts?.length || 0)
  
  // Validar entrada
  if (!authAttempts || authAttempts.length === 0) {
    console.log('No hay authAttempts')
    return {
      average: 0,
      highConfidence: 0,
      distribution: [],
      hasData: false
    }
  }

  // VER TODOS LOS INTENTOS
  console.log('=== ANALIZANDO TODOS LOS INTENTOS (CONFIANZA) ===')
  authAttempts.forEach((attempt, i) => {
    console.log(`[${i}] Intento:`, {
      result: attempt.result,
      confidence: attempt.confidence,
      fused_score: attempt.fused_score,
      confidence_type: typeof attempt.confidence,
      fused_score_type: typeof attempt.fused_score,
      user_id: attempt.user_id,
      timestamp: attempt.timestamp,
      all_possible_confidence_fields: {
        'confidence': attempt.confidence,
        'fused_score': attempt.fused_score,
        'score': attempt.score,
        'similarity': attempt.similarity,
        'metadata.confidence': attempt.metadata?.confidence,
        'metadata.fused_score': attempt.metadata?.fused_score
      }
    })
  })

  // Filtrar y validar confidences
  console.log('=== FILTRANDO CONFIDENCES ===')
  const confidences = authAttempts
    .map((a, idx) => {
      const conf = a.confidence || a.fused_score
      // Validar que sea numero valido entre 0 y 1
      if (conf !== null && conf !== undefined && typeof conf === 'number' && !isNaN(conf)) {
        const clamped = Math.max(0, Math.min(1, conf))
        console.log(`[${idx}] Confianza valida: ${conf} -> clamped: ${clamped}`)
        return clamped
      }
      console.log(`[${idx}] Confianza invalida:`, conf, typeof conf)
      return null
    })
    .filter(c => c !== null)
  
  console.log('=== RESULTADO FINAL ===')
  console.log('Confidences validas:', confidences)
  console.log('Total validas:', confidences.length)
  
  if (confidences.length > 0) {
    const min = Math.min(...confidences)
    const max = Math.max(...confidences)
    const avg = confidences.reduce((a,b) => a+b, 0) / confidences.length
    
    console.log('Min confianza:', min)
    console.log('Max confianza:', max)
    console.log('Average confianza:', avg)
    
    // Encontrar el intento con la maxima confianza
    const maxConf = Math.max(...confidences)
    const maxIndex = authAttempts.findIndex(a => {
      const conf = a.confidence || a.fused_score
      return conf === maxConf
    })
    console.log('=== INTENTO CON CONFIANZA MAXIMA ===')
    console.log('Indice:', maxIndex)
    console.log('Confianza:', maxConf)
    console.log('Objeto completo:', authAttempts[maxIndex])
    
    // Encontrar el intento con la minima confianza
    const minConf = Math.min(...confidences)
    const minIndex = authAttempts.findIndex(a => {
      const conf = a.confidence || a.fused_score
      return conf === minConf
    })
    console.log('=== INTENTO CON CONFIANZA MINIMA ===')
    console.log('Indice:', minIndex)
    console.log('Confianza:', minConf)
    console.log('Objeto completo:', authAttempts[minIndex])
  }
  
  if (confidences.length === 0) {
    return {
      average: 0,
      highConfidence: 0,
      distribution: [],
      hasData: false
    }
  }

  const average = confidences.reduce((a, b) => a + b, 0) / confidences.length
  const highConfidence = confidences.filter(c => c >= 0.8).length

  const ranges = [
    { range: '0-20%', count: confidences.filter(c => c < 0.2).length },
    { range: '20-40%', count: confidences.filter(c => c >= 0.2 && c < 0.4).length },
    { range: '40-60%', count: confidences.filter(c => c >= 0.4 && c < 0.6).length },
    { range: '60-80%', count: confidences.filter(c => c >= 0.6 && c < 0.8).length },
    { range: '80-100%', count: confidences.filter(c => c >= 0.8).length }
  ]

  return { 
    average, 
    highConfidence, 
    distribution: ranges,
    hasData: true,
    totalSamples: confidences.length
  }
}

function calculateGenderDistribution(users) {
  const male = users.filter(u => 
    u.gender === 'male' || u.gender === 'M' || u.gender === 'Masculino'
  ).length
  
  const female = users.filter(u => 
    u.gender === 'female' || u.gender === 'F' || u.gender === 'Femenino'
  ).length
  
  const other = users.filter(u => 
    u.gender === 'other' || u.gender === 'O' || u.gender === 'Otro'
  ).length

  return { male, female, other }
}

function calculateAgeDistribution(users) {
  const ages = users.filter(u => u.age && u.age > 0).map(u => u.age)
  
  if (ages.length === 0) {
    return {
      range_18_25: 0,
      range_26_35: 0,
      range_36_50: 0,
      range_51_plus: 0,
      average: 0
    }
  }

  const range_18_25 = ages.filter(a => a >= 18 && a <= 25).length
  const range_26_35 = ages.filter(a => a >= 26 && a <= 35).length
  const range_36_50 = ages.filter(a => a >= 36 && a <= 50).length
  const range_51_plus = ages.filter(a => a >= 51).length
  
  const average = ages.reduce((a, b) => a + b, 0) / ages.length

  return { range_18_25, range_26_35, range_36_50, range_51_plus, average }
}