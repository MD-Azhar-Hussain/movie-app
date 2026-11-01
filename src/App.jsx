import React from 'react';
import { Outlet } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

const App = () => {
  return (
    <div className="app-container min-h-screen bg-[#030014] text-white">
      <Outlet />
      {typeof __VERCEL_DEPLOYMENT__ !== 'undefined' && __VERCEL_DEPLOYMENT__ && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
    </div>
  );
};

export default App;