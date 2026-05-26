import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth, USER_ROLES } from './contexts/AuthContext';
import { MqttProvider } from './contexts/MqttContext';
import AppLayout from './components/layout/AppLayout';
import { devLog } from './utils/devLogger';
import DevErrorBoundary from './components/ErrorBoundary'
import { useDataRefresh } from './hooks/useDataRefresh';
import Dashboard from './pages/Dashboard/Dashboard_OPTIMIZED';
import MapMonitor from './pages/Map/MapMonitor';
import Users from './pages/Users/Users';
import Animals from './pages/Animals/Animals';
import AnimalDetail from './pages/Animals/AnimalDetail';
import AnimalProfile from './pages/Animals/AnimalProfile';
import CompareView from './pages/Animals/CompareView';
import AgendaView from './pages/Agenda/AgendaView';
import Alerts from './pages/Alerts/Alerts';
import Anomalies from './pages/Anomalies/Anomalies';
import Analytics from './pages/Analytics/Analytics';
import Hardware from './pages/Hardware/Hardware';
import Settings from './pages/Settings/Settings';
import AISettings from './pages/Admin/AISettings';
import AIAnalysis from './components/ai/AIAnalysis';
const AIPredictionDashboard = React.lazy(() => import('./components/ai/AIPredictionDashboard'));
import LabellingPage from './pages/Admin/LabellingPage';
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';

const normalizeRole = (role?: string | null) => (role ?? '').trim().toLowerCase();

// ============================================
// ERROR BOUNDARY - Capture toutes les erreurs React
// ============================================
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep crash details out of production consoles; only emit them in DEV.
    devLog('[ErrorBoundary] Caught error:', error);
    devLog('[ErrorBoundary] Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const MapError = () => (
  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
    <h3 className="text-lg font-bold">La carte a rencontré une erreur</h3>
    <p className="mt-2 text-sm">Les données de géolocalisation n’ont pas pu être affichées. Rechargez la page pour réessayer.</p>
  </div>
);

const ChartError = () => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
    <h3 className="text-lg font-bold">Les graphiques sont indisponibles</h3>
    <p className="mt-2 text-sm">Le tableau de bord reste accessible, mais les graphiques ont été désactivés après une erreur.</p>
  </div>
);

const AlertError = () => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
    <h3 className="text-lg font-bold">Le centre d'alertes est momentanément indisponible</h3>
    <p className="mt-2 text-sm">Les alertes n’ont pas pu être rendues. Le reste du dashboard continue de fonctionner.</p>
  </div>
);

const LegacyAnimalRedirect = () => {
  const { id } = useParams<{ id: string }>();

  return <Navigate to={id ? `/animals/${id}` : '/animals'} replace />;
};

// ============================================
// LOGIN COMPONENT
// ============================================
const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [isShaking, setIsShaking] = useState(false);

  const triggerShake = () => {
    setIsShaking(false);
    window.requestAnimationFrame(() => {
      setIsShaking(true);
      window.setTimeout(() => setIsShaking(false), 450);
    });
  };

  const validate = () => {
    const nextErrors: { identifier?: string; password?: string } = {};

    if (!identifier.trim()) {
      nextErrors.identifier = 'L’identifiant est requis.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Le mot de passe est requis.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) {
      setGeneralError('Veuillez corriger les champs signalés.');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    setGeneralError('');
    try {
      await login({ email: identifier, password });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setGeneralError(error instanceof Error ? error.message : 'Identifiants invalides ou serveur d’authentification indisponible.');
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDevMode = import.meta.env.DEV;
  const heroImageUrl = `${import.meta.env.BASE_URL || '/'}sheep-logo.png`;

  return (
    <div className="min-h-screen bg-[var(--page-bg)] lg:grid lg:h-screen lg:grid-cols-[44%_56%] lg:overflow-hidden">
      <style>{`
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(4px); }
        }
      `}</style>

      <section className="relative flex min-h-[42vh] items-center overflow-hidden bg-[var(--sidebar-bg)] px-6 py-10 text-white sm:px-10 lg:min-h-0 lg:px-12">
        <div className="absolute inset-0">
          <img
            src={heroImageUrl}
            alt="Troupeau de moutons"
            className="h-full w-full scale-125 object-cover object-center opacity-20 blur-2xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(26,26,24,0.86),rgba(15,110,86,0.72))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_35%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.08),transparent_30%)]" />
        </div>

        <div className="relative z-10 max-w-xl pl-0 lg:pl-2">
          <div className="mb-10 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-white/95">
            <img src={heroImageUrl} alt="Smart Shepherd" className="h-full w-full object-cover" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Artisanal Tech</p>
          <h1 className="mt-2 text-[32px] font-medium leading-tight tracking-tight text-white">Smart Shepherd</h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-white/78">
            La nouvelle ère de la surveillance du bétail par l'IA et l'IoT.
          </p>
        </div>
      </section>

      <section className="flex min-h-[58vh] items-center justify-center bg-[var(--page-bg)] px-6 py-10 sm:px-10 lg:min-h-0 lg:px-12">
        <div className={`w-full max-w-[420px] lg:translate-y-[-2%] ${isShaking ? 'animate-[login-shake_0.45s_ease-in-out]' : ''}`}>
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Connexion</p>
            <h2 className="mt-2 text-[24px] font-medium text-[var(--text-primary)]">Bienvenue</h2>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Accédez à votre tableau de bord opérationnel.</p>
          </div>

          <form
            className="mt-10 space-y-5 rounded-[10px] border border-[var(--card-border)] bg-white p-6 dark:bg-[var(--card-bg)]"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
            noValidate
          >
            <div>
              <label htmlFor="login-identifier" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
                Identifiant
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    setFieldErrors((current) => ({ ...current, identifier: undefined }));
                    setGeneralError('');
                  }}
                  autoComplete="username"
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  aria-describedby={fieldErrors.identifier ? 'identifier-error' : undefined}
                  aria-label="Identifiant"
                  placeholder="Entrez votre identifiant"
                  disabled={isSubmitting}
                  className="h-14 w-full rounded-[10px] border border-[var(--card-border)] bg-white pl-12 pr-4 text-[14px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[rgba(29,158,117,0.12)] disabled:cursor-not-allowed disabled:bg-[#fafaf8] dark:bg-[var(--card-bg)]"
                />
              </div>
              {fieldErrors.identifier && (
                <p id="identifier-error" className="mt-2 text-[12px] text-[var(--danger)]" role="alert">
                  {fieldErrors.identifier}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                    setGeneralError('');
                  }}
                  autoComplete="current-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  aria-label="Mot de passe"
                  placeholder="Entrez votre mot de passe"
                  disabled={isSubmitting}
                  className="h-14 w-full rounded-[10px] border border-[var(--card-border)] bg-white pl-12 pr-14 text-[14px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[rgba(29,158,117,0.12)] disabled:cursor-not-allowed disabled:bg-[#fafaf8] dark:bg-[var(--card-bg)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[var(--text-muted)] transition hover:bg-[#fafaf8] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(29,158,117,0.18)]"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className="mt-2 text-[12px] text-[var(--danger)]" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {generalError && (
              <p className="rounded-[10px] border border-[var(--danger)] bg-[var(--danger-bg)] px-4 py-3 text-[12px] text-[var(--danger)]" role="alert" aria-live="polite">
                {generalError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-14 w-full items-center justify-center rounded-[10px] bg-[var(--brand-primary)] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[var(--brand-dark)] focus:outline-none focus:ring-4 focus:ring-[rgba(29,158,117,0.2)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Connexion...
                </span>
              ) : (
                'Se connecter'
              )}
            </button>

            {isDevMode && (
              <div className="flex justify-center pt-2">
                <div className="rounded-full border border-[var(--card-border)] bg-[#fafaf8] px-4 py-2 text-[12px] text-[var(--text-muted)]" aria-label="Identifiants par défaut en environnement de développement">
                  Identifiants par défaut : <span className="font-medium text-[var(--text-primary)]">admin / admin123</span>
                </div>
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  );
};

// ============================================
// AUTHENTICATED APP WRAPPER - Manages data refresh
// ============================================
const AuthenticatedAppWrapper = () => {
  // Note: Global data refresh is already handled by individual page components
  // and AIAnalysis polling. Disabling global refresh to avoid conflicts.
  // useDataRefresh(5000);

  return (
    <>
      <MqttProvider>
        <AIAnalysis />
        <AppLayout />
      </MqttProvider>
    </>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================

function App() {
  const { user, loading } = useAuth();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      setAppReady(true);
      devLog('[App] Ready with user:', user?.id, 'role:', user?.role);
    }
  }, [loading, user?.id]);

  if (loading || !appReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin text-5xl mb-4">🐑</div>
          <p className="text-lg">Chargement...</p>
        </div>
      </div>
    );
  }

  devLog('[App] Rendering with user:', user?.id);

  return (
    <>
      <DevErrorBoundary>
        <Routes>
          {/* LOGIN ROUTE */}
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

          {/* APP ROUTES - Protected Layout */}
          <Route
            element={
              user ? (
                <AuthenticatedAppWrapper />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/map" element={<ErrorBoundary fallback={<MapError />}><MapMonitor /></ErrorBoundary>} />
            <Route path="/animals" element={<Animals />} />
            <Route path="/animals/:id" element={<AnimalProfile />} />
            <Route path="/animal/:id" element={<LegacyAnimalRedirect />} />
            <Route path="/compare" element={<CompareView />} />
            <Route path="/agenda" element={<AgendaView />} />
            <Route path="/alerts" element={<ErrorBoundary fallback={<AlertError />}><Alerts /></ErrorBoundary>} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/analytics" element={<ErrorBoundary fallback={<ChartError />}><Analytics /></ErrorBoundary>} />
            <Route path="/ai-dashboard" element={
              <React.Suspense fallback={
                <div className="flex flex-col items-center justify-center h-[60vh] gap-5">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-[11px] font-normal text-gray-500 tracking-wide animate-pulse">Initialisation du moteur IA...</p>
                </div>
              }>
                <AIPredictionDashboard />
              </React.Suspense>
            } />

            {/* Admin Only Routes */}
            {(normalizeRole(user?.role) === 'super_admin' || normalizeRole(user?.role) === 'admin') && (
              <>
                <Route path="/users" element={<Users />} />
                <Route path="/hardware" element={<Hardware />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin/ai-settings" element={<AISettings />} />
                <Route path="/admin/labelling" element={<LabellingPage />} />
              </>
            )}

            {/* Fallback for authenticated users */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* Global Fallback for non-authenticated users */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </DevErrorBoundary>
    </>
  );
}

export default App;
