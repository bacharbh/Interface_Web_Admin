import AnimalCard from './AnimalCard';

export default {
  title: 'UI/AnimalCard',
  component: AnimalCard,
  tags: ['autodocs'],
};

export const Safe = {
  args: {
    name: 'Bébért le Mouton',
    battery: 85,
    status: 'safe',
    coordinates: { lat: 45.123456, lng: 5.678901 },
  },
};

export const Critical = {
  args: {
    name: 'Gertrude',
    battery: 12,
    status: 'out_of_zone',
    coordinates: { lat: 45.999888, lng: 5.999888 },
  },
};

export const LowBattery = {
  args: {
    name: 'Shaun',
    battery: 5,
    status: 'low_battery',
    coordinates: { lat: 45.454545, lng: 5.454545 },
  },
};
