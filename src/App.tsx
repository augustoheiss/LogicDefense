import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { GamesMenu } from './pages/GamesMenu'
import { LogicDefensePage } from './pages/LogicDefensePage'
import { LogicAscensionPage } from './pages/LogicAscensionPage'
import { LogicInvadersLanding } from './pages/LogicInvadersLanding'
import { LogicFrictionPage } from './pages/LogicFrictionPage'
import { LabPage } from './pages/LabPage'
import { MaterialsPage } from './pages/MaterialsPage'
import { LessonPage } from './pages/LessonPage'
import { SobrePage } from './pages/SobrePage'
import { CVMaker } from './pages/CVMaker'
import { OcorrenciasPage } from './pages/OcorrenciasPage'
import { ApiPortPage } from './pages/ApiPortPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfUse from './pages/TermsOfUse'
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
          <Route path="/jogos/logic-ascension"    element={<LogicAscensionPage />} />
          <Route path="/jogos/logic-invaders"     element={<LogicInvadersLanding />} />
          <Route path="/jogos/logic-friction"    element={<LogicFrictionPage />} />
          <Route path="/laboratorio"               element={<LabPage />} />
          <Route path="/cv-maker"                  element={<CVMaker />} />
          <Route path="/laboratorio/cv-maker"      element={<CVMaker />} />
          <Route path="/laboratorio/ocorrencias" element={<OcorrenciasPage />} />
          <Route path="/laboratorio/api-port" element={<ApiPortPage />} />
          <Route path="/repositorio"               element={<MaterialsPage />} />
          {/* Dynamic lesson reading page — /repositorio/vieses-dos-numeros etc. */}
          <Route path="/repositorio/:slug"         element={<LessonPage />} />
          <Route path="/sobre"                     element={<SobrePage />} />
          <Route path="/privacidade"               element={<PrivacyPolicy />} />
          <Route path="/termos"                    element={<TermsOfUse />} />
          <Route path="*"                          element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
