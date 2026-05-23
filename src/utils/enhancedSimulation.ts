import { Alert, queueIoTUpdate, useIoTStore } from '../hooks/useIoTStore';
import { IAnimal as Animal } from '../types';
import { notificationService } from '../services/notificationService';

// Enhanced simulation with realistic animal behavior
const BREEDS = ['Merinos', 'Ouessant', 'Suffolk', 'Rambouillet', 'Lacaune', 'Texel', 'Dorper', 'Jacob'];
const NAMES_PREFIX = ['Bélier', 'Brebis', 'Agneau', 'Mouton'];

// Environmental factors
interface EnvironmentState {
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
  weather: 'sunny' | 'cloudy' | 'rainy' | 'windy';
  temperature: number;
  humidity: number;
}

// Animal behavior patterns
interface AnimalBehavior {
  grazingPattern: 'active' | 'resting' | 'seeking_shelter' | 'socializing';
  stressLevel: number;
  energyLevel: number;
  preferredTerrain: 'open' | 'shaded' | 'near_water' | 'near_shelter';
}

// Health simulation parameters
interface HealthMetrics {
  heartRate: number;
  bodyTemperature: number;
  hydration: number;
  nutrition: number;
  stress: number;
}

class EnhancedSimulation {
  private environment: EnvironmentState;
  private animalBehaviors: Map<string, AnimalBehavior> = new Map();
  private healthMetrics: Map<string, HealthMetrics> = new Map();
  private timeElapsed = 0;

  constructor() {
    this.environment = this.generateInitialEnvironment();
  }

  private generateInitialEnvironment(): EnvironmentState {
    const hour = new Date().getHours();
    let timeOfDay: EnvironmentState['timeOfDay'];

    if (hour >= 5 && hour < 8) timeOfDay = 'dawn';
    else if (hour >= 8 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 20) timeOfDay = 'evening';
    else timeOfDay = 'night';

    return {
      timeOfDay,
      weather: ['sunny', 'cloudy', 'rainy', 'windy'][Math.floor(Math.random() * 4)] as EnvironmentState['weather'],
      temperature: 15 + Math.random() * 20, // 15-35°C
      humidity: 30 + Math.random() * 50 // 30-80%
    };
  }

  private generateAnimalBehavior(animal: Animal): AnimalBehavior {
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour > 20;

    // Sheep are more active during dawn and dusk
    const isActive = this.environment.timeOfDay === 'dawn' || this.environment.timeOfDay === 'evening';

    // Weather affects behavior
    const weatherStress = this.environment.weather === 'rainy' ? 0.3 :
      this.environment.weather === 'windy' ? 0.2 : 0.1;

    // Temperature affects energy
    const tempComfort = this.environment.temperature >= 10 && this.environment.temperature <= 25;
    const energyLevel = tempComfort ? 0.8 : 0.5;

    // Health affects behavior
    const healthFactor = animal.health === 'Good' ? 0.1 :
      animal.health === 'Warning' ? 0.4 : 0.7;

    let grazingPattern: AnimalBehavior['grazingPattern'];
    if (isNight) grazingPattern = 'resting';
    else if (this.environment.weather === 'rainy') grazingPattern = 'seeking_shelter';
    else if (isActive && energyLevel > 0.6) grazingPattern = 'active';
    else grazingPattern = 'socializing';

    return {
      grazingPattern,
      stressLevel: Math.min(1, weatherStress + healthFactor + Math.random() * 0.2),
      energyLevel: Math.max(0, energyLevel - healthFactor - Math.random() * 0.3),
      preferredTerrain: this.environment.weather === 'sunny' ? 'shaded' : 'open'
    };
  }

  private generateHealthMetrics(animal: Animal): HealthMetrics {
    const behavior = this.animalBehaviors.get(animal.collar_id) || this.generateAnimalBehavior(animal);

    // Base metrics
    let heartRate = 70 + Math.random() * 30; // 70-100 BPM normal
    let bodyTemperature = 38.5 + Math.random() * 1.5; // 38.5-40°C normal

    // Stress affects heart rate
    heartRate += behavior.stressLevel * 40;

    // Activity affects temperature
    if (behavior.grazingPattern === 'active') {
      bodyTemperature += 0.5;
      heartRate += 10;
    }

    // Environment affects metrics
    if (this.environment.temperature > 30) {
      bodyTemperature += 0.8;
      heartRate += 15;
    }

    // Health status affects metrics
    if (animal.health === 'Warning') {
      heartRate += 20;
      bodyTemperature += 0.3;
    } else if (animal.health === 'Critical') {
      heartRate += 40;
      bodyTemperature += 0.8;
    }

    return {
      heartRate: Math.min(200, Math.max(40, heartRate)),
      bodyTemperature: Math.min(42, Math.max(36, bodyTemperature)),
      hydration: Math.max(0, 100 - Math.random() * 30 - behavior.stressLevel * 20),
      nutrition: Math.max(0, 80 + Math.random() * 20 - behavior.stressLevel * 10),
      stress: behavior.stressLevel
    };
  }

  private calculateRealisticMovement(animal: Animal): { lat: number; lng: number; speed: number; heading: number } {
    const behavior = this.animalBehaviors.get(animal.collar_id) || this.generateAnimalBehavior(animal);
    const health = this.healthMetrics.get(animal.collar_id) || this.generateHealthMetrics(animal);

    // Base movement parameters
    let moveFactor = 0.0001; // Base movement
    let speed = 0.5; // km/h

    // Behavior affects movement
    switch (behavior.grazingPattern) {
      case 'active':
        moveFactor = 0.0008;
        speed = 2.5 + Math.random() * 2;
        break;
      case 'resting':
        moveFactor = 0.00005;
        speed = 0.1 + Math.random() * 0.3;
        break;
      case 'seeking_shelter':
        moveFactor = 0.0012;
        speed = 3.0 + Math.random() * 2;
        break;
      case 'socializing':
        moveFactor = 0.0003;
        speed = 0.8 + Math.random() * 1;
        break;
    }

    // Health affects movement
    if (animal.health === 'Warning') {
      moveFactor *= 0.6;
      speed *= 0.7;
    } else if (animal.health === 'Critical') {
      moveFactor *= 0.3;
      speed *= 0.4;
    }

    // Energy affects movement
    moveFactor *= behavior.energyLevel;
    speed *= behavior.energyLevel;

    // Calculate new position with realistic movement patterns
    const currentHeading = animal.heading || 0;
    const headingChange = (Math.random() - 0.5) * 60; // ±30 degrees change
    const newHeading = (currentHeading + headingChange + 360) % 360;

    // Add some meandering to movement
    const meanderFactor = Math.sin(this.timeElapsed * 0.1 + parseInt(animal.collar_id.slice(1))) * 0.0002;

    const latChange = Math.cos(newHeading * Math.PI / 180) * moveFactor + meanderFactor;
    const lngChange = Math.sin(newHeading * Math.PI / 180) * moveFactor;

    return {
      lat: animal.lat + latChange,
      lng: animal.lng + lngChange,
      speed: +(speed * (0.8 + Math.random() * 0.4)).toFixed(1),
      heading: Math.floor(newHeading)
    };
  }

  private simulateBatteryDrain(animal: Animal): number {
    const behavior = this.animalBehaviors.get(animal.collar_id) || this.generateAnimalBehavior(animal);

    // Base drain rate
    let drainRate = 0.1; // % per update cycle

    // Activity affects battery
    if (behavior.grazingPattern === 'active') drainRate *= 1.5;
    if (behavior.grazingPattern === 'seeking_shelter') drainRate *= 1.3;

    // Health affects battery (sick animals might have irregular collar behavior)
    if (animal.health === 'Warning') drainRate *= 1.2;
    if (animal.health === 'Critical') drainRate *= 1.4;

    // Random battery events
    if (Math.random() < 0.02) drainRate *= 2; // Sudden drain

    return Math.max(0, animal.battery - drainRate);
  }

  public generateEnvironmentalAlert(): Alert | null {
    if (Math.random() > 0.01) return null; // 1% chance per cycle

    const alertTypes = [
      { type: 'WEATHER_WARNING', message: 'Changement météorologique détecté' },
      { type: 'TEMPERATURE_EXTREME', message: 'Température extrême' },
      { type: 'HUMIDITY_HIGH', message: 'Taux d\'humidité élevé' }
    ];

    const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];

    return {
      id: Date.now() + Math.random(),
      type: alert.type as any,
      collar_id: 'ENVIRONMENT',
      animal_name: 'Système',
      severity: 'WARNING',
      timestamp: new Date().toISOString(),
      read: false,
      message: alert.message
    };
  }

  public updateEnvironment() {
    this.timeElapsed++;

    // Gradually change environment
    if (this.timeElapsed % 100 === 0) { // Every 100 cycles
      // Change weather occasionally
      if (Math.random() < 0.3) {
        const weathers: EnvironmentState['weather'][] = ['sunny', 'cloudy', 'rainy', 'windy'];
        this.environment.weather = weathers[Math.floor(Math.random() * weathers.length)];
      }

      // Fluctuate temperature
      this.environment.temperature += (Math.random() - 0.5) * 2;
      this.environment.temperature = Math.max(5, Math.min(40, this.environment.temperature));

      // Update time of day
      const hour = (new Date().getHours() + Math.floor(this.timeElapsed / 200)) % 24;
      if (hour >= 5 && hour < 8) this.environment.timeOfDay = 'dawn';
      else if (hour >= 8 && hour < 12) this.environment.timeOfDay = 'morning';
      else if (hour >= 12 && hour < 17) this.environment.timeOfDay = 'afternoon';
      else if (hour >= 17 && hour < 20) this.environment.timeOfDay = 'evening';
      else this.environment.timeOfDay = 'night';
    }
  }

  public updateAnimal(animal: Animal): Partial<Animal> {
    // Update behavior
    const behavior = this.generateAnimalBehavior(animal);
    this.animalBehaviors.set(animal.collar_id, behavior);

    // Update health metrics
    const health = this.generateHealthMetrics(animal);
    this.healthMetrics.set(animal.collar_id, health);

    // Calculate movement
    const movement = this.calculateRealisticMovement(animal);

    // Simulate battery drain
    const newBattery = this.simulateBatteryDrain(animal);

    // Update health status based on metrics
    let newHealth: 'Good' | 'Warning' | 'Critical' = 'Good';
    if (health.stress > 0.7 || health.hydration < 30 || health.nutrition < 20) {
      newHealth = 'Critical';
    } else if (health.stress > 0.4 || health.hydration < 50 || health.nutrition < 40) {
      newHealth = 'Warning';
    }

    return {
      lat: movement.lat,
      lng: movement.lng,
      speed: movement.speed,
      heading: movement.heading,
      battery: newBattery,
      temperature: health.bodyTemperature,
      heartRate: health.heartRate,
      health: newHealth,
      lastUpdate: new Date().toLocaleTimeString(),
      rssi: -Math.floor(Math.random() * 40 + 50) // Signal strength
    };
  }

  public getEnvironment(): EnvironmentState {
    return { ...this.environment };
  }

  public getAnimalBehavior(collarId: string): AnimalBehavior | undefined {
    return this.animalBehaviors.get(collarId);
  }

  public getHealthMetrics(collarId: string): HealthMetrics | undefined {
    return this.healthMetrics.get(collarId);
  }
}

// Enhanced simulation functions
const enhancedSim = new EnhancedSimulation();

export function generateEnhancedMockAnimals(count = 200): Animal[] {
  const animals: Animal[] = [];
  const centerLat = 33.885;
  const centerLng = -5.54;
  const spreadLat = 0.012;
  const spreadLng = 0.015;

  for (let i = 1; i <= count; i++) {
    const id = `C${String(i).padStart(3, '0')}`;
    const prefix = NAMES_PREFIX[Math.floor(Math.random() * NAMES_PREFIX.length)];
    const breed = BREEDS[Math.floor(Math.random() * BREEDS.length)];

    // More realistic health distribution
    const healthRand = Math.random();
    let health: 'Good' | 'Warning' | 'Critical';
    if (healthRand < 0.8) health = 'Good';
    else if (healthRand < 0.95) health = 'Warning';
    else health = 'Critical';

    // Battery based on health
    const battery = health === 'Critical'
      ? Math.floor(Math.random() * 15) + 3
      : health === 'Warning'
        ? Math.floor(Math.random() * 30) + 15
        : Math.floor(Math.random() * 40) + 60;

    animals.push({
      collar_id: id,
      name: `${prefix} #${i}`,
      breed,
      lat: centerLat + (Math.random() - 0.5) * spreadLat,
      lng: centerLng + (Math.random() - 0.5) * spreadLng,
      status: 'SAFE',
      battery,
      health,
      speed: +(Math.random() * 2).toFixed(1),
      heading: Math.floor(Math.random() * 360),
      temperature: +(38 + Math.random() * 2).toFixed(1),
      lastUpdate: new Date().toLocaleTimeString()
    });
  }
  return animals;
}

let simInterval: NodeJS.Timeout | null = null;
let currentCount = 200;
let currentInterval = 3000;

export const updateEnhancedSimulationConfig = (count: number, interval: number) => {
  currentCount = count;
  currentInterval = interval;

  if (simInterval) {
    stopEnhancedSimulation();
    startEnhancedSimulation();
  }
};

export const startEnhancedSimulation = () => {
  if (simInterval) return;

  const mockAnimals = generateEnhancedMockAnimals(currentCount);
  const store = useIoTStore.getState();

  // Initial state push
  const initialUpdates: Record<string, Partial<Animal>> = {};
  mockAnimals.forEach(a => {
    initialUpdates[a.collar_id] = { ...a };
  });
  store.batchUpdateDevices(initialUpdates);

  simInterval = setInterval(() => {
    enhancedSim.updateEnvironment();
    const currentState = useIoTStore.getState().devices;

    Object.keys(currentState).forEach(id => {
      const animal = currentState[id];
      const updatedData = enhancedSim.updateAnimal(animal);

      // Update via batched queue for performance
      queueIoTUpdate(id, updatedData);

      // Enhanced alert generation
      if (Math.random() < 0.008) { // Slightly higher alert rate
        const alertTypes = ['OUT_OF_ZONE', 'LOW_BATTERY', 'HEALTH_WARNING', 'COLLAR_OFFLINE', 'BEHAVIOR_ANOMALY'];
        const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        const severity = Math.random() > 0.7 ? 'CRITICAL' : 'WARNING';

        const newAlert: Alert = {
          id: Date.now() + Math.random(),
          type,
          collar_id: id,
          animal_name: animal.name,
          severity: severity as 'CRITICAL' | 'WARNING',
          timestamp: new Date().toISOString(),
          read: false,
        };

        store.addAlert(newAlert);
        notificationService.playNotification(severity === 'CRITICAL' ? 'critical' : 'default');
      }
    });

    // Environmental alerts
    const envAlert = enhancedSim.generateEnvironmentalAlert();
    if (envAlert) {
      store.addAlert(envAlert);
      notificationService.playNotification('warning');
    }
  }, currentInterval);
};

export const stopEnhancedSimulation = () => {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
};

export const getSimulationEnvironment = () => enhancedSim.getEnvironment();
export const getAnimalBehavior = (collarId: string) => enhancedSim.getAnimalBehavior(collarId);
export const getAnimalHealth = (collarId: string) => enhancedSim.getHealthMetrics(collarId);
