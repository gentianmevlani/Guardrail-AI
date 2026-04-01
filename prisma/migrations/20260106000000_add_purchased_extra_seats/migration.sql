-- Add purchased_extra_seats column to organizations table
-- This tracks additional seats purchased beyond the tier's base allocation

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS purchased_extra_seats INTEGER NOT NULL DEFAULT 0;

-- Add constraint to ensure non-negative values
ALTER TABLE organizations ADD CONSTRAINT purchased_extra_seats_non_negative CHECK (purchased_extra_seats >= 0);

-- Add index for queries that filter by seat count
CREATE INDEX IF NOT EXISTS idx_organizations_purchased_extra_seats ON organizations(purchased_extra_seats) WHERE purchased_extra_seats > 0;

-- Update existing organizations to have 0 purchased extra seats (already default, but explicit)
UPDATE organizations SET purchased_extra_seats = 0 WHERE purchased_extra_seats IS NULL;
