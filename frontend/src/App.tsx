import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Get the API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || '';

// Logo
const LOGO = "🩺բժիշկ";

// Define Config type directly since we're having import issues
interface Config {
  instanceName: string;
  refreshInterval: number;
}

// Import Dashboard component (for now we'll handle any errors at runtime)
// @ts-ignore
import Dashboard from './pages/Dashboard';

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Fetch configuration
    const fetchConfig = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/ui-config`);
        setConfig(response.data.data);
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
      axios.get(`${API_URL}/api/ui-config`)
        .then(response => setConfig(response.data.data))
        .catch(err => console.error('Failed to refresh configuration:', err));
    }, config.refreshInterval * 1000);
    
    return () => clearInterval(refreshIntervalId);
  }, [config?.refreshInterval]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg">Loading {LOGO}...</p>
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="text-3xl mr-3">
              {LOGO}
            </div>
            <h1 className="text-xl font-bold text-gray-800">
              {config?.instanceName || 'bjishk'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Federated Healthcheck System
            </span>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main content - Single page with all sections */}
        <Dashboard refreshInterval={config?.refreshInterval || 30} showAllSections={true} />
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} {LOGO} bjishk
            </div>
            <div className="text-sm text-gray-500">
              Version 1.0.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App; 