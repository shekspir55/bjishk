import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { DashboardSummary, Service } from '../types';

interface DashboardProps {
  refreshInterval: number;
}

function Dashboard({ refreshInterval }: DashboardProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch dashboard data
  const fetchData = async () => {
    try {
      // Get dashboard summary
      const summaryResponse = await axios.get('/api/dashboard');
      setSummary(summaryResponse.data);
      
      // Get all services
      const servicesResponse = await axios.get('/api/services');
      setServices(servicesResponse.data);
      
      setLoading(false);
    } catch (err) {
      const error = err as Error;
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to fetch dashboard data. Please try again later.');
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);
  
  // Refresh data periodically
  useEffect(() => {
    if (refreshInterval <= 0) return;
    
    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval * 1000);
    
    return () => clearInterval(intervalId);
  }, [refreshInterval]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <h2 className="text-red-800 font-medium">Error</h2>
        <p className="text-red-700 mt-1">{error}</p>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Services</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-gray-900">{summary?.totalServices || 0}</div>
              <div className="text-sm text-gray-500">Total services monitored</div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center">
                <div className="h-4 w-4 rounded-full bg-green-500 mr-2"></div>
                <span>{summary?.servicesUp || 0} Up</span>
              </div>
              <div className="flex items-center mt-1">
                <div className="h-4 w-4 rounded-full bg-red-500 mr-2"></div>
                <span>{summary?.servicesDown || 0} Down</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Peers</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-gray-900">{summary?.totalPeers || 0}</div>
              <div className="text-sm text-gray-500">Connected peers</div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center">
                <div className="h-4 w-4 rounded-full bg-green-500 mr-2"></div>
                <span>{summary?.peersUp || 0} Up</span>
              </div>
              <div className="flex items-center mt-1">
                <div className="h-4 w-4 rounded-full bg-red-500 mr-2"></div>
                <span>{summary?.peersDown || 0} Down</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Recent Incidents</h2>
          <div>
            <div className="text-3xl font-bold text-gray-900">{summary?.recentIncidents?.length || 0}</div>
            <div className="text-sm text-gray-500">Notifications in last 24h</div>
          </div>
          <Link to="/notifications" className="text-blue-600 hover:text-blue-800 text-sm inline-block mt-2">
            View all notifications →
          </Link>
        </div>
      </div>
      
      {/* Services List */}
      <h2 className="section-title">Your Services</h2>
      
      {services.length === 0 ? (
        <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
          No services configured. Add services in your .bjishk.toml file.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Check
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {services.map((service) => (
                <tr key={service.url} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link to={`/services/${encodeURIComponent(service.url)}`} className="text-blue-600 hover:text-blue-900">
                      {service.name || service.url}
                    </Link>
                    <div className="text-sm text-gray-500 truncate" style={{ maxWidth: '300px' }}>
                      {service.url}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`status-${service.status || 'unknown'}`}>
                      {service.status || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.response_time ? `${service.response_time}ms` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.last_check_time ? new Date(service.last_check_time).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Dashboard; 