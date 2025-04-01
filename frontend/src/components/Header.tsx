import React from 'react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  instanceName: string;
}

function Header({ instanceName }: HeaderProps) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link to="/" className="flex items-center">
            <div className="bg-blue-600 text-white p-2 rounded-lg mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800">
              {instanceName}
            </h1>
          </Link>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Federated Healthcheck System
          </span>
        </div>
      </div>
    </header>
  );
}

export default Header; 