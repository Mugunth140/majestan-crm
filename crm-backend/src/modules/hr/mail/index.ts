import { applicationReceivedMail } from './application-received.mail';
import { interviewScheduledMail } from './interview-scheduled.mail';
import { offerSentMail } from './offer-sent.mail';
import { rejectedMail } from './rejected.mail';

/** HR emails registered with the central mail service (MailModule.forFeature). */
export const HR_MAIL_EVENTS = [applicationReceivedMail, interviewScheduledMail, offerSentMail, rejectedMail];
