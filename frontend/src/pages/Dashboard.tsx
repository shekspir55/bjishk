import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardSummary, Service, StatusResponse, Peer } from '../types';
import { getServices, getServiceStatuses, getPeers, getServiceHistoryDots, getPeerServices } from '../utils/api';
import { displayUrl } from '../utils/url';

// Separate component for history dots to properly handle hooks
function ServiceHistoryDots({ service }: { service: Service }) {
  const [historyDots, setHistoryDots] = useState<{timestamp: string, isUp: boolean}[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const fetchHistoryDots = async () => {
      try {
        const response = await getServiceHistoryDots(service.url, 10);
        setHistoryDots(response.data || []);
      } catch (error) {
        console.error(`Failed to fetch history dots for ${service.url}`, error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistoryDots();
  }, [service.url]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-5">
        <div className="animate-pulse w-20 h-2 bg-gray-200 rounded"></div>
      </div>
    );
  }
  
  if (historyDots.length === 0) {
    return (
      <div className="text-xs text-gray-400">No history available</div>
    );
  }
  
  return (
    <div className="flex flex-row-reverse items-center">
      {historyDots.map((dot, index) => (
        <div 
          key={index} 
          className={`w-2 h-2 rounded-full mx-0.5 ${dot.isUp ? 'bg-green-500' : 'bg-red-500'}`} 
          title={`${dot.isUp ? 'Up' : 'Down'} at ${new Date(dot.timestamp).toLocaleString()}`}
        />
      ))}
    </div>
  );
}

interface DashboardProps {
  refreshInterval: number;
  showAllSections?: boolean;
}

function Dashboard({ refreshInterval, showAllSections = true }: DashboardProps) {
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
      const peersResponse = await getPeers();
      peerData = peersResponse.data || [];
      setPeers(peerData);
      
      // Calculate summary
      const serviceCount = servicesResponse.data?.length || 0;
      const upServices = statusesResponse.data?.filter((s: StatusResponse) => s.isUp)?.length || 0;
      const peerCount = peerData.length;
      const peersUp = peerData.filter(p => p.isUp).length;
      
      const summary: DashboardSummary = {
        totalServices: serviceCount,
        servicesUp: upServices,
        servicesDown: serviceCount - upServices,
        totalPeers: peerCount,
        peersUp: peersUp,
        peersDown: peerCount - peersUp,
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
  
  // Format time difference for last updated
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
  
  // Format time difference for last checked
  const getTimeSinceLastCheck = (lastCheckedStr: string | undefined): string => {
    if (!lastCheckedStr) return 'Never';
    
    const lastChecked = new Date(lastCheckedStr);
    const now = new Date();
    const diff = now.getTime() - lastChecked.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
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
            <div className="text-sm text-gray-500">Recent incidents</div>
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  History
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
                        {/* Display human-readable internationalized domain name with title */}
                        {status?.title ? (
                          <>
                            <div>{status.title}</div>
                            <div className="text-xs text-gray-500">{displayUrl(service.url)}</div>
                          </>
                        ) : (
                          displayUrl(service.url)
                        )}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status?.isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {status?.isUp ? 'UP' : 'DOWN'}
                      </span>
                      {!status?.isUp && status?.error && (
                        <div className="mt-1 text-xs text-red-600 max-w-xs overflow-hidden text-ellipsis">
                          {status.error}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {status?.responseTime ? `${status.responseTime}ms` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {status?.lastChecked ? getTimeSinceLastCheck(status.lastChecked) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ServiceHistoryDots service={service} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Peers Table */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Peer Instances</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Peer URL
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Checked
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Services
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {peers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No peer instances configured
                  </td>
                </tr>
              ) : (
                peers.map((peer) => (
                  <PeerRow key={peer.url} peer={peer} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Peer component with expandable services list
function PeerRow({ peer }: { peer: Peer }) {
  const [expanded, setExpanded] = useState(false);
  const [peerServices, setPeerServices] = useState<StatusResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleExpanded = async () => {
    if (!expanded && peerServices.length === 0) {
      setLoading(true);
      try {
        // Try to fetch actual peer services using the API
        const response = await getPeerServices(peer.url);
        if (response.success && Array.isArray(response.data)) {
          setPeerServices(response.data);
        } else {
          setPeerServices([]);
        }
      } catch (error) {
        console.error('Failed to fetch peer services', error);
        setPeerServices([]);
      } finally {
        setLoading(false);
      }
    }
    
    setExpanded(!expanded);
  };
  
  // Format time difference for last checked
  const getTimeSinceLastCheck = (lastCheckedStr: string | undefined): string => {
    if (!lastCheckedStr) return 'Never';
    
    const lastChecked = new Date(lastCheckedStr);
    const now = new Date();
    const diff = now.getTime() - lastChecked.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <>
      <tr key={peer.url} className={expanded ? "bg-gray-50" : ""}>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <button 
              onClick={toggleExpanded}
              className="mr-2 p-1 rounded-full hover:bg-gray-200 focus:outline-none"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <svg 
                className={`h-4 w-4 transition-transform ${expanded ? 'transform rotate-90' : ''}`} 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <a 
              href={peer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              <div>{displayUrl(peer.url)}</div>
              {/* Show punycode version only if different from display version */}
              {peer.url !== displayUrl(peer.url) && (
                <div className="text-xs text-gray-500">(punycode: {peer.url})</div>
              )}
            </a>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${peer.isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {peer.isUp ? 'UP' : 'DOWN'}
          </span>
          {!peer.isUp && peer.error && (
            <div className="mt-1 text-xs text-red-600 max-w-xs overflow-hidden text-ellipsis">
              {peer.error}
            </div>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {peer.lastChecked ? getTimeSinceLastCheck(peer.lastChecked) : 'Never'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {peer.services !== undefined ? peer.services : '-'}
        </td>
      </tr>
      
      {/* Expandable services section */}
      {expanded && (
        <tr>
          <td colSpan={4} className="px-0 py-0 border-b border-gray-200">
            <div className="bg-gray-50 px-8 py-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Services from this peer:</h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-sm text-gray-600">Loading services...</span>
                </div>
              ) : peerServices.length > 0 ? (
                <div className="bg-white shadow overflow-hidden rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {peerServices.map(service => (
                      <li key={service.url} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{service.title || displayUrl(service.url)}</div>
                            <div className="text-xs text-gray-500">{displayUrl(service.url)}</div>
                          </div>
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${service.isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {service.isUp ? 'UP' : 'DOWN'}
                            </span>
                            <span className="ml-3 text-xs text-gray-500">
                              {service.responseTime ? `${service.responseTime}ms` : '-'}
                            </span>
                            <span className="ml-3 text-xs text-gray-500">
                              {getTimeSinceLastCheck(service.lastChecked)}
                            </span>
                          </div>
                        </div>
                        {!service.isUp && service.error && (
                          <div className="mt-1 text-xs text-red-600">
                            {service.error}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-2">No services available from this peer.</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default Dashboard; 