import AlertBadge from './AlertBadge';

export default {
  title: 'UI/AlertBadge',
  component: AlertBadge,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['geofence', 'battery', 'health'],
    },
    count: { control: { type: 'number' } },
  },
};

export const Geofence = {
  args: {
    type: 'geofence',
    count: 3,
  },
};

export const BatteryLow = {
  args: {
    type: 'battery',
    count: 5,
  },
};

export const HealthIssue = {
  args: {
    type: 'health',
    count: 1,
  },
};
