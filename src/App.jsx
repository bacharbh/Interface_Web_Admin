import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, USER_ROLES } from './contexts/AuthContext';
import { MqttProvider } from './contexts/MqttContext';
import AppLayout from './components/layout/AppLayout';
import { devLog } from './utils/devLogger';
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

const normalizeRole = (role) => (role ?? '').trim().toLowerCase();

// ============================================
// ERROR BOUNDARY - Capture toutes les erreurs React
// ============================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-white text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-3xl font-bold mb-2">Erreur Application</h1>
            <p className="text-gray-400 mb-2 font-mono text-sm break-all">
              {this.state.error?.message || 'Une erreur inattendue est survenue'}
            </p>
            <p className="text-gray-500 text-xs mb-6">Consultez la console pour plus de détails</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-green-600 px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition"
            >
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [isShaking, setIsShaking] = useState(false);

  const triggerShake = () => {
    setIsShaking(false);
    window.requestAnimationFrame(() => {
      setIsShaking(true);
      window.setTimeout(() => setIsShaking(false), 450);
    });
  };

  const validate = () => {
    const nextErrors = {};

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
  const heroImageUrl = '/sheep-logo.png';

  return (
    <div className="min-h-screen bg-[#f7faf8] lg:grid lg:h-screen lg:grid-cols-[45%_55%] lg:overflow-hidden">
      <style>{`
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(4px); }
        }
      `}</style>

      <section className="relative flex min-h-[42vh] items-center overflow-hidden bg-[#0f6e56] px-6 py-10 text-white sm:px-10 lg:min-h-0 lg:px-12">
        <div className="absolute inset-0">
          <img
            src={heroImageUrl}
            alt="Troupeau de moutons"
            className="h-full w-full scale-125 object-cover object-center opacity-15 blur-2xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,110,86,0.82),rgba(29,158,117,0.72))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.08),transparent_30%)]" />
        </div>

        <div className="relative z-10 max-w-xl pl-0 lg:pl-2">
          <div className="mb-12 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[28px] shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            🐑
          </div>
          <h1 className="text-[32px] font-medium leading-tight tracking-tight text-white">Smart Shepherd</h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-white/80">
            La nouvelle ère de la surveillance du bétail par l'IA et l'IoT.
          </p>
        </div>
      </section>

      <section className="flex min-h-[58vh] items-center justify-center bg-white px-6 py-10 sm:px-10 lg:min-h-0 lg:px-12">
        <div className={`w-full max-w-[420px] lg:translate-y-[-2%] ${isShaking ? 'animate-[login-shake_0.45s_ease-in-out]' : ''}`}>
          <div className="text-center">
            <h2 className="text-[22px] font-medium text-slate-900">Bienvenue</h2>
            <p className="mt-2 text-sm text-slate-500">Connectez-vous à votre tableau de bord</p>
          </div>

          <form
            className="mt-10 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
            noValidate
          >
            <div>
              <label htmlFor="login-identifier" className="mb-2 block text-sm font-semibold text-slate-700">
                Identifiant
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
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
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1d9e75] focus:ring-4 focus:ring-[#1d9e75]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
              {fieldErrors.identifier && (
                <p id="identifier-error" className="mt-2 text-sm text-red-600" role="alert">
                  {fieldErrors.identifier}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-slate-700">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
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
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-14 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1d9e75] focus:ring-4 focus:ring-[#1d9e75]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1d9e75]/30"
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
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#1d9e75] px-4 text-[15px] font-semibold text-white transition hover:bg-[#17835f] focus:outline-none focus:ring-4 focus:ring-[#1d9e75]/20 disabled:cursor-not-allowed disabled:opacity-70"
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
                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500" aria-label="Identifiants par défaut en environnement de développement">
                  Identifiants par défaut : <span className="font-semibold text-slate-700">admin / admin123</span>
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
// MAIN APP COMPONENT
// ============================================

function App() {
  const { user, loading } = useAuth();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      setAppReady(true);
      console.log('[App] Ready with user:', user?.id, 'role:', user?.role);
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

  console.log('[App] Rendering with user:', user?.id);

  return (
    <ErrorBoundary>
      <Routes>
        {/* LOGIN ROUTE */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

        {/* APP ROUTES - Protected Layout */}
        <Route
          element={
            user ? (
              <MqttProvider>
                <AIAnalysis />
                <AppLayout />
              </MqttProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/map" element={<MapMonitor />} />
          <Route path="/animals" element={<Animals />} />
          <Route path="/animals/:id" element={<AnimalDetail />} />
          <Route path="/animal/:id" element={<AnimalProfile />} />
          <Route path="/compare" element={<CompareView />} />
          <Route path="/agenda" element={<AgendaView />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/analytics" element={<Analytics />} />
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
    </ErrorBoundary>
  );
}

export default App;
