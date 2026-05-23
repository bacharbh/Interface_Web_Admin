import React from 'react';
import { AlertCircle, Battery, HeartPulse, Shield } from 'lucide-react';
import PropTypes from 'prop-types';

const AlertBadge = ({ type, count }) => {
  const getIcon = () => {
    switch (type) {
      case 'geofence': return <Shield className="w-4 h-4" />;
      case 'battery': return <Battery className="w-4 h-4" />;
      case 'health': return <HeartPulse className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const colors = {
    geofence: 'bg-alert-high text-white',
    battery: 'bg-alert-medium text-white',
    health: 'bg-alert-low text-slate-900',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full label-xs font-bold shadow-lg animate-slide-in ${colors[type] || 'bg-slate-500 text-white'}`}>
      {getIcon()}
      <span>{count} {type === 'gps' ? 'GPS' : type}</span>
    </div>
  );
};

AlertBadge.propTypes = {
  type: PropTypes.oneOf(['geofence', 'battery', 'health']).isRequired,
  count: PropTypes.number.isRequired,
};

export default AlertBadge;
