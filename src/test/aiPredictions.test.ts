import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AIPredictionDashboard from '../components/ai/AIPredictionDashboard';
import { useIoTStore } from '../hooks/useIoTStore';
import { makeAlert, makeAnimal, makePrediction } from './factories';

const apiGet = vi.hoisted(() => vi.fn());
vi.mock('../services/api.js', () => ({ default: { get: apiGet } }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr', changeLanguage: vi.fn() } }) }));
vi.mock('../components/ai/AIInsightsFeed', () => ({ default: () => React.createElement('div') }));
vi.mock('../components/widgets/AnomalyHeatmap', () => ({ default: () => React.createElement('div') }));
vi.mock('../components/ui/KpiCard', () => ({ default: () => React.createElement('div') }));
vi.mock('react-chartjs-2', () => ({ Line: () => React.createElement('div') }));

beforeEach(() => { apiGet.mockReset(); useIoTStore.setState({ devices: { A1: makeAnimal({ name: 'Store Sheep' }) }, history: {}, alerts: [makeAlert()], aiAlerts: [makeAlert()], needsCharging: [], isConnected: false, isSimulation: true, isOfflineData: false }); });

it('uses simulation values without surfacing backend errors', async () => {
    render(React.createElement(MemoryRouter, null, React.createElement(AIPredictionDashboard)));
    await waitFor(() => expect(apiGet).not.toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows an error state when the API call fails outside simulation mode', async () => {
    useIoTStore.setState({ devices: { A1: makeAnimal({ name: 'Store Sheep' }) }, history: {}, alerts: [makeAlert()], aiAlerts: [makeAlert()], needsCharging: [], isConnected: false, isSimulation: false, isOfflineData: false });
    apiGet.mockRejectedValue(new Error('boom'));
    render(React.createElement(MemoryRouter, null, React.createElement(AIPredictionDashboard)));
    expect(await screen.findByRole('status')).toHaveTextContent('Chargement des prédictions indisponible.');
});

it('renders valid predictions', async () => {
    useIoTStore.setState({ devices: { A1: makeAnimal({ name: 'Store Sheep' }) }, history: {}, alerts: [makeAlert()], aiAlerts: [makeAlert()], needsCharging: [], isConnected: false, isSimulation: false, isOfflineData: false });
    const prediction = makePrediction({ name: 'Brebis A', sheepId: 'sheep-a' });
    apiGet.mockImplementation((url: string) => Promise.resolve(url.includes('all') ? { data: { data: { predictions: [prediction] } } } : { data: { data: { totalAnimals: 1, riskDistribution: { low: 1, medium: 0, high: 0, critical: 0 }, averageRiskScore: 20, animalsWithAnomalies: 0, highRiskAnimals: [] } } }));
    render(React.createElement(MemoryRouter, null, React.createElement(AIPredictionDashboard)));
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
});