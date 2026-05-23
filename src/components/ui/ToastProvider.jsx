import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

/**
 * ToastProvider — Global toast notification wrapper
 * with custom styling and positioning.
 */

export default function ToastProvider() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const originalApiRef = useRef(null);
  const idRef = useRef(0);
  const maxVisible = 3;
  const defaultDuration = 5000;

  const promoteVisibleToasts = useMemo(() => (items) => {
    const nextItems = items.map((item) => ({ ...item }));
    let visibleCount = nextItems.filter((item) => item.visible).length;

    for (const item of nextItems) {
      if (visibleCount >= maxVisible) break;
      if (!item.visible) {
        item.visible = true;
        item.startedAt = Date.now();
        visibleCount += 1;
      }
    }

    return nextItems;
  }, []);

  const dismissToast = useMemo(() => (id) => {
    if (!id) {
      setToasts([]);
      return;
    }

    setToasts((current) => promoteVisibleToasts(current.filter((item) => item.id !== id)));
  }, [promoteVisibleToasts]);

  const enqueueToast = useMemo(() => (type, content, options = {}) => {
    const id = options.id ?? `ss-toast-${Date.now()}-${(idRef.current += 1)}`;
    const duration = options.duration ?? defaultDuration;

    setToasts((current) => {
      const nextItems = current.map((item) => ({ ...item }));
      const visibleCount = nextItems.filter((item) => item.visible).length;
      nextItems.push({
        id,
        type,
        content,
        duration,
        visible: visibleCount < maxVisible,
        startedAt: visibleCount < maxVisible ? Date.now() : null,
      });
      return promoteVisibleToasts(nextItems);
    });

    return id;
  }, [promoteVisibleToasts]);

  useEffect(() => {
    if (!originalApiRef.current) {
      originalApiRef.current = {
        success: toast.success,
        error: toast.error,
        loading: toast.loading,
        custom: toast.custom,
        dismiss: toast.dismiss,
        remove: toast.remove,
        dismissAll: toast.dismissAll,
        removeAll: toast.removeAll,
      };

      toast.success = (message, options) => enqueueToast('success', message, options);
      toast.error = (message, options) => enqueueToast('error', message, options);
      toast.loading = (message, options) => enqueueToast('loading', message, options);
      toast.custom = (renderer, options) => enqueueToast('custom', renderer, options);
      toast.dismiss = (id) => dismissToast(id);
      toast.remove = (id) => dismissToast(id);
      toast.dismissAll = () => dismissToast();
      toast.removeAll = () => dismissToast();
    }

    return () => {
      const originalApi = originalApiRef.current;
      if (originalApi) {
        toast.success = originalApi.success;
        toast.error = originalApi.error;
        toast.loading = originalApi.loading;
        toast.custom = originalApi.custom;
        toast.dismiss = originalApi.dismiss;
        toast.remove = originalApi.remove;
        toast.dismissAll = originalApi.dismissAll;
        toast.removeAll = originalApi.removeAll;
      }

      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [dismissToast, enqueueToast]);

  useEffect(() => {
    const visibleIds = new Set();

    toasts.forEach((item) => {
      if (!item.visible) return;
      visibleIds.add(item.id);

      if (timersRef.current.has(item.id)) return;

      const timer = window.setTimeout(() => {
        dismissToast(item.id);
      }, item.duration ?? defaultDuration);

      timersRef.current.set(item.id, timer);
    });

    timersRef.current.forEach((timer, id) => {
      if (!visibleIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    });
  }, [dismissToast, toasts]);

  const renderToastBody = (item) => {
    if (item.type === 'custom') {
      if (typeof item.content === 'function') {
        return item.content({ id: item.id, visible: item.visible, type: item.type });
      }

      return item.content;
    }

    const tone = item.type === 'success'
      ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-50'
      : item.type === 'error'
        ? 'border-red-500 bg-red-50 text-red-950 dark:bg-red-500/10 dark:text-red-50'
        : item.type === 'loading'
          ? 'border-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-500/10 dark:text-sky-50'
          : 'border-[var(--card-border)] bg-white text-[var(--text-primary)] dark:bg-[var(--card-bg)]';

    return (
      <div className={`w-full rounded-[12px] border-l-4 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.15)] ${tone}`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-[13px] leading-5">
            {item.content}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(item.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] leading-none text-current/40 transition hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
            aria-label="Fermer la notification"
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  const visibleToasts = toasts.filter((item) => item.visible).slice(0, maxVisible);

  return (
    createPortal(
      <div className="pointer-events-none fixed bottom-5 right-5 z-[1200] flex w-[min(100vw-1.5rem,26rem)] flex-col gap-3">
        {visibleToasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto transition-all duration-200 ${item.visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
          >
            {renderToastBody(item)}
          </div>
        ))}
      </div>,
      document.body
    )
  );
}
