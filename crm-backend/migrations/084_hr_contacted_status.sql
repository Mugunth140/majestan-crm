-- HR candidates get a "Contacted" status between New Application and
-- Resume Shortlisted. Existing values are unchanged.
ALTER TABLE hr_candidates
  MODIFY COLUMN status ENUM(
    'New Application', 'Contacted', 'Resume Shortlisted', 'Interview Scheduled',
    'Interview Completed', 'Selected', 'Offer Sent', 'Joined', 'Rejected', 'Hold'
  ) NOT NULL DEFAULT 'New Application';
