import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import QuizEditor from './pages/QuizEditor'
import HostLive from './pages/HostLive'
import Play from './pages/Play'
import Login from './pages/Login'
import Host from './pages/Host'

function Home() {
  const user = JSON.parse(localStorage.getItem('user'))
  if (!user) return <Navigate to="/login" />
  if (user.role === 'host' || user.role === 'admin') return <Navigate to="/host" />
  return <Navigate to="/play" />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<Host />} />
        <Route path="/quiz/:id/edit" element={<QuizEditor />} />
        <Route path="/play" element={<Play />} /> 
        <Route path="/host/live/:roomCode" element={<HostLive />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App