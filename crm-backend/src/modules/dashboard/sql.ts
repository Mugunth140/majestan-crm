import {
  addDays, inBothPeriods, istDate, periodOf, RESPONSE_SLA_MIN, utcStart, workClockStart, type Range,
} from './range';

/**
 * DuckDB queries over the analytics mirror. Every value interpolated here is
 * a validated date or an integer id, never user text.
 *
 * Counter queries return one row per person and period ('cur' / 'prev'), so
 * totals, medians and rankings all come from the same numbers.
 */
export type Ctx = { ids: string; range: Range; now: string };

export const idList = (ids: number[]) => (ids.length ? ids.map(n => Math.trunc(n)).join(',') : 'NULL');
export const nowLiteral = (now = new Date()) => `TIMESTAMP '${now.toISOString().slice(0, 19).replace('T', ' ')}'`;

export const CLOSED_STATUSES = ['Closed Won', 'Lost', 'Closed Lost', 'Dropped', 'Not Interested', 'Unqualified'];
export const QUALIFIED = ['Qualified', 'Interested'];
export const BOOKED = ['Booking Advance', 'Agreement', 'Closed Won'];
export const DROPPED = ['Dropped', 'Lost', 'Not Interested'];
const list = (values: string[]) => values.map(v => `'${v.replace(/'/g, "''")}'`).join(',');

const end = (r: Range) => utcStart(addDays(r.to, 1));

/** Every touch on a lead by anyone: a contact or a follow-up. */
const LEAD_TOUCHES = `
  SELECT entity_id AS lead_id, sent_by_id AS uid, created_at AS ts FROM all_contacts WHERE entity = 'lead'
  UNION ALL SELECT lead_id, created_by_id, created_at FROM lead_follow_ups`;

export function callCounters({ ids, range }: Ctx) {
  const out = `contact_type = 'call' AND COALESCE(call_direction, 'Outgoing') = 'Outgoing'`;
  return `
  SELECT sent_by_id AS uid, ${periodOf('created_at', range)} AS p,
    COUNT(*) FILTER (WHERE contact_type = 'call') AS calls,
    COUNT(*) FILTER (WHERE ${out}) AS calls_out,
    COUNT(*) FILTER (WHERE ${out} AND call_duration IS NOT NULL) AS calls_out_timed,
    COUNT(*) FILTER (WHERE ${out} AND call_duration > 0) AS calls_out_connected,
    COUNT(*) FILTER (WHERE contact_type = 'call' AND call_direction = 'Incoming') AS calls_in,
    COUNT(*) FILTER (WHERE contact_type = 'call' AND call_direction = 'Missed') AS calls_missed,
    COUNT(*) FILTER (WHERE contact_type = 'call' AND call_duration > 0) AS calls_connected,
    COALESCE(SUM(call_duration) FILTER (WHERE contact_type = 'call' AND call_duration > 0), 0) AS talk_sec,
    COUNT(*) FILTER (WHERE contact_type = 'call' AND source_call_id IS NOT NULL) AS logger_calls,
    COUNT(*) FILTER (WHERE contact_type = 'call' AND entity = 'lead') AS lead_calls,
    COUNT(DISTINCT entity_id) FILTER (WHERE contact_type = 'call' AND entity = 'lead') AS leads_called,
    COUNT(DISTINCT entity_id) FILTER (WHERE entity = 'lead') AS leads_contacted,
    COUNT(*) FILTER (WHERE entity = 'lead') AS lead_contacts,
    COUNT(*) FILTER (WHERE contact_type IN ('whatsapp', 'sms', 'email')) AS messages,
    COUNT(*) FILTER (WHERE contact_type = 'share') AS shares,
    COUNT(DISTINCT entity_id) FILTER (WHERE contact_type = 'share' AND entity = 'lead') AS share_leads,
    COUNT(*) FILTER (WHERE contact_type = 'call' AND entity = 'inbound') AS inbound_calls,
    COUNT(*) FILTER (WHERE contact_type = 'call' AND entity = 'inbound' AND call_duration IS NOT NULL) AS inbound_calls_timed,
    COUNT(*) FILTER (WHERE contact_type = 'call' AND entity = 'inbound' AND call_duration > 0) AS inbound_calls_connected,
    COUNT(*) FILTER (WHERE contact_type = 'call' AND entity = 'hr') AS hr_calls,
    COUNT(*) FILTER (WHERE entity = 'agent') AS agent_contacts,
    COUNT(DISTINCT ${istDate('created_at')}) AS active_days
  FROM all_contacts
  WHERE sent_by_id IN (${ids}) AND ${inBothPeriods('created_at', range)}
  GROUP BY ALL`;
}

/** Touches on leads by the person, how often they return to a lead, and follow-ups logged. */
export function touchCounters({ ids, range }: Ctx) {
  return `
  WITH t AS (
    SELECT entity_id AS lead_id, sent_by_id AS uid, created_at AS ts, 0 AS fu FROM all_contacts
     WHERE entity = 'lead' AND sent_by_id IN (${ids}) AND ${inBothPeriods('created_at', range)}
    UNION ALL
    SELECT lead_id, created_by_id, created_at, 1 FROM lead_follow_ups
     WHERE created_by_id IN (${ids}) AND ${inBothPeriods('created_at', range)}
  ), g AS (
    SELECT t.*, ${periodOf('ts', range)} AS p, l.department AS dept FROM t LEFT JOIN leads l ON l.id = t.lead_id
  ), w AS (
    SELECT *, LAG(ts) OVER (PARTITION BY uid, lead_id, p ORDER BY ts) AS prev_ts FROM g
  )
  SELECT uid, p,
    COUNT(*) AS touches,
    COUNT(DISTINCT lead_id) AS touched_leads,
    COUNT(*) FILTER (WHERE fu = 1) AS followups_logged,
    COUNT(*) FILTER (WHERE dept = 'sales') AS sales_touches,
    COUNT(DISTINCT lead_id) FILTER (WHERE dept = 'sales') AS sales_touched_leads,
    COALESCE(SUM(date_diff('minute', prev_ts, ts)) FILTER (WHERE date_diff('minute', prev_ts, ts) >= 60), 0) / 1440.0 AS gap_days_sum,
    COUNT(*) FILTER (WHERE date_diff('minute', prev_ts, ts) >= 60) AS gap_n
  FROM w GROUP BY ALL`;
}

/**
 * Follow-ups logged, split by the lead's age (new when the lead was created in
 * the same period, old when before it), and the listings sent in shares: one
 * share can carry several properties or projects.
 */
export function leadWorkCounters({ ids, range }: Ctx) {
  const start = `CASE WHEN p = 'cur' THEN ${utcStart(range.from)} ELSE ${utcStart(range.prevFrom)} END`;
  return `
  WITH f AS (
    SELECT f.created_by_id AS uid, ${periodOf('f.created_at', range)} AS p, l.created_at AS lead_at
      FROM lead_follow_ups f JOIN leads l ON l.id = f.lead_id
     WHERE f.created_by_id IN (${ids}) AND ${inBothPeriods('f.created_at', range)}
  ), fu AS (
    SELECT uid, p,
      COUNT(*) FILTER (WHERE lead_at >= ${start}) AS fu_new,
      COUNT(*) FILTER (WHERE lead_at < ${start}) AS fu_old
    FROM f GROUP BY ALL
  ), sh AS (
    SELECT sent_by_id AS uid, ${periodOf('created_at', range)} AS p,
      SUM(COALESCE(TRY(json_array_length(message)), 1)) AS listings_shared
    FROM contact_logs
    WHERE contact_type = 'share' AND sent_by_id IN (${ids}) AND ${inBothPeriods('created_at', range)}
    GROUP BY ALL
  )
  SELECT COALESCE(fu.uid, sh.uid) AS uid, COALESCE(fu.p, sh.p) AS p,
    COALESCE(fu.fu_new, 0) AS fu_new, COALESCE(fu.fu_old, 0) AS fu_old, COALESCE(sh.listings_shared, 0) AS listings_shared
  FROM fu FULL JOIN sh ON sh.uid = fu.uid AND sh.p = fu.p`;
}

/**
 * Follow-up promises falling due in the period, by the person who set them.
 * Kept on time when someone touched the lead again by the end of the due day.
 */
export function followUpDiscipline({ ids, range }: Ctx) {
  return `
  WITH f AS (
    SELECT id, lead_id, created_by_id AS uid, created_at, next_follow_up_date AS d FROM lead_follow_ups
     WHERE created_by_id IN (${ids}) AND next_follow_up_date BETWEEN DATE '${range.prevFrom}' AND DATE '${range.to}'
  ), touch AS (${LEAD_TOUCHES}),
  r AS (
    SELECT f.id, f.uid, f.d, MIN(t.ts) AS first_after
      FROM f LEFT JOIN touch t ON t.lead_id = f.lead_id AND t.ts > f.created_at
     GROUP BY ALL
  )
  SELECT uid, CASE WHEN d >= DATE '${range.from}' THEN 'cur' ELSE 'prev' END AS p,
    COUNT(*) AS fu_due,
    COUNT(*) FILTER (WHERE first_after IS NOT NULL AND ${istDate('first_after')} <= d) AS fu_ontime,
    COUNT(*) FILTER (WHERE first_after IS NOT NULL AND ${istDate('first_after')} > d) AS fu_late,
    COUNT(*) FILTER (WHERE first_after IS NULL AND d < DATE '${range.today}') AS fu_overdue,
    COUNT(*) FILTER (WHERE first_after IS NULL AND d = DATE '${range.today}') AS fu_pending_today
  FROM r GROUP BY ALL`;
}

/** Lead status moves made by the person; each lead counts once per stage per period. */
export function statusCounters({ ids, range }: Ctx) {
  const stage = (name: string, values: string[]) =>
    `COUNT(DISTINCT lead_id) FILTER (WHERE to_value IN (${list(values)})) AS ${name}`;
  return `
  SELECT actor_id AS uid, ${periodOf('created_at', range)} AS p,
    ${stage('ev_contacted', ['Contacted'])},
    ${stage('ev_qualified', QUALIFIED)},
    ${stage('ev_shared', ['Property Shared'])},
    ${stage('ev_sv_sched', ['Site Visit Scheduled'])},
    ${stage('ev_sv_done', ['Site Visit Completed'])},
    ${stage('ev_rsv_sched', ['Re Visit Scheduled'])},
    ${stage('ev_rsv_done', ['Re Visit Completed'])},
    ${stage('ev_nego', ['Negotiation'])},
    ${stage('ev_booked', BOOKED)},
    ${stage('ev_dropped', DROPPED)},
    COUNT(*) AS status_changes
  FROM lead_events
  WHERE type = 'status_changed' AND actor_id IN (${ids}) AND ${inBothPeriods('created_at', range)}
  GROUP BY ALL`;
}

/**
 * Assignments to the person and how quickly they first touched the lead.
 * The clock runs in working hours only. Leads never routed count from creation.
 */
export function responseCounters({ ids, range, now }: Ctx) {
  return `
  WITH a AS (
    SELECT lead_id, to_user_id AS uid, created_at AS t_at FROM routing_histories
     WHERE to_user_id IN (${ids}) AND to_user_id IS DISTINCT FROM from_user_id AND ${inBothPeriods('created_at', range)}
    UNION ALL
    SELECT l.id, l.assigned_staff_id, l.created_at FROM leads l
     WHERE l.assigned_staff_id IN (${ids}) AND ${inBothPeriods('l.created_at', range)}
       AND NOT EXISTS (SELECT 1 FROM routing_histories r WHERE r.lead_id = l.id)
  ), touch AS (${LEAD_TOUCHES}),
  r AS (
    SELECT a.lead_id, a.uid, a.t_at, ${workClockStart('a.t_at')} AS clock, MIN(t.ts) AS first_ts
      FROM a LEFT JOIN touch t ON t.lead_id = a.lead_id AND t.uid = a.uid AND t.ts >= a.t_at
     GROUP BY ALL
  )
  SELECT uid, ${periodOf('t_at', range)} AS p,
    COUNT(*) AS assigned_n,
    COUNT(first_ts) AS responded_n,
    COALESCE(SUM(GREATEST(date_diff('minute', clock, first_ts), 0)), 0) AS resp_min_sum,
    COUNT(*) FILTER (WHERE first_ts IS NOT NULL AND date_diff('minute', clock, first_ts) <= ${RESPONSE_SLA_MIN}) AS resp_sla_n,
    COUNT(*) FILTER (WHERE first_ts IS NULL AND clock < ${now} - INTERVAL ${RESPONSE_SLA_MIN} MINUTE) AS resp_missed_n
  FROM r GROUP BY ALL`;
}

/** Current portfolio of open leads owned by each person (a snapshot, no period). */
export function portfolio({ ids, now }: Ctx) {
  return `
  WITH owned AS (
    SELECT id, status, department, assigned_staff_id AS uid, COALESCE(rnr_consecutive_count, 0) AS rnr, created_at FROM leads
     WHERE assigned_staff_id IN (${ids}) AND COALESCE(is_unqualified, false) = false AND converted_to IS NULL
       AND COALESCE(status, 'New Lead') NOT IN (${list(CLOSED_STATUSES)})
  ), touch AS (${LEAD_TOUCHES}),
  lt AS (
    SELECT o.id, MAX(t.ts) AS last_any, MAX(t.ts) FILTER (WHERE t.uid = o.uid) AS last_owner
      FROM owned o LEFT JOIN touch t ON t.lead_id = o.id GROUP BY 1
  ), fu AS (
    SELECT f.lead_id, f.next_follow_up_date AS d, COALESCE(f.is_completed, false) AS done
      FROM lead_follow_ups f JOIN owned o ON o.id = f.lead_id
    QUALIFY ROW_NUMBER() OVER (PARTITION BY f.lead_id ORDER BY f.created_at DESC, f.id DESC) = 1
  ), st AS (
    SELECT e.lead_id, MAX(e.created_at) AS t_at FROM lead_events e JOIN owned o ON o.id = e.lead_id
     WHERE e.type = 'status_changed' GROUP BY 1
  ), w AS (
    SELECT o.*, CASE WHEN NOT fu.done THEN fu.d END AS due, lt.last_any, lt.last_owner,
      date_diff('day', COALESCE(st.t_at, o.created_at), ${now}) AS stage_days,
      date_diff('hour', COALESCE(lt.last_any, o.created_at), ${now}) / 24.0 AS idle_days
    FROM owned o LEFT JOIN fu ON fu.lead_id = o.id LEFT JOIN lt ON lt.id = o.id LEFT JOIN st ON st.lead_id = o.id
  )
  SELECT uid,
    COUNT(*) AS open,
    COUNT(*) FILTER (WHERE due < ${istDate(now)}) AS overdue,
    COUNT(*) FILTER (WHERE due = ${istDate(now)}) AS due_today,
    COUNT(*) FILTER (WHERE due IS NULL) AS no_next,
    COUNT(*) FILTER (WHERE last_owner IS NULL OR last_owner < ${now} - INTERVAL 7 DAY) AS neglected,
    COUNT(*) FILTER (WHERE rnr >= 3) AS rnr3,
    COALESCE(SUM(idle_days), 0) AS idle_days_sum,
    COUNT(*) FILTER (WHERE idle_days < 2) AS idle_0_1,
    COUNT(*) FILTER (WHERE idle_days >= 2 AND idle_days < 4) AS idle_2_3,
    COUNT(*) FILTER (WHERE idle_days >= 4 AND idle_days < 8) AS idle_4_7,
    COUNT(*) FILTER (WHERE idle_days >= 8 AND idle_days < 15) AS idle_8_14,
    COUNT(*) FILTER (WHERE idle_days >= 15) AS idle_15_plus,
    COUNT(*) FILTER (WHERE department = 'sales') AS sales_open,
    COUNT(*) FILTER (WHERE status = 'Negotiation') AS negotiating,
    COUNT(*) FILTER (WHERE department = 'sales' AND stage_days > 14 AND (last_any IS NULL OR last_any < ${now} - INTERVAL 7 DAY)) AS stagnant,
    COUNT(*) FILTER (WHERE department = 'sales' AND stage_days <= 7) AS age_0_7,
    COUNT(*) FILTER (WHERE department = 'sales' AND stage_days BETWEEN 8 AND 14) AS age_8_14,
    COUNT(*) FILTER (WHERE department = 'sales' AND stage_days BETWEEN 15 AND 30) AS age_15_30,
    COUNT(*) FILTER (WHERE department = 'sales' AND stage_days > 30) AS age_30_plus
  FROM w GROUP BY uid`;
}

/** Leads that need attention now, with the reason, for the action queue. */
export function attentionQueue({ ids, now }: Ctx, limit = 40) {
  return `
  WITH owned AS (
    SELECT id, name, status, assigned_staff_id AS uid, COALESCE(rnr_consecutive_count, 0) AS rnr, created_at FROM leads
     WHERE assigned_staff_id IN (${ids}) AND COALESCE(is_unqualified, false) = false AND converted_to IS NULL
       AND COALESCE(status, 'New Lead') NOT IN (${list(CLOSED_STATUSES)})
  ), touch AS (${LEAD_TOUCHES}),
  lt AS (SELECT o.id, MAX(t.ts) FILTER (WHERE t.uid = o.uid) AS last_owner FROM owned o LEFT JOIN touch t ON t.lead_id = o.id GROUP BY 1),
  fu AS (
    SELECT f.lead_id, f.next_follow_up_date AS d, COALESCE(f.is_completed, false) AS done
      FROM lead_follow_ups f JOIN owned o ON o.id = f.lead_id
    QUALIFY ROW_NUMBER() OVER (PARTITION BY f.lead_id ORDER BY f.created_at DESC, f.id DESC) = 1
  ), w AS (
    SELECT o.*, CASE WHEN NOT fu.done THEN fu.d END AS due, lt.last_owner FROM owned o
      LEFT JOIN fu ON fu.lead_id = o.id LEFT JOIN lt ON lt.id = o.id
  )
  SELECT id, name, status, uid AS "ownerId", CAST(due AS VARCHAR) AS due,
    CASE WHEN due < ${istDate(now)} THEN 'overdue' WHEN due = ${istDate(now)} THEN 'today'
      WHEN rnr >= 3 THEN 'rnr' WHEN last_owner IS NULL OR last_owner < ${now} - INTERVAL 7 DAY THEN 'neglected'
      ELSE 'unscheduled' END AS reason,
    CAST(date_diff('day', COALESCE(last_owner, created_at), ${now}) AS INTEGER) AS "idleDays"
  FROM w WHERE due <= ${istDate(now)} OR due IS NULL OR rnr >= 3 OR last_owner IS NULL OR last_owner < ${now} - INTERVAL 7 DAY
  ORDER BY CASE WHEN due < ${istDate(now)} THEN 0 WHEN due = ${istDate(now)} THEN 1 WHEN rnr >= 3 THEN 2
    WHEN last_owner IS NULL OR last_owner < ${now} - INTERVAL 7 DAY THEN 3 ELSE 4 END, due NULLS LAST, id
  LIMIT ${limit}`;
}

/** Connected lead calls followed within two hours by a CRM update from the caller. */
export function crmCompliance({ ids, range }: Ctx) {
  return `
  WITH c AS (
    SELECT id, sent_by_id AS uid, entity_id AS lead_id, created_at AS ts FROM all_contacts
     WHERE entity = 'lead' AND contact_type = 'call' AND call_duration > 0
       AND sent_by_id IN (${ids}) AND ${inBothPeriods('created_at', range)}
  ), u AS (
    SELECT created_by_id AS uid, lead_id, created_at AS ts FROM lead_follow_ups
    UNION ALL SELECT actor_id, lead_id, created_at FROM lead_events WHERE type <> 'created'
  ), f AS (
    SELECT c.id, c.uid, c.ts, MAX(CASE WHEN u.ts IS NULL THEN 0 ELSE 1 END) AS ok
      FROM c LEFT JOIN u ON u.uid = c.uid AND u.lead_id = c.lead_id
        AND u.ts BETWEEN c.ts - INTERVAL 10 MINUTE AND c.ts + INTERVAL 2 HOUR
     GROUP BY ALL
  )
  SELECT uid, ${periodOf('ts', range)} AS p, COUNT(*) AS crm_calls, SUM(ok) AS crm_updated FROM f GROUP BY ALL`;
}

/** Telecalling → Sales handoffs by the telecaller who owned the lead, and the first Sales touch. */
export function handoffCounters({ ids, range }: Ctx) {
  return `
  WITH h AS (
    SELECT lead_id, from_user_id AS uid, created_at AS t_at FROM routing_histories
     WHERE event_type = 'Auto-transferred' AND from_user_id IN (${ids}) AND ${inBothPeriods('created_at', range)}
  ), sales AS (
    SELECT u.id FROM users u JOIN departments d ON d.id = u.department_id WHERE d.name ILIKE '%sales%'
  ), touch AS (${LEAD_TOUCHES}),
  r AS (
    SELECT h.lead_id, h.uid, h.t_at, MIN(t.ts) AS first_sales FROM h
      LEFT JOIN touch t ON t.lead_id = h.lead_id AND t.ts >= h.t_at AND t.uid IN (SELECT id FROM sales)
     GROUP BY ALL
  )
  SELECT uid, ${periodOf('t_at', range)} AS p,
    COUNT(*) AS ho_n,
    COUNT(first_sales) AS ho_touched,
    COUNT(*) FILTER (WHERE first_sales <= t_at + INTERVAL 48 HOUR) AS ho_accepted,
    COALESCE(SUM(date_diff('minute', t_at, first_sales)), 0) AS ho_min_sum
  FROM r GROUP BY ALL`;
}

/** Site visits due by their visit date, against the owner, and whether they happened. */
export function visitAttendance({ ids, range }: Ctx) {
  return `
  WITH v AS (
    SELECT lead_id, MAX(visit_date) AS d FROM lead_inquiries
     WHERE visit_date BETWEEN DATE '${range.prevFrom}' AND DATE '${range.to}' GROUP BY 1
  ), done AS (
    SELECT lead_id, MAX(created_at) AS t_at FROM lead_events
     WHERE type = 'status_changed' AND to_value IN ('Site Visit Completed', 'Re Visit Completed') GROUP BY 1
  )
  SELECT l.assigned_staff_id AS uid, CASE WHEN v.d >= DATE '${range.from}' THEN 'cur' ELSE 'prev' END AS p,
    COUNT(*) AS sv_due,
    COUNT(*) FILTER (WHERE ${istDate('done.t_at')} >= v.d - INTERVAL 1 DAY) AS sv_attended,
    COUNT(*) FILTER (WHERE v.d < DATE '${range.today}' AND (done.t_at IS NULL OR ${istDate('done.t_at')} < v.d - INTERVAL 1 DAY)) AS sv_missed
  FROM v JOIN leads l ON l.id = v.lead_id LEFT JOIN done ON done.lead_id = v.lead_id
  WHERE l.assigned_staff_id IN (${ids}) GROUP BY ALL`;
}

/** Sales journeys: negotiation length, sales cycle, cancelled bookings, shares that led to visits. */
export function salesJourneys({ ids, range }: Ctx) {
  return `
  WITH e AS (
    SELECT lead_id, actor_id, to_value, created_at,
      LEAD(created_at) OVER (PARTITION BY lead_id ORDER BY created_at, id) AS next_at
    FROM lead_events WHERE type = 'status_changed'
  ), nego AS (
    SELECT l.assigned_staff_id AS uid, e.next_at AS t_at, date_diff('hour', e.created_at, e.next_at) / 24.0 AS days
      FROM e JOIN leads l ON l.id = e.lead_id
     WHERE e.to_value = 'Negotiation' AND e.next_at IS NOT NULL AND l.assigned_staff_id IN (${ids})
       AND ${inBothPeriods('e.next_at', range)}
  ), booked AS (
    SELECT e.actor_id AS uid, e.lead_id, MIN(e.created_at) AS t_at FROM e
     WHERE e.to_value IN (${list(BOOKED)}) AND e.actor_id IN (${ids}) AND ${inBothPeriods('e.created_at', range)}
     GROUP BY ALL
  ), bk AS (
    SELECT b.*, date_diff('hour', l.created_at, b.t_at) / 24.0 AS cycle_days,
      EXISTS (SELECT 1 FROM lead_events x WHERE x.lead_id = b.lead_id AND x.type = 'status_changed'
        AND x.to_value IN (${list(DROPPED)}) AND x.created_at > b.t_at) AS cancelled
    FROM booked b JOIN leads l ON l.id = b.lead_id
  ), shares AS (
    SELECT sent_by_id AS uid, entity_id AS lead_id, MIN(created_at) AS t_at FROM all_contacts
     WHERE entity = 'lead' AND contact_type = 'share' AND sent_by_id IN (${ids}) AND ${inBothPeriods('created_at', range)}
     GROUP BY ALL
    UNION
    SELECT actor_id, lead_id, MIN(created_at) FROM lead_events
     WHERE type = 'status_changed' AND to_value = 'Property Shared' AND actor_id IN (${ids}) AND ${inBothPeriods('created_at', range)}
     GROUP BY ALL
  ), sh AS (
    SELECT uid, lead_id, MIN(t_at) AS t_at FROM shares GROUP BY ALL
  ), shv AS (
    SELECT sh.*, EXISTS (SELECT 1 FROM lead_events x WHERE x.lead_id = sh.lead_id AND x.type = 'status_changed'
      AND x.to_value IN ('Site Visit Scheduled', 'Re Visit Scheduled', 'Site Visit Completed', 'Re Visit Completed') AND x.created_at > sh.t_at) AS visited
    FROM sh
  ), rows AS (
    SELECT uid, ${periodOf('t_at', range)} AS p, 'nego' AS k, days AS v, 0 AS flag FROM nego
    UNION ALL SELECT uid, ${periodOf('t_at', range)}, 'booking', cycle_days, CASE WHEN cancelled THEN 1 ELSE 0 END FROM bk
    UNION ALL SELECT uid, ${periodOf('t_at', range)}, 'share', 0, CASE WHEN visited THEN 1 ELSE 0 END FROM shv
  )
  SELECT uid, p,
    COUNT(*) FILTER (WHERE k = 'nego') AS nego_closed_n,
    COALESCE(SUM(v) FILTER (WHERE k = 'nego'), 0) AS nego_days_sum,
    COUNT(*) FILTER (WHERE k = 'booking') AS bookings_n,
    COALESCE(SUM(v) FILTER (WHERE k = 'booking'), 0) AS cycle_days_sum,
    COUNT(*) FILTER (WHERE k = 'booking' AND flag = 1) AS bookings_cancelled,
    COUNT(*) FILTER (WHERE k = 'share') AS shared_leads,
    COUNT(*) FILTER (WHERE k = 'share' AND flag = 1) AS shared_to_visit
  FROM rows GROUP BY ALL`;
}

/** Inbound listings sourced by the person, with completeness and what happened to them. */
export function sourcingCounters({ ids, range }: Ctx) {
  const filled = [
    `NULLIF(TRIM(owner_name), '') IS NOT NULL`, `NULLIF(TRIM(mobile_number), '') IS NOT NULL`,
    `NULLIF(TRIM(property_type), '') IS NOT NULL`, `NULLIF(TRIM(COALESCE(locality, area)), '') IS NOT NULL`,
    `(COALESCE(sale_price, 0) > 0 OR COALESCE(total_rent, 0) > 0)`, `NULLIF(TRIM(image_url), '') IS NOT NULL`,
    `latitude IS NOT NULL`, `COALESCE(documents_collected, false)`,
  ];
  return `
  WITH v AS (
    SELECT entity_id, MIN(created_at) AS t_at FROM record_events
     WHERE entity = 'inbound' AND field = 'inbound_status' AND to_value = 'verification_done' GROUP BY 1
  )
  SELECT i.uploaded_by_id AS uid, ${periodOf('i.created_at', range)} AS p,
    COUNT(*) AS src_added,
    SUM((${filled.map(f => `CASE WHEN ${f} THEN 1 ELSE 0 END`).join(' + ')}) / ${filled.length}.0) AS src_complete_sum,
    COUNT(*) FILTER (WHERE COALESCE(i.documents_collected, false)) AS src_docs,
    COUNT(*) FILTER (WHERE i.inbound_status = 'verification_done' OR v.t_at IS NOT NULL) AS src_verified,
    COUNT(*) FILTER (WHERE i.inbound_status = 'not_available') AS src_rejected,
    COUNT(v.t_at) AS src_verify_n,
    COALESCE(SUM(date_diff('hour', i.created_at, v.t_at)), 0) AS src_verify_hours_sum,
    COUNT(DISTINCT COALESCE(i.locality, i.area)) AS src_localities
  FROM inbounds i LEFT JOIN v ON v.entity_id = i.id
  WHERE i.uploaded_by_id IN (${ids}) AND ${inBothPeriods('i.created_at', range)}
  GROUP BY ALL`;
}

/** Verification work: decisions made by the person, turnaround, and their open queue. */
export function verificationCounters({ ids, range, now }: Ctx) {
  return `
  WITH d AS (
    SELECT e.actor_id AS uid, e.entity_id, e.to_value, e.created_at,
      (SELECT MAX(x.created_at) FROM record_events x WHERE x.entity = 'inbound' AND x.entity_id = e.entity_id
        AND x.field = 'inbound_status' AND x.to_value = 'fixed_verification' AND x.created_at < e.created_at) AS queued_at,
      i.created_at AS added_at
    FROM record_events e JOIN inbounds i ON i.id = e.entity_id
    WHERE e.entity = 'inbound' AND e.field = 'inbound_status' AND e.to_value IN ('verification_done', 'not_available')
      AND e.actor_id IN (${ids}) AND ${inBothPeriods('e.created_at', range)}
  ), q AS (
    SELECT i.assigned_staff_id AS uid, i.id,
      (SELECT MAX(x.created_at) FROM record_events x WHERE x.entity = 'inbound' AND x.entity_id = i.id
        AND x.field = 'inbound_status' AND x.to_value = 'fixed_verification') AS queued_at, i.created_at
    FROM inbounds i WHERE i.inbound_status = 'fixed_verification' AND i.assigned_staff_id IN (${ids})
  ), fu AS (
    SELECT created_by_id AS uid, ${periodOf('created_at', range)} AS p, COUNT(*) AS n FROM inbound_follow_ups
     WHERE created_by_id IN (${ids}) AND ${inBothPeriods('created_at', range)} GROUP BY ALL
  ), dec AS (
    SELECT uid, ${periodOf('created_at', range)} AS p,
      COUNT(DISTINCT entity_id) FILTER (WHERE to_value = 'verification_done') AS ver_done,
      COUNT(DISTINCT entity_id) FILTER (WHERE to_value = 'not_available') AS ver_rejected,
      COALESCE(SUM(date_diff('hour', COALESCE(queued_at, added_at), created_at)) FILTER (WHERE to_value = 'verification_done'), 0) AS ver_hours_sum
    FROM d GROUP BY ALL
  ), pend AS (
    SELECT uid, 'cur' AS p, COUNT(*) AS ver_pending,
      COUNT(*) FILTER (WHERE COALESCE(queued_at, created_at) < ${now} - INTERVAL 3 DAY) AS ver_overdue
    FROM q GROUP BY ALL
  )
  SELECT COALESCE(dec.uid, pend.uid, fu.uid) AS uid, COALESCE(dec.p, pend.p, fu.p) AS p,
    COALESCE(dec.ver_done, 0) AS ver_done, COALESCE(dec.ver_rejected, 0) AS ver_rejected,
    COALESCE(dec.ver_hours_sum, 0) AS ver_hours_sum,
    COALESCE(pend.ver_pending, 0) AS ver_pending, COALESCE(pend.ver_overdue, 0) AS ver_overdue,
    COALESCE(fu.n, 0) AS ver_followups
  FROM dec FULL JOIN pend ON pend.uid = dec.uid AND pend.p = dec.p
    FULL JOIN fu ON fu.uid = COALESCE(dec.uid, pend.uid) AND fu.p = COALESCE(dec.p, pend.p)`;
}

/** Hiring work: applications owned and status moves made by the recruiter. */
export function hrCounters({ ids, range, now }: Ctx) {
  const stage = (name: string, value: string) => `COUNT(DISTINCT e.entity_id) FILTER (WHERE e.to_value = '${value}') AS ${name}`;
  return `
  WITH apps AS (
    SELECT "assignedStaffId" AS uid, ${periodOf('"createdAt"', range)} AS p, COUNT(*) AS hr_apps FROM hr_candidates
     WHERE "assignedStaffId" IN (${ids}) AND ${inBothPeriods('"createdAt"', range)} GROUP BY ALL
  ), moves AS (
    SELECT e.actor_id AS uid, ${periodOf('e.created_at', range)} AS p,
      ${stage('hr_shortlisted', 'Resume Shortlisted')}, ${stage('hr_int_sched', 'Interview Scheduled')},
      ${stage('hr_int_done', 'Interview Completed')}, ${stage('hr_selected', 'Selected')},
      ${stage('hr_offers', 'Offer Sent')}, ${stage('hr_joined', 'Joined')}, ${stage('hr_rejected', 'Rejected')},
      COALESCE(SUM(date_diff('hour', c."createdAt", e.created_at)) FILTER (WHERE e.to_value = 'Joined'), 0) / 24.0 AS hr_hire_days_sum
    FROM record_events e LEFT JOIN hr_candidates c ON c.id = e.entity_id
    WHERE e.entity = 'hr' AND e.type = 'status_changed' AND e.actor_id IN (${ids}) AND ${inBothPeriods('e.created_at', range)}
    GROUP BY ALL
  ), stuck AS (
    SELECT "assignedStaffId" AS uid, 'cur' AS p,
      COUNT(*) FILTER (WHERE status NOT IN ('Joined', 'Rejected') AND "updatedAt" < ${now} - INTERVAL 7 DAY) AS hr_stuck,
      COUNT(*) FILTER (WHERE status NOT IN ('Joined', 'Rejected')) AS hr_open
    FROM hr_candidates WHERE "assignedStaffId" IN (${ids}) GROUP BY ALL
  )
  SELECT COALESCE(m.uid, a.uid, s.uid) AS uid, COALESCE(m.p, a.p, s.p) AS p,
    COALESCE(a.hr_apps, 0) AS hr_apps, m.* EXCLUDE (uid, p), COALESCE(s.hr_stuck, 0) AS hr_stuck, COALESCE(s.hr_open, 0) AS hr_open
  FROM moves m FULL JOIN apps a ON a.uid = m.uid AND a.p = m.p
    FULL JOIN stuck s ON s.uid = COALESCE(m.uid, a.uid) AND s.p = COALESCE(m.p, a.p)`;
}

/** Manual task entries logged by the person (Design, Digital, HR and other hand-logged work). */
export function manualTaskCounters({ ids, range }: Ctx) {
  return `
  SELECT logged_by AS uid, CASE WHEN logged_date >= DATE '${range.from}' THEN 'cur' ELSE 'prev' END AS p,
    COALESCE(SUM(count_value), 0) AS manual_logged,
    COUNT(DISTINCT metric_key) AS manual_metrics
  FROM task_activity_logs
  WHERE logged_by IN (${ids}) AND logged_date BETWEEN DATE '${range.prevFrom}' AND DATE '${range.to}'
  GROUP BY ALL`;
}

/** Bucketed activity for trends and streaks, current period only. */
export function activitySeries({ ids, range }: Ctx, from = range.from, to = range.to, bucket = range.bucket) {
  const b = (col: string) => bucket === 'hour'
    ? `CAST(hour(${col} + INTERVAL 330 MINUTE) AS VARCHAR)`
    : bucket === 'week'
      ? `CAST(date_trunc('week', ${istDate(col)}) AS VARCHAR)`
      : `CAST(${istDate(col)} AS VARCHAR)`;
  const within = (col: string) => `${col} >= ${utcStart(from)} AND ${col} < ${utcStart(addDays(to, 1))}`;
  return `
  WITH e AS (
    SELECT sent_by_id AS uid, ${b('created_at')} AS t,
      CASE WHEN contact_type = 'call' THEN 'calls' WHEN contact_type = 'share' THEN 'shares' ELSE 'messages' END AS k,
      CASE WHEN contact_type = 'call' AND call_duration > 0 THEN 1 ELSE 0 END AS c, COALESCE(call_duration, 0) AS s
    FROM all_contacts WHERE sent_by_id IN (${ids}) AND ${within('created_at')}
    UNION ALL SELECT created_by_id, ${b('created_at')}, 'followups', 0, 0 FROM lead_follow_ups
     WHERE created_by_id IN (${ids}) AND ${within('created_at')}
    UNION ALL SELECT actor_id, ${b('created_at')},
      CASE WHEN to_value IN (${list(QUALIFIED)}) THEN 'qualified' WHEN to_value = 'Site Visit Scheduled' THEN 'sv_sched'
        WHEN to_value IN ('Site Visit Completed', 'Re Visit Completed') THEN 'sv_done' WHEN to_value = 'Negotiation' THEN 'nego'
        WHEN to_value IN (${list(BOOKED)}) THEN 'booked' WHEN to_value IN (${list(DROPPED)}) THEN 'dropped' ELSE 'moves' END, 0, 0
    FROM lead_events WHERE type = 'status_changed' AND actor_id IN (${ids}) AND ${within('created_at')}
    UNION ALL SELECT uploaded_by_id, ${b('created_at')}, 'sourced', 0, 0 FROM inbounds
     WHERE uploaded_by_id IN (${ids}) AND ${within('created_at')}
    UNION ALL SELECT actor_id, ${b('created_at')}, 'verified', 0, 0 FROM record_events
     WHERE entity = 'inbound' AND field = 'inbound_status' AND to_value = 'verification_done' AND actor_id IN (${ids}) AND ${within('created_at')}
    UNION ALL SELECT actor_id, ${b('created_at')}, 'hr_moves', 0, 0 FROM record_events
     WHERE entity = 'hr' AND type = 'status_changed' AND actor_id IN (${ids}) AND ${within('created_at')}
  )
  SELECT uid, t, k, COUNT(*) AS n, SUM(c) AS connected, SUM(s) AS seconds FROM e GROUP BY ALL`;
}

/** Calls by weekday and IST hour, for the time-of-day heatmap. */
export function callHeatmap({ ids, range }: Ctx) {
  const ist = `created_at + INTERVAL 330 MINUTE`;
  return `
  SELECT CAST(dayofweek(${ist}) AS INTEGER) AS dow, CAST(hour(${ist}) AS INTEGER) AS hour,
    COUNT(*) AS calls, COUNT(*) FILTER (WHERE call_duration > 0) AS connected
  FROM all_contacts
  WHERE contact_type = 'call' AND sent_by_id IN (${ids})
    AND created_at >= ${utcStart(range.from)} AND created_at < ${end(range)}
  GROUP BY ALL`;
}

/** Status of every lead owned by the population (all statuses). */
export function statusMix({ ids }: Ctx) {
  return `SELECT COALESCE(status, 'New Lead') AS label, COUNT(*) AS value FROM leads
    WHERE assigned_staff_id IN (${ids}) GROUP BY ALL ORDER BY value DESC`;
}

/** Why leads were dropped in the period by the population. */
export function lossReasons({ ids, range }: Ctx) {
  return `SELECT COALESCE(NULLIF(TRIM(l.drop_reason), ''), e.to_value) AS label, COUNT(DISTINCT e.lead_id) AS value
    FROM lead_events e JOIN leads l ON l.id = e.lead_id
    WHERE e.type = 'status_changed' AND e.to_value IN (${list(DROPPED)}) AND e.actor_id IN (${ids})
      AND e.created_at >= ${utcStart(range.from)} AND e.created_at < ${end(range)}
    GROUP BY ALL ORDER BY value DESC LIMIT 12`;
}

/**
 * Leads created in the period and how far each got, for the end-to-end funnel
 * and lead source quality. `owners` limits it to leads owned by the population.
 */
export function leadCohort({ range }: Ctx, owners?: string) {
  const reached = (name: string, values: string[]) =>
    `MAX(CASE WHEN e.to_value IN (${list(values)}) OR l.status IN (${list(values)}) THEN 1 ELSE 0 END) AS ${name}`;
  return `
  WITH l AS (
    SELECT id, COALESCE(NULLIF(TRIM(lead_source), ''), 'Unknown') AS source, status, created_at FROM leads
     WHERE created_at >= ${utcStart(range.from)} AND created_at < ${end(range)} ${owners ? `AND assigned_staff_id IN (${owners})` : ''}
  ), touched AS (
    SELECT DISTINCT entity_id AS lead_id FROM all_contacts WHERE entity = 'lead'
    UNION SELECT DISTINCT lead_id FROM lead_follow_ups
  ), j AS (
    SELECT l.id, l.source, CASE WHEN t.lead_id IS NULL THEN 0 ELSE 1 END AS contacted,
      ${reached('qualified', [...QUALIFIED, 'Property Shared', 'Site Visit Scheduled', 'Site Visit Completed', 'Re Visit Scheduled', 'Re Visit Completed', 'Negotiation', ...BOOKED])},
      ${reached('sv_sched', ['Site Visit Scheduled', 'Site Visit Completed', 'Re Visit Scheduled', 'Re Visit Completed', 'Negotiation', ...BOOKED])},
      ${reached('sv_done', ['Site Visit Completed', 'Re Visit Scheduled', 'Re Visit Completed', 'Negotiation', ...BOOKED])},
      ${reached('nego', ['Negotiation', ...BOOKED])},
      ${reached('booked', BOOKED)},
      ${reached('dropped', DROPPED)}
    FROM l LEFT JOIN touched t ON t.lead_id = l.id
      LEFT JOIN lead_events e ON e.lead_id = l.id AND e.type = 'status_changed'
    GROUP BY ALL
  )
  SELECT source, COUNT(*) AS leads, SUM(contacted) AS contacted, SUM(qualified) AS qualified, SUM(sv_sched) AS sv_sched,
    SUM(sv_done) AS sv_done, SUM(nego) AS nego, SUM(booked) AS booked, SUM(dropped) AS dropped
  FROM j GROUP BY ALL ORDER BY leads DESC`;
}

/** Inbound listings by area and by property type in the period. */
export function sourcingMix({ ids, range }: Ctx) {
  return `SELECT 'area' AS dim, COALESCE(NULLIF(TRIM(COALESCE(locality, area)), ''), 'Unknown') AS label, COUNT(*) AS value
      FROM inbounds WHERE uploaded_by_id IN (${ids}) AND created_at >= ${utcStart(range.from)} AND created_at < ${end(range)} GROUP BY ALL
    UNION ALL
    SELECT 'type', COALESCE(NULLIF(TRIM(property_type), ''), 'Unknown'), COUNT(*)
      FROM inbounds WHERE uploaded_by_id IN (${ids}) AND created_at >= ${utcStart(range.from)} AND created_at < ${end(range)} GROUP BY ALL`;
}

/**
 * Listings sourced in both periods by property type, and where each stands:
 * not yet checked, validated with the owner (available), in verification,
 * verified, or not available.
 */
export function sourcingStages({ ids, range }: Ctx) {
  return `SELECT ${periodOf('created_at', range)} AS p, COALESCE(NULLIF(TRIM(property_type), ''), 'Unknown') AS type,
      COUNT(*) AS sourced,
      COUNT(*) FILTER (WHERE NULLIF(inbound_status, '') IS NULL) AS unchecked,
      COUNT(*) FILTER (WHERE inbound_status = 'available') AS validated,
      COUNT(*) FILTER (WHERE inbound_status = 'fixed_verification') AS verifying,
      COUNT(*) FILTER (WHERE inbound_status = 'verification_done') AS verified,
      COUNT(*) FILTER (WHERE inbound_status = 'not_available') AS not_available
    FROM inbounds WHERE uploaded_by_id IN (${ids}) AND ${inBothPeriods('created_at', range)} GROUP BY ALL`;
}

/**
 * Buyer demand (requirements in the last 90 days) against available supply
 * (open or verified inbound listings), by property type.
 */
export function supplyDemand({ range }: Ctx) {
  return `
  WITH demand AS (
    SELECT LOWER(TRIM(COALESCE(NULLIF(property_type, ''), property_category, 'unknown'))) AS k, COUNT(*) AS n FROM lead_inquiries
     WHERE created_at >= ${utcStart(addDays(range.today, -89))} GROUP BY 1
  ), supply AS (
    SELECT LOWER(TRIM(COALESCE(NULLIF(property_type, ''), property_category, 'unknown'))) AS k, COUNT(*) AS n FROM inbounds
     WHERE COALESCE(status, '') <> 'Closed' OR inbound_status = 'verification_done' GROUP BY 1
  )
  SELECT COALESCE(d.k, s.k) AS label, COALESCE(d.n, 0) AS demand, COALESCE(s.n, 0) AS supply
  FROM demand d FULL JOIN supply s ON s.k = d.k ORDER BY demand DESC, supply DESC LIMIT 14`;
}

/** Hiring pipeline snapshot and source effectiveness for the population. */
export function hrMix({ ids, range }: Ctx) {
  return `SELECT 'status' AS dim, COALESCE(status, 'New Application') AS label, COUNT(*) AS value, 0 AS joined
      FROM hr_candidates WHERE "assignedStaffId" IN (${ids}) GROUP BY ALL
    UNION ALL
    SELECT 'source', COALESCE(NULLIF(TRIM(s.name), ''), NULLIF(TRIM(c."recruitmentSource"), ''), 'Unknown'), COUNT(*),
      COUNT(*) FILTER (WHERE c.status = 'Joined')
      FROM hr_candidates c LEFT JOIN hr_sources s ON s.id = c."hrSourceId"
     WHERE c."assignedStaffId" IN (${ids}) AND c."createdAt" >= ${utcStart(range.from)} AND c."createdAt" < ${end(range)} GROUP BY ALL`;
}

/** Data health: logger devices that stopped syncing, unowned leads, enquiries waiting. */
export function dataHealth({ ids, now }: Ctx) {
  return `
  SELECT
    (SELECT COUNT(DISTINCT user_id) FROM logger_devices WHERE user_id IN (${ids})) AS loggers,
    (SELECT COUNT(*) FROM (SELECT user_id, MAX(last_successful_sync_at) AS t_at FROM logger_devices WHERE user_id IN (${ids}) GROUP BY 1)
      WHERE t_at IS NULL OR t_at < ${now} - INTERVAL 24 HOUR) AS loggers_stale,
    (SELECT COUNT(*) FROM leads WHERE assigned_staff_id IS NULL AND converted_to IS NULL
      AND COALESCE(status, 'New Lead') NOT IN (${list(CLOSED_STATUSES)})) AS unowned_leads,
    (SELECT COUNT(*) FROM leads WHERE assigned_staff_id IN (${ids}) AND NULLIF(TRIM(lead_source), '') IS NULL) AS no_source,
    (SELECT COUNT(*) FROM website_enquiry_events WHERE resolved_lead_id IS NULL AND matched_lead_id IS NULL AND decided_at IS NULL) AS enquiries_waiting`;
}

/** Last successful logger sync per person. */
export function loggerStatus({ ids }: Ctx) {
  return `SELECT user_id AS uid, CAST(MAX(last_successful_sync_at) AS VARCHAR) AS t_at FROM logger_devices WHERE user_id IN (${ids}) GROUP BY 1`;
}
