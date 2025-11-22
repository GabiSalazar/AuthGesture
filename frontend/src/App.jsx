import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Landing from './pages/landing/Landing'
import AdminPanel from './pages/admin/AdminPanel'
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
        
        {/* Admin panel SIN Layout (tiene su propio header interno) */}
        <Route path="/admin/dashboard" element={<AdminPanel />} />
      </Routes>
    </Router>
  )
}

export default App