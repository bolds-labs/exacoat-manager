import React from 'react';
import { SystemHealthDashboard } from '../components/health/SystemHealthDashboard';

export const SystemHealthPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <SystemHealthDashboard />
    </div>
  );
};
