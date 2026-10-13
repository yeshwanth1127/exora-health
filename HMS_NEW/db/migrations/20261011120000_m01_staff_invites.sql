-- migrate:up
-- Staff invites (G16). An administrator creates a login for a work email; it stays 'invited', with no
-- identity, until that person first signs in with the same email verified by the identity provider.
ALTER TABLE platform.user_account
  ALTER COLUMN identity_issuer DROP NOT NULL,
  ALTER COLUMN identity_subject DROP NOT NULL,
  ADD CONSTRAINT user_account_identity_pair CHECK ((identity_issuer IS NULL) = (identity_subject IS NULL)),
  ADD CONSTRAINT user_account_identity_or_invite CHECK (identity_subject IS NOT NULL OR (status = 'invited' AND email IS NOT NULL));
-- One staff login per work email per tenant, so an email can only ever link to one person.
CREATE UNIQUE INDEX user_account_staff_email ON platform.user_account (tenant_id, email) WHERE staff_id IS NOT NULL AND email IS NOT NULL;
CREATE INDEX user_account_open_invite ON platform.user_account (lower(email::text)) WHERE identity_subject IS NULL;

-- Runs before a tenant is chosen (like accounts_for_identity), so it is SECURITY DEFINER and narrowly
-- scoped: it links only open invites for this exact (verified) email, for active staff in live tenants
-- where the identity has no login yet, and audits each link. The caller must pass a verified email.
CREATE FUNCTION platform.link_staff_invites(p_issuer text, p_subject text, p_email citext) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
DECLARE
  linked integer;
BEGIN
  WITH done AS (
    UPDATE platform.user_account ua
       SET identity_issuer = p_issuer, identity_subject = p_subject, status = 'active'
      FROM platform.staff s, platform.tenant t
     -- citext's case-insensitive '=' lives in public, outside this search_path, so compare lower-cased text.
     WHERE ua.identity_subject IS NULL AND ua.status = 'invited' AND lower(ua.email::text) = lower(p_email::text)
       AND s.tenant_id = ua.tenant_id AND s.id = ua.staff_id AND s.status = 'active'
       AND t.id = ua.tenant_id AND t.status IN ('trial', 'active')
       AND NOT EXISTS (SELECT 1 FROM platform.user_account x
                        WHERE x.tenant_id = ua.tenant_id AND x.identity_issuer = p_issuer AND x.identity_subject = p_subject)
    RETURNING ua.tenant_id, ua.id, ua.staff_id
  ), audited AS (
    INSERT INTO platform.audit_event (tenant_id, actor_staff_id, actor_user_id, action, subject_type, subject_id, diff)
    SELECT tenant_id, staff_id, id, 'update', 'platform.user_account', id, jsonb_build_object('linked', 'verified_email')
    FROM done
    RETURNING 1
  )
  SELECT count(*) INTO linked FROM audited;
  RETURN linked;
END $$;
REVOKE EXECUTE ON FUNCTION platform.link_staff_invites(text, text, citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.link_staff_invites(text, text, citext) TO hms_app;

-- migrate:down
DROP FUNCTION platform.link_staff_invites(text, text, citext);
DROP INDEX platform.user_account_open_invite;
DROP INDEX platform.user_account_staff_email;
ALTER TABLE platform.user_account
  DROP CONSTRAINT user_account_identity_or_invite,
  DROP CONSTRAINT user_account_identity_pair,
  ALTER COLUMN identity_subject SET NOT NULL,
  ALTER COLUMN identity_issuer SET NOT NULL;
