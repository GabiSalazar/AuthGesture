import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  TrendingUp,
  Filter,
  Download,
  Search,
  X,
  Eye,
  CheckCircle,
  XCircle,
  Users,
  Activity
} from 'lucide-react'
import { adminApi } from '../../../lib/api/admin'

export default function AuthenticationLogs() {
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState([])
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])

  // Estados de filtros
  const [filters, setFilters] = useState({
    user_id: '',
    auth_type: 'all',
    result: 'all',
    date_from: '',
    date_to: '',
    min_confidence: 0,
    search: ''
  })

  const [showFilters, setShowFilters] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [verificationData, identificationData, statsData, usersData] = await Promise.all([
        adminApi.getAllAuthAttempts(),
        adminApi.getAllIdentificationAttempts(),
        adminApi.getAuthStats(),
        adminApi.getUsers()
      ])

      const allAttempts = [
        ...(verificationData.attempts || []),
        ...(identificationData.attempts || [])
      ]

      allAttempts.sort((a, b) => b.timestamp - a.timestamp)

      setAttempts(allAttempts)
      setStats(statsData)
      setUsers(usersData.users || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
      alert('Error al cargar datos de autenticación')
    } finally {
      setLoading(false)
    }
  }

  // Aplicar filtros
  const filteredAttempts = attempts.filter(attempt => {
    if (filters.user_id && attempt.user_id !== filters.user_id) return false
    if (filters.auth_type !== 'all' && attempt.auth_type !== filters.auth_type) return false
    if (filters.result !== 'all' && attempt.result !== filters.result) return false
    if (attempt.confidence < filters.min_confidence / 100) return false

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchUser = attempt.user_id?.toLowerCase().includes(searchLower)
      const matchIP = attempt.ip_address?.toLowerCase().includes(searchLower)
      const matchDevice = attempt.device_info?.toLowerCase().includes(searchLower)
      if (!matchUser && !matchIP && !matchDevice) return false
    }

    if (filters.date_from) {
      const attemptDate = new Date(attempt.timestamp * 1000)
      const fromDate = new Date(filters.date_from)
      if (attemptDate < fromDate) return false
    }

    if (filters.date_to) {
      const attemptDate = new Date(attempt.timestamp * 1000)
      const toDate = new Date(filters.date_to)
      toDate.setHours(23, 59, 59)
      if (attemptDate > toDate) return false
    }

    return true
  })

  // Paginación
  const totalPages = Math.ceil(filteredAttempts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedAttempts = filteredAttempts.slice(startIndex, startIndex + itemsPerPage)

  const resetFilters = () => {
    setFilters({
      user_id: '',
      auth_type: 'all',
      result: 'all',
      date_from: '',
      date_to: '',
      min_confidence: 0,
      search: ''
    })
    setCurrentPage(1)
  }

  const exportToCSV = () => {
    const headers = [
      'Fecha',
      'Usuario',
      'Tipo',
      'Resultado',
      'Confidence',
      'Score Anatómico',
      'Score Dinámico',
      'Score Fusionado',
      'Gestos',
      'Duración',
      'Frames',
      'IP',
      'Device',
      'Razón de Fallo'
    ]

    const rows = filteredAttempts.map(attempt => [
      formatDate(attempt.timestamp),
      attempt.user_id,
      attempt.auth_type,
      attempt.result,
      (attempt.confidence * 100).toFixed(2) + '%',
      (attempt.anatomical_score * 100).toFixed(2) + '%',
      (attempt.dynamic_score * 100).toFixed(2) + '%',
      (attempt.fused_score * 100).toFixed(2) + '%',
      attempt.metadata?.gestures_captured?.join(' → ') || 'N/A',
      attempt.metadata?.duration ? `${attempt.metadata.duration.toFixed(2)}s` : 'N/A',
      attempt.metadata?.frames_processed || 'N/A',
      attempt.ip_address || 'N/A',
      attempt.device_info || 'N/A',
      attempt.failure_reason || 'N/A'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `authentication_logs_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getConfidenceBadge = (confidence) => {
    const percent = (confidence * 100).toFixed(1)
    const styles = confidence >= 0.9 
      ? { bg: '#F0FDF4', color: '#065F46' }
      : confidence >= 0.7 
        ? { bg: '#FFFBEB', color: '#92400E' }
        : { bg: '#FEF2F2', color: '#991B1B' }
    
    return (
      <span 
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
        style={{ backgroundColor: styles.bg, color: styles.color }}
      >
        {percent}%
      </span>
    )
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
            Cargando registros de autenticación...
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            Registros de Autenticación
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Historial completo de intentos de autenticación del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition-all duration-300 border-2 text-sm"
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
            <Filter className="w-4 h-4" />
            {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 text-sm"
            style={{
              background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
              boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
            }}
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* ========================================
          ESTADÍSTICAS
      ======================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Intentos */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Total Intentos
              </p>
              <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
                {stats?.total_attempts || attempts.length}
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#F4FCFF' }}
            >
              <Activity className="w-7 h-7" style={{ color: '#05A8F9' }} />
            </div>
          </div>
        </div>

        {/* Exitosos */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#86EFAC' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Exitosos
              </p>
              <p className="text-3xl font-black text-green-600">
                {stats?.successful_attempts || attempts.filter(a => a.result === 'success').length}
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#F0FDF4' }}
            >
              <ShieldCheck className="w-7 h-7 text-green-600" />
            </div>
          </div>
        </div>

        {/* Fallidos */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#FCA5A5' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Fallidos
              </p>
              <p className="text-3xl font-black text-red-600">
                {stats?.failed_attempts || attempts.filter(a => a.result === 'failed').length}
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#FEF2F2' }}
            >
              <ShieldAlert className="w-7 h-7 text-red-600" />
            </div>
          </div>
        </div>

        {/* Tasa de Éxito */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Tasa de Éxito
              </p>
              <p className="text-3xl font-black" style={{ color: '#05A8F9' }}>
                {stats?.success_rate 
                  ? `${(stats.success_rate * 100).toFixed(1)}%`
                  : attempts.length > 0
                    ? `${((attempts.filter(a => a.result === 'success').length / attempts.length) * 100).toFixed(1)}%`
                    : '0%'
                }
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#F4FCFF' }}
            >
              <TrendingUp className="w-7 h-7" style={{ color: '#05A8F9' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          PANEL DE FILTROS
      ======================================== */}
      {showFilters && (
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-gray-900">Filtros Avanzados</h3>
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                Limpiar Filtros
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Búsqueda general */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Usuario, IP, Device..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
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

              {/* Filtro por usuario */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Usuario
                </label>
                <select
                  value={filters.user_id}
                  onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
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
                  <option value="">Todos los usuarios</option>
                  {users.map(user => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.user_id} ({user.username || 'Sin nombre'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por tipo */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Tipo de Autenticación
                </label>
                <select
                  value={filters.auth_type}
                  onChange={(e) => setFilters({ ...filters, auth_type: e.target.value })}
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
                  <option value="all">Todos</option>
                  <option value="verification">Verificación (1:1)</option>
                  <option value="identification">Identificación (1:N)</option>
                </select>
              </div>

              {/* Filtro por resultado */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Estado
                </label>
                <select
                  value={filters.result}
                  onChange={(e) => setFilters({ ...filters, result: e.target.value })}
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
                  <option value="all">Todos</option>
                  <option value="success">Exitosos</option>
                  <option value="failed">Fallidos</option>
                </select>
              </div>

              {/* Fecha desde */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
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

              {/* Fecha hasta */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
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

              {/* Confidence mínima */}
              <div className="space-y-2 md:col-span-2 lg:col-span-1">
                <label className="block text-sm font-bold text-gray-700">
                  Confidence Mínima: <span style={{ color: '#05A8F9' }}>{filters.min_confidence}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.min_confidence}
                  onChange={(e) => setFilters({ ...filters, min_confidence: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #00B8D4 0%, #00B8D4 ${filters.min_confidence}%, #E0F2FE ${filters.min_confidence}%, #E0F2FE 100%)`
                  }}
                />
              </div>
            </div>

            {/* Resumen de filtros activos */}
            {(filters.user_id || filters.auth_type !== 'all' || filters.result !== 'all' || 
              filters.date_from || filters.date_to || filters.min_confidence > 0 || filters.search) && (
              <div className="pt-4 border-t-2" style={{ borderColor: '#E0F2FE' }}>
                <p className="text-sm text-gray-600">
                  Mostrando <span className="font-black" style={{ color: '#05A8F9' }}>{filteredAttempts.length}</span> de{' '}
                  <span className="font-black text-gray-900">{attempts.length}</span> intentos
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================
          TABLA DE INTENTOS
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg overflow-hidden"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="p-6">
          {paginatedAttempts.length === 0 ? (
            <div className="text-center py-12">
              <ShieldAlert className="w-16 h-16 mx-auto mb-4" style={{ color: '#E0F2FE' }} />
              <p className="text-gray-600 font-medium mb-4">
                No se encontraron intentos de autenticación
              </p>
              {(filters.user_id || filters.auth_type !== 'all' || filters.result !== 'all') && (
                <button
                  onClick={resetFilters}
                  className="px-5 py-2.5 font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
                  style={{
                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                    color: 'white'
                  }}
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr 
                      className="border-b-2"
                      style={{ borderColor: '#E0F2FE' }}
                    >
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Fecha y Hora
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Usuario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Confidence
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Scores
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Gestos
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Duración
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        IP
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAttempts.map((attempt, idx) => (
                      <tr 
                        key={attempt.attempt_id || idx}
                        className={`border-b transition-colors hover:bg-gray-50 ${
                          idx === paginatedAttempts.length - 1 ? 'border-b-0' : ''
                        }`}
                        style={{ 
                          borderColor: idx === paginatedAttempts.length - 1 ? 'transparent' : '#F3F4F6'
                        }}
                      >
                        {/* Fecha */}
                        <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                          {formatDate(attempt.timestamp)}
                        </td>

                        {/* Usuario */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="font-bold text-gray-900 text-sm">
                              {attempt.user_id}
                            </span>
                          </div>
                        </td>

                        {/* Tipo */}
                        <td className="px-4 py-3">
                          {attempt.auth_type === 'verification' ? (
                            <span 
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                              style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
                            >
                              Verificación
                            </span>
                          ) : (
                            <span 
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                              style={{ backgroundColor: '#ECFEFF', color: '#0E7490' }}
                            >
                              Identificación
                            </span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3">
                          {attempt.result === 'success' ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span 
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                                style={{ backgroundColor: '#F0FDF4', color: '#065F46' }}
                              >
                                Exitoso
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span 
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                                style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
                              >
                                Fallido
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Confidence */}
                        <td className="px-4 py-3">
                          {getConfidenceBadge(attempt.confidence)}
                        </td>

                        {/* Scores */}
                        <td className="px-4 py-3">
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-medium">A:</span>
                              <span className="font-bold">{(attempt.anatomical_score * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-medium">D:</span>
                              <span className="font-bold">{(attempt.dynamic_score * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-medium">F:</span>
                              <span className="font-black" style={{ color: '#05A8F9' }}>
                                {(attempt.fused_score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Gestos */}
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-600 max-w-[150px] truncate font-medium">
                            {attempt.metadata?.gestures_captured?.join(' → ') || 'N/A'}
                          </div>
                        </td>

                        {/* Duración */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Clock className="w-3 h-3" />
                            <span className="font-medium">
                              {attempt.metadata?.duration 
                                ? `${attempt.metadata.duration.toFixed(2)}s`
                                : 'N/A'
                              }
                            </span>
                          </div>
                        </td>

                        {/* IP */}
                        <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                          {attempt.ip_address || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ========================================
                  PAGINACIÓN
              ======================================== */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-6 border-t-2 gap-4" style={{ borderColor: '#E0F2FE' }}>
                  <p className="text-sm text-gray-600">
                    Mostrando <span className="font-black">{startIndex + 1}</span> -{' '}
                    <span className="font-black">{Math.min(startIndex + itemsPerPage, filteredAttempts.length)}</span> de{' '}
                    <span className="font-black">{filteredAttempts.length}</span> resultados
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 font-bold rounded-xl transition-all duration-300 border-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: 'white',
                        borderColor: '#E0F2FE',
                        color: '#05A8F9'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.backgroundColor = '#F4FCFF'
                          e.currentTarget.style.borderColor = '#6FBFDE'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white'
                        e.currentTarget.style.borderColor = '#E0F2FE'
                      }}
                    >
                      Anterior
                    </button>
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const pageNum = i + 1
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className="px-3 py-1.5 rounded-lg text-sm font-black transition-all duration-200"
                            style={
                              currentPage === pageNum
                                ? { 
                                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                                    color: 'white'
                                  }
                                : { 
                                    backgroundColor: '#F3F4F6',
                                    color: '#374151'
                                  }
                            }
                            onMouseEnter={(e) => {
                              if (currentPage !== pageNum) {
                                e.currentTarget.style.backgroundColor = '#E5E7EB'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (currentPage !== pageNum) {
                                e.currentTarget.style.backgroundColor = '#F3F4F6'
                              }
                            }}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                      {totalPages > 5 && (
                        <>
                          <span className="px-2 text-gray-500">...</span>
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            className="px-3 py-1.5 rounded-lg text-sm font-black transition-all duration-200"
                            style={
                              currentPage === totalPages
                                ? { 
                                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                                    color: 'white'
                                  }
                                : { 
                                    backgroundColor: '#F3F4F6',
                                    color: '#374151'
                                  }
                            }
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 font-bold rounded-xl transition-all duration-300 border-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: 'white',
                        borderColor: '#E0F2FE',
                        color: '#05A8F9'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.backgroundColor = '#F4FCFF'
                          e.currentTarget.style.borderColor = '#6FBFDE'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white'
                        e.currentTarget.style.borderColor = '#E0F2FE'
                      }}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}