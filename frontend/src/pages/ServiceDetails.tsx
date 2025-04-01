import React from 'react';
import { useParams } from 'react-router-dom';

interface ServiceDetailsProps {
  refreshInterval: number;
}

function ServiceDetails({ refreshInterval }: ServiceDetailsProps) {
  const { url } = useParams<{ url: string }>();
  const decodedUrl = url ? decodeURIComponent(url) : '';
  
  return (
    <div>
      <h1 className="page-title">Service Details</h1>
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">{decodedUrl}</h2>
        <p className="text-gray-600">
          Detailed information about this service will be shown here, including response time charts
          and historical uptime data.
        </p>
      </div>
    </div>
  );
}

export default ServiceDetails; 