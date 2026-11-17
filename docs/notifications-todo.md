# Notifications to-do

Status 17 Nov: everything ticked is built (uncommitted). Shipping needs migration 086 (`escalated_for` on the four follow-up tables) on prod before the backend deploys.

Audit of the CRM's in-app notifications, 17 Nov 2026. It covers what is sent today, who receives it, and where staff, team leads, managers or admins are never told about something they should know.

## What is sent today

Counts are from prod's `notifications` table on 17 Nov.

| Type | Sent when | Goes to | On prod |
|---|---|---|---|
| `followup_due` | A follow-up is saved with a next date | Lead owner, **even when the owner saved it** | 5,193 |
| `followup_reminder` | A follow-up falls due (lead, inbound, partner, HR) | Record owner | 797 |
| `lead_transferred` | A lead moves to Sales | **Every active user in Sales**, staff included | 514 |
| `lead_assigned` | Assigned from the lead page, the list or routing | New owner | 379 |
| `lead_claimed`, `lead_claimed_team` | A lead is claimed from the queue | The claimer and their team leads | 445 |
| `lead_converted` | A lead becomes a partner or inbound | The person converting, plus managers and admins | 92 |
| `whatsapp_message` | A customer replies on WhatsApp | Lead owner (if the lead has one) | 28 |
| `first_contact_reminder`, `_escalation`, `_digest` | No first contact after 60 / 120 working minutes; daily at 18:30 | Owner, then team leads; managers and admins | 35 (since 16 Nov) |
| `lead_enquiry_attached`, `_acknowledged` | A website enquiry is attached to, or acknowledged on, a lead | Lead owner | 17 |
| `rnr5_unassigned` | Five RNRs in a row release the lead | Previous owner and their team leads | — |
| `security` | Password changed | That user | — |

## 1. Repeat leads in an Excel import (client request)

- [x] **Review column shows the owner.** It should read "Exists • L04488 · Yazhini", or "Unassigned". The check already returns the owner's name, but today it only appears on hover in the Duplicates found popup (`leads/page.tsx`, `reviewColumn`).
- [x] **Record the repeat on the lead.** `bulkCreateLeads` sends nothing for a row that matches an existing lead: its source and remarks are dropped (`leads.service.ts`, around line 579). Add an activity entry with the new source, the import date and the remarks.
- [x] **Notify the owner and their team lead.** Send one message per person per import, not one per row. For example: "3 of your leads came in again in today's import: L04488, L04487, …". Repeats with no owner stay in the routing queue.
- [x] **Same for single entries.** When the New Lead form or the website matches an existing lead (`isExistingCustomer`), the owner should also hear about it.

## 2. Things nobody is told about

### Assignments

- [x] **Leads pre-assigned in an Excel import.** The chosen staff member gets nothing (`bulkCreateLeads`, assign-on-insert).
- [x] **Leads created with an owner from the New Lead form** (`createLeadRecord`, `userId`). The owner gets nothing.
- [x] **HR candidates assigned** (`hr.service.ts` `assignCandidates`). Notifications are never sent from the HR module.
- [x] **Inbound records assigned** (`inbounds.service.ts` `assign`). No notification.
- [x] **Partners (agents) assigned or reassigned** (`agents.service.ts`, `assigned_staff_id` on update and import). No notification.
- [x] **The previous owner when a lead is taken away.** `assignLead` tells only the new owner. The old owner, and the team lead if they didn't make the change, hear nothing.
- [x] **Monthly targets set or changed for a person** (`tasks.service.ts` `createTaskTemplate`, `updateTargets`, `copyPreviousMonth`). Staff only find out by opening Tasks.

### Escalations to team leads, managers and admins

- [x] **New website and 99acres enquiries in the routing queue.** Nobody is told one has arrived; team leads have to keep the routing page open.
- [x] **Missed follow-ups.** The owner gets one reminder when a follow-up falls due, then nothing. If it is still not done, say an hour of working time later, tell the team lead.
- [x] **Milestones.** No one is notified when a lead reaches Booking Advance, Agreement or Closed Won. Tell the team lead and managers; the owner already knows.
- [x] **Lost leads.** Team leads get one summary after 18:30 of the leads their team marked Not Interested, Lost or Dropped that day.
- [x] **Targets behind pace.** Targets are now coloured, but nobody is warned. Send staff and their team lead a mid-afternoon note when today's pace is red.
- [x] **WhatsApp replies on leads with no owner** now go to the team leads of the lead's pipeline.
- [ ] **WhatsApp from unknown numbers** (no lead at all) are still only written to the server log. Needs a decision: notify team leads, or create a routing-queue entry.
- [x] **Leads converted.** The team lead of the lead's owner is not told; only managers and admins are.

## 3. Notifications that are noisy or unclear

- [x] **`followup_due` notifies the person who just saved the follow-up.** That's 5,193 notifications, most of them people being told about something they just did themselves. Skip it when the person saving the follow-up is the owner; the due-time reminder covers it.
- [x] **`lead_transferred` goes to every Sales user.** It should go to the owner (if any) and the Sales team leads.
- **Lead naming (decided 17 Nov):** messages already live keep their current wording. Every new notification names the lead by its ID, like L04488.
- [x] **`assignLead` notifies you when you assign a lead to yourself.**

## 4. Housekeeping

- [x] **Notifications are never pruned.** Done: read ones are deleted after 30 days and unread after 90 (daily, after 6 AM), the list sends the newest 300, and creating a notification no longer reloads the list. Previously: One user has 2,505. Each new notification reloads that user's entire list and pushes it over the live stream (`notifications.service.ts` `notifyClient`). Cap the list sent (for example the latest 100 plus the unread count), and delete read notifications older than 60 days.
- [x] **A listener for an event nobody sends.** The `lead.assigned` listener in `notifications.listener.ts` is never triggered, because nothing emits that event. Remove it, or route all lead assignments through it.
- [x] **Out-of-date comment.** The type list in `notification.entity.ts` is missing most of the current types.
- [x] **Links only go to lead, inbound, partner and HR records.** New types for targets, tasks or the routing queue will need routes in `crm-frontend/src/lib/notification-text.ts`.

## Suggested order

1. The client's repeat-lead request (section 1), together with the assignment gaps in the same import and New Lead paths.
2. The assignment notifications for HR, inbound and partners, and the previous owner.
3. The noise fixes: `followup_due` to self, the Sales broadcast, readable lead names.
4. Escalations: the routing queue, missed follow-ups, milestones, pace.
5. Housekeeping: pruning and the payload cap.
