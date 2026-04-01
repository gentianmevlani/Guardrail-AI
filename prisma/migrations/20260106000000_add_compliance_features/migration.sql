-- Migration: Add compliance features (GDPR, consent, legal acceptance)
-- Created: 2026-01-06

-- Add age verification fields to users table
ALTER TABLE users 
ADD COLUMN is_age_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN age_confirmed_at TIMESTAMP NULL;

-- Create consent_preferences table
CREATE TABLE consent_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    necessary BOOLEAN DEFAULT TRUE,
    analytics BOOLEAN DEFAULT FALSE,
    marketing BOOLEAN DEFAULT FALSE,
    functional BOOLEAN DEFAULT FALSE,
    source TEXT DEFAULT 'web',
    ip_hash TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create legal_acceptances table
CREATE TABLE legal_acceptances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    doc_type TEXT NOT NULL, -- 'terms' | 'privacy'
    version TEXT NOT NULL,
    accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_hash TEXT NULL,
    user_agent TEXT NULL,
    locale TEXT NULL,
    
    UNIQUE(user_id, doc_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create gdpr_jobs table
CREATE TABLE gdpr_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'EXPORT' | 'DELETE'
    status TEXT DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    artifact_path TEXT NULL,
    signed_url TEXT NULL,
    failure_reason TEXT NULL,
    metadata JSON NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create gdpr_audit_log table
CREATE TABLE gdpr_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'data_exported' | 'account_deleted' | 'data_anonymized' | 'consent_updated'
    actor_user_id TEXT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSON NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_consent_preferences_user_id ON consent_preferences(user_id);
CREATE INDEX idx_consent_preferences_updated_at ON consent_preferences(updated_at);

CREATE INDEX idx_legal_acceptances_user_id ON legal_acceptances(user_id);
CREATE INDEX idx_legal_acceptances_doc_type ON legal_acceptances(doc_type);
CREATE INDEX idx_legal_acceptances_accepted_at ON legal_acceptances(accepted_at);

CREATE INDEX idx_gdpr_jobs_user_id ON gdpr_jobs(user_id);
CREATE INDEX idx_gdpr_jobs_type ON gdpr_jobs(type);
CREATE INDEX idx_gdpr_jobs_status ON gdpr_jobs(status);
CREATE INDEX idx_gdpr_jobs_created_at ON gdpr_jobs(created_at);

CREATE INDEX idx_gdpr_audit_log_user_id ON gdpr_audit_log(user_id);
CREATE INDEX idx_gdpr_audit_log_timestamp ON gdpr_audit_log(timestamp);
CREATE INDEX idx_gdpr_audit_log_action ON gdpr_audit_log(action);
