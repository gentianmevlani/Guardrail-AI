-- Add scans and findings tables
CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  repository_id TEXT,
  project_path TEXT,
  branch TEXT DEFAULT 'main',
  commit_sha TEXT,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  verdict TEXT,
  score INTEGER,
  files_scanned INTEGER DEFAULT 0,
  lines_scanned INTEGER DEFAULT 0,
  issues_found INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  info_count INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_scans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_scans_repository FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  file TEXT NOT NULL,
  line INTEGER NOT NULL,
  column INTEGER,
  end_line INTEGER,
  end_column INTEGER,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  code_snippet TEXT,
  suggestion TEXT,
  confidence REAL NOT NULL,
  ai_explanation TEXT,
  ai_generated BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open',
  rule_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_findings_scan FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

-- Add organizations and team seats tables
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'free',
  max_seats INTEGER DEFAULT 1,
  purchased_extra_seats INTEGER DEFAULT 0,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  invited_by TEXT,
  invited_at TIMESTAMP,
  joined_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_org_members_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_org_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_seats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT,
  subscription_id TEXT,
  tier TEXT NOT NULL,
  seat_type TEXT DEFAULT 'base',
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_team_seats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_seats_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_seats_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

-- Add reports table
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  content TEXT NOT NULL,
  filename TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_reports_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scans_user_created_at ON scans(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scans_repository_id ON scans(repository_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);

CREATE INDEX IF NOT EXISTS idx_findings_scan_severity ON findings(scan_id, severity);
CREATE INDEX IF NOT EXISTS idx_findings_scan_status ON findings(scan_id, status);
CREATE INDEX IF NOT EXISTS idx_findings_file ON findings(file);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_team_seats_user_id ON team_seats(user_id);
CREATE INDEX IF NOT EXISTS idx_team_seats_org_id ON team_seats(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_seats_subscription_id ON team_seats(subscription_id);

CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);

-- Add purchased_extra_seats column to organizations table (if not exists)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS purchased_extra_seats INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT IF NOT EXISTS purchased_extra_seats_non_negative CHECK (purchased_extra_seats >= 0);

-- Update existing organizations to have 0 purchased extra seats
UPDATE organizations SET purchased_extra_seats = 0 WHERE purchased_extra_seats IS NULL;
