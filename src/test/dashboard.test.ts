import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard/Dashboard';
import { useIoTStore } from '../hooks/useIoTStore';
import { makeAlert, makeAnimal } from './factories';

vi.mock('../contexts/MqttContext', () => ({ useMqtt: () => ({ isConnected: true }) }));
vi.mock('../hooks/useMapWorker', () => ({ useMapWorker: () => ({ enrichedAnimals: [makeAnimal({ collar_id: 'A1' }), makeAnimal({ collar_id: 'A2' })], kpis: { totalActive: 34, safe: 0, outOfZone: 78, lowBattery: 0, critical: 0, avgBattery: 88, unreadAlerts: 0, criticalAlerts: 0 } }) }));
vi.mock('../services/geofenceService', () => ({ default: { getZones: vi.fn().mockResolvedValue([]) } }));
vi.mock('../components/widgets/WeatherWidget', () => ({ default: () => React.createElement('div', { 'data-testid': 'weather-widget' }) }));
vi.mock('../components/widgets/MiniMapPreview', () => ({ default: () => React.createElement('div', { 'data-testid': 'mini-map' }) }));
vi.mock('react-chartjs-2', () => ({ Line: () => React.createElement('div', { 'data-testid': 'chart' }) }));

beforeEach(() => { useIoTStore.setState({ devices: { A1: makeAnimal({ collar_id: 'A1', battery: 12, temperature: 78 }) }, history: {}, alerts: [makeAlert({ id: 'a1' })], aiAlerts: [], needsCharging: [], isConnected: false, isOfflineData: false }); });

it('renders KPI cards', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() });
    vi.useFakeTimers();
    render(React.createElement(MemoryRouter, null, React.createElement(Dashboard)));
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(screen.getByText('Tableau de bord intelligent')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('78.0°C')).toBeInTheDocument();
    expect(screen.getByText('1 critiques (<20%)')).toBeInTheDocument();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy.mock.calls.filter(([message]) => String(message).includes('Dashboard'))).toHaveLength(0);
});
