import React, { type ErrorInfo, type ReactNode } from 'react';
import { Map } from 'lucide-react';
import { devLog } from '../../utils/devLogger';

interface MapErrorBoundaryProps {
    children: ReactNode;
    onRetry: () => void;
}

interface MapErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export default class MapErrorBoundary extends React.Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
    state: MapErrorBoundaryState = {
        hasError: false,
        error: null,
    };

    static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        devLog('[MapErrorBoundary]', error, info);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
        this.props.onRetry();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div
                    role="alert"
                    className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 text-center dark:border-red-500/30 dark:bg-red-500/10"
                >
                    <Map className="h-10 w-10 text-red-600 dark:text-red-300" />
                    <p className="font-semibold text-red-700 dark:text-red-200">La carte a rencontré une erreur</p>
                    <p className="max-w-md text-sm text-red-600/90 dark:text-red-100/80">
                        {import.meta.env.DEV ? this.state.error?.message : 'Le rendu géospatial a échoué.'}
                    </p>
                    <button
                        type="button"
                        onClick={this.handleRetry}
                        className="mt-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                    >
                        Réessayer
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
