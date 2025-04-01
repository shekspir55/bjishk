import React from 'react';

interface PeerListProps {
  refreshInterval: number;
}

function PeerList({ refreshInterval }: PeerListProps) {
  return (
    <div>
      <h1 className="page-title">Peer Instances</h1>
      <div className="card">
        <p className="text-gray-600">
          This page will display all connected peer bjishk instances.
        </p>
      </div>
    </div>
  );
}

export default PeerList; 