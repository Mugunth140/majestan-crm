import type { MailContext } from '../../mail/core/mail-event';
import { HrCandidate, HrCandidateStatus } from '../../../database/entities/hr-candidate.entity';

export type InterviewMode = 'in_person' | 'phone' | 'video';

/** Everything an HR email may show. Deliberately excludes salary and ID documents. */
export interface CandidateMailData {
  id: number;
  name: string;
  email: string | null;
  position: string;
  status: HrCandidateStatus;
  interviewDate: string | null; // YYYY-MM-DD
  interviewTime: string | null; // HH:mm, IST wall clock
  interviewMode: InterviewMode | null;
  interviewLocation: string | null;
  interviewLink: string | null;
  interviewer: string | null;
  interviewRound: string | null;
}

/** mysql2 builds DATE values at local midnight; read the local parts back. */
export function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
  if (Number.isNaN(value.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function toTimeOnly(value: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

export async function loadCandidateMailData(id: number, ctx: MailContext): Promise<CandidateMailData | null> {
  const c = await ctx.dataSource.getRepository(HrCandidate).findOne({ where: { id } });
  if (!c) return null;
  return {
    id: c.id,
    name: (c.name || '').trim(),
    email: c.email?.trim() || null,
    position: (c.position || '').trim(),
    status: c.status,
    interviewDate: toDateOnly(c.interviewDate),
    interviewTime: toTimeOnly(c.interviewTime),
    interviewMode: c.interviewMode ?? null,
    interviewLocation: c.interviewLocation?.trim() || null,
    interviewLink: c.interviewLink?.trim() || null,
    interviewer: c.interviewer?.trim() || null,
    interviewRound: c.interviewRound?.trim() || null,
  };
}

/** "Tuesday, 3 November 2026" from YYYY-MM-DD, with no timezone shift. */
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

/** "11:30 AM" from HH:mm. */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Today's date in India, YYYY-MM-DD. */
export function todayInIndia(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const INTERVIEW_MODE_LABELS: Record<InterviewMode, string> = {
  in_person: 'In person',
  phone: 'Phone call',
  video: 'Video call',
};

export const positionPhrase = (d: CandidateMailData) => d.position || 'the open position';
