import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronRight } from 'lucide-react';
import { useIoTStore } from '../../hooks/useIoTStore';
import { IAnimal } from '../../types';
import { Alert } from '../../hooks/useIoTStore';
import { SEARCH_PAGES } from '../../config/routes';

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultStatus = 'ok' | 'warn' | 'critical';

interface SearchResult {
  type: 'animal' | 'alert' | 'page';
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  status: ResultStatus;
  action: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function animalToStatus(health: IAnimal['health']): ResultStatus {
  if (health === 'Critical') return 'critical';
  if (health === 'Warning') return 'warn';
  return 'ok';
}

function alertToStatus(severity: Alert['severity']): ResultStatus {
  if (severity === 'CRITICAL') return 'critical';
  if (severity === 'WARNING') return 'warn';
  return 'ok';
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  return `il y a ${Math.floor(diff / 3600)}h`;
}

function getAlertLabel(type: string): string {
  switch (type) {
    case 'OUT_OF_ZONE': return 'Sortie de zone';
    case 'LOW_BATTERY': return 'Batterie critique';
    case 'HEALTH_WARNING': return 'Alerte santé';
    case 'COLLAR_OFFLINE': return 'Collier hors ligne';
    default: return 'Alerte';
  }
}

const STATUS_DOT: Record<ResultStatus, string> = {
  ok: 'bg-[#1D9E75]',
  warn: 'bg-[#EF9F27]',
  critical: 'bg-[#E24B4A] animate-pulse',
};

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Result Row ───────────────────────────────────────────────────────────────

interface ResultRowProps {
  result: SearchResult;
  isActive: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  query: string;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="gs-mark">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const ResultRow = React.memo(({ result, isActive, onMouseEnter, onClick, query }: ResultRowProps) => (
  <div
    role="option"
    aria-selected={isActive}
    className={`gs-row ${isActive ? 'gs-row--active' : ''}`}
    onMouseEnter={onMouseEnter}
    onClick={onClick}
  >
    <span className="gs-icon">{result.icon}</span>
    <span className={`gs-dot ${STATUS_DOT[result.status]}`} />
    <span className="gs-row-content">
      <span className="gs-row-title">{highlight(result.title, query)}</span>
      <span className="gs-row-subtitle">{result.subtitle}</span>
    </span>
    <ChevronRight size={14} className="gs-chevron" />
  </div>
));

ResultRow.displayName = 'ResultRow';

// ─── Group header ─────────────────────────────────────────────────────────────

const GroupHeader = ({ label, count }: { label: string; count: number }) => (
  <div className="gs-group-header">
    <span>{label}</span>
    <span className="gs-group-badge">{count}</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const debouncedQuery = useDebounce(query, 150);

  const devicesMap = useIoTStore(s => s.devices);
  const alerts = useIoTStore(s => s.alerts);

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // Autofocus after portal paints
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ── Build results with useMemo ─────────────────────────────────────────────
  const results = useMemo((): SearchResult[] => {
    const q = debouncedQuery.trim().toLowerCase();

    // ── Animals ──────────────────────────────────────────────────────────────
    const animalResults: SearchResult[] = Object.values(devicesMap)
      .filter((a: IAnimal) => {
        if (!q) return true;
        return (
          a.name?.toLowerCase().includes(q) ||
          a.collar_id?.toLowerCase().includes(q) ||
          a.breed?.toLowerCase().includes(q) ||
          a.health?.toLowerCase().includes(q) ||
          (a.status as string)?.toLowerCase().includes(q)
        );
      })
      .slice(0, 8)
      .map((a: IAnimal): SearchResult => ({
        type: 'animal',
        id: a.collar_id,
        title: a.name,
        subtitle: `${a.breed ?? '—'} · Collier ${a.collar_id} · ${a.health === 'Critical' ? '🔴' : a.health === 'Warning' ? '🟡' : '🟢'} ${a.health}`,
        icon: '🐑',
        status: animalToStatus(a.health),
        action: () => { navigate(`/animals/${a.collar_id}`); onClose(); },
      }));

    // ── Active alerts ──────────────────────────────────────────────────────
    const alertResults: SearchResult[] = alerts
      .filter((al: Alert) => {
        if (!q) return !al.read;
        return (
          al.animal_name?.toLowerCase().includes(q) ||
          al.collar_id?.toLowerCase().includes(q) ||
          al.type?.toLowerCase().includes(q) ||
          getAlertLabel(al.type).toLowerCase().includes(q)
        );
      })
      .slice(0, 5)
      .map((al: Alert): SearchResult => ({
        type: 'alert',
        id: String(al.id),
        title: `${getAlertLabel(al.type)} — ${al.animal_name}`,
        subtitle: `Collier ${al.collar_id} · ${al.severity.toLowerCase()} · ${timeAgo(al.timestamp)}`,
        icon: al.severity === 'CRITICAL' ? '🚨' : '⚠️',
        status: alertToStatus(al.severity),
        action: () => { navigate('/alerts'); onClose(); },
      }));

    // ── Pages ─────────────────────────────────────────────────────────────
    const pageResults: SearchResult[] = SEARCH_PAGES
      .filter(p => {
        if (!q) return true;
        return (
          p.label.toLowerCase().includes(q) ||
          p.keywords.some(k => k.includes(q))
        );
      })
      .map((p): SearchResult => ({
        type: 'page',
        id: p.id,
        title: p.label,
        subtitle: p.path,
        icon: p.icon,
        status: 'ok',
        action: () => { navigate(p.path); onClose(); },
      }));

    return [...animalResults, ...alertResults, ...pageResults];
  }, [debouncedQuery, devicesMap, alerts, navigate, onClose]);

  // Grouped
  const groups = useMemo(() => {
    const animals = results.filter(r => r.type === 'animal');
    const alertsR = results.filter(r => r.type === 'alert');
    const pages = results.filter(r => r.type === 'page');
    return { animals, alerts: alertsR, pages };
  }, [results]);

  // Flat indexed list for keyboard nav
  const flat = useMemo(
    () => [...groups.animals, ...groups.alerts, ...groups.pages],
    [groups]
  );

  // Keep activeIdx in range
  useEffect(() => {
    setActiveIdx(0);
  }, [debouncedQuery]);

  // Scroll active row into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flat[activeIdx]?.action();
      }
    },
    [flat, activeIdx]
  );

  if (!open) return null;

  const hasResults = flat.length > 0;
  const isEmpty = debouncedQuery.length > 0 && !hasResults;

  // ── Render groups ─────────────────────────────────────────────────────────
  let globalIdx = 0;

  const renderGroup = (
    label: string,
    items: SearchResult[]
  ) => {
    if (items.length === 0) return null;
    const startIdx = globalIdx;
    globalIdx += items.length;
    return (
      <div key={label}>
        <GroupHeader label={label} count={items.length} />
        {items.map((r, i) => {
          const idx = startIdx + i;
          return (
            <div key={r.id} data-idx={idx}>
              <ResultRow
                result={r}
                isActive={activeIdx === idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={r.action}
                query={debouncedQuery}
              />
            </div>
          );
        })}
      </div>
    );
  };

  // ── Portal ────────────────────────────────────────────────────────────────
  return ReactDOM.createPortal(
    <>
      {/* Styles injectées une seule fois */}
      <style>{`
        .gs-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,.42);
          backdrop-filter: blur(4px);
          display: flex; align-items: flex-start;
          justify-content: center;
          padding-top: 12vh;
          animation: gs-fade-in .15s ease;
        }
        @keyframes gs-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .gs-panel {
          width: 100%; max-width: 560px;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 24px 80px rgba(0,0,0,.22), 0 4px 16px rgba(0,0,0,.08);
          overflow: hidden;
          animation: gs-slide-in .18s cubic-bezier(.32,0,.67,0);
          display: flex; flex-direction: column;
          max-height: 72vh;
        }
        .dark .gs-panel {
          background: #1e293b;
          box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.3);
        }
        @keyframes gs-slide-in {
          from { opacity: 0; transform: translateY(-8px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .gs-input-row {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(0,0,0,.08);
        }
        .dark .gs-input-row { border-bottom-color: rgba(255,255,255,.06); }
        .gs-input-icon { color: #94a3b8; flex-shrink: 0; }
        .gs-input {
          flex: 1; border: none; outline: none;
          font-size: 17px; font-family: 'Inter', system-ui, sans-serif;
          font-weight: 400; color: #0f172a;
          background: transparent;
          line-height: 1.4;
        }
        .dark .gs-input { color: #f1f5f9; }
        .gs-input::placeholder { color: #94a3b8; }
        .gs-clear-btn {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%;
          border: none; background: #e2e8f0; cursor: pointer;
          color: #475569; transition: background .15s;
        }
        .gs-clear-btn:hover { background: #cbd5e1; }
        .dark .gs-clear-btn { background: #334155; color: #94a3b8; }
        .dark .gs-clear-btn:hover { background: #475569; }
        .gs-results {
          overflow-y: auto; flex: 1;
          padding: 6px 0 8px;
        }
        .gs-group-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 18px 4px;
          font-size: 10px; font-weight: 700; letter-spacing: .07em;
          text-transform: uppercase; color: #94a3b8;
        }
        .gs-group-badge {
          background: #e2e8f0; color: #64748b;
          border-radius: 99px; padding: 1px 7px;
          font-size: 10px; font-weight: 700;
        }
        .dark .gs-group-badge { background: #334155; color: #94a3b8; }
        .gs-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 18px; cursor: pointer;
          transition: background .08s;
          border-radius: 0;
        }
        .gs-row:hover,
        .gs-row--active { background: #f1f5f9; }
        .dark .gs-row:hover,
        .dark .gs-row--active { background: #334155; }
        .gs-icon { font-size: 18px; flex-shrink: 0; width: 26px; text-align: center; }
        .gs-dot {
          width: 8px; height: 8px; border-radius: 50%;
          flex-shrink: 0;
        }
        .gs-row-content { flex: 1; min-width: 0; }
        .gs-row-title {
          display: block; font-size: 13.5px; font-weight: 500;
          color: #0f172a; white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis;
        }
        .dark .gs-row-title { color: #f1f5f9; }
        .gs-row-subtitle {
          display: block; font-size: 11.5px;
          color: #64748b; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
          margin-top: 1px;
        }
        .gs-chevron { color: #cbd5e1; flex-shrink: 0; }
        .gs-mark {
          background: rgba(16,185,129,.18); color: #059669;
          border-radius: 3px; padding: 0 2px; font-weight: 600;
        }
        .dark .gs-mark { background: rgba(16,185,129,.25); color: #34d399; }
        .gs-empty {
          padding: 36px 18px; text-align: center;
          color: #94a3b8; font-size: 13px;
        }
        .gs-empty strong { color: #0f172a; font-weight: 600; }
        .dark .gs-empty strong { color: #f1f5f9; }
        .gs-footer {
          display: flex; align-items: center; gap: 12px;
          padding: 9px 18px;
          border-top: 1px solid rgba(0,0,0,.06);
          font-size: 10.5px; color: #94a3b8;
        }
        .dark .gs-footer { border-top-color: rgba(255,255,255,.05); }
        .gs-kbd {
          display: inline-flex; align-items: center; justify-content: center;
          background: #f1f5f9; border: 1px solid #e2e8f0;
          border-radius: 5px; padding: 1px 5px;
          font-size: 10px; font-weight: 600; color: #475569;
        }
        .dark .gs-kbd { background: #0f172a; border-color: #334155; color: #94a3b8; }
      `}</style>

      {/* Backdrop — click outside closes */}
      <div
        className="gs-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale"
      >
        <div
          className="gs-panel"
          onClick={e => e.stopPropagation()}
        >
          {/* Input row */}
          <div className="gs-input-row">
            <Search size={18} className="gs-input-icon" />
            <input
              ref={inputRef}
              className="gs-input"
              type="text"
              placeholder="Rechercher un animal, alerte, page…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck="false"
              aria-autocomplete="list"
              aria-controls="gs-listbox"
              aria-activedescendant={`gs-result-${activeIdx}`}
            />
            {query && (
              <button
                className="gs-clear-btn"
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                aria-label="Effacer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Results */}
          <div
            ref={listRef}
            id="gs-listbox"
            role="listbox"
            className="gs-results"
          >
            {isEmpty ? (
              <div className="gs-empty">
                Aucun animal ou alerte trouvé pour{' '}
                <strong>"{debouncedQuery}"</strong>
              </div>
            ) : (
              <>
                {renderGroup('Animaux', groups.animals)}
                {renderGroup('Alertes actives', groups.alerts)}
                {renderGroup('Navigation', groups.pages)}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="gs-footer">
            <span><kbd className="gs-kbd">↑</kbd><kbd className="gs-kbd" style={{ marginLeft: 3 }}>↓</kbd> Naviguer</span>
            <span><kbd className="gs-kbd">↵</kbd> Ouvrir</span>
            <span><kbd className="gs-kbd">Esc</kbd> Fermer</span>
            <span style={{ marginLeft: 'auto' }}>{flat.length} résultat{flat.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Trigger Button (pour le header) ──────────────────────────────────────────

interface SearchTriggerProps {
  onClick: () => void;
}

export function SearchTriggerButton({ onClick }: SearchTriggerProps) {
  return (
    <button
      id="global-search-trigger"
      onClick={onClick}
      title="Recherche globale (Ctrl+K)"
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-primary/50 hover:text-primary transition-all text-sm font-medium shadow-sm group"
      aria-label="Ouvrir la recherche"
    >
      <Search size={15} className="text-gray-400 group-hover:text-primary transition-colors" />
      <span className="hidden lg:inline text-[12px] text-gray-400">Rechercher…</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-400 border border-gray-200 dark:border-gray-600 leading-none">
        ⌘K
      </kbd>
    </button>
  );
}

// ─── Hook to wire keyboard shortcut ───────────────────────────────────────────

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { open, setOpen };
}

export default GlobalSearch;
