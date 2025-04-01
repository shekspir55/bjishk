import React from 'react';
import { NavLink } from 'react-router-dom';

function Sidebar() {
  return (
    <aside className="bg-gray-800 text-white w-64 min-h-0 flex-shrink-0 hidden md:block">
      <nav className="mt-10 px-6">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `flex items-center py-2 px-4 rounded-lg mb-2 ${isActive ? 'bg-gray-700' : 'hover:bg-gray-700'}`
          }
          end
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          Dashboard
        </NavLink>
        
        <NavLink 
          to="/peers" 
          className={({ isActive }) => 
            `flex items-center py-2 px-4 rounded-lg mb-2 ${isActive ? 'bg-gray-700' : 'hover:bg-gray-700'}`
          }
          end
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          Peers
        </NavLink>
        
        <NavLink 
          to="/notifications" 
          className={({ isActive }) => 
            `flex items-center py-2 px-4 rounded-lg mb-2 ${isActive ? 'bg-gray-700' : 'hover:bg-gray-700'}`
          }
          end
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          Notifications
        </NavLink>
      </nav>
      
      <div className="px-6 py-4 mt-10">
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-sm font-medium">Healthcheck System</h3>
          <p className="text-xs text-gray-400 mt-2">
            Monitor your services and collaborate with trusted peers.
          </p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar; 