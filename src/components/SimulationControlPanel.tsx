import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Settings, 
  Thermometer, 
  Droplets, 
  Wind, 
  Sun, 
  Cloud,
  Battery,
  Activity,
  Heart
} from 'lucide-react';
import { 
  getSimulationEnvironment, 
  getAnimalBehavior, 
  getAnimalHealth,
  updateEnhancedSimulationConfig,
  startEnhancedSimulation,
  stopEnhancedSimulation 
} from '../utils/enhancedSimulation';
import { useIoTStore } from '../hooks/useIoTStore';

const SimulationControlPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [animalCount, setAnimalCount] = useState(200);
  const [updateInterval, setUpdateInterval] = useState(3000);
  const [environment, setEnvironment] = useState<any>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<string>('');
  
  const { devices } = useIoTStore();

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRunning) {
        setEnvironment(getSimulationEnvironment());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStart = () => {
    startEnhancedSimulation();
    setIsRunning(true);
  };

  const handleStop = () => {
    stopEnhancedSimulation();
    setIsRunning(false);
  };

  const handleConfigUpdate = () => {
    updateEnhancedSimulationConfig(animalCount, updateInterval);
    setShowSettings(false);
  };

  const getWeatherIcon = (weather: string) => {
    switch (weather) {
      case 'sunny': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'cloudy': return <Cloud className="w-4 h-4 text-gray-500" />;
      case 'rainy': return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'windy': return <Wind className="w-4 h-4 text-gray-400" />;
      default: return <Sun className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getTimeOfDayColor = (timeOfDay: string) => {
    switch (timeOfDay) {
      case 'dawn': return 'bg-orange-200 text-orange-800';
      case 'morning': return 'bg-blue-200 text-blue-800';
      case 'afternoon': return 'bg-yellow-200 text-yellow-800';
      case 'evening': return 'bg-purple-200 text-purple-800';
      case 'night': return 'bg-gray-800 text-gray-200';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const selectedAnimalData = selectedAnimal ? devices[selectedAnimal] : null;
  const selectedBehavior = selectedAnimal ? getAnimalBehavior(selectedAnimal) : null;
  const selectedHealth = selectedAnimal ? getAnimalHealth(selectedAnimal) : null;

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-y-auto z-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Simulation Control</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={isRunning ? handleStop : handleStart}
            className={`p-2 rounded ${isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Environment Display */}
      {environment && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Environment</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-2">
              {getWeatherIcon(environment.weather)}
              <span className="capitalize">{environment.weather}</span>
            </div>
            <div className={`px-2 py-1 rounded text-xs ${getTimeOfDayColor(environment.timeOfDay)}`}>
              {environment.timeOfDay}
            </div>
            <div className="flex items-center space-x-1">
              <Thermometer className="w-3 h-3 text-red-500" />
              <span>{environment.temperature.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center space-x-1">
              <Droplets className="w-3 h-3 text-blue-500" />
              <span>{environment.humidity.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Animal Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Animal
        </label>
        <select
          value={selectedAnimal}
          onChange={(e) => setSelectedAnimal(e.target.value)}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
        >
          <option value="">Choose an animal...</option>
          {Object.values(devices).map((animal: any) => (
            <option key={animal.collar_id} value={animal.collar_id}>
              {animal.name} ({animal.collar_id})
            </option>
          ))}
        </select>
      </div>

      {/* Selected Animal Details */}
      {selectedAnimalData && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="font-medium text-sm text-blue-800 dark:text-blue-300 mb-2">
            {selectedAnimalData.name}
          </h4>
          
          {/* Behavior */}
          {selectedBehavior && (
            <div className="mb-2">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Behavior</div>
              <div className="text-xs space-y-1">
                <div>Pattern: <span className="font-medium capitalize">{selectedBehavior.grazingPattern.replace('_', ' ')}</span></div>
                <div>Energy: <span className="font-medium">{(selectedBehavior.energyLevel * 100).toFixed(0)}%</span></div>
                <div>Stress: <span className="font-medium">{(selectedBehavior.stressLevel * 100).toFixed(0)}%</span></div>
              </div>
            </div>
          )}

          {/* Health Metrics */}
          {selectedHealth && (
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Health Metrics</div>
              <div className="text-xs space-y-1">
                <div className="flex items-center space-x-1">
                  <Heart className="w-3 h-3 text-red-500" />
                  <span>HR: {selectedHealth.heartRate.toFixed(0)} BPM</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Thermometer className="w-3 h-3 text-orange-500" />
                  <span>Temp: {selectedHealth.bodyTemperature.toFixed(1)}°C</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span>Hydration: {selectedHealth.hydration.toFixed(0)}%</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-green-500" />
                  <span>Nutrition: {selectedHealth.nutrition.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Settings</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Animal Count: {animalCount}
              </label>
              <input
                type="range"
                min="10"
                max="500"
                value={animalCount}
                onChange={(e) => setAnimalCount(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Update Interval: {updateInterval}ms
              </label>
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={updateInterval}
                onChange={(e) => setUpdateInterval(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <button
              onClick={handleConfigUpdate}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded"
            >
              Apply Changes
            </button>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            Status: <span className={`font-medium ${isRunning ? 'text-green-600' : 'text-red-600'}`}>
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            Animals: <span className="font-medium">{Object.keys(devices).length}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default SimulationControlPanel;
