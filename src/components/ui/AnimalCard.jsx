import React from 'react';
import PropTypes from 'prop-types';
import { MapPin, Battery } from 'lucide-react';

const AnimalCard = ({ name, battery, status, coordinates }) => {
  const isHealthy = status === 'safe';
  const latitude = typeof coordinates?.lat === 'number' ? coordinates.lat : null;
  const longitude = typeof coordinates?.lng === 'number' ? coordinates.lng : null;

  return (
    <div className="glass p-5 rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/30 hover:shadow-2xl transition-all duration-300 animate-fade-in max-w-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="title-md text-slate-900 dark:text-white leading-tight">{name}</h3>
          <div className="mt-1">
            <span className={`label-xs px-2.5 py-0.5 rounded-full font-extrabold ${isHealthy ? 'bg-primary/20 text-primary' : 'bg-alert-high/20 text-alert-high'
              }`}>
              {status === 'safe' ? 'Sauf' : status}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <Battery className={`w-4 h-4 ${battery < 20 ? 'text-alert-high animate-pulse' : 'text-primary'}`} />
            <span className="text-sm text-slate-700 dark:text-slate-300">{battery}%</span>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 label-xs">
          <MapPin className="w-4 h-4 opacity-70" />
          <span className="font-medium tracking-tight">
            {latitude !== null && longitude !== null ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : 'GPS indisponible'}
          </span>
        </div>
      </div>
    </div>
  );
};

AnimalCard.propTypes = {
  name: PropTypes.string.isRequired,
  battery: PropTypes.number.isRequired,
  status: PropTypes.string.isRequired,
  coordinates: PropTypes.shape({
    lat: PropTypes.number,
    lng: PropTypes.number,
  }).isRequired,
};

export default AnimalCard;
