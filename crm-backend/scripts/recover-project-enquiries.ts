/** One-off recovery: defaults to dry-run. Run inside the CRM backend container.
 * Uses the authenticated intake API, never inserts leads or events directly.
 * Site enquiry IDs in preferences make repeated sequential runs safe.
 */
import mysql from 'mysql2/promise';

async function run() {
  const apply = process.argv.includes('--apply');
  // Freeze this incident's scope; later correctly queued submissions must not be replayed.
  const lastAffectedSiteLeadId = 26;
  const crm = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, dateStrings: true,
  });
  const site = await mysql.createConnection({
    host: process.env.SITE_DB_HOST || process.env.DB_HOST,
    port: Number(process.env.SITE_DB_PORT || process.env.DB_PORT || 3306),
    user: process.env.SITE_DB_USER || process.env.DB_USERNAME,
    password: process.env.SITE_DB_PASS || process.env.DB_PASSWORD,
    database: process.env.SITE_DB_NAME || 'majestan', dateStrings: true,
  });
  try {
    const [rows]: any = await site.query(`SELECT l.*, p.project_code, p.canonical_slug, p.project_type
      FROM leads l JOIN projects p ON p.id=l.project_id WHERE l.id<=? ORDER BY l.id`, [lastAffectedSiteLeadId]);
    for (const row of rows) {
      const [existing]: any = await crm.query(`SELECT id FROM website_enquiry_events
        WHERE JSON_UNQUOTE(JSON_EXTRACT(preferences,'$.siteLeadId'))=?`, [String(row.id)]);
      if (existing.length) { console.log(JSON.stringify({ siteLeadId: row.id, skipped: 'already queued' })); continue; }
      const [inquiries]: any = await crm.query(`SELECT i.intent,i.visit_date,i.visit_slot FROM lead_inquiries i
        JOIN leads l ON l.id=i.lead_id WHERE l.mobile_number=?
        AND ABS(TIMESTAMPDIFF(SECOND,i.created_at,?))<5`, [row.phone, row.created_at]);
      if (!inquiries.length) { console.log(JSON.stringify({ siteLeadId: row.id, skipped: 'requires manual intent verification' })); continue; }
      const visit = inquiries.find((i: any) => i.intent === 'site_visit');
      if (apply) {
        if (!process.env.SITE_TO_CRM_SERVICE_KEY) throw new Error('Missing service key');
        const response = await fetch(`http://localhost:${process.env.PORT || 8000}/api/v1/leads/website`, {
          method: 'POST', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json', 'X-Service-Key': process.env.SITE_TO_CRM_SERVICE_KEY },
          body: JSON.stringify({ name: row.name, mobile: row.phone, email: row.email || undefined,
            source: 'Website – Project page', propertyType: row.project_type,
            projectId: row.project_id, projectCode: row.project_code, projectSlug: row.canonical_slug,
            intent: visit ? 'site_visit' : 'enquiry',
            ...(visit ? { visitDate: visit.visit_date, visitSlot: visit.visit_slot.slice(0, 5) } : {}),
            notes: row.message?.replace(/^\[project_page\][^\n]*(\n|$)/, '') || undefined,
            preferences: { source: 'project_page', siteLeadId: row.id, originalSubmittedAt: row.created_at, recovered: true },
          }),
        });
        if (!response.ok) throw new Error(`Recovery failed for site lead ${row.id}: HTTP ${response.status}`);
      }
      console.log(JSON.stringify({ siteLeadId: row.id, intent: visit ? 'site_visit' : 'enquiry', action: apply ? 'queued' : 'would queue' }));
    }
  } finally { await Promise.all([crm.end(), site.end()]); }
}
void run().catch(error => { console.error(error.message); process.exitCode = 1; });
