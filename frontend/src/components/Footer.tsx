import React from 'react';

function Footer() {
  return (
    <footer className="bg-white py-4 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          bjishk - Distributed Federated Healthcheck System
        </div>
        <div className="text-sm text-gray-500">
          <a href="https://github.com/yourusername/bjishk" className="hover:text-gray-700">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer; 