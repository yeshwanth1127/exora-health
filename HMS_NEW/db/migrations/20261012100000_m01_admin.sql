-- migrate:up
-- Workspace administration (G02, G16, G18): invites expire, and sign-in can name the hospitals an
-- identity belongs to before a tenant is chosen.

-- An invite links only until it expires (14 days by default, renewed by re-sending).
ALTER TABLE platform.user_account ADD COLUMN invite_expires_at timestamptz;
UPDATE platform.user_account SET invite_expires_at = now() + interval '14 days' WHERE status = 'invited' AND identity_subject IS NULL;

CREATE OR REPLACE FUNCTION platform.link_staff_invites(p_issuer text, p_subject text, p_email citext) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
DECLARE
  linked integer;
BEGIN
  WITH done AS (
    UPDATE platform.user_account ua
       SET identity_issuer = p_issuer, identity_subject = p_subject, status = 'active', invite_expires_at = NULL
      FROM platform.staff s, platform.tenant t
     -- citext's case-insensitive '=' lives in public, outside this search_path, so compare lower-cased text.
     WHERE ua.identity_subject IS NULL AND ua.status = 'invited' AND lower(ua.email::text) = lower(p_email::text)
       AND (ua.invite_expires_at IS NULL OR ua.invite_expires_at > now())
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

-- The hospitals (id and name) an identity can sign in to, for the account chooser. Runs before a tenant
-- is set, so it is SECURITY DEFINER and returns only names of tenants this identity already belongs to.
CREATE FUNCTION platform.tenants_for_identity(p_issuer text, p_subject text)
RETURNS TABLE (tenant_id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
  SELECT DISTINCT t.id, t.name
  FROM platform.user_account ua
  JOIN platform.tenant t ON t.id = ua.tenant_id AND t.status IN ('trial', 'active')
  WHERE ua.identity_issuer = p_issuer AND ua.identity_subject = p_subject AND ua.status = 'active'
  ORDER BY t.name;
$$;
REVOKE EXECUTE ON FUNCTION platform.tenants_for_identity(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform.tenants_for_identity(text, text) TO hms_app;

-- migrate:down
DROP FUNCTION platform.tenants_for_identity(text, text);
CREATE OR REPLACE FUNCTION platform.link_staff_invites(p_issuer text, p_subject text, p_email citext) RETURNS integer
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

ALTER TABLE platform.user_account DROP COLUMN invite_expires_at;
