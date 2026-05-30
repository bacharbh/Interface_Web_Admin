import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth, USER_ROLES } from './contexts/AuthContext';
import { MqttProvider } from './contexts/MqttContext';
import AppLayout from './components/layout/AppLayout';
import { devLog } from './utils/devLogger';
import DevErrorBoundary from './components/ErrorBoundary'
import { useDataRefresh } from './hooks/useDataRefresh';
import AIAnalysis from './components/ai/AIAnalysis';
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import sheepBg from './assets/sheep-bg.jpg';

const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));
const MapMonitor = React.lazy(() => import('./pages/Map/MapMonitor'));
const Users = React.lazy(() => import('./pages/Users/Users'));
const Animals = React.lazy(() => import('./pages/Animals/Animals'));
const AnimalProfile = React.lazy(() => import('./pages/Animals/AnimalProfile'));
const AgendaView = React.lazy(() => import('./pages/Agenda/AgendaView'));
const Alerts = React.lazy(() => import('./pages/Alerts/Alerts'));
const Anomalies = React.lazy(() => import('./pages/Anomalies/Anomalies'));
const Analytics = React.lazy(() => import('./pages/Analytics/Analytics'));
const Hardware = React.lazy(() => import('./pages/Hardware/Hardware'));
const Settings = React.lazy(() => import('./pages/Settings/Settings'));
const AISettings = React.lazy(() => import('./pages/Admin/AISettings'));
const AIPredictionDashboard = React.lazy(() => import('./components/ai/AIPredictionDashboard'));
const LabellingPage = React.lazy(() => import('./pages/Admin/LabellingPage'));

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

const PageSkeleton = () => (
  <div className="mx-auto max-w-7xl space-y-4 p-6 animate-pulse">
    <div className="h-10 w-56 rounded-lg bg-gray-200 dark:bg-gray-800" />
    <div className="h-52 rounded-2xl bg-gray-100 dark:bg-gray-800" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800" />
    </div>
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

  return (
    <div className="min-h-screen bg-[#f4f7f5] lg:grid lg:grid-cols-2 lg:overflow-hidden">
      <style>{`
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(4px); }
        }
      `}</style>

      <section
        className="relative overflow-hidden lg:min-h-screen"
        style={{
          backgroundImage: `
            linear-gradient(
              135deg,
              rgba(15, 110, 86, 0.72) 0%,
              rgba(29, 158, 117, 0.60) 100%
            ),
            url(${sheepBg})
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '2.5rem',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '2rem',
            left: '2rem',
            width: '60px',
            height: '60px',
            background: 'white',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <img src="/sheep-logo.png" alt="Smart Shepherd" className="h-11 w-11 object-contain" />
        </div>
        <div className="relative z-10 max-w-xl text-white">
          <h2
            style={{
              color: 'white',
              fontSize: '32px',
              fontWeight: '700',
              marginBottom: '8px',
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          >
            Smart Shepherd
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '15px',
              lineHeight: '1.5',
              maxWidth: '320px',
            }}
          >
            La nouvelle ère de la surveillance du bétail par l'IA et l'IoT.
          </p>
        </div>
      </section>

      <section className="flex min-h-[56vh] items-center justify-center bg-white px-6 py-10 sm:px-10 lg:min-h-screen lg:px-14">
        <div className={`w-full max-w-[430px] ${isShaking ? 'animate-[login-shake_0.45s_ease-in-out]' : ''}`}>
          <div className="text-center">
            <h3 className="text-[clamp(2.2rem,2.8vw,2.9rem)] font-bold tracking-tight text-[#1f2d44]">Bienvenue</h3>
            <p className="mt-3 text-[18px] leading-7 text-[#6b7d95]">Connectez-vous à votre tableau de bord</p>
          </div>

          <form
            className="mt-12 space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
            noValidate
          >
            <div>
              <label htmlFor="login-identifier" className="mb-2 block text-[15px] font-semibold text-[#34424a]">
                Identifiant
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8aa09a]" aria-hidden="true" />
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
                  className="h-14 w-full rounded-2xl border border-[#d8e0ea] bg-white pl-12 pr-4 text-[15px] text-[#12221d] shadow-[0_8px_18px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-[#97a6b9] focus:border-[#19c48b] focus:ring-4 focus:ring-[#19c48b]/15 disabled:cursor-not-allowed disabled:bg-[#fbfcfc]"
                />
              </div>
              {fieldErrors.identifier && (
                <p id="identifier-error" className="mt-2 text-sm text-red-600" role="alert">
                  {fieldErrors.identifier}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-[15px] font-semibold text-[#34424a]">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8aa09a]" aria-hidden="true" />
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
                  className="h-14 w-full rounded-2xl border border-[#d8e0ea] bg-white pl-12 pr-14 text-[15px] text-[#12221d] shadow-[0_8px_18px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-[#97a6b9] focus:border-[#19c48b] focus:ring-4 focus:ring-[#19c48b]/15 disabled:cursor-not-allowed disabled:bg-[#fbfcfc]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#8aa09a] transition hover:bg-[#f0f6f4] hover:text-[#12221d] focus:outline-none focus:ring-2 focus:ring-[#19c48b]/20"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className="mt-2 text-sm text-red-600" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {generalError && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert" aria-live="polite">
                {generalError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#19c48b] px-4 text-[15px] font-semibold text-white shadow-[0_18px_30px_rgba(25,196,139,0.24)] transition-all hover:bg-[#13b17d] hover:shadow-[0_20px_38px_rgba(25,196,139,0.34)] focus:outline-none focus:ring-4 focus:ring-[#19c48b]/20 disabled:cursor-not-allowed disabled:opacity-70"
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

            {import.meta.env.DEV && (
              <div className="flex justify-center pt-2">
                <div className="rounded-full border border-[#dbe3ea] bg-[#f2f4f7] px-4 py-2 text-[12px] text-[#7b8794] shadow-[0_8px_18px_rgba(15,23,42,0.04)]" aria-label="Identifiants par défaut en environnement de développement">
                  Identifiants par défaut : <span className="font-semibold text-[#12221d]">admin / admin123</span>
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
        <Suspense fallback={<PageSkeleton />}>
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
              <Route path="/ai" element={<Navigate to="/ai-dashboard" replace />} />
              <Route path="/troupeau" element={<Navigate to="/animals" replace />} />
              <Route path="/troupeau/compare" element={<Navigate to="/animals" replace />} />
              <Route
                path="/labelling"
                element={(user?.role ?? '').toLowerCase() === 'admin' ? <LabellingPage /> : <Navigate to="/dashboard" replace />}
              />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/map" element={<ErrorBoundary fallback={<MapError />}><MapMonitor /></ErrorBoundary>} />
              <Route path="/animals" element={<Animals />} />
              <Route path="/animals/:id" element={<AnimalProfile />} />
              <Route path="/animal/:id" element={<LegacyAnimalRedirect />} />
              <Route path="/compare" element={<Navigate to="/animals" replace />} />
              <Route path="/agenda" element={<AgendaView />} />
              <Route path="/alerts" element={<ErrorBoundary fallback={<AlertError />}><Alerts /></ErrorBoundary>} />
              <Route path="/anomalies" element={<Anomalies />} />
              <Route path="/analytics" element={<ErrorBoundary fallback={<ChartError />}><Analytics /></ErrorBoundary>} />
              <Route path="/ai-dashboard" element={<AIPredictionDashboard />} />

              {/* Admin Only Routes */}
              {(user?.role ?? '').toLowerCase() === 'admin' && (
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
        </Suspense>
      </DevErrorBoundary>
    </>
  );
}

export default App;
