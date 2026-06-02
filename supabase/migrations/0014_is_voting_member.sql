-- Add is_voting_member flag to positions.
-- Board officers (president, officer, member roles) are voting members;
-- committee chairs are not.

ALTER TABLE positions
  ADD COLUMN is_voting_member boolean NOT NULL DEFAULT false;

UPDATE positions
  SET is_voting_member = true
  WHERE role IN ('president', 'officer', 'member');
