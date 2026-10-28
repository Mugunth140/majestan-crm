import { toast } from 'sonner';
import { apiFetch } from './api-fetch';
import { InboundLocationQueue, type InboundCoordinates } from './inbound-location-queue';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const keyFor = (scope: string) => `inbound:pending-location:${scope}`;

function locate(highAccuracy: boolean): Promise<InboundCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location unavailable')); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      reject,
      { enableHighAccuracy: highAccuracy, timeout: 20000, maximumAge: highAccuracy ? 0 : 60000 },
    );
  });
}

export const inboundLocation = new InboundLocationQueue({
  identity: () => {
    if (typeof window === 'undefined') return null;
    try {
      const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
      return user.id != null ? String(user.id) : user.email || null;
    } catch { return null; }
  },
  load: (scope) => {
    try {
      const jobs = JSON.parse(localStorage.getItem(keyFor(scope)) || '[]');
      return Array.isArray(jobs) ? jobs.filter(job => Number.isSafeInteger(job.id) && job.id > 0 && typeof job.capture === 'string') : [];
    } catch { return []; }
  },
  store: (scope, jobs) => {
    try { localStorage.setItem(keyFor(scope), JSON.stringify(jobs)); } catch { /* Keep the in-memory queue working. */ }
  },
  locate: async () => {
    try { return await locate(true); } catch (error) {
      if ((error as GeolocationPositionError).code === 1) throw error;
      return locate(false);
    }
  },
  save: async (id, coordinates) => {
    const response = await apiFetch(`${API_URL}/inbounds/${id}/location`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coordinates), keepalive: true,
    });
    if (!response.ok && response.status !== 404) throw new Error('Location update failed');
  },
  notify: (message, retry) => toast.error(message, {
    id: 'inbound-location', duration: Infinity,
    action: { label: 'Retry location', onClick: retry },
  }),
  complete: () => toast.dismiss('inbound-location'),
});
