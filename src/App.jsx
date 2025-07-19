import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import ScrapingTab from './components/ScrapingTab';

function Home() {
  return <div>Accueil</div>;
}

export default function App() {
  return (
    <Router>
      <nav className="tabs-container">
        <div className="tabs">
          <NavLink to="/" className="tab">Identification</NavLink>
          <NavLink to="/biblio" className="tab">Biblio</NavLink>
          <NavLink to="/patri" className="tab">Patri</NavLink>
          <NavLink to="/integration" className="tab">Intégration</NavLink>
          <NavLink to="/scraping" className="tab">Scraping</NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/scraping" element={<ScrapingTab />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}
