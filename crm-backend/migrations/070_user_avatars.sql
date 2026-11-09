-- Profile photos for CRM users: a public CDN URL in the shared R2 bucket.
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER qualification;
