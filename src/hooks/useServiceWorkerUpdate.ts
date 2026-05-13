import { useEffect, useState } from 'react';

export type SWUpdateStatus = 'idle' | 'available' | 'installing' | 'activated';

export function useServiceWorkerUpdate() {
  const [status, setStatus] = useState<SWUpdateStatus>('idle');
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;
      setRegistration(reg);

      if (reg.waiting) {
        setStatus('available');
        return;
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        setStatus('installing');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setStatus('available');
          }
          if (newWorker.state === 'activated') {
            setStatus('activated');
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      setStatus('activated');
    });
  }, []);

  const applyUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return { status, applyUpdate };
}
