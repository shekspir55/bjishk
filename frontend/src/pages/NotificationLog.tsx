import React from 'react';

interface NotificationLogProps {
  refreshInterval: number;
}

function NotificationLog({ refreshInterval }: NotificationLogProps) {
  return (
    <div>
      <h1 className="page-title">Notification History</h1>
      <div className="card">
        <p className="text-gray-600">
          This page will display the history of all notifications sent for service status changes.
        </p>
      </div>
    </div>
  );
}

export default NotificationLog; 