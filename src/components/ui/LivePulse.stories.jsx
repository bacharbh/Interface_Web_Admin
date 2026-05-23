import LivePulse from './LivePulse';

export default {
  title: 'UI/LivePulse',
  component: LivePulse,
  tags: ['autodocs'],
};

export const Connected = {
  args: {
    connected: true,
  },
};

export const Disconnected = {
  args: {
    connected: false,
  },
};
