import axios from 'axios';

// Get the API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || '';

// Create axios instance with the API URL
const api = axios.create({
  baseURL: API_URL,
});

// Dashboard API
export const getDashboard = async () => {
  try {
    const response = await api.get('/api/instance');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch dashboard data', error);
    throw error;
  }
};

// Services API
export const getServices = async () => {
  try {
    const response = await api.get('/api/services');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch services', error);
    throw error;
  }
};

export const getServiceStatuses = async () => {
  try {
    const response = await api.get('/api/services/statuses');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch service statuses', error);
    throw error;
  }
};

export const getServiceStatus = async (url: string) => {
  try {
    const encodedUrl = encodeURIComponent(url);
    const response = await api.get(`/api/services/${encodedUrl}/status`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch status for service ${url}`, error);
    throw error;
  }
};

export const getServiceHistory = async (url: string, limit: number = 100) => {
  try {
    const encodedUrl = encodeURIComponent(url);
    const response = await api.get(`/api/services/${encodedUrl}/history?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch history for service ${url}`, error);
    throw error;
  }
};

export const getServiceUptime = async (url: string, days: number = 7) => {
  try {
    const encodedUrl = encodeURIComponent(url);
    const response = await api.get(`/api/services/${encodedUrl}/uptime?days=${days}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch uptime for service ${url}`, error);
    throw error;
  }
};

// Peers API
export const getPeers = async () => {
  try {
    const response = await api.get('/api/peers');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch peers', error);
    throw error;
  }
};

// UI Config API
export const getUiConfig = async () => {
  try {
    const response = await api.get('/api/ui-config');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch UI configuration', error);
    throw error;
  }
}; 