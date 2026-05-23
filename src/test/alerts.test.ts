import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Alerts from '../pages/Alerts/Alerts';
import { useIoTStore } from '../hooks/useIoTStore';
import { makeAlert } from './factories';

const mocks = vi.hoisted(() => ({ saveData: vi.fn(), loadData: vi.fn().mockResolvedValue(null), handler: undefined as undefined | ((payload: any) => void) }));
vi.mock('../utils/persistence', () => ({ saveData: mocks.saveData, loadData: mocks.loadData }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ token: 'token' }) }));
vi.mock('../services/socket', () => ({ connectSocket: vi.fn(), disconnectSocket: vi.fn(), socket: { on: vi.fn((_event, cb) => { mocks.handler = cb; }), off: vi.fn() } }));

const reset = () => useIoTStore.setState({ alerts: [], devices: {}, history: {}, aiAlerts: [], needsCharging: [], isConnected: false, isSimulation: true, isOfflineData: false });
beforeEach(() => { reset(); mocks.saveData.mockClear(); mocks.handler = undefined; });

it('persists read state after a later store update', () => {
    const alert = makeAlert({ id: 'a1' });
    useIoTStore.getState().addAlert(alert);
    useIoTStore.getState().markAlertAsRead(alert.id);
    useIoTStore.getState().addAlert(makeAlert({ id: 'a2', read: false }));
    expect(useIoTStore.getState().alerts[0].read).toBe(true);
    expect(mocks.saveData).toHaveBeenCalledWith('last_known_alerts', expect.arrayContaining([expect.objectContaining({ id: 'a1', read: true })]));
});

it('deduplicates alerts with the same natural key', () => {
    useIoTStore.getState().addAlert(makeAlert({ id: 'a1' }));
    useIoTStore.getState().addAlert(makeAlert({ id: 'a2' }));
    expect(useIoTStore.getState().alerts).toHaveLength(1);
});

it('marks all alerts as read', () => {
    useIoTStore.getState().setAlerts([makeAlert({ id: 'a1' }), makeAlert({ id: 'a2' })]);
    useIoTStore.getState().markAllAlertsAsRead();
    expect(useIoTStore.getState().alerts.every((alert) => alert.read)).toBe(true);
});

it('deduplicates websocket ingestion of the same alert twice', async () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Alerts)));
    await waitFor(() => expect(mocks.handler).toBeDefined());
    act(() => {
        mocks.handler?.({ type: 'LOW_BATTERY', collar_id: 'COLLAR-1', animal_name: 'Brebis 1', severity: 'WARNING', timestamp: '2026-05-22T10:00:00.000Z' });
        mocks.handler?.({ type: 'LOW_BATTERY', collar_id: 'COLLAR-1', animal_name: 'Brebis 1', severity: 'WARNING', timestamp: '2026-05-22T10:00:00.000Z' });
    });
    await waitFor(() => expect(useIoTStore.getState().alerts).toHaveLength(1));
});