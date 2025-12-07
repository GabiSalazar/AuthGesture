import { useState, useEffect } from 'react'
import { Card, CardContent, Badge, Spinner, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Button } from '../../../components/ui'
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
    auth_type: 'all', // 'all', 'verification', 'identification'
    result: 'all', // 'all', 'success', 'failed'
    date_from: '',
    date_to: '',
    min_confidence: 0,
    search: ''
  })

  const [showFilters, setShowFilters] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Cargar datos iniciales
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [attemptsData, statsData, usersData] = await Promise.all([
        adminApi.getAllAuthAttempts(),
        adminApi.getAuthStats(),
        adminApi.getUsers()
      ])

      setAttempts(attemptsData.attempts || [])
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
    // Filtro por usuario
    if (filters.user_id && attempt.user_id !== filters.user_id) return false

    // Filtro por tipo
    if (filters.auth_type !== 'all' && attempt.auth_type !== filters.auth_type) return false

    // Filtro por resultado
    if (filters.result !== 'all' && attempt.result !== filters.result) return false

    // Filtro por confidence
    if (attempt.confidence < filters.min_confidence / 100) return false

    // Filtro por búsqueda (user_id, IP, device)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchUser = attempt.user_id?.toLowerCase().includes(searchLower)
      const matchIP = attempt.ip_address?.toLowerCase().includes(searchLower)
      const matchDevice = attempt.device_info?.toLowerCase().includes(searchLower)
      if (!matchUser && !matchIP && !matchDevice) return false
    }

    // Filtro por fecha
    if (filters.date_from) {
      const attemptDate = new Date(attempt.timestamp * 1000)
      const fromDate = new Date(filters.date_from)
      if (attemptDate < fromDate) return false
    }

    if (filters.date_to) {
      const attemptDate = new Date(attempt.timestamp * 1000)
      const toDate = new Date(filters.date_to)
      toDate.setHours(23, 59, 59) // Final del día
      if (attemptDate > toDate) return false
    }

    return true
  })

  // Paginación
  const totalPages = Math.ceil(filteredAttempts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedAttempts = filteredAttempts.slice(startIndex, startIndex + itemsPerPage)

  // Reset de filtros
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

  // Exportar a CSV
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

  // Formateo de fecha
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

  // Formateo de confianza con color
  const getConfidenceBadge = (confidence) => {
    const percent = (confidence * 100).toFixed(1)
    if (confidence >= 0.9) return <Badge variant="success">{percent}%</Badge>
    if (confidence >= 0.7) return <Badge variant="warning">{percent}%</Badge>
    return <Badge variant="danger">{percent}%</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Autenticaciones</h1>
          <p className="text-gray-600 mt-1">
            Historial completo de intentos de autenticación del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={exportToCSV}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Estadísticas Globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Intentos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.total_attempts || attempts.length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Exitosos</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats?.successful_attempts || attempts.filter(a => a.result === 'success').length}
                </p>
              </div>
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Fallidos</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats?.failed_attempts || attempts.filter(a => a.result === 'failed').length}
                </p>
              </div>
              <ShieldAlert className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tasa de Éxito</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats?.success_rate 
                    ? `${(stats.success_rate * 100).toFixed(1)}%`
                    : attempts.length > 0
                      ? `${((attempts.filter(a => a.result === 'success').length / attempts.length) * 100).toFixed(1)}%`
                      : '0%'
                  }
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel de Filtros */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Filtros Avanzados</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetFilters}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpiar Filtros
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Búsqueda general */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buscar
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Usuario, IP, Device..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Filtro por usuario */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Usuario
                  </label>
                  <select
                    value={filters.user_id}
                    onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Autenticación
                  </label>
                  <select
                    value={filters.auth_type}
                    onChange={(e) => setFilters({ ...filters, auth_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    <option value="verification">Verificación (1:1)</option>
                    <option value="identification">Identificación (1:N)</option>
                  </select>
                </div>

                {/* Filtro por resultado */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <select
                    value={filters.result}
                    onChange={(e) => setFilters({ ...filters, result: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    <option value="success">Exitosos</option>
                    <option value="failed">Fallidos</option>
                  </select>
                </div>

                {/* Fecha desde */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Desde
                  </label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Fecha hasta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Hasta
                  </label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Confidence mínima */}
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confidence Mínima: {filters.min_confidence}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.min_confidence}
                    onChange={(e) => setFilters({ ...filters, min_confidence: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Resumen de filtros activos */}
              {(filters.user_id || filters.auth_type !== 'all' || filters.result !== 'all' || 
                filters.date_from || filters.date_to || filters.min_confidence > 0 || filters.search) && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Mostrando <span className="font-semibold text-gray-900">{filteredAttempts.length}</span> de{' '}
                    <span className="font-semibold text-gray-900">{attempts.length}</span> intentos
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de Intentos */}
      <Card>
        <CardContent className="pt-6">
          {paginatedAttempts.length === 0 ? (
            <div className="text-center py-12">
              <ShieldAlert className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No se encontraron intentos de autenticación</p>
              {(filters.user_id || filters.auth_type !== 'all' || filters.result !== 'all') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetFilters}
                  className="mt-4"
                >
                  Limpiar Filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha y Hora</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Scores</TableHead>
                      <TableHead>Gestos</TableHead>
                      <TableHead>Duración</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAttempts.map((attempt, idx) => (
                      <TableRow key={attempt.attempt_id || idx}>
                        {/* Fecha */}
                        <TableCell className="text-xs font-mono text-gray-600 whitespace-nowrap">
                          {formatDate(attempt.timestamp)}
                        </TableCell>

                        {/* Usuario */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {attempt.user_id}
                            </span>
                          </div>
                        </TableCell>

                        {/* Tipo */}
                        <TableCell>
                          {attempt.auth_type === 'verification' ? (
                            <Badge variant="primary">Verificación</Badge>
                          ) : (
                            <Badge variant="info">Identificación</Badge>
                          )}
                        </TableCell>

                        {/* Estado */}
                        <TableCell>
                          {attempt.result === 'success' ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <Badge variant="success">Exitoso</Badge>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <Badge variant="danger">Fallido</Badge>
                            </div>
                          )}
                        </TableCell>

                        {/* Confidence */}
                        <TableCell>
                          {getConfidenceBadge(attempt.confidence)}
                        </TableCell>

                        {/* Scores */}
                        <TableCell>
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">A:</span>
                              <span className="font-medium">{(attempt.anatomical_score * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">D:</span>
                              <span className="font-medium">{(attempt.dynamic_score * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">F:</span>
                              <span className="font-semibold text-blue-600">{(attempt.fused_score * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Gestos */}
                        <TableCell>
                          <div className="text-xs text-gray-600 max-w-[150px] truncate">
                            {attempt.metadata?.gestures_captured?.join(' → ') || 'N/A'}
                          </div>
                        </TableCell>

                        {/* Duración */}
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Clock className="w-3 h-3" />
                            {attempt.metadata?.duration 
                              ? `${attempt.metadata.duration.toFixed(2)}s`
                              : 'N/A'
                            }
                          </div>
                        </TableCell>

                        {/* IP */}
                        <TableCell className="text-xs text-gray-600 font-mono">
                          {attempt.ip_address || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Mostrando {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredAttempts.length)} de{' '}
                    {filteredAttempts.length} resultados
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const pageNum = i + 1
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`
                              px-3 py-1 rounded-lg text-sm font-medium transition-colors
                              ${currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }
                            `}
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
                            className={`
                              px-3 py-1 rounded-lg text-sm font-medium transition-colors
                              ${currentPage === totalPages
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }
                            `}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}