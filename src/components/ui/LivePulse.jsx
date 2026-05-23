import React from 'react';
import PropTypes from 'prop-types';

const LivePulse = ({ connected }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-3 w-3">
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${connected ? 'bg-primary' : 'bg-slate-400'}`}></span>
      </div>
      <span className={`text-xs font-medium ${connected ? 'text-primary' : 'text-slate-400'}`}>
        {connected ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  );
};

LivePulse.propTypes = {
  connected: PropTypes.bool.isRequired,
};

export default LivePulse;
