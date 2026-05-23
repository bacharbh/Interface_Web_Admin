import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WeatherWidget from '../components/widgets/WeatherWidget';

const getCurrentWeather = vi.hoisted(() => vi.fn());
vi.mock('../services/weatherService', () => ({ getCurrentWeather }));
vi.mock('../hooks/useFarmConfig', () => ({ useFarmConfig: () => ({ farmLat: 35.1, farmLng: -5.2, farmName: 'Ferme Smart Shepherd' }) }));

beforeEach(() => { getCurrentWeather.mockReset(); });

it('uses farm coordinates and shows the loading skeleton', async () => {
    let resolveWeather!: (value: unknown) => void;
    getCurrentWeather.mockReturnValueOnce(new Promise((resolve) => { resolveWeather = resolve; }));
    const { container } = render(React.createElement(WeatherWidget));
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    resolveWeather({ current: { temp: 21, windSpeed: 12, humidity: 60 }, weather: { main: 'Clear' } });
    await waitFor(() => expect(getCurrentWeather).toHaveBeenCalledWith(35.1, -5.2));
});

it('shows forecast error and retry when fetching fails', async () => {
    getCurrentWeather.mockResolvedValueOnce({ current: { temp: 21, windSpeed: 12, humidity: 60 }, weather: { main: 'Clear' } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    render(React.createElement(WeatherWidget));
    fireEvent.click(await screen.findByText('Pâturages N°1'));
    expect(await screen.findByText('Erreur de chargement des prévisions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
});