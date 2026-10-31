import { apiFetch } from './api-fetch';
export const HR_DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
export function isHrDocumentAvailable(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.startsWith('hr-private://')) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !(url.hostname === 'r2.cloudflare.com' && url.pathname.startsWith('/hr-documents/'));
  } catch { return false; }
}
export async function downloadHrDocument(apiUrl: string, candidateId: string, type: string) {
  const response = await apiFetch(`${apiUrl}/hr/${candidateId}/documents/${type}`);
  if (!response.ok) {
    let message = 'Could not download this document. Please try again.';
    try { message = (await response.json()).message || message; } catch {}
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  let filename = type;
  try { if (encoded) filename = decodeURIComponent(encoded); } catch {}
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
