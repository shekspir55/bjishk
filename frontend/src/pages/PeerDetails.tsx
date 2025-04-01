import React from 'react';
import { useParams } from 'react-router-dom';

interface PeerDetailsProps {
  refreshInterval: number;
}

function PeerDetails({ refreshInterval }: PeerDetailsProps) {
  const { url } = useParams<{ url: string }>();
  const decodedUrl = url ? decodeURIComponent(url) : '';
  
  return (
    <div>
      <h1 className="page-title">Peer Details</h1>
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">{decodedUrl}</h2>
        <p className="text-gray-600">
          Detailed information about this peer bjishk instance will be shown here,
          including its services and status.
        </p>
      </div>
    </div>
  );
}

export default PeerDetails; 