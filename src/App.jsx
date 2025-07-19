import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import ScrapingTab from './components/ScrapingTab';

function Home() {
  return <div className="p-6">Bienvenue</div>;
}

export default function App() {
  return (
    <Router>
      <nav className="flex space-x-4 p-4 bg-gray-100">
        <NavLink to="/" className="text-blue-700" end>
          Accueil
        </NavLink>
        <NavLink to="/scraping" className="text-blue-700">
          Scraping
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scraping" element={<ScrapingTab />} />
      </Routes>
    </Router>
  );
}
