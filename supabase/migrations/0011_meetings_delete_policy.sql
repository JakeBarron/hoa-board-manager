-- Restrict DELETE on meetings to officer and president roles,
-- and only for pending meetings. Previously no DELETE policy existed,
-- so any authenticated user could delete any meeting row directly.
CREATE POLICY "officers and president can delete pending meetings"
ON meetings FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM positions
    WHERE email = auth.email()
    AND role IN ('officer', 'president')
  )
  AND status = 'pending'
);
