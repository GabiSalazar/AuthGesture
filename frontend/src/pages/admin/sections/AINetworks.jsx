import { useState, useEffect } from 'react'
import { systemApi } from '../../../lib/api/system'
import {
  Brain,
  Activity,
  Target,
  Zap,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Network
} from 'lucide-react'
import config from '../../../lib/config'

export default function AINetworks() {
  const [activeTab, setActiveTab] = useState('anatomical')
  
  // Estado de redes
  const [anatomicalMetrics, setAnatomicalMetrics] = useState(null)
  const [dynamicMetrics, setDynamicMetrics] = useState(null)
  const [fusionConfig, setFusionConfig] = useState(null)
  const [fusionWeights, setFusionWeights] = useState(null)
  const [biometricMetrics, setBiometricMetrics] = useState(null)
  
  // Estado de UI
  const [loading, setLoading] = useState(true)
  const [retraining, setRetraining] = useState(false)
  const [retrainProgress, setRetrainProgress] = useState(0)

  useEffect(() => {
    loadNetworksData()
  }, [])

  const loadNetworksData = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('admin_token')
      const [anatomical, dynamic, fusion, weights, metricsResponse] = await Promise.all([
        systemApi.getAnatomicalNetworkMetrics(),
        systemApi.getDynamicNetworkMetrics(),
        systemApi.getFusionConfig(),
        systemApi.getFusionWeights(),
        fetch(config.endpoints.feedback.verificationMetrics, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => res.json())
          .catch(() => ({ metrics: null }))
      ])
      
      setAnatomicalMetrics(anatomical)
      setDynamicMetrics(dynamic)
      setFusionConfig(fusion)
      setFusionWeights(weights)
      setBiometricMetrics(metricsResponse.metrics || null)
    } catch (err) {
      console.error('Error cargando datos de redes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRetrain = async () => {
    if (!confirm('¿Reentrenar las redes neuronales?\n\nEsto puede tardar 2-5 minutos y afectará el sistema.')) {
      return
    }

    try {
      setRetraining(true)
      setRetrainProgress(10)

      const interval = setInterval(() => {
        setRetrainProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval)
            return 90
          }
          return prev + 10
        })
      }, 500)

      await systemApi.retrainNetworks(true)
      
      clearInterval(interval)
      setRetrainProgress(100)
      
      setTimeout(async () => {
        await loadNetworksData()
        setRetraining(false)
        setRetrainProgress(0)
        alert('Redes reentrenadas exitosamente!')
      }, 1000)
      
    } catch (err) {
      console.error('Error reentrenando:', err)
      alert('Error al reentrenar las redes')
      setRetraining(false)
      setRetrainProgress(0)
    }
  }

  const getStatusBadge = (isTrained) => {
    if (isTrained) {
      return (
        <span 
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: '#F0FDF4', color: '#065F46' }}
        >
          <CheckCircle className="w-3 h-3" />
          Entrenada
        </span>
      )
    }
    return (
      <span 
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
        style={{ backgroundColor: '#FFFBEB', color: '#92400E' }}
      >
        <AlertCircle className="w-3 h-3" />
        Sin entrenar
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div 
            className="w-12 h-12 mx-auto border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#05A8F9', borderTopColor: 'transparent' }}
          />
          <p className="text-gray-600 text-sm font-medium">
            Cargando métricas de IA...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* ========================================
          HEADER
      ======================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            IA y Redes Neuronales
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Métricas y estado de las redes siamesas
          </p>
        </div>
        <button
          onClick={handleRetrain}
          disabled={retraining}
          className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          style={{
            background: retraining 
              ? 'linear-gradient(to right, #9CA3AF, #6B7280)'
              : 'linear-gradient(to right, #00B8D4, #00ACC1)',
            boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
          }}
        >
          <RefreshCw className={`w-4 h-4 ${retraining ? 'animate-spin' : ''}`} />
          {retraining ? 'Reentrenando...' : 'Reentrenar Redes'}
        </button>
      </div>

      {/* ========================================
          PROGRESS BAR
      ======================================== */}
      {retraining && (
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-900">Progreso del entrenamiento</span>
              <span className="font-bold" style={{ color: '#05A8F9' }}>
                {retrainProgress}%
              </span>
            </div>
            <div 
              className="w-full rounded-full h-3 overflow-hidden"
              style={{ backgroundColor: '#E0F2FE' }}
            >
              <div
                className="h-3 transition-all duration-500 rounded-full"
                style={{ 
                  width: `${retrainProgress}%`,
                  background: 'linear-gradient(to right, #00B8D4, #00ACC1)'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================
          ESTADO GENERAL
      ======================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Red Anatómica */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Red Anatómica
              </p>
              <p className="text-3xl font-black mb-3" style={{ color: '#05A8F9' }}>
                {anatomicalMetrics?.training_metrics?.final_accuracy || '--'}%
              </p>
              {getStatusBadge(anatomicalMetrics?.is_trained)}
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#EFF6FF' }}
            >
              <Network className="w-7 h-7 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Red Dinámica */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Red Dinámica
              </p>
              <p className="text-3xl font-black mb-3" style={{ color: '#05A8F9' }}>
                {dynamicMetrics?.training_metrics?.final_accuracy || '--'}%
              </p>
              {getStatusBadge(dynamicMetrics?.is_trained)}
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#F5F3FF' }}
            >
              <Activity className="w-7 h-7 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Pesos de Fusión */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Pesos de Fusión
              </p>
              <p className="text-2xl font-black" style={{ color: '#05A8F9' }}>
                {fusionWeights?.weights?.anatomical ? 
                  `${(fusionWeights.weights.anatomical * 100).toFixed(0)}% / ${(fusionWeights.weights.dynamic * 100).toFixed(0)}%` 
                  : '--'}
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#F0FDF4' }}
            >
              <Brain className="w-7 h-7 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          TABS
      ======================================== */}
      <div className="flex items-center gap-2 border-b-2 overflow-x-auto" style={{ borderColor: '#E0F2FE' }}>
        <button
          onClick={() => setActiveTab('anatomical')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4 ${
            activeTab === 'anatomical'
              ? 'text-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          style={
            activeTab === 'anatomical'
              ? { 
                  borderColor: '#05A8F9',
                  backgroundColor: '#F4FCFF',
                  color: '#05A8F9'
                }
              : {}
          }
        >
          <Network className="w-4 h-4" />
          Red Anatómica
        </button>
        <button
          onClick={() => setActiveTab('dynamic')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4 ${
            activeTab === 'dynamic'
              ? 'text-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          style={
            activeTab === 'dynamic'
              ? { 
                  borderColor: '#05A8F9',
                  backgroundColor: '#F4FCFF',
                  color: '#05A8F9'
                }
              : {}
          }
        >
          <Activity className="w-4 h-4" />
          Red Dinámica
        </button>
        <button
          onClick={() => setActiveTab('fusion')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4 ${
            activeTab === 'fusion'
              ? 'text-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          style={
            activeTab === 'fusion'
              ? { 
                  borderColor: '#05A8F9',
                  backgroundColor: '#F4FCFF',
                  color: '#05A8F9'
                }
              : {}
          }
        >
          <Zap className="w-4 h-4" />
          Fusión
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4 ${
            activeTab === 'metrics'
              ? 'text-white'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          style={
            activeTab === 'metrics'
              ? { 
                  borderColor: '#05A8F9',
                  backgroundColor: '#F4FCFF',
                  color: '#05A8F9'
                }
              : {}
          }
        >
          <BarChart3 className="w-4 h-4" />
          Métricas Biométricas
        </button>
      </div>

      {/* ========================================
          CONTENIDO DE TABS
      ======================================== */}
      
      {activeTab === 'anatomical' && anatomicalMetrics && (
        <NetworkDetails
          metrics={anatomicalMetrics}
          networkType="anatomical"
        />
      )}

      {activeTab === 'dynamic' && dynamicMetrics && (
        <NetworkDetails
          metrics={dynamicMetrics}
          networkType="dynamic"
        />
      )}

      {activeTab === 'fusion' && fusionConfig && fusionWeights && (
        <FusionDetails
          config={fusionConfig}
          weights={fusionWeights}
        />
      )}

      {activeTab === 'metrics' && (
        <BiometricMetricsPanel metrics={biometricMetrics} />
      )}
    </div>
  )
}

/* ========================================
   COMPONENTE: BIOMETRIC METRICS PANEL
======================================== */
function BiometricMetricsPanel({ metrics }) {
  if (!metrics || metrics.total_samples === 0) {
    return (
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-12"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="text-center max-w-md mx-auto">
          <BarChart3 className="w-16 h-16 mx-auto mb-4" style={{ color: '#E0F2FE' }} />
          <h3 className="text-lg font-black text-gray-900 mb-2">
            No hay métricas disponibles
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Las métricas biométricas se calculan cuando los usuarios responden 
            los correos de feedback. Realiza algunas autenticaciones para ver 
            los datos aquí.
          </p>
        </div>
      </div>
    )
  }

  const getMetricColor = (value, isNegative = false) => {
    if (isNegative) {
      return value <= 2 
        ? { bg: '#F0FDF4', border: '#86EFAC', text: 'text-green-800' }
        : value <= 5 
          ? { bg: '#FFFBEB', border: '#FCD34D', text: 'text-yellow-800' }
          : { bg: '#FEF2F2', border: '#FCA5A5', text: 'text-red-800' }
    } else {
      return value >= 10 
        ? { bg: '#F0FDF4', border: '#86EFAC', text: 'text-green-800' }
        : value >= 5 
          ? { bg: '#FFFBEB', border: '#FCD34D', text: 'text-yellow-800' }
          : { bg: '#F3F4F6', border: '#E5E7EB', text: 'text-gray-800' }
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Matriz de Confusión */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Matriz de Confusión - Resultados de Autenticación
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {/* VP */}
          <div 
            className={`p-6 rounded-xl border-2 ${getMetricColor(metrics.true_positives).text}`}
            style={{ 
              backgroundColor: getMetricColor(metrics.true_positives).bg,
              borderColor: getMetricColor(metrics.true_positives).border
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <span className="text-4xl font-black">{metrics.true_positives}</span>
            </div>
            <h4 className="font-black text-sm mb-1">Verdaderos Positivos (VP)</h4>
            <p className="text-xs opacity-75">
              Sistema autenticó correctamente al usuario legítimo
            </p>
          </div>

          {/* FP */}
          <div 
            className={`p-6 rounded-xl border-2 ${getMetricColor(metrics.false_positives, true).text}`}
            style={{ 
              backgroundColor: getMetricColor(metrics.false_positives, true).bg,
              borderColor: getMetricColor(metrics.false_positives, true).border
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <span className="text-4xl font-black">{metrics.false_positives}</span>
            </div>
            <h4 className="font-black text-sm mb-1">Falsos Positivos (FP)</h4>
            <p className="text-xs opacity-75">
              Sistema autenticó incorrectamente a un impostor
            </p>
          </div>

          {/* FN */}
          <div 
            className={`p-6 rounded-xl border-2 ${getMetricColor(metrics.false_negatives, true).text}`}
            style={{ 
              backgroundColor: getMetricColor(metrics.false_negatives, true).bg,
              borderColor: getMetricColor(metrics.false_negatives, true).border
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-8 h-8 text-orange-600" />
              <span className="text-4xl font-black">{metrics.false_negatives}</span>
            </div>
            <h4 className="font-black text-sm mb-1">Falsos Negativos (FN)</h4>
            <p className="text-xs opacity-75">
              Sistema rechazó incorrectamente a un usuario legítimo
            </p>
          </div>

          {/* VN */}
          <div 
            className={`p-6 rounded-xl border-2 ${getMetricColor(metrics.true_negatives).text}`}
            style={{ 
              backgroundColor: getMetricColor(metrics.true_negatives).bg,
              borderColor: getMetricColor(metrics.true_negatives).border
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-8 h-8 text-blue-600" />
              <span className="text-4xl font-black">{metrics.true_negatives}</span>
            </div>
            <h4 className="font-black text-sm mb-1">Verdaderos Negativos (VN)</h4>
            <p className="text-xs opacity-75">
              Sistema bloqueó correctamente a un impostor
            </p>
          </div>
        </div>

        {/* Total */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Total de muestras analizadas: <span className="font-black">{metrics.total_samples}</span>
          </p>
        </div>
      </div>

      {/* Métricas Derivadas */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Métricas de Rendimiento
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
              Accuracy
            </p>
            <p className="text-3xl font-black text-blue-900">
              {(metrics.accuracy * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-blue-600 mt-2 font-medium">
              Decisiones correctas
            </p>
          </div>

          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              Precision
            </p>
            <p className="text-3xl font-black text-green-900">
              {(metrics.precision * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-green-600 mt-2 font-medium">
              Autenticaciones correctas
            </p>
          </div>

          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              Recall
            </p>
            <p className="text-3xl font-black text-purple-900">
              {(metrics.recall * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600 mt-2 font-medium">
              Usuarios identificados
            </p>
          </div>

          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-indigo-700">
              F1 Score
            </p>
            <p className="text-3xl font-black text-indigo-900">
              {(metrics.f1_score * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-indigo-600 mt-2 font-medium">
              Métrica combinada
            </p>
          </div>
        </div>
      </div>

      {/* Tasas de Error */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Tasas de Error Biométrico
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <div 
            className="p-6 rounded-xl border-2"
            style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-red-700">
              FAR (False Acceptance Rate)
            </p>
            <p className="text-4xl font-black text-red-900">
              {(metrics.far * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-red-600 mt-2 font-medium">
              Tasa de aceptación de impostores
            </p>
          </div>

          <div 
            className="p-6 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              FRR (False Rejection Rate)
            </p>
            <p className="text-4xl font-black text-orange-900">
              {(metrics.frr * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-orange-600 mt-2 font-medium">
              Tasa de rechazo de usuarios legítimos
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================
   COMPONENTE: NETWORK DETAILS
======================================== */
function NetworkDetails({ metrics, networkType }) {
  const getMetricColor = (value, metric) => {
    if (metric === 'accuracy') return value >= 95 ? 'text-green-600' : value >= 90 ? 'text-yellow-600' : 'text-red-600'
    if (metric === 'far' || metric === 'frr') return value <= 2 ? 'text-green-600' : value <= 5 ? 'text-yellow-600' : 'text-red-600'
    if (metric === 'eer') return value <= 3 ? 'text-green-600' : value <= 5 ? 'text-yellow-600' : 'text-red-600'
    return 'text-gray-900'
  }

  const isDynamic = networkType === 'dynamic'

  return (
    <div className="space-y-6">
      
      {/* Métricas de Entrenamiento */}
      {metrics.training_metrics && (
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5" style={{ color: '#05A8F9' }} />
            <h3 className="text-lg font-black text-gray-900">
              Métricas de Entrenamiento
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Accuracy Final
              </p>
              <p className={`text-2xl font-black ${getMetricColor(metrics.training_metrics.final_accuracy, 'accuracy')}`}>
                {metrics.training_metrics.final_accuracy}%
              </p>
            </div>
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Loss Final
              </p>
              <p className="text-2xl font-black text-gray-900">
                {metrics.training_metrics.final_loss}
              </p>
            </div>
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Total Epochs
              </p>
              <p className="text-2xl font-black text-gray-900">
                {metrics.training_metrics.total_epochs}
              </p>
            </div>
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Best Accuracy
              </p>
              <p className={`text-2xl font-black ${getMetricColor(metrics.training_metrics.best_accuracy, 'accuracy')}`}>
                {metrics.training_metrics.best_accuracy}%
              </p>
            </div>
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Tiempo Total
              </p>
              <p className="text-2xl font-black text-gray-900">
                {metrics.training_metrics.training_time}s
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Métricas Biométricas */}
      {metrics.biometric_metrics && (
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
            <h3 className="text-lg font-black text-gray-900">
              Métricas Biométricas
            </h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
            >
              <p className="text-xs font-bold uppercase tracking-wide mb-2 text-red-700">
                FAR
              </p>
              <p className={`text-3xl font-black ${getMetricColor(metrics.biometric_metrics.far, 'far')}`}>
                {metrics.biometric_metrics.far}%
              </p>
              <p className="text-xs text-red-600 mt-2 font-medium">
                False Accept Rate
              </p>
            </div>
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
            >
              <p className="text-xs font-bold uppercase tracking-wide mb-2 text-yellow-700">
                FRR
              </p>
              <p className={`text-3xl font-black ${getMetricColor(metrics.biometric_metrics.frr, 'frr')}`}>
                {metrics.biometric_metrics.frr}%
              </p>
              <p className="text-xs text-yellow-600 mt-2 font-medium">
                False Reject Rate
              </p>
            </div>
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
            >
              <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
                EER
              </p>
              <p className={`text-3xl font-black ${getMetricColor(metrics.biometric_metrics.eer, 'eer')}`}>
                {metrics.biometric_metrics.eer}%
              </p>
              <p className="text-xs text-green-600 mt-2 font-medium">
                Equal Error Rate
              </p>
            </div>
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
            >
              <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
                AUC
              </p>
              <p className="text-3xl font-black text-blue-900">
                {metrics.biometric_metrics.auc_score}%
              </p>
              <p className="text-xs text-blue-600 mt-2 font-medium">
                Area Under Curve
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#F4FCFF' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                Accuracy
              </p>
              <p className="text-xl font-black text-gray-900">
                {metrics.biometric_metrics.accuracy}%
              </p>
            </div>
            <div 
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#F4FCFF' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                Precision
              </p>
              <p className="text-xl font-black text-gray-900">
                {metrics.biometric_metrics.precision}%
              </p>
            </div>
            <div 
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#F4FCFF' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                Recall
              </p>
              <p className="text-xl font-black text-gray-900">
                {metrics.biometric_metrics.recall}%
              </p>
            </div>
            <div 
              className="p-4 rounded-xl"
              style={{ backgroundColor: '#F4FCFF' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                F1 Score
              </p>
              <p className="text-xl font-black text-gray-900">
                {metrics.biometric_metrics.f1_score}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Arquitectura */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Arquitectura de Red
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {isDynamic && metrics.architecture.sequence_length && (
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Sequence Length
              </p>
              <p className="text-2xl font-black text-gray-900">
                {metrics.architecture.sequence_length}
              </p>
            </div>
          )}

          {isDynamic && metrics.architecture.feature_dim && (
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Feature Dim
              </p>
              <p className="text-2xl font-black text-gray-900">
                {metrics.architecture.feature_dim}
              </p>
            </div>
          )}

          {!isDynamic && metrics.architecture.input_dim && (
            <div 
              className="p-5 rounded-xl border-2"
              style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
            >
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Input Dim
              </p>
              <p className="text-2xl font-black text-gray-900">
                {metrics.architecture.input_dim}
              </p>
            </div>
          )}

          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
          >
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              Embedding Dim
            </p>
            <p className="text-2xl font-black text-gray-900">
              {metrics.architecture.embedding_dim}
            </p>
          </div>
          
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
          >
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              Total Parámetros
            </p>
            <p className="text-2xl font-black text-gray-900">
              {metrics.architecture.total_parameters.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Capas */}
        <div 
          className="p-5 rounded-xl"
          style={{ backgroundColor: '#F4FCFF' }}
        >
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
            Capas de la Red:
          </p>
          <div className="flex flex-wrap gap-2">
            {metrics.architecture.layers && metrics.architecture.layers.length > 0 ? (
              metrics.architecture.layers.map((layer, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}
                >
                  {typeof layer === 'number' ? `Dense(${layer})` : layer}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-500">No disponible</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================
   COMPONENTE: FUSION DETAILS
======================================== */
function FusionDetails({ config, weights }) {
  return (
    <div className="space-y-6">
      
      {/* Configuración de Fusión */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Configuración de Fusión
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
          >
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              Estrategia
            </p>
            <p className="text-xl font-black text-gray-900">
              {config.config.fusion_strategy}
            </p>
          </div>
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
          >
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              Calibración
            </p>
            <p className="text-xl font-black text-gray-900">
              {config.config.calibration_method}
            </p>
          </div>
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F4FCFF', borderColor: '#E0F2FE' }}
          >
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              Optimización
            </p>
            <p className="text-xl font-black text-gray-900">
              {config.config.weight_optimization}
            </p>
          </div>
        </div>
      </div>

      {/* Pesos Optimizados */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Pesos Optimizados
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div 
            className="p-6 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-3 text-blue-700">
              Peso Anatómico
            </p>
            <p className="text-5xl font-black text-blue-900 mb-3">
              {weights.weights && weights.weights.anatomical 
                ? `${(weights.weights.anatomical * 100).toFixed(0)}%`
                : '---'}
            </p>
            <p className="text-xs text-blue-600 font-medium">
              Características estáticas
            </p>
          </div>
          <div 
            className="p-6 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-3 text-purple-700">
              Peso Dinámico
            </p>
            <p className="text-5xl font-black text-purple-900 mb-3">
              {weights.weights && weights.weights.dynamic
                ? `${(weights.weights.dynamic * 100).toFixed(0)}%`
                : '---'}
            </p>
            <p className="text-xs text-purple-600 font-medium">
              Características temporales
            </p>
          </div>
        </div>

        <div 
          className="p-5 rounded-xl border-2"
          style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
        >
          <div className="flex items-center gap-2 text-sm font-bold text-green-800">
            <CheckCircle className="w-5 h-5" />
            <span>
              Umbral óptimo: <span className="text-lg">{weights.optimal_threshold || '---'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}