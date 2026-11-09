/**
 * What each report can export. Every column is an SQL expression written here,
 * so the browser only ever sends field keys: nothing it sends reaches the query
 * text. Values from filters go in as bound parameters.
 */

export type FieldType = 'text' | 'number' | 'money' | 'date' | 'datetime' | 'bool';
export type ReportField = { key: string; label: string; sql: string; type: FieldType; group: string; default?: boolean };
/** `staff` lists active users; `distinct` lists the column's own values. */
export type ReportFilter = { key: string; label: string; sql: string; options: 'staff' | 'distinct' };
export type ReportModule = {
  key: string;
  label: string;
  description: string;
  db: 'crm' | 'site';
  from: string;
  /** Column the date range applies to. */
  date: string;
  dateLabel: string;
  order: string;
  fields: ReportField[];
  filters: ReportFilter[];
};

const f = (group: string) => (key: string, label: string, sql: string, type: FieldType = 'text', isDefault = false): ReportField =>
  ({ key, label, sql, type, group, default: isDefault || undefined });
const staffName = (col: string) => `(SELECT su.name FROM users su WHERE su.id = ${col})`;

// ── Leads ─────────────────────────────────────────────────────────────────
const lead = f('Lead');
const req = f('Requirement');
const work = f('Activity');
const LATEST_INQUIRY = `(SELECT li.* FROM lead_inquiries li JOIN (SELECT lead_id, MAX(id) AS id FROM lead_inquiries GROUP BY lead_id) m ON m.id = li.id)`;

const leads: ReportModule = {
  key: 'leads', label: 'Leads', description: 'Every lead with its requirement and how much it has been worked.',
  db: 'crm', from: `leads l LEFT JOIN ${LATEST_INQUIRY} q ON q.lead_id = l.id`,
  date: 'l.created_at', dateLabel: 'Created', order: 'l.id DESC',
  fields: [
    lead('id', 'Lead ID', 'l.id', 'number', true),
    lead('name', 'Name', 'l.name', 'text', true),
    lead('mobile', 'Mobile', 'l.mobile_number', 'text', true),
    lead('whatsapp', 'WhatsApp', 'l.whatsapp_number'),
    lead('email', 'Email', 'l.email'),
    lead('city', 'City', 'l.city', 'text', true),
    lead('address', 'Address', 'l.address'),
    lead('source', 'Source', 'l.lead_source', 'text', true),
    lead('status', 'Status', `COALESCE(l.status, 'New Lead')`, 'text', true),
    lead('department', 'Department', 'l.department'),
    lead('owner', 'Assigned to', staffName('l.assigned_staff_id'), 'text', true),
    lead('created', 'Created', 'l.created_at', 'datetime', true),
    lead('updated', 'Last updated', 'l.updated_at', 'datetime'),
    lead('referral', 'Referral', 'l.is_referral', 'bool'),
    lead('referred_by', 'Referred by', 'l.referred_by_name'),
    lead('referred_contact', 'Referrer contact', 'l.referred_by_contact'),
    lead('drop_reason', 'Drop reason', 'l.drop_reason'),
    lead('converted_to', 'Converted to', 'l.converted_to'),
    lead('converted_at', 'Converted on', 'l.converted_at', 'datetime'),
    lead('commission', 'Commission', 'l.commission', 'money'),
    lead('commission_note', 'Commission remarks', 'l.commission_remarks'),
    req('property_type', 'Property type', 'q.property_type', 'text', true),
    req('category', 'Category', 'q.property_category'),
    req('purchase_type', 'Purchase type', 'q.purchase_type'),
    req('intent', 'Intent', 'q.intent'),
    req('projects', 'Projects asked about', 'q.project_list'),
    req('property_code', 'Property code', 'q.property_code'),
    req('timeline', 'Purchase timeline', 'q.purchase_timeline'),
    req('funder', 'Funding', 'q.funder'),
    req('purpose', 'Purpose', 'q.qualification_purpose'),
    req('decision_maker', 'Decision maker', 'q.decision_maker'),
    req('visit_date', 'Visit date', 'q.visit_date', 'date'),
    req('visit_location', 'Visit location', 'q.visit_location'),
    work('calls', 'Calls', `(SELECT COUNT(*) FROM contact_logs c WHERE c.lead_id = l.id AND c.contact_type = 'call')`, 'number'),
    work('messages', 'Messages', `(SELECT COUNT(*) FROM contact_logs c WHERE c.lead_id = l.id AND c.contact_type IN ('whatsapp', 'sms', 'email'))`, 'number'),
    work('shares', 'Properties shared', `(SELECT COUNT(*) FROM contact_logs c WHERE c.lead_id = l.id AND c.contact_type = 'share')`, 'number'),
    work('last_contact', 'Last contacted', `(SELECT MAX(c.created_at) FROM contact_logs c WHERE c.lead_id = l.id)`, 'datetime', true),
    work('followups', 'Follow-ups', `(SELECT COUNT(*) FROM lead_follow_ups fu WHERE fu.lead_id = l.id)`, 'number'),
    work('next_followup', 'Next follow-up', `(SELECT MIN(fu.follow_up_date) FROM lead_follow_ups fu WHERE fu.lead_id = l.id AND fu.is_completed = 0)`, 'date', true),
    work('rnr', 'Unanswered calls in a row', 'l.rnr_consecutive_count', 'number'),
  ],
  filters: [
    { key: 'status', label: 'Status', sql: `COALESCE(l.status, 'New Lead')`, options: 'distinct' },
    { key: 'source', label: 'Source', sql: 'l.lead_source', options: 'distinct' },
    { key: 'owner', label: 'Assigned to', sql: 'l.assigned_staff_id', options: 'staff' },
    { key: 'city', label: 'City', sql: 'l.city', options: 'distinct' },
  ],
};

// ── Inbound ───────────────────────────────────────────────────────────────
const lst = f('Listing');
const own = f('Owner and contacts');
const com = f('Price and brokerage');
const inbound: ReportModule = {
  key: 'inbound', label: 'Inbound', description: 'Listings sourced from owners, with verification status.',
  db: 'crm', from: 'inbounds i', date: 'i.created_at', dateLabel: 'Sourced', order: 'i.id DESC',
  fields: [
    lst('id', 'ID', 'i.id', 'number', true),
    lst('code', 'Property ID', 'i.property_id', 'text', true),
    lst('title', 'Title', 'i.property_title', 'text', true),
    lst('category', 'Category', 'i.property_category'),
    lst('type', 'Property type', 'i.property_type', 'text', true),
    lst('purpose', 'Purpose', 'i.purpose', 'text', true),
    lst('bhk', 'BHK', 'i.bhk'),
    lst('floor', 'Floor', 'i.floor_number'),
    lst('city', 'City', 'i.city', 'text', true),
    lst('area', 'Area', 'i.area'),
    lst('locality', 'Locality', 'i.locality', 'text', true),
    lst('landmark', 'Landmark', 'i.landmark'),
    lst('map', 'Map link', 'i.google_map_location'),
    lst('status', 'Status', 'i.status', 'text', true),
    lst('verification', 'Verification', `CASE i.inbound_status WHEN 'available' THEN 'Validated' WHEN 'fixed_verification' THEN 'In verification' WHEN 'verification_done' THEN 'Verified' WHEN 'not_available' THEN 'Not available' ELSE 'Awaiting validation' END`, 'text', true),
    lst('exclusive', 'Exclusive', 'i.is_exclusive', 'bool'),
    lst('prime', 'Prime location', 'i.is_prime_location', 'bool'),
    lst('documents', 'Documents collected', 'i.documents_collected', 'bool'),
    lst('quality', 'Quality score', 'i.quality_score', 'number'),
    lst('listed_on', 'Listed on', 'i.listed_on'),
    lst('owner_staff', 'Assigned to', staffName('i.assigned_staff_id'), 'text', true),
    lst('uploaded_by', 'Sourced by', staffName('i.uploaded_by_id')),
    lst('created', 'Sourced on', 'i.created_at', 'datetime', true),
    lst('updated', 'Last updated', 'i.updated_at', 'datetime'),
    own('owner', 'Owner', 'i.owner_name', 'text', true),
    own('mobile', 'Owner mobile', 'i.mobile_number', 'text', true),
    own('whatsapp', 'Owner WhatsApp', 'i.whatsapp_number'),
    own('email', 'Owner email', 'i.email'),
    own('preferred_time', 'Preferred contact time', 'i.preferred_contact_time'),
    own('manager', 'Building manager', 'i.building_manager_name'),
    own('manager_mobile', 'Manager mobile', 'i.manager_mobile'),
    own('caretaker', 'Caretaker', 'i.caretaker_name'),
    own('caretaker_mobile', 'Caretaker mobile', 'i.caretaker_mobile'),
    own('key_with', 'Key available with', 'i.key_available_with'),
    own('broker', 'Broker', 'i.broker_name'),
    own('broker_mobile', 'Broker mobile', 'i.broker_mobile'),
    com('sale_price', 'Sale price', 'i.sale_price', 'money', true),
    com('rent', 'Monthly rent', 'i.total_rent', 'money', true),
    com('rent_sqft', 'Rent per sq ft', 'i.rent_per_sqft', 'money'),
    com('advance', 'Advance', 'i.advance'),
    com('budget', 'Budget details', 'i.budget_details'),
    com('brokerage', 'Brokerage accepted', 'i.brokerage_accepted'),
    com('brokerage_type', 'Brokerage type', 'i.brokerage_type'),
    com('brokerage_pct', 'Brokerage %', 'i.percentage', 'number'),
    com('brokerage_fixed', 'Brokerage amount', 'i.fixed_amount', 'money'),
    com('brokerage_by', 'Brokerage paid by', 'i.brokerage_paid_by'),
  ],
  filters: [
    { key: 'status', label: 'Status', sql: 'i.status', options: 'distinct' },
    { key: 'type', label: 'Property type', sql: 'i.property_type', options: 'distinct' },
    { key: 'city', label: 'City', sql: 'i.city', options: 'distinct' },
    { key: 'owner', label: 'Assigned to', sql: 'i.assigned_staff_id', options: 'staff' },
  ],
};

// ── Agent network ─────────────────────────────────────────────────────────
const ag = f('Agent');
const agents: ReportModule = {
  key: 'agents', label: 'Agent network', description: 'Brokers, agencies and partners.',
  db: 'crm', from: 'agents a', date: 'a.created_at', dateLabel: 'Added', order: 'a.id DESC',
  fields: [
    ag('id', 'ID', 'a.id', 'number', true),
    ag('name', 'Name', 'a.name', 'text', true),
    ag('company', 'Company', 'a.company_name', 'text', true),
    ag('mobile', 'Mobile', 'a.mobile_number', 'text', true),
    ag('whatsapp', 'WhatsApp', 'a.whatsapp_number'),
    ag('email', 'Email', 'a.email'),
    ag('city', 'City', 'a.city', 'text', true),
    ag('state', 'State', 'a.state'),
    ag('partner_type', 'Partner type', 'a.partner_type', 'text', true),
    ag('category', 'Property category', 'a.property_category'),
    ag('commission', 'Commission accepted', 'a.commission_accepted'),
    ag('commission_type', 'Commission type', 'a.commission_type'),
    ag('commission_value', 'Commission value', 'a.commission_value'),
    ag('status', 'Status', 'a.status', 'text', true),
    ag('owner', 'Assigned to', staffName('a.assigned_staff_id'), 'text', true),
    ag('remarks', 'Remarks', 'a.remarks'),
    ag('followups', 'Follow-ups', '(SELECT COUNT(*) FROM agent_follow_ups x WHERE x.agent_id = a.id)', 'number'),
    ag('created', 'Added on', 'a.created_at', 'datetime', true),
    ag('updated', 'Last updated', 'a.updated_at', 'datetime'),
  ],
  filters: [
    { key: 'status', label: 'Status', sql: 'a.status', options: 'distinct' },
    { key: 'partner_type', label: 'Partner type', sql: 'a.partner_type', options: 'distinct' },
    { key: 'city', label: 'City', sql: 'a.city', options: 'distinct' },
    { key: 'owner', label: 'Assigned to', sql: 'a.assigned_staff_id', options: 'staff' },
  ],
};

// ── Asset inventory ───────────────────────────────────────────────────────
const as = f('Asset');
const loc = f('Location');
const fin = f('Price');
const assets: ReportModule = {
  key: 'assets', label: 'Asset inventory', description: 'Land and assets with location and price.',
  db: 'crm', from: 'assets s LEFT JOIN asset_locations al ON al.asset_id = s.id LEFT JOIN asset_financials af ON af.asset_id = s.id',
  date: 's.created_at', dateLabel: 'Added', order: 's.id DESC',
  fields: [
    as('id', 'ID', 's.display_id', 'text', true),
    as('owner', 'Owner', 's.owner_name', 'text', true),
    as('mobile', 'Owner mobile', 's.mobile_number', 'text', true),
    as('status', 'Status', 's.status', 'text', true),
    as('source', 'Source', 's.source', 'text', true),
    as('mediator', 'Mediator', 's.mediator_name'),
    as('cp_ref', 'CP reference', 's.cp_reference_name'),
    as('visited', 'Visited on', 's.visited_date', 'date'),
    as('visit_done', 'Site visit done', 's.site_visited_done'),
    as('photos', 'Photos taken', 's.photos_taken'),
    as('outcome', 'Outcome', 's.outcome'),
    as('checked_by', 'Checked by', 's.checked_by'),
    as('approved_by', 'Approved by', 's.approved_by'),
    as('quality', 'Quality score', 's.quality_score', 'number'),
    as('staff', 'Assigned to', staffName('s.assigned_staff_id'), 'text', true),
    as('remarks', 'Remarks', 's.remarks'),
    as('created', 'Added on', 's.created_at', 'datetime', true),
    loc('district', 'District', 'al.district', 'text', true),
    loc('taluk', 'Taluk', 'al.taluk'),
    loc('village', 'Village', 'al.village', 'text', true),
    loc('road', 'Road name', 'al.road_name'),
    loc('site', 'Site location', 'al.site_location'),
    loc('zone', 'Zone', 'al.zone'),
    loc('junction', 'Junction', 'al.junction_name'),
    loc('from_main', 'Distance from main road', 'al.distance_from_main'),
    loc('from_airport', 'Distance from airport', 'al.distance_from_airport'),
    loc('road_width', 'Approach road width', 'al.approached_road_width'),
    loc('pin', 'Google pin', 'al.google_pin'),
    fin('land_price', 'Land price', 'af.land_price', 'money', true),
    fin('dtcp_price', 'DTCP price', 'af.dtcp_price', 'money'),
    fin('expectation', 'Owner expectation', 'af.expectation', 'money', true),
    fin('lo_price', 'LO price', 'af.lo_price', 'money'),
    fin('payment', 'Payment options', 'af.payment_options'),
    fin('mode', 'Business mode', 'af.business_mode'),
  ],
  filters: [
    { key: 'status', label: 'Status', sql: 's.status', options: 'distinct' },
    { key: 'source', label: 'Source', sql: 's.source', options: 'distinct' },
    { key: 'district', label: 'District', sql: 'al.district', options: 'distinct' },
    { key: 'staff', label: 'Assigned to', sql: 's.assigned_staff_id', options: 'staff' },
  ],
};

// ── HR panel ──────────────────────────────────────────────────────────────
const cand = f('Candidate');
const intv = f('Interview');
const hr: ReportModule = {
  key: 'hr', label: 'HR panel', description: 'Candidates and where they are in hiring.',
  db: 'crm', from: 'hr_candidates h LEFT JOIN hr_sources hs ON hs.id = h.hrSourceId', date: 'h.createdAt', dateLabel: 'Applied', order: 'h.id DESC',
  fields: [
    cand('id', 'ID', 'h.id', 'number', true),
    cand('name', 'Name', 'h.name', 'text', true),
    cand('mobile', 'Mobile', 'h.mobile', 'text', true),
    cand('whatsapp', 'WhatsApp', 'h.whatsapp'),
    cand('email', 'Email', 'h.email'),
    cand('city', 'City', 'h.city', 'text', true),
    cand('state', 'State', 'h.state'),
    cand('department', 'Department', 'h.department', 'text', true),
    cand('position', 'Position', 'h.position', 'text', true),
    cand('experience', 'Experience', 'h.experience'),
    cand('current_salary', 'Current salary', 'h.currentSalary'),
    cand('expected_salary', 'Expected salary', 'h.expectedSalary'),
    cand('notice', 'Notice period', 'h.noticePeriod'),
    cand('source', 'Source', `COALESCE(hs.name, h.recruitmentSource)`, 'text', true),
    cand('status', 'Status', 'h.status', 'text', true),
    cand('recruiter', 'Recruiter', staffName('h.assignedStaffId'), 'text', true),
    cand('resume', 'Resume', 'h.resumeUrl'),
    cand('applied', 'Applied on', 'h.createdAt', 'datetime', true),
    cand('updated', 'Last updated', 'h.updatedAt', 'datetime'),
    intv('date', 'Interview date', 'h.interviewDate', 'date', true),
    intv('time', 'Interview time', 'h.interviewTime'),
    intv('mode', 'Interview mode', 'h.interviewMode'),
    intv('round', 'Round', 'h.interviewRound'),
    intv('interviewer', 'Interviewer', 'h.interviewer'),
    intv('location', 'Location', 'h.interviewLocation'),
    intv('feedback', 'Feedback', 'h.interviewFeedback'),
  ],
  filters: [
    { key: 'status', label: 'Status', sql: 'h.status', options: 'distinct' },
    { key: 'department', label: 'Department', sql: 'h.department', options: 'distinct' },
    { key: 'position', label: 'Position', sql: 'h.position', options: 'distinct' },
    { key: 'recruiter', label: 'Recruiter', sql: 'h.assignedStaffId', options: 'staff' },
  ],
};

// ── Projects (website database) ───────────────────────────────────────────
const pj = f('Project');
const projects: ReportModule = {
  key: 'projects', label: 'Projects', description: 'Builder projects published on the website.',
  db: 'site', from: 'projects pr LEFT JOIN builders b ON b.id = pr.builder_id', date: 'pr.created_at', dateLabel: 'Added', order: 'pr.id DESC',
  fields: [
    pj('id', 'ID', 'pr.id', 'number', true),
    pj('code', 'Project code', 'pr.project_code', 'text', true),
    pj('name', 'Name', 'pr.name', 'text', true),
    pj('type', 'Type', 'pr.project_type', 'text', true),
    pj('builder', 'Builder', 'COALESCE(b.name, pr.builder_name)', 'text', true),
    pj('rera', 'RERA number', 'pr.rera_number'),
    pj('status', 'Status', 'pr.status', 'text', true),
    pj('possession', 'Possession', 'pr.possession_status', 'text', true),
    pj('possession_date', 'Possession date', 'pr.possession_date', 'date'),
    pj('city', 'City', 'pr.city', 'text', true),
    pj('state', 'State', 'pr.state'),
    pj('sublocation', 'Locality', 'pr.sublocation', 'text', true),
    pj('address', 'Address', 'pr.address'),
    pj('pincode', 'Pincode', 'pr.pincode'),
    pj('towers', 'Towers', 'pr.towers', 'number'),
    pj('floors', 'Floors', 'pr.total_floors', 'number'),
    pj('units', 'Total units', 'pr.total_units', 'number', true),
    pj('configurations', 'Unit configurations', '(SELECT COUNT(*) FROM project_units u WHERE u.project_id = pr.id)', 'number'),
    pj('area', 'Project area (sq ft)', 'pr.project_area_sqft', 'number'),
    pj('slug', 'Page slug', 'pr.slug'),
    pj('created', 'Added on', 'pr.created_at', 'datetime', true),
    pj('updated', 'Last updated', 'pr.updated_at', 'datetime'),
  ],
  filters: [
    { key: 'status', label: 'Status', sql: 'pr.status', options: 'distinct' },
    { key: 'type', label: 'Type', sql: 'pr.project_type', options: 'distinct' },
    { key: 'city', label: 'City', sql: 'pr.city', options: 'distinct' },
    { key: 'possession', label: 'Possession', sql: 'pr.possession_status', options: 'distinct' },
  ],
};

// ── Properties (website database) ─────────────────────────────────────────
const pp = f('Property');
const pd = f('Size and layout');
const po = f('Owner');
const pm = f('Price');
const PROPERTY_LOCATION = `(SELECT property_id, MIN(address) AS address, MIN(pincode) AS pincode, MIN(landmark) AS landmark FROM property_locations GROUP BY property_id)`;
const properties: ReportModule = {
  key: 'properties', label: 'Properties', description: 'Resale and rental properties on the website.',
  db: 'site', from: `properties p LEFT JOIN property_details d ON d.id = (SELECT MIN(x.id) FROM property_details x WHERE x.property_id = p.id) LEFT JOIN ${PROPERTY_LOCATION} pl ON pl.property_id = p.id`,
  date: 'p.created_at', dateLabel: 'Added', order: 'p.id DESC',
  fields: [
    pp('id', 'ID', 'p.id', 'number', true),
    pp('code', 'Property code', 'p.property_code', 'text', true),
    pp('title', 'Title', 'p.title', 'text', true),
    pp('type', 'Type', 'p.property_type', 'text', true),
    pp('listing', 'Listing type', 'p.listing_type', 'text', true),
    pp('status', 'Availability', 'p.status', 'text', true),
    pp('approval', 'Approval', 'p.approval_status', 'text', true),
    pp('verification', 'Verification', 'p.verification_status'),
    pp('city', 'City', 'p.city', 'text', true),
    pp('state', 'State', 'p.state'),
    pp('address', 'Address', 'pl.address'),
    pp('landmark', 'Landmark', 'pl.landmark'),
    pp('pincode', 'Pincode', 'pl.pincode'),
    pp('road', 'Road name', 'p.road_name'),
    pp('project', 'Project', 'p.project_name'),
    pp('builder', 'Builder', 'p.builder_name'),
    pp('condition', 'Condition', 'p.property_condition'),
    pp('ownership', 'Ownership', 'p.ownership_type'),
    pp('rera', 'RERA number', 'p.rera_number'),
    pp('available_from', 'Available from', 'p.available_from', 'date'),
    pp('source', 'Source', 'p.source'),
    pp('created', 'Added on', 'p.created_at', 'datetime', true),
    pp('updated', 'Last updated', 'p.updated_at', 'datetime'),
    pd('bedrooms', 'Bedrooms', 'd.bedrooms', 'number', true),
    pd('bathrooms', 'Bathrooms', 'd.bathrooms', 'number'),
    pd('area', 'Area', 'COALESCE(d.area_sqft, d.built_up_area, d.carpet_area, d.plot_area)', 'number', true),
    pd('area_unit', 'Area unit', 'd.area_unit'),
    pd('carpet', 'Carpet area', 'd.carpet_area', 'number'),
    pd('built_up', 'Built-up area', 'd.built_up_area', 'number'),
    pd('plot', 'Plot area', 'd.plot_area', 'number'),
    pd('floor', 'Floor', 'd.floor_number'),
    pd('total_floors', 'Total floors', 'd.total_floors', 'number'),
    pd('facing', 'Facing', 'd.property_facing'),
    pd('furnished', 'Furnished', 'd.furnished', 'bool'),
    pd('parking', 'Parking', 'd.parking', 'number'),
    pd('age', 'Property age', 'd.property_age'),
    pd('possession', 'Possession', 'd.possession_status'),
    pd('seats', 'Seats', 'd.min_seats', 'number'),
    pm('price', 'Price', 'p.price', 'money', true),
    pm('rent', 'Monthly rent', 'p.monthly_rent', 'money', true),
    pm('per_sqft', 'Price per sq ft', 'p.price_per_sqft', 'money'),
    pm('expected', 'Expected sale price', 'p.expected_sale_price', 'money'),
    pm('negotiable', 'Negotiable', 'p.negotiable', 'bool'),
    pm('maintenance', 'Maintenance', 'p.maintenance_charges'),
    pm('deposit', 'Security deposit', 'p.security_deposit'),
    pm('booking', 'Booking amount', 'p.booking_amount'),
    pm('brokerage_type', 'Brokerage type', 'p.brokerage_type'),
    pm('brokerage', 'Brokerage', 'p.brokerage_value'),
    po('owner', 'Owner', 'p.owner_name', 'text', true),
    po('owner_phone', 'Owner phone', 'p.owner_phone', 'text', true),
    po('owner_email', 'Owner email', 'p.owner_email'),
    po('alt_name', 'Alternate contact', 'p.alternate_name'),
    po('alt_phone', 'Alternate phone', 'p.alternate_phone'),
    po('agent', 'Agent', 'p.agent_name'),
    po('agency', 'Agency', 'p.agency_name'),
  ],
  filters: [
    { key: 'type', label: 'Type', sql: 'p.property_type', options: 'distinct' },
    { key: 'listing', label: 'Listing type', sql: 'p.listing_type', options: 'distinct' },
    { key: 'status', label: 'Availability', sql: 'p.status', options: 'distinct' },
    { key: 'approval', label: 'Approval', sql: 'p.approval_status', options: 'distinct' },
    { key: 'city', label: 'City', sql: 'p.city', options: 'distinct' },
  ],
};

// ── Blog (website database) ───────────────────────────────────────────────
const bl = f('Post');
const blog: ReportModule = {
  key: 'blog', label: 'Blog', description: 'Articles on the website and their SEO details.',
  db: 'site', from: 'blog_posts bp', date: 'bp.created_at', dateLabel: 'Created', order: 'bp.id DESC',
  fields: [
    bl('id', 'ID', 'bp.id', 'number', true),
    bl('title', 'Title', 'bp.title', 'text', true),
    bl('slug', 'Slug', 'bp.slug', 'text', true),
    bl('category', 'Category', 'bp.category', 'text', true),
    bl('author', 'Author', 'bp.author_name', 'text', true),
    bl('status', 'Status', 'bp.status', 'text', true),
    bl('published', 'Published on', 'bp.published_at', 'datetime', true),
    bl('excerpt', 'Excerpt', 'bp.excerpt'),
    bl('meta_title', 'Meta title', 'bp.meta_title'),
    bl('meta_description', 'Meta description', 'bp.meta_description'),
    bl('keywords', 'Keywords', 'bp.meta_keywords'),
    bl('noindex', 'Hidden from search', 'bp.noindex', 'bool'),
    bl('words', 'Word count', `(LENGTH(bp.content) - LENGTH(REPLACE(bp.content, ' ', '')) + 1)`, 'number'),
    bl('created', 'Created', 'bp.created_at', 'datetime'),
    bl('updated', 'Last updated', 'bp.updated_at', 'datetime'),
  ],
  filters: [
    { key: 'status', label: 'Status', sql: 'bp.status', options: 'distinct' },
    { key: 'category', label: 'Category', sql: 'bp.category', options: 'distinct' },
    { key: 'author', label: 'Author', sql: 'bp.author_name', options: 'distinct' },
  ],
};

export const REPORT_MODULES: ReportModule[] = [leads, inbound, agents, assets, hr, projects, properties, blog];
export const reportModule = (key: string) => REPORT_MODULES.find(m => m.key === key);
