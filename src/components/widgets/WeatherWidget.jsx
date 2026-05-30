import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, Sun, CloudRain, Wind, Droplets, Thermometer, Loader2, AlertTriangle, RotateCcw, X, Calendar, ChevronRight } from 'lucide-react';
import { getCurrentWeather } from '../../services/weatherService';
import { useFarmConfig } from '../../hooks/useFarmConfig';
import { devLog } from '../../utils/devLogger';

const WeatherWidget = () => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const { farmLat, farmLng, farmName } = useFarmConfig();

  const getCoordinates = useCallback(() => {
    const fallback = { lat: 36.8, lng: 10.18 };

    if (farmLat !== null && farmLng !== null) {
      return Promise.resolve({ lat: farmLat, lng: farmLng });
    }

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(fallback);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => resolve(fallback),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
      );
    });
  }, [farmLat, farmLng]);

  const resolveCoords = useCallback(async () => {
    const coords = await getCoordinates();
    return { ...coords, source: farmName || 'Position de secours' };
  }, [farmName, getCoordinates]);

  const fetchOpenMeteoFallback = useCallback(async (lat, lng) => {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`);
    if (!res.ok) {
      throw new Error('Open-Meteo indisponible');
    }

    const data = await res.json();
    const current = data?.current;
    if (!current) {
      throw new Error('Données météo incomplètes');
    }

    const code = Number(current.weather_code);
    let main = 'Clouds';
    if (code === 0) main = 'Clear';
    else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) main = 'Rain';

    return {
      temp: Math.round(Number(current.temperature_2m)),
      windspeed: Math.round(Number(current.wind_speed_10m)),
      humidity: Math.round(Number(current.relative_humidity_2m)),
      code: main,
    };
  }, []);

  const loadWeather = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const { lat, lng } = await resolveCoords();
      const result = await getCurrentWeather(lat, lng);

      setWeather({
        temp: result.current.temp,
        windspeed: result.current.windSpeed,
        code: result.weather.main,
        humidity: result.current.humidity
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger la météo en ce moment.';
      devLog('[Weather] backend unavailable, trying Open-Meteo fallback:', message);

      try {
        const { lat, lng } = await resolveCoords();
        const fallbackWeather = await fetchOpenMeteoFallback(lat, lng);
        setWeather(fallbackWeather);
        setNotice('Source locale météo utilisée');
      } catch (fallbackError) {
        devLog('[Weather] Open-Meteo fallback failed:', fallbackError instanceof Error ? fallbackError.message : fallbackError);
        setWeather(null);
        setNotice('');
        setError('Météo indisponible');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchOpenMeteoFallback, resolveCoords]);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  const getWeatherIcon = (code) => {
    if (code === 'Clear') return <Sun className="w-10 h-10 text-amber-400" />;
    if (code === 'Rain' || code === 'Drizzle' || code === 'Thunderstorm') return <CloudRain className="w-10 h-10 text-blue-400" />;
    return <Cloud className="w-10 h-10 text-slate-400" />;
  };

  const getWMOIcon = (code) => {
    if (code === 0) return <Sun className="w-8 h-8 text-amber-400" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-8 h-8 text-slate-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="w-8 h-8 text-blue-400" />;
    if (code >= 95) return <AlertTriangle className="w-8 h-8 text-red-500" />;
    return <Cloud className="w-8 h-8 text-slate-400" />;
  };

  const fetchForecast = async () => {
    setLoadingForecast(true);
    try {
      const { lat, lng } = await resolveCoords();
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
      const data = await res.json();

      const days = data.daily.time.map((time, index) => {
        const tempMax = data.daily.temperature_2m_max[index];
        const tempMin = data.daily.temperature_2m_min[index];
        const precipProb = data.daily.precipitation_probability_max[index];
        const code = data.daily.weather_code[index];

        let risk = false;
        if (precipProb > 50 || code >= 51 || tempMax > 35 || tempMin < 0) {
          risk = true;
        }

        return {
          date: new Date(time).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
          tempMax: Math.round(tempMax),
          tempMin: Math.round(tempMin),
          precipProb,
          code,
          recommendation: risk ? 'Risque météo' : 'Bon jour de pâturage',
          isRisk: risk
        };
      });
      setForecast(days);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingForecast(false);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    if (!forecast) {
      fetchForecast();
    }
  };

  const getWeatherText = (code) => {
    if (code === 'Clear') return 'Ciel dégagé';
    if (code === 'Rain' || code === 'Drizzle') return 'Pluvieux';
    if (code === 'Thunderstorm') return 'Orageux';
    return 'Nuageux';
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl p-6 shadow-xl border border-white/5 flex flex-col justify-center items-center h-[160px]">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl p-6 shadow-xl border border-white/5 flex flex-col justify-center items-center gap-3 h-[160px]">
        <AlertTriangle className="w-5 h-5 text-slate-300" />
        <p className="text-sm font-medium text-slate-100">Météo indisponible</p>
        <button
          onClick={loadWeather}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/10"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={handleOpenModal}
        className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl p-6 shadow-xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-primary/40 hover:shadow-2xl transition-all duration-300"
      >
        {/* Decorative Blob */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors duration-500" />

        <div className="relative z-10 flex flex-col h-full justify-between gap-4 text-white">

          <div className="flex justify-between items-start">
            <div>
              <h3 className="label-xs mb-1">Pâturages N°1</h3>
              <p className="value-xl">{weather?.temp ?? '--'}°C</p>
            </div>
            <div className="p-2 bg-white/5 backdrop-blur-md rounded-2xl shadow-inner border border-white/10 group-hover:scale-110 transition-transform duration-300">
              {getWeatherIcon(weather?.code)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-slate-400" />
              <div className="flex flex-col">
                <span className="label-xs">État</span>
                <span className="label-sm text-white">{getWeatherText(weather?.code)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-400" />
              <div className="flex flex-col">
                <span className="label-xs">Humidité</span>
                <span className="label-sm text-white">{weather?.humidity}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2 col-span-2 mt-1">
              <Wind className="w-4 h-4 text-slate-400" />
              <div className="flex flex-col">
                <span className="label-xs">Vent</span>
                <span className="label-sm text-white">{weather?.windspeed} km/h</span>
              </div>
            </div>

            {notice && (
              <div className="col-span-2 mt-1 text-[11px] text-slate-400">
                {notice}
              </div>
            )}
          </div>

          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
            <ChevronRight className="w-5 h-5 text-white/50" />
          </div>
        </div>
      </div>

      {/* Slide-over Forecast Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-card-dark h-full shadow-2xl flex flex-col transform transition-transform animate-slide-left">

            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
              <div>
                <h2 className="title-md text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Prévisions 7 jours
                </h2>
                <p className="label-xs text-gray-500 mt-1">Domaine Pâturages N°1</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} aria-label="Fermer la fenêtre météo" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingForecast ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="label-sm text-gray-500">Chargement des prévisions...</span>
                </div>
              ) : forecast ? (
                forecast.map((day, i) => (
                  <div key={i} className={`p-4 rounded-2xl border ${day.isRisk ? 'bg-red-50 dark:bg-red-500/5 border-red-100 dark:border-red-500/20' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'} flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow`}>
                    <div className={`p-3 rounded-xl shadow-sm ${day.isRisk ? 'bg-white dark:bg-red-900/20' : 'bg-white dark:bg-gray-800'}`}>
                      {getWMOIcon(day.code)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1.5">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white capitalize">{day.date}</h4>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${day.isRisk ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 ring-1 ring-red-500/20' : 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400 ring-1 ring-green-500/20'}`}>
                          {day.recommendation}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5" /> {day.tempMin}° / {day.tempMax}°</span>
                        <span className="flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" /> {day.precipProb}% pluie</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-10 flex flex-col items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                  <p>Erreur de chargement des prévisions.</p>
                  <button onClick={fetchForecast} className="px-4 py-2 mt-2 bg-primary/10 text-primary rounded-lg text-sm font-bold">Réessayer</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WeatherWidget;
