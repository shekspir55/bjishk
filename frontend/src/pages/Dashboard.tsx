import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardSummary, Service, StatusResponse, Peer } from '../types';
import { getServices, getServiceStatuses, getPeers } from '../utils/api';
import { displayUrl } from '../utils/url';

interface DashboardProps {
  refreshInterval: number;
  showAllSections?: boolean;
}

function Dashboard({ refreshInterval, showAllSections = false }: DashboardProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [statuses, setStatuses] = useState<StatusResponse[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Fetch dashboard data
  const fetchData = async () => {
    try {
      // Get all services
      const servicesResponse = await getServices();
      setServices(servicesResponse.data || []);
      
      // Get all service statuses
      const statusesResponse = await getServiceStatuses();
      setStatuses(statusesResponse.data || []);
      
      // Get all peers
      let peerData: Peer[] = [];
      if (showAllSections) {
        const peersResponse = await getPeers();
        peerData = peersResponse.data || [];
        setPeers(peerData);
      }
      
      // Calculate summary
      const serviceCount = servicesResponse.data?.length || 0;
      const upServices = statusesResponse.data?.filter((s: StatusResponse) => s.isUp)?.length || 0;
      const peerCount = peerData.length;
      
      const summary: DashboardSummary = {
        totalServices: serviceCount,
        servicesUp: upServices,
        servicesDown: serviceCount - upServices,
        totalPeers: peerCount,
        peersUp: peerCount, // Assuming all peers are up for now
        peersDown: 0,
        recentIncidents: []
      };
      setSummary(summary);
      
      // Update last updated time
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      const error = err as Error;
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to fetch dashboard data. Please try again later.');
      setLoading(false);
    }
  };
  
  // Format time difference
  const getTimeSinceUpdate = (): string => {
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  };
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);
  
  // Refresh data periodically based on refreshInterval prop
  useEffect(() => {
    if (refreshInterval <= 0) return;
    
    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval * 1000);
    
    return () => clearInterval(intervalId);
  }, [refreshInterval]);
  
  // Long polling at 1-minute intervals
  useEffect(() => {
    const longPollInterval = setInterval(() => {
      console.log('Long polling update...');
      fetchData();
    }, 60000); // 1 minute
    
    return () => clearInterval(longPollInterval);
  }, []);
  
  // Update the "updated X seconds ago" text every second
  useEffect(() => {
    const timerInterval = setInterval(() => {
      // Force re-render to update the time display
      setLastUpdated(prev => prev);
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, []);
  
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {getTimeSinceUpdate()}
          <button 
            onClick={() => fetchData()} 
            className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Refresh
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
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
        
        <div className="bg-white p-6 rounded-lg shadow">
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
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Incidents</h2>
          <div>
            <div className="text-3xl font-bold text-gray-900">{summary?.recentIncidents?.length || 0}</div>
            <div className="text-sm text-gray-500">Notifications in last 24h</div>
          </div>
        </div>
      </div>
      
      {/* Services Table */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Service Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Time
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Checked
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {services.map(service => {
                const status = statuses.find(s => s.url === service.url);
                return (
                  <tr key={service.url}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a 
                        href={service.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {/* Display human-readable internationalized domain name */}
                        {status?.title || displayUrl(service.url)}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status?.isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {status?.isUp ? 'UP' : 'DOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {status?.responseTime ? `${status.responseTime}ms` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {status?.lastChecked ? new Date(status.lastChecked).toLocaleString() : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {showAllSections && (
        <>
          {/* Peers Section */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Peer Instances</h2>
            
            {peers.length === 0 ? (
              <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
                No peer instances configured. Add peers in your .bjishk.toml file.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Peer URL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Check
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {peers.map((peer) => (
                      <tr key={peer.url} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-blue-600">
                            <a href={peer.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {peer.url}
                            </a>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                            Up
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {peer.lastChecked ? new Date(peer.lastChecked).toLocaleString() : 'Recently'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          
          {/* Notifications Section */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Notifications</h2>
            
            <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
              No recent notifications.
            </div>
          </section>
        </>
      )}
      
      {/* Footer info with long polling status */}
      <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-500 text-center">
        <strong>Long polling enabled:</strong> Dashboard auto-updates every minute
      </div>
    </div>
  );
}

export default Dashboard; 