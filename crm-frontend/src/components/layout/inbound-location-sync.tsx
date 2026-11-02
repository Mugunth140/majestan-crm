'use client';
import { useEffect } from 'react';
import { inboundLocation } from '@/lib/inbound-location';

export function InboundLocationSync() {
  useEffect(() => {
    const retry = () => inboundLocation.retry();
    const visible = () => { if (document.visibilityState === 'visible') retry(); };
    retry();
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    document.addEventListener('visibilitychange', visible);
    // Background tabs skip the periodic retry; becoming visible retries at once.
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') retry(); }, 30000);
    let permission: PermissionStatus | undefined;
    let disposed = false;
    navigator.permissions?.query({ name: 'geolocation' }).then(status => {
      if (disposed) return;
      permission = status;
      status.addEventListener('change', retry);
    }).catch(() => {});
    return () => {
      disposed = true;
      clearInterval(timer);
      permission?.removeEventListener('change', retry);
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return null;
}
