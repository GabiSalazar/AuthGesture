import { useState, useEffect } from 'react'
import { systemApi } from '../../../lib/api/system'
import {
  Brain,
  Activity,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Network,
  TrendingDown
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import config from '../../../lib/config'

export default function AINetworks() {
  // Estado de redes
  const [anatomicalMetrics, setAnatomicalMetrics] = useState(null)
  const [dynamicMetrics, setDynamicMetrics] = useState(null)
  const [fusionWeights, setFusionWeights] = useState(null)
  const [biometricMetrics, setBiometricMetrics] = useState(null)
  
  // Estado de UI
  const [loading, setLoading] = useState(true)
  const [retraining, setRetraining] = useState(false)
  const [retrainProgress, setRetrainProgress] = useState(0)
  const [activeTab, setActiveTab] = useState('biometric')

  useEffect(() => {
    loadNetworksData()
  }, [])

  const loadNetworksData = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('admin_token')
      const [anatomical, dynamic, weights, metricsResponse] = await Promise.all([
        systemApi.getAnatomicalNetworkMetricsFull(),
        systemApi.getDynamicNetworkMetricsFull(),
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
          <h2 className="text-2xl sm:text-3xl font-black text-gray-600">
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
          ESTADO GENERAL - 3 CARDS
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
                {anatomicalMetrics?.metrics?.accuracy 
                  ? `${(anatomicalMetrics.metrics.accuracy * 100).toFixed(1)}%`
                  : '--'}
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
                {dynamicMetrics?.metrics?.accuracy 
                  ? `${(dynamicMetrics.metrics.accuracy * 100).toFixed(1)}%`
                  : '--'}
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
      </div>

      {/* ========================================
          TABS NAVIGATION
      ======================================== */}
      <div className="flex items-center gap-2 border-b-2 overflow-x-auto" style={{ borderColor: '#E0F2FE' }}>
        
        {/* Tab Red Anatómica */}
        <button
          onClick={() => setActiveTab('anatomical')}
          className="flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4"
          style={{ 
            borderColor: activeTab === 'anatomical' ? '#05A8F9' : 'transparent',
            backgroundColor: activeTab === 'anatomical' ? '#F4FCFF' : 'transparent',
            color: activeTab === 'anatomical' ? '#05A8F9' : '#6B7280'
          }}
        >
          <Network className="w-4 h-4" />
          Red Anatómica
        </button>

        {/* Tab Red Dinámica */}
        <button
          onClick={() => setActiveTab('dynamic')}
          className="flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4"
          style={{ 
            borderColor: activeTab === 'dynamic' ? '#05A8F9' : 'transparent',
            backgroundColor: activeTab === 'dynamic' ? '#F4FCFF' : 'transparent',
            color: activeTab === 'dynamic' ? '#05A8F9' : '#6B7280'
          }}
        >
          <Activity className="w-4 h-4" />
          Red Dinámica
        </button>

        {/* Tab Métricas Biométricas */}
        <button
          onClick={() => setActiveTab('biometric')}
          className="flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4"
          style={{ 
            borderColor: activeTab === 'biometric' ? '#05A8F9' : 'transparent',
            backgroundColor: activeTab === 'biometric' ? '#F4FCFF' : 'transparent',
            color: activeTab === 'biometric' ? '#05A8F9' : '#6B7280'
          }}
        >
          <BarChart3 className="w-4 h-4" />
          Métricas biométricas
        </button>
      </div>

      {/* ========================================
          CONTENIDO
      ======================================== */}
      {activeTab === 'anatomical' && (
        <AnatomicalNetworkPanel metrics={anatomicalMetrics} />
      )}
      
      {activeTab === 'dynamic' && (
        <DynamicNetworkPanel metrics={dynamicMetrics} />
      )}
      
      {activeTab === 'biometric' && (
        <BiometricMetricsPanel metrics={biometricMetrics} />
      )}
    </div>
  )
}

/* ========================================
   COMPONENTE: ANATOMICAL NETWORK PANEL
======================================== */
function AnatomicalNetworkPanel({ metrics }) {
  if (!metrics) {
    return (
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-12"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="text-center max-w-md mx-auto">
          <Network className="w-16 h-16 mx-auto mb-4" style={{ color: '#E0F2FE' }} />
          <h3 className="text-lg font-black text-gray-900 mb-2">
            Red anatómica no disponible
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            La red anatómica aún no ha sido entrenada. Realiza un entrenamiento 
            para ver las métricas aquí.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ========================================
          MÉTRICAS BIOMÉTRICAS PRINCIPALES
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Métricas biométricas
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* FAR */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-red-700">
              FAR
            </p>
            <p className="text-3xl font-black text-red-900">
              {((metrics.metrics?.far || 0) * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-red-600 mt-2 font-medium">
              False Accept Rate
            </p>
          </div>

          {/* FRR */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              FRR
            </p>
            <p className="text-3xl font-black text-orange-900">
              {((metrics.metrics?.frr || 0) * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-orange-600 mt-2 font-medium">
              False Reject Rate
            </p>
          </div>

          {/* EER */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              EER
            </p>
            <p className="text-3xl font-black text-purple-900">
              {((metrics.metrics?.eer || 0) * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-purple-600 mt-2 font-medium">
              Equal Error Rate
            </p>
          </div>

          {/* AUC */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              AUC
            </p>
            <p className="text-3xl font-black text-green-900">
              {(metrics.metrics?.auc_score || 0).toFixed(3)}
            </p>
            <p className="text-xs text-green-600 mt-2 font-medium">
              ROC Area
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          MÉTRICAS DE MACHINE LEARNING
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Métricas de clasificación
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Accuracy */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
              Accuracy
            </p>
            <p className="text-3xl font-black text-blue-900">
              {((metrics.metrics?.accuracy || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-blue-600 mt-2 font-medium">
              Precisión global
            </p>
          </div>

          {/* Precision */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              Precision
            </p>
            <p className="text-3xl font-black text-green-900">
              {((metrics.metrics?.precision || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-green-600 mt-2 font-medium">
              Aceptaciones correctas
            </p>
          </div>

          {/* Recall */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              Recall
            </p>
            <p className="text-3xl font-black text-purple-900">
              {((metrics.metrics?.recall || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600 mt-2 font-medium">
              Usuarios detectados
            </p>
          </div>

          {/* F1 Score */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-indigo-700">
              F1 Score
            </p>
            <p className="text-3xl font-black text-indigo-900">
              {((metrics.metrics?.f1_score || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-indigo-600 mt-2 font-medium">
              Balance P/R
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          MATRIZ DE CONFUSIÓN
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Matriz de confusión
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {/* Verdaderos Positivos (TP) */}
          <div 
            className="p-6 rounded-xl border-2"
            style={{ 
              backgroundColor: '#F0FDF4',
              borderColor: '#86EFAC'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <span className="text-4xl font-black text-green-900">
                {metrics.confusion_matrix?.true_positives || 0}
              </span>
            </div>
            <h4 className="font-black text-sm mb-1 text-green-800">
              Verdaderos Positivos (VP)
            </h4>
            <p className="text-xs text-green-700">
              Genuinos correctamente autenticados
            </p>
          </div>

          {/* Falsos Positivos (FP) */}
          <div 
            className="p-6 rounded-xl border-2"
            style={{ 
              backgroundColor: '#FEF2F2',
              borderColor: '#FCA5A5'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <span className="text-4xl font-black text-red-900">
                {metrics.confusion_matrix?.false_positives || 0}
              </span>
            </div>
            <h4 className="font-black text-sm mb-1 text-red-800">
              Falsos Positivos (FP)
            </h4>
            <p className="text-xs text-red-700">
              Impostores incorrectamente autenticados
            </p>
          </div>

          {/* Falsos Negativos (FN) */}
          <div 
            className="p-6 rounded-xl border-2"
            style={{ 
              backgroundColor: '#FFFBEB',
              borderColor: '#FCD34D'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-8 h-8 text-orange-600" />
              <span className="text-4xl font-black text-orange-900">
                {metrics.confusion_matrix?.false_negatives || 0}
              </span>
            </div>
            <h4 className="font-black text-sm mb-1 text-orange-800">
              Falsos Negativos (FN)
            </h4>
            <p className="text-xs text-orange-700">
              Genuinos incorrectamente rechazados
            </p>
          </div>

          {/* Verdaderos Negativos (TN) */}
          <div 
            className="p-6 rounded-xl border-2"
            style={{ 
              backgroundColor: '#EFF6FF',
              borderColor: '#BFDBFE'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-8 h-8 text-blue-600" />
              <span className="text-4xl font-black text-blue-900">
                {metrics.confusion_matrix?.true_negatives || 0}
              </span>
            </div>
            <h4 className="font-black text-sm mb-1 text-blue-800">
              Verdaderos Negativos (VN)
            </h4>
            <p className="text-xs text-blue-700">
              Impostores correctamente rechazados
            </p>
          </div>
        </div>

        {/* Total de evaluaciones */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Total de evaluaciones: <span className="font-black">
              {(metrics.confusion_matrix?.true_positives || 0) + 
               (metrics.confusion_matrix?.false_positives || 0) + 
               (metrics.confusion_matrix?.true_negatives || 0) + 
               (metrics.confusion_matrix?.false_negatives || 0)}
            </span>
          </p>
        </div>
      </div>

      {/* ========================================
          CURVA ROC
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Curva ROC (Receiver Operating Characteristic)
          </h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={(() => {
              const fpr = metrics.roc_curve?.fpr || []
              const tpr = metrics.roc_curve?.tpr || []
              
              return fpr.map((fp, idx) => ({
                fpr: (fp * 100).toFixed(2),
                tpr: (tpr[idx] * 100).toFixed(2),
                random: (fp * 100).toFixed(2)
              }))
            })()}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="fpr" 
              label={{ value: 'False Positive Rate (%)', position: 'insideBottom', offset: -5, style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <YAxis 
              label={{ value: 'True Positive Rate (%)', angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '2px solid #05A8F9',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => `${value}%`}
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
              name={`ROC (AUC=${(metrics.metrics?.auc_score || 0).toFixed(3)})`}
              // dot={{ fill: '#05A8F9', r: 4 }}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>


        {/* <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={(() => {
              const fpr = metrics.roc_curve?.fpr || []
              const tpr = metrics.roc_curve?.tpr || []
              
              return fpr.map((fp, idx) => ({
                fpr: fp * 100,
                tpr: tpr[idx] * 100,
                random: fp * 100
              }))
            })()}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="fpr" 
              label={{ value: 'False Positive Rate (%)', position: 'insideBottom', offset: -5, style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
              domain={[0, 100]}
              type="number"
              ticks={[0, 20, 40, 60, 80, 100]}
            />
            <YAxis 
              label={{ value: 'True Positive Rate (%)', angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '2px solid #05A8F9',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => `${value.toFixed(2)}%`}
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
              name={`ROC (AUC=${(metrics.metrics?.auc_score || 0).toFixed(3)})`}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer> */}

        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
          <p className="text-sm font-bold text-gray-700">
            AUC Score: <span className="text-2xl" style={{ color: '#05A8F9' }}>
              {(metrics.metrics?.auc_score || 0).toFixed(3)}
            </span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Área bajo la curva ROC (1.0 = perfecto, 0.5 = aleatorio)
          </p>
        </div>
      </div>

      {/* ========================================
          DISTRIBUCIÓN DE SCORES
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Distribución de scores de similitud
          </h3>
        </div>

        {(() => {
          const genuineScores = metrics.score_distributions?.genuine_scores || []
          const impostorScores = metrics.score_distributions?.impostor_scores || []
          const threshold = metrics.metrics?.threshold || 0.5

          // Calcular estadísticas
          const genuineStats = {
            min: genuineScores.length > 0 ? Math.min(...genuineScores) : 0,
            max: genuineScores.length > 0 ? Math.max(...genuineScores) : 0,
            mean: genuineScores.length > 0 
              ? genuineScores.reduce((a, b) => a + b, 0) / genuineScores.length 
              : 0
          }

          const impostorStats = {
            min: impostorScores.length > 0 ? Math.min(...impostorScores) : 0,
            max: impostorScores.length > 0 ? Math.max(...impostorScores) : 0,
            mean: impostorScores.length > 0 
              ? impostorScores.reduce((a, b) => a + b, 0) / impostorScores.length 
              : 0
          }

          const separation = genuineStats.min - impostorStats.max

          return (
            <>
              {/* Visualización conceptual */}
              <div className="mb-6">
                <div className="relative h-32 bg-gray-50 rounded-xl p-4">
                  
                  {/* Región impostores */}
                  <div 
                    className="absolute top-4 h-24 bg-red-200 rounded-lg opacity-60"
                    style={{
                      left: `${impostorStats.min * 100}%`,
                      width: `${(impostorStats.max - impostorStats.min) * 100}%`
                    }}
                  />
                  
                  {/* Región genuinos */}
                  <div 
                    className="absolute top-4 h-24 bg-green-200 rounded-lg opacity-60"
                    style={{
                      left: `${genuineStats.min * 100}%`,
                      width: `${(genuineStats.max - genuineStats.min) * 100}%`
                    }}
                  />
                  
                  {/* Línea de threshold */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-purple-600"
                    style={{ left: `${threshold * 100}%` }}
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap">
                      Threshold: {threshold.toFixed(3)}
                    </div>
                  </div>

                  {/* Etiquetas */}
                  <div className="absolute bottom-1 left-0 text-xs font-bold text-red-700">
                    Impostores
                  </div>
                  <div className="absolute bottom-1 right-0 text-xs font-bold text-green-700">
                    Genuinos
                  </div>
                </div>

                {/* Escala */}
                <div className="flex justify-between mt-2 text-xs text-gray-600 font-mono">
                  <span>0.0</span>
                  <span>0.2</span>
                  <span>0.4</span>
                  <span>0.6</span>
                  <span>0.8</span>
                  <span>1.0</span>
                </div>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Stats Impostores */}
                <div 
                  className="p-4 rounded-xl border-2"
                  style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
                >
                  <h4 className="text-sm font-black text-red-800 mb-3">
                    Impostores ({impostorScores.length})
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-red-700">Min:</span>
                      <span className="font-black text-red-900">{impostorStats.min.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-700">Max:</span>
                      <span className="font-black text-red-900">{impostorStats.max.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-700">Media:</span>
                      <span className="font-black text-red-900">{impostorStats.mean.toFixed(4)}</span>
                    </div>
                  </div>
                </div>

                {/* Separación */}
                <div 
                  className="p-4 rounded-xl border-2"
                  style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
                >
                  <h4 className="text-sm font-black text-purple-800 mb-3">
                    Separación
                  </h4>
                  <div className="text-center">
                    <p className="text-4xl font-black text-purple-900">
                      {separation.toFixed(3)}
                    </p>
                    <p className="text-xs text-purple-700 mt-2">
                      Gap entre clases
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {(separation * 100).toFixed(1)}% de separación
                    </p>
                  </div>
                </div>

                {/* Stats Genuinos */}
                <div 
                  className="p-4 rounded-xl border-2"
                  style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
                >
                  <h4 className="text-sm font-black text-green-800 mb-3">
                    Genuinos ({genuineScores.length})
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-green-700">Min:</span>
                      <span className="font-black text-green-900">{genuineStats.min.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Max:</span>
                      <span className="font-black text-green-900">{genuineStats.max.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Media:</span>
                      <span className="font-black text-green-900">{genuineStats.mean.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )
        })()}
      </div>

      {/* ========================================
          CURVA DE ENTRENAMIENTO (LOSS)
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingDown className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Evolución de la pérdida durante entrenamiento
          </h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={(() => {
              const loss = metrics.training_history?.loss || []
              const valLoss = metrics.training_history?.val_loss || []
              const epochs = metrics.training_history?.epochs || []
              
              return epochs.map((epoch, idx) => ({
                epoch: epoch,
                trainLoss: loss[idx],
                valLoss: valLoss[idx]
              }))
            })()}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="epoch" 
              label={{ value: 'Época', position: 'insideBottom', offset: -5, style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <YAxis 
              label={{ value: 'Pérdida (Loss)', angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '2px solid #05A8F9',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => value.toFixed(4)}
            />
            <Legend />
            
            {/* Train Loss */}
            <Line 
              type="monotone" 
              dataKey="trainLoss" 
              stroke="#3B82F6" 
              strokeWidth={2}
              name="Train Loss"
              dot={false}
            />
            
            {/* Validation Loss */}
            <Line 
              type="monotone" 
              dataKey="valLoss" 
              stroke="#F59E0B" 
              strokeWidth={2}
              name="Validation Loss"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
              Loss inicial
            </p>
            <p className="text-2xl font-black text-blue-900">
              {(metrics.training_history?.loss?.[0] || 0).toFixed(4)}
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              Loss final
            </p>
            <p className="text-2xl font-black text-green-900">
              {(metrics.training_history?.loss?.[metrics.training_history?.loss?.length - 1] || 0).toFixed(4)}
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              Épocas totales
            </p>
            <p className="text-2xl font-black text-purple-900">
              {metrics.training_history?.epochs?.length || 0}
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              Reducción
            </p>
            <p className="text-2xl font-black text-orange-900">
              {(() => {
                const initial = metrics.training_history?.loss?.[0] || 0
                const final = metrics.training_history?.loss?.[metrics.training_history?.loss?.length - 1] || 0
                const reduction = ((initial - final) / initial * 100)
                return reduction.toFixed(1)
              })()}%
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          EVOLUCIÓN FAR/FRR
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Evolución de tasas de error biométrico
          </h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={(() => {
              const farHistory = metrics.training_history?.far_history || []
              const frrHistory = metrics.training_history?.frr_history || []
              const epochs = metrics.training_history?.epochs || []
              
              return epochs.map((epoch, idx) => ({
                epoch: epoch,
                FAR: (farHistory[idx] * 100),
                FRR: (frrHistory[idx] * 100)
              }))
            })()}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="epoch" 
              label={{ value: 'Época', position: 'insideBottom', offset: -5, style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <YAxis 
              label={{ value: 'Tasa de Error (%)', angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '2px solid #05A8F9',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => `${value.toFixed(2)}%`}
            />
            <Legend />
            
            {/* FAR */}
            <Line 
              type="monotone" 
              dataKey="FAR" 
              stroke="#EF4444" 
              strokeWidth={2}
              name="FAR (False Accept Rate)"
              dot={false}
            />
            
            {/* FRR */}
            <Line 
              type="monotone" 
              dataKey="FRR" 
              stroke="#F59E0B" 
              strokeWidth={2}
              name="FRR (False Reject Rate)"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Hitos importantes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-red-700">
              FAR inicial
            </p>
            <p className="text-2xl font-black text-red-900">
              {((metrics.training_history?.far_history?.[0] || 0) * 100).toFixed(2)}%
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              FAR final
            </p>
            <p className="text-2xl font-black text-green-900">
              {((metrics.training_history?.far_history?.[metrics.training_history?.far_history?.length - 1] || 0) * 100).toFixed(2)}%
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              FRR inicial
            </p>
            <p className="text-2xl font-black text-orange-900">
              {((metrics.training_history?.frr_history?.[0] || 0) * 100).toFixed(2)}%
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              FRR final
            </p>
            <p className="text-2xl font-black text-green-900">
              {((metrics.training_history?.frr_history?.[metrics.training_history?.frr_history?.length - 1] || 0) * 100).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Análisis de convergencia */}
        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
          <p className="text-sm font-bold text-gray-700">
            Primera época con FAR = 0%: <span className="text-lg" style={{ color: '#05A8F9' }}>
              {(() => {
                const farHistory = metrics.training_history?.far_history || []
                const firstZeroIdx = farHistory.findIndex(val => val === 0)
                return firstZeroIdx !== -1 ? `Época ${firstZeroIdx + 1}` : 'No alcanzado'
              })()}
            </span>
          </p>
          <p className="text-sm font-bold text-gray-700 mt-2">
            Primera época con FRR = 0%: <span className="text-lg" style={{ color: '#05A8F9' }}>
              {(() => {
                const frrHistory = metrics.training_history?.frr_history || []
                const firstZeroIdx = frrHistory.findIndex(val => val === 0)
                return firstZeroIdx !== -1 ? `Época ${firstZeroIdx + 1}` : 'No alcanzado'
              })()}
            </span>
          </p>
        </div>
      </div>

      {/* ========================================
          CONFIGURACIÓN Y ARQUITECTURA
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Network className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Arquitectura y configuración del modelo
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Arquitectura */}
          <div>
            <h4 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-wide">
              Arquitectura de la red
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Dimensión de entrada</span>
                <span className="text-sm font-black text-gray-900">{metrics.input_dim || 180} features</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Capas ocultas</span>
                <span className="text-sm font-black text-gray-900">
                  [{(metrics.config?.hidden_layers || []).join(', ')}]
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Dimensión de embedding</span>
                <span className="text-sm font-black text-gray-900">{metrics.embedding_dim || 64}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Activación</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.activation || 'ReLU'}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Batch Normalization</span>
                <span className="text-sm font-black text-gray-900">
                  {metrics.config?.batch_normalization ? ' Sí' : ' No'}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Dropout</span>
                <span className="text-sm font-black text-gray-900">
                  {((metrics.config?.dropout_rate || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Entrenamiento */}
          <div>
            <h4 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-wide">
              Configuración de entrenamiento
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Learning Rate</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.learning_rate || 0.001}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Batch Size</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.batch_size || 32}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Épocas configuradas</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.epochs || 100}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Early Stopping Patience</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.patience || 15} épocas</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Función de pérdida</span>
                <span className="text-sm font-black text-gray-900">
                  {metrics.config?.loss_function || 'Contrastive'}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Métrica de distancia</span>
                <span className="text-sm font-black text-gray-900">
                  {metrics.config?.distance_metric || 'Euclidean'}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Margen (Contrastive)</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.margin || 1.5}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Regularización L2</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.l2_regularization || 0.001}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Threshold óptimo */}
        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-700">Threshold óptimo de decisión</p>
              <p className="text-xs text-gray-600 mt-1">
                Punto de corte para clasificación genuino/impostor
              </p>
            </div>
            <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
              {(metrics.optimal_threshold || metrics.metrics?.threshold || 0).toFixed(4)}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          ESTADÍSTICAS DEL DATASET
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Estadísticas del dataset
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Usuarios */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
              Usuarios
            </p>
            <p className="text-4xl font-black text-blue-900">
              {metrics.users_trained_count || 0}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Entrenados
            </p>
          </div>

          {/* Muestras totales */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              Pares de entrenamiento
            </p>
            <p className="text-4xl font-black text-green-900">
              {metrics.training_samples || 0}
            </p>
            <p className="text-xs text-green-600 mt-2">
              Genuinos + Impostores
            </p>
          </div>

          {/* Pares genuinos */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              Pares genuinos
            </p>
            <p className="text-4xl font-black text-purple-900">
              {metrics.total_genuine_pairs || 0}
            </p>
            <p className="text-xs text-purple-600 mt-2">
              Para entrenamiento
            </p>
          </div>

          {/* Pares impostores */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              Pares impostores
            </p>
            <p className="text-4xl font-black text-orange-900">
              {metrics.total_impostor_pairs || 0}
            </p>
            <p className="text-xs text-orange-600 mt-2">
              Para entrenamiento
            </p>
          </div>
        </div>

        {/* Distribución detallada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Dataset de entrenamiento */}
          <div 
            className="p-5 rounded-xl"
            style={{ backgroundColor: '#F9FAFB', border: '2px solid #E5E7EB' }}
          >
            <h4 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-wide">
              Dataset de entrenamiento
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pares genuinos:</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${((metrics.total_genuine_pairs || 0) / (metrics.training_samples || 1)) * 100}px`,
                      backgroundColor: '#10B981',
                      maxWidth: '100px'
                    }}
                  />
                  <span className="text-sm font-black text-gray-900">
                    {metrics.total_genuine_pairs || 0}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pares impostores:</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${((metrics.total_impostor_pairs || 0) / (metrics.training_samples || 1)) * 100}px`,
                      backgroundColor: '#EF4444',
                      maxWidth: '100px'
                    }}
                  />
                  <span className="text-sm font-black text-gray-900">
                    {metrics.total_impostor_pairs || 0}
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t-2 border-gray-200">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-gray-700">Total:</span>
                  <span className="text-sm font-black text-gray-900">
                    {(metrics.total_genuine_pairs || 0) + (metrics.total_impostor_pairs || 0)} pares
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dataset de evaluación */}
          <div 
            className="p-5 rounded-xl"
            style={{ backgroundColor: '#F9FAFB', border: '2px solid #E5E7EB' }}
          >
            <h4 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-wide">
              Dataset de evaluación (Test)
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pares genuinos:</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${((metrics.confusion_matrix?.true_positives + metrics.confusion_matrix?.false_negatives) / 139) * 100}px`,
                      backgroundColor: '#10B981',
                      maxWidth: '100px'
                    }}
                  />
                  <span className="text-sm font-black text-gray-900">
                    {(metrics.confusion_matrix?.true_positives || 0) + (metrics.confusion_matrix?.false_negatives || 0)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pares impostores:</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${((metrics.confusion_matrix?.true_negatives + metrics.confusion_matrix?.false_positives) / 139) * 100}px`,
                      backgroundColor: '#EF4444',
                      maxWidth: '100px'
                    }}
                  />
                  <span className="text-sm font-black text-gray-900">
                    {(metrics.confusion_matrix?.true_negatives || 0) + (metrics.confusion_matrix?.false_positives || 0)}
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t-2 border-gray-200">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-gray-700">Total:</span>
                  <span className="text-sm font-black text-gray-900">
                    {(metrics.confusion_matrix?.true_positives || 0) + 
                     (metrics.confusion_matrix?.false_positives || 0) + 
                     (metrics.confusion_matrix?.true_negatives || 0) + 
                     (metrics.confusion_matrix?.false_negatives || 0)} pares
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Información de guardado */}
        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-700">Último entrenamiento</p>

            </div>
            <p className="text-sm font-black" style={{ color: '#05A8F9' }}>
              {(() => {
                if (!metrics.save_timestamp) return 'No disponible'
                const date = new Date(metrics.save_timestamp)
                return date.toLocaleString('es-ES', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              })()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================
   COMPONENTE: DYNAMIC NETWORK PANEL
======================================== */
function DynamicNetworkPanel({ metrics }) {
  if (!metrics) {
    return (
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-12"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="text-center max-w-md mx-auto">
          <Activity className="w-16 h-16 mx-auto mb-4" style={{ color: '#E0F2FE' }} />
          <h3 className="text-lg font-black text-gray-900 mb-2">
            Red dinámica no disponible
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            La red dinámica aún no ha sido entrenada. Realiza un entrenamiento 
            para ver las métricas aquí.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* ========================================
          MÉTRICAS BIOMÉTRICAS PRINCIPALES
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Métricas biométricas
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* FAR */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-red-700">
              FAR
            </p>
            <p className="text-3xl font-black text-red-900">
              {((metrics.metrics?.far || 0) * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-red-600 mt-2 font-medium">
              False Accept Rate
            </p>
          </div>

          {/* FRR */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              FRR
            </p>
            <p className="text-3xl font-black text-orange-900">
              {((metrics.metrics?.frr || 0) * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-orange-600 mt-2 font-medium">
              False Reject Rate
            </p>
          </div>

          {/* EER */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              EER
            </p>
            <p className="text-3xl font-black text-purple-900">
              {((metrics.metrics?.eer || 0) * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-purple-600 mt-2 font-medium">
              Equal Error Rate
            </p>
          </div>

          {/* AUC */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              AUC
            </p>
            <p className="text-3xl font-black text-green-900">
              {(metrics.metrics?.auc_score || 0).toFixed(3)}
            </p>
            <p className="text-xs text-green-600 mt-2 font-medium">
              ROC Area
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          MÉTRICAS TEMPORALES ESPECÍFICAS
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Métricas temporales (características dinámicas)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Sequence Correlation */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
              Correlación de secuencia
            </p>
            <p className="text-3xl font-black text-blue-900">
              {((metrics.metrics?.sequence_correlation || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-blue-600 mt-2 font-medium">
              Similitud entre secuencias genuinas
            </p>
          </div>

          {/* Temporal Consistency */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              Consistencia temporal
            </p>
            <p className="text-3xl font-black text-purple-900">
              {((metrics.metrics?.temporal_consistency || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600 mt-2 font-medium">
              Separación entre clases
            </p>
          </div>

          {/* Rhythm Similarity */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              Similitud de ritmo
            </p>
            <p className="text-3xl font-black text-green-900">
              {((metrics.metrics?.rhythm_similarity || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-green-600 mt-2 font-medium">
              Patrones de velocidad similares
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          MÉTRICAS DE MACHINE LEARNING
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Métricas de clasificación
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Accuracy */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
              Accuracy
            </p>
            <p className="text-3xl font-black text-blue-900">
              {((metrics.metrics?.accuracy || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-blue-600 mt-2 font-medium">
              Precisión global
            </p>
          </div>

          {/* Precision */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              Precision
            </p>
            <p className="text-3xl font-black text-green-900">
              {((metrics.metrics?.precision || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-green-600 mt-2 font-medium">
              Aceptaciones correctas
            </p>
          </div>

          {/* Recall */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              Recall
            </p>
            <p className="text-3xl font-black text-purple-900">
              {((metrics.metrics?.recall || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600 mt-2 font-medium">
              Usuarios detectados
            </p>
          </div>

          {/* F1 Score */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-indigo-700">
              F1 Score
            </p>
            <p className="text-3xl font-black text-indigo-900">
              {((metrics.metrics?.f1_score || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-indigo-600 mt-2 font-medium">
              Balance P/R
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          MATRIZ DE CONFUSIÓN
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Matriz de confusión
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {/* Verdaderos Positivos (TP) */}
          <div 
            className="p-6 rounded-xl border-2"
            style={{ 
              backgroundColor: '#F0FDF4',
              borderColor: '#86EFAC'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <span className="text-4xl font-black text-green-900">
                {metrics.confusion_matrix?.true_positives || 0}
              </span>
            </div>
            <h4 className="font-black text-sm mb-1 text-green-800">
              Verdaderos Positivos (VP)
            </h4>
            <p className="text-xs text-green-700">
              Secuencias genuinas correctamente autenticadas
            </p>
          </div>

          {/* Falsos Positivos (FP) */}
          <div 
            className="p-6 rounded-xl border-2"
            style={{ 
              backgroundColor: '#FEF2F2',
              borderColor: '#FCA5A5'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <span className="text-4xl font-black text-red-900">
                {metrics.confusion_matrix?.false_positives || 0}
              </span>
            </div>
            <h4 className="font-black text-sm mb-1 text-red-800">
              Falsos Positivos (FP)
            </h4>
            <p className="text-xs text-red-700">
              Secuencias impostoras incorrectamente autenticadas
            </p>
          </div>

          {/* Falsos Negativos (FN) */}
          <div 
            className="p-6 rounded-xl border-2"
            style={{ 
              backgroundColor: '#FFFBEB',
              borderColor: '#FCD34D'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-8 h-8 text-orange-600" />
              <span className="text-4xl font-black text-orange-900">
                {metrics.confusion_matrix?.false_negatives || 0}
              </span>
            </div>
            <h4 className="font-black text-sm mb-1 text-orange-800">
              Falsos Negativos (FN)
            </h4>
            <p className="text-xs text-orange-700">
              Secuencias genuinas incorrectamente rechazadas
            </p>
          </div>

          {/* Verdaderos Negativos (TN) */}
          <div 
            className="p-6 rounded-xl border-2"
            style={{ 
              backgroundColor: '#EFF6FF',
              borderColor: '#BFDBFE'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-8 h-8 text-blue-600" />
              <span className="text-4xl font-black text-blue-900">
                {metrics.confusion_matrix?.true_negatives || 0}
              </span>
            </div>
            <h4 className="font-black text-sm mb-1 text-blue-800">
              Verdaderos Negativos (VN)
            </h4>
            <p className="text-xs text-blue-700">
              Secuencias impostoras correctamente rechazadas
            </p>
          </div>
        </div>

        {/* Total de evaluaciones */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Total de evaluaciones: <span className="font-black">
              {(metrics.confusion_matrix?.true_positives || 0) + 
               (metrics.confusion_matrix?.false_positives || 0) + 
               (metrics.confusion_matrix?.true_negatives || 0) + 
               (metrics.confusion_matrix?.false_negatives || 0)}
            </span>
          </p>
        </div>
      </div>
      
      {/* ========================================
          CURVA ROC
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Curva ROC (Receiver Operating Characteristic)
          </h3>
        </div>

        {/* <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={(() => {
              const fpr = metrics.roc_curve?.fpr || []
              const tpr = metrics.roc_curve?.tpr || []
              
              return fpr.map((fp, idx) => ({
                fpr: (fp * 100).toFixed(2),
                tpr: (tpr[idx] * 100).toFixed(2),
                random: (fp * 100).toFixed(2)
              }))
            })()}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="fpr" 
              label={{ value: 'False Positive Rate (%)', position: 'insideBottom', offset: -5, style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <YAxis 
              label={{ value: 'True Positive Rate (%)', angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '2px solid #05A8F9',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => `${value}%`}
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
              name={`ROC (AUC=${(metrics.metrics?.auc_score || 0).toFixed(3)})`}
              dot={{ fill: '#05A8F9', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer> */}

        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={(() => {
              const fpr = metrics.roc_curve?.fpr || []
              const tpr = metrics.roc_curve?.tpr || []
              
              return fpr.map((fp, idx) => ({
                fpr: fp * 100,
                tpr: tpr[idx] * 100,
                random: fp * 100
              }))
            })()}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="fpr" 
              label={{ value: 'False Positive Rate (%)', position: 'insideBottom', offset: -5, style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
              domain={[0, 100]}
              type="number"
              ticks={[0, 20, 40, 60, 80, 100]}
            />
            <YAxis 
              label={{ value: 'True Positive Rate (%)', angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '2px solid #05A8F9',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => `${value.toFixed(2)}%`}
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
              name={`ROC (AUC=${(metrics.metrics?.auc_score || 0).toFixed(3)})`}
              // dot={{ fill: '#05A8F9', r: 4 }}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
          <p className="text-sm font-bold text-gray-700">
            AUC Score: <span className="text-2xl" style={{ color: '#05A8F9' }}>
              {(metrics.metrics?.auc_score || 0).toFixed(3)}
            </span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Área bajo la curva ROC (1.0 = perfecto, 0.5 = aleatorio)
          </p>
        </div>
      </div>
      

      {/* ========================================
          DISTRIBUCIÓN DE SCORES
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Distribución de scores de similitud temporal
          </h3>
        </div>

        {(() => {
          const genuineScores = metrics.score_distributions?.genuine_scores || []
          const impostorScores = metrics.score_distributions?.impostor_scores || []
          const threshold = metrics.metrics?.threshold || 0.5

          // Calcular estadísticas
          const genuineStats = {
            min: genuineScores.length > 0 ? Math.min(...genuineScores) : 0,
            max: genuineScores.length > 0 ? Math.max(...genuineScores) : 0,
            mean: genuineScores.length > 0 
              ? genuineScores.reduce((a, b) => a + b, 0) / genuineScores.length 
              : 0
          }

          const impostorStats = {
            min: impostorScores.length > 0 ? Math.min(...impostorScores) : 0,
            max: impostorScores.length > 0 ? Math.max(...impostorScores) : 0,
            mean: impostorScores.length > 0 
              ? impostorScores.reduce((a, b) => a + b, 0) / impostorScores.length 
              : 0
          }

          const separation = genuineStats.min - impostorStats.max

          return (
            <>
              {/* Visualización conceptual */}
              <div className="mb-6">
                <div className="relative h-32 bg-gray-50 rounded-xl p-4">
                  
                  {/* Región impostores */}
                  <div 
                    className="absolute top-4 h-24 bg-red-200 rounded-lg opacity-60"
                    style={{
                      left: `${impostorStats.min * 100}%`,
                      width: `${(impostorStats.max - impostorStats.min) * 100}%`
                    }}
                  />
                  
                  {/* Región genuinos */}
                  <div 
                    className="absolute top-4 h-24 bg-green-200 rounded-lg opacity-60"
                    style={{
                      left: `${genuineStats.min * 100}%`,
                      width: `${(genuineStats.max - genuineStats.min) * 100}%`
                    }}
                  />
                  
                  {/* Línea de threshold */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-purple-600"
                    style={{ left: `${threshold * 100}%` }}
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap">
                      Threshold: {threshold.toFixed(3)}
                    </div>
                  </div>

                  {/* Etiquetas */}
                  <div className="absolute bottom-1 left-0 text-xs font-bold text-red-700">
                    Impostores
                  </div>
                  <div className="absolute bottom-1 right-0 text-xs font-bold text-green-700">
                    Genuinos
                  </div>
                </div>

                {/* Escala */}
                <div className="flex justify-between mt-2 text-xs text-gray-600 font-mono">
                  <span>0.0</span>
                  <span>0.2</span>
                  <span>0.4</span>
                  <span>0.6</span>
                  <span>0.8</span>
                  <span>1.0</span>
                </div>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Stats Impostores */}
                <div 
                  className="p-4 rounded-xl border-2"
                  style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
                >
                  <h4 className="text-sm font-black text-red-800 mb-3">
                    Impostores ({impostorScores.length})
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-red-700">Min:</span>
                      <span className="font-black text-red-900">{impostorStats.min.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-700">Max:</span>
                      <span className="font-black text-red-900">{impostorStats.max.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-700">Media:</span>
                      <span className="font-black text-red-900">{impostorStats.mean.toFixed(4)}</span>
                    </div>
                  </div>
                </div>

                {/* Separación */}
                <div 
                  className="p-4 rounded-xl border-2"
                  style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
                >
                  <h4 className="text-sm font-black text-purple-800 mb-3">
                    Separación
                  </h4>
                  <div className="text-center">
                    <p className="text-4xl font-black text-purple-900">
                      {separation.toFixed(3)}
                    </p>
                    <p className="text-xs text-purple-700 mt-2">
                      Gap entre clases
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {(separation * 100).toFixed(1)}% de separación
                    </p>
                  </div>
                </div>

                {/* Stats Genuinos */}
                <div 
                  className="p-4 rounded-xl border-2"
                  style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
                >
                  <h4 className="text-sm font-black text-green-800 mb-3">
                    Genuinos ({genuineScores.length})
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-green-700">Min:</span>
                      <span className="font-black text-green-900">{genuineStats.min.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Max:</span>
                      <span className="font-black text-green-900">{genuineStats.max.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Media:</span>
                      <span className="font-black text-green-900">{genuineStats.mean.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )
        })()}
      </div>

      {/* ========================================
          CURVA DE ENTRENAMIENTO (LOSS)
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingDown className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Evolución de la pérdida durante entrenamiento
          </h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={(() => {
              const loss = metrics.training_history?.loss || []
              const valLoss = metrics.training_history?.val_loss || []
              const epochs = metrics.training_history?.epochs || []
              
              return epochs.map((epoch, idx) => ({
                epoch: epoch,
                trainLoss: loss[idx],
                valLoss: valLoss[idx]
              }))
            })()}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="epoch" 
              label={{ value: 'Época', position: 'insideBottom', offset: -5, style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <YAxis 
              label={{ value: 'Pérdida (Loss)', angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '2px solid #05A8F9',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => value.toFixed(4)}
            />
            <Legend />
            
            {/* Train Loss */}
            <Line 
              type="monotone" 
              dataKey="trainLoss" 
              stroke="#3B82F6" 
              strokeWidth={2}
              name="Train Loss"
              dot={false}
            />
            
            {/* Validation Loss */}
            <Line 
              type="monotone" 
              dataKey="valLoss" 
              stroke="#F59E0B" 
              strokeWidth={2}
              name="Validation Loss"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
              Loss inicial
            </p>
            <p className="text-2xl font-black text-blue-900">
              {(metrics.training_history?.loss?.[0] || 0).toFixed(4)}
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              Loss final
            </p>
            <p className="text-2xl font-black text-green-900">
              {(metrics.training_history?.loss?.[metrics.training_history?.loss?.length - 1] || 0).toFixed(4)}
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              Épocas totales
            </p>
            <p className="text-2xl font-black text-purple-900">
              {metrics.training_history?.epochs?.length || 0}
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              Reducción
            </p>
            <p className="text-2xl font-black text-orange-900">
              {(() => {
                const initial = metrics.training_history?.loss?.[0] || 0
                const final = metrics.training_history?.loss?.[metrics.training_history?.loss?.length - 1] || 0
                const reduction = ((initial - final) / initial * 100)
                return reduction.toFixed(1)
              })()}%
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          EVOLUCIÓN FAR/FRR
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Evolución de tasas de error biométrico
          </h3>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={(() => {
              const farHistory = metrics.training_history?.far_history || []
              const frrHistory = metrics.training_history?.frr_history || []
              const epochs = metrics.training_history?.epochs || []
              
              return epochs.map((epoch, idx) => ({
                epoch: epoch,
                FAR: (farHistory[idx] * 100),
                FRR: (frrHistory[idx] * 100)
              }))
            })()}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="epoch" 
              label={{ value: 'Época', position: 'insideBottom', offset: -5, style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <YAxis 
              label={{ value: 'Tasa de Error (%)', angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }}
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '2px solid #05A8F9',
                borderRadius: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => `${value.toFixed(2)}%`}
            />
            <Legend />
            
            {/* FAR */}
            <Line 
              type="monotone" 
              dataKey="FAR" 
              stroke="#EF4444" 
              strokeWidth={2}
              name="FAR (False Accept Rate)"
              dot={false}
            />
            
            {/* FRR */}
            <Line 
              type="monotone" 
              dataKey="FRR" 
              stroke="#F59E0B" 
              strokeWidth={2}
              name="FRR (False Reject Rate)"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Hitos importantes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-red-700">
              FAR inicial
            </p>
            <p className="text-2xl font-black text-red-900">
              {((metrics.training_history?.far_history?.[0] || 0) * 100).toFixed(2)}%
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              FAR final
            </p>
            <p className="text-2xl font-black text-green-900">
              {((metrics.training_history?.far_history?.[metrics.training_history?.far_history?.length - 1] || 0) * 100).toFixed(2)}%
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              FRR inicial
            </p>
            <p className="text-2xl font-black text-orange-900">
              {((metrics.training_history?.frr_history?.[0] || 0) * 100).toFixed(2)}%
            </p>
          </div>

          <div 
            className="p-4 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              FRR final
            </p>
            <p className="text-2xl font-black text-green-900">
              {((metrics.training_history?.frr_history?.[metrics.training_history?.frr_history?.length - 1] || 0) * 100).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Análisis de convergencia */}
        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
          <p className="text-sm font-bold text-gray-700">
            Primera época con FAR = 0%: <span className="text-lg" style={{ color: '#05A8F9' }}>
              {(() => {
                const farHistory = metrics.training_history?.far_history || []
                const firstZeroIdx = farHistory.findIndex(val => val === 0)
                return firstZeroIdx !== -1 ? `Época ${firstZeroIdx + 1}` : 'No alcanzado'
              })()}
            </span>
          </p>
          <p className="text-sm font-bold text-gray-700 mt-2">
            Primera época con FRR = 0%: <span className="text-lg" style={{ color: '#05A8F9' }}>
              {(() => {
                const frrHistory = metrics.training_history?.frr_history || []
                const firstZeroIdx = frrHistory.findIndex(val => val === 0)
                return firstZeroIdx !== -1 ? `Época ${firstZeroIdx + 1}` : 'No alcanzado'
              })()}
            </span>
          </p>
        </div>
      </div>

      {/* ========================================
          CONFIGURACIÓN Y ARQUITECTURA
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Network className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Arquitectura y configuración del modelo temporal
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Arquitectura */}
          <div>
            <h4 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-wide">
              Arquitectura de la red
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Dimensión de features</span>
                <span className="text-sm font-black text-gray-900">{metrics.feature_dim || 320}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Longitud de secuencia</span>
                <span className="text-sm font-black text-gray-900">{metrics.sequence_length || 50} frames</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Unidades LSTM</span>
                <span className="text-sm font-black text-gray-900">
                  [{(metrics.config?.lstm_units || []).join(', ')}]
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Capas densas</span>
                <span className="text-sm font-black text-gray-900">
                  [{(metrics.config?.dense_layers || []).join(', ')}]
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Dimensión de embedding</span>
                <span className="text-sm font-black text-gray-900">{metrics.embedding_dim || 128}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Procesamiento</span>
                <span className="text-sm font-black text-gray-900">
                  {metrics.config?.sequence_processing || 'Bidirectional LSTM'}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Temporal Pooling</span>
                <span className="text-sm font-black text-gray-900">
                  {metrics.config?.temporal_pooling || 'Attention'}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Dropout</span>
                <span className="text-sm font-black text-gray-900">
                  {((metrics.config?.dropout_rate || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Recurrent Dropout</span>
                <span className="text-sm font-black text-gray-900">
                  {((metrics.config?.recurrent_dropout || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Entrenamiento */}
          <div>
            <h4 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-wide">
              Configuración de entrenamiento
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Learning Rate</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.learning_rate || 0.0005}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Batch Size</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.batch_size || 32}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Épocas configuradas</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.epochs || 100}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Early Stopping Patience</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.early_stopping_patience || 10} épocas</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Reduce LR Patience</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.reduce_lr_patience || 8} épocas</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Min Learning Rate</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.min_lr || 1e-6}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Función de pérdida</span>
                <span className="text-sm font-black text-gray-900">
                  {metrics.config?.loss_function || 'Contrastive'}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Margen (Contrastive)</span>
                <span className="text-sm font-black text-gray-900">{metrics.config?.margin || 0.8}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <span className="text-sm font-medium text-gray-600">Métrica de distancia</span>
                <span className="text-sm font-black text-gray-900">
                  {metrics.config?.distance_metric || 'Euclidean'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Threshold óptimo */}
        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-700">Threshold óptimo de decisión</p>
              <p className="text-xs text-gray-600 mt-1">
                Punto de corte para clasificación genuino/impostor en secuencias temporales
              </p>
            </div>
            <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
              {(metrics.optimal_threshold || metrics.metrics?.threshold || 0).toFixed(4)}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================
          ESTADÍSTICAS DEL DATASET
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Estadísticas del dataset
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Usuarios */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
              Usuarios
            </p>
            <p className="text-4xl font-black text-blue-900">
              {metrics.users_trained_count || 0}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Entrenados
            </p>
          </div>

          {/* Muestras totales */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              Pares de entrenamiento
            </p>
            <p className="text-4xl font-black text-green-900">
              {metrics.training_samples || 0}
            </p>
            <p className="text-xs text-green-600 mt-2">
              Genuinos + Impostores
            </p>
          </div>

          {/* Pares genuinos (de evaluación porque no hay total_genuine_pairs) */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              Pares genuinos
            </p>
            <p className="text-4xl font-black text-purple-900">
              {(() => {
                const scores = metrics.score_distributions?.genuine_scores || []
                return scores.length
              })()}
            </p>
            <p className="text-xs text-purple-600 mt-2">
              Para entrenamiento
            </p>
          </div>

          {/* Pares impostores (de evaluación porque no hay total_impostor_pairs) */}
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              Pares impostores
            </p>
            <p className="text-4xl font-black text-orange-900">
              {(() => {
                const scores = metrics.score_distributions?.impostor_scores || []
                return scores.length
              })()}
            </p>
            <p className="text-xs text-orange-600 mt-2">
              Para entrenamiento
            </p>
          </div>
        </div>

        {/* Distribución detallada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Dataset de entrenamiento */}
          <div 
            className="p-5 rounded-xl"
            style={{ backgroundColor: '#F9FAFB', border: '2px solid #E5E7EB' }}
          >
            <h4 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-wide">
              Dataset de entrenamiento
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pares genuinos:</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${(() => {
                        const genuine = metrics.score_distributions?.genuine_scores?.length || 0
                        const impostor = metrics.score_distributions?.impostor_scores?.length || 0
                        const total = genuine + impostor || 1
                        return (genuine / total) * 100
                      })()}px`,
                      backgroundColor: '#10B981',
                      maxWidth: '100px'
                    }}
                  />
                  <span className="text-sm font-black text-gray-900">
                    {metrics.score_distributions?.genuine_scores?.length || 0}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pares impostores:</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${(() => {
                        const genuine = metrics.score_distributions?.genuine_scores?.length || 0
                        const impostor = metrics.score_distributions?.impostor_scores?.length || 0
                        const total = genuine + impostor || 1
                        return (impostor / total) * 100
                      })()}px`,
                      backgroundColor: '#EF4444',
                      maxWidth: '100px'
                    }}
                  />
                  <span className="text-sm font-black text-gray-900">
                    {metrics.score_distributions?.impostor_scores?.length || 0}
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t-2 border-gray-200">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-gray-700">Total:</span>
                  <span className="text-sm font-black text-gray-900">
                    {(metrics.score_distributions?.genuine_scores?.length || 0) + 
                     (metrics.score_distributions?.impostor_scores?.length || 0)} pares
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dataset de evaluación */}
          <div 
            className="p-5 rounded-xl"
            style={{ backgroundColor: '#F9FAFB', border: '2px solid #E5E7EB' }}
          >
            <h4 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-wide">
              Dataset de evaluación (Test)
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pares genuinos:</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${(() => {
                        const tp = metrics.confusion_matrix?.true_positives || 0
                        const fp = metrics.confusion_matrix?.false_positives || 0
                        const tn = metrics.confusion_matrix?.true_negatives || 0
                        const fn = metrics.confusion_matrix?.false_negatives || 0
                        const total = tp + fp + tn + fn || 1
                        const genuine = tp + fn
                        return (genuine / total) * 100
                      })()}px`,
                      backgroundColor: '#10B981',
                      maxWidth: '100px'
                    }}
                  />
                  <span className="text-sm font-black text-gray-900">
                    {(metrics.confusion_matrix?.true_positives || 0) + (metrics.confusion_matrix?.false_negatives || 0)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pares impostores:</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${(() => {
                        const tp = metrics.confusion_matrix?.true_positives || 0
                        const fp = metrics.confusion_matrix?.false_positives || 0
                        const tn = metrics.confusion_matrix?.true_negatives || 0
                        const fn = metrics.confusion_matrix?.false_negatives || 0
                        const total = tp + fp + tn + fn || 1
                        const impostor = tn + fp
                        return (impostor / total) * 100
                      })()}px`,
                      backgroundColor: '#EF4444',
                      maxWidth: '100px'
                    }}
                  />
                  <span className="text-sm font-black text-gray-900">
                    {(metrics.confusion_matrix?.true_negatives || 0) + (metrics.confusion_matrix?.false_positives || 0)}
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t-2 border-gray-200">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-gray-700">Total:</span>
                  <span className="text-sm font-black text-gray-900">
                    {(metrics.confusion_matrix?.true_positives || 0) + 
                     (metrics.confusion_matrix?.false_positives || 0) + 
                     (metrics.confusion_matrix?.true_negatives || 0) + 
                     (metrics.confusion_matrix?.false_negatives || 0)} pares
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Información de guardado */}
        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#F0F9FF' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-700">Último entrenamiento</p>

            </div>
            <p className="text-sm font-black" style={{ color: '#05A8F9' }}>
              {(() => {
                if (!metrics.save_timestamp) return 'No disponible'
                const date = new Date(metrics.save_timestamp)
                return date.toLocaleString('es-ES', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              })()}
            </p>
          </div>
        </div>
      </div>
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
            Matriz de confusión
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
            Métricas de rendimiento
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
            Tasas de error biométrico
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

      {/* ========================================
          TASA DE RESPUESTA
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <CheckCircle className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Tasa de respuesta de feedback
          </h3>
        </div>

        {(() => {
          const totalAttempts = metrics.total_attempts || 0
          const totalWithFeedback = metrics.total_samples || 0
          const responseRate = totalAttempts > 0 
            ? (totalWithFeedback / totalAttempts * 100) 
            : 0

          return (
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">
                  Usuarios que respondieron el correo de feedback
                </p>
                <p className="text-5xl font-black" style={{ color: '#05A8F9' }}>
                  {responseRate.toFixed(1)}%
                </p>
                <p className="text-sm font-bold text-gray-700 mt-3">
                  {totalWithFeedback} de {totalAttempts} autenticaciones
                </p>
              </div>

              {/* Indicador visual */}
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Círculo de fondo */}
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#E5E7EB"
                    strokeWidth="12"
                    fill="none"
                  />
                  {/* Círculo de progreso */}
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#05A8F9"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - responseRate / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-black" style={{ color: '#05A8F9' }}>
                    {responseRate.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          )
        })()}


      </div>
    </div>
  )
}