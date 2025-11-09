import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Landing from './pages/landing/Landing'
import Dashboard from './pages/dashboard/Dashboard'
import Enrollment from './pages/enrollment/Enrollment'
import Verification from './pages/verification/Verification'
import Identification from './pages/identification/Identification'

import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        {/* Páginas públicas SIN Layout (Fullscreen) */}
        <Route path="/" element={<Landing />} />
        <Route path="/enrollment" element={<Enrollment />} />
        <Route path="/verification" element={<Verification />} />
        <Route path="/identification" element={<Identification />} />
        
        {/* Páginas de administrador CON Layout */}
        <Route path="/admin/*" element={
          <Layout>
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  )
}

export default App