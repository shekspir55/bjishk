import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ServiceDetails from './pages/ServiceDetails';
import PeerList from './pages/PeerList';
import PeerDetails from './pages/PeerDetails';
import NotificationLog from './pages/NotificationLog';
import Footer from './components/Footer';

// Types
import { Config } from './types';

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Fetch configuration
    const fetchConfig = async () => {
      try {
        const response = await axios.get('/api/config');
        setConfig(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch configuration:', err);
        setError('Failed to load application configuration. Please check if the server is running.');
        setLoading(false);
      }
    };
    
    fetchConfig();
  }, []);
  
  // Auto-refresh configuration
  useEffect(() => {
    if (!config?.refreshInterval) return;
    
    const refreshIntervalId = setInterval(() => {
      axios.get('/api/config')
        .then(response => setConfig(response.data))
        .catch(err => console.error('Failed to refresh configuration:', err));
    }, config.refreshInterval * 1000);
    
    return () => clearInterval(refreshIntervalId);
  }, [config?.refreshInterval]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg">Loading bjishk...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="mb-4">{error}</p>
          <p className="text-gray-600 text-sm">
            Please ensure the bjishk server is running and refresh the page.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-gray-100">
        <Header instanceName={config?.name || 'bjishk'} />
        
        <div className="flex flex-1">
          <Sidebar />
          
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Dashboard refreshInterval={config?.refreshInterval || 30} />} />
              <Route path="/services/:url" element={<ServiceDetails refreshInterval={config?.refreshInterval || 30} />} />
              <Route path="/peers" element={<PeerList refreshInterval={config?.refreshInterval || 30} />} />
              <Route path="/peers/:url" element={<PeerDetails refreshInterval={config?.refreshInterval || 30} />} />
              <Route path="/notifications" element={<NotificationLog refreshInterval={config?.refreshInterval || 30} />} />
            </Routes>
          </main>
        </div>
        
        <Footer />
      </div>
    </Router>
  );
}

export default App; 