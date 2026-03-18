import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { GamesMenu } from './pages/GamesMenu'
import { LogicDefensePage } from './pages/LogicDefensePage'
import { LabPage } from './pages/LabPage'
import { MaterialsPage } from './pages/MaterialsPage'
import { LessonPage } from './pages/LessonPage'
import './styles/game.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* All portal routes share the Layout (Navbar + Footer) */}
        <Route element={<Layout />}>
          <Route path="/"                          element={<Home />} />
          <Route path="/jogos"                     element={<GamesMenu />} />
          <Route path="/jogos/logic-defense"       element={<LogicDefensePage />} />
          <Route path="/laboratorio"               element={<LabPage />} />
          <Route path="/repositorio"               element={<MaterialsPage />} />
          {/* Dynamic lesson reading page — /repositorio/vieses-dos-numeros etc. */}
          <Route path="/repositorio/:slug"         element={<LessonPage />} />
          <Route path="*"                          element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
