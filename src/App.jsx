import React from 'react';
import { Outlet } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

const App = () => {
  return (
    <div className="app-container min-h-screen bg-[#030014] text-white">
      <Outlet />
      <Analytics />
      <SpeedInsights />
    </div>
  );
};

export default App;