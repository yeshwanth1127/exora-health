-- migrate:up
-- Coexistence sync callbacks may contain a WABA without phone metadata. Resolve only phones from
-- an enabled, subscribed Business app connection for that exact WABA; never return credentials.
CREATE FUNCTION comms.managed_phones_for_waba(waba text) RETURNS TABLE(phone_number_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,comms AS $$
 SELECT external_id FROM comms.managed_connection WHERE provider='whatsapp' AND enabled
 AND metadata->>'subscribed'='true' AND metadata->>'path'='coexistence'
 AND metadata->>'businessAccountId'=waba ORDER BY external_id LIMIT 100
$$;
REVOKE ALL ON FUNCTION comms.managed_phones_for_waba(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION comms.managed_phones_for_waba(text) TO hms_app;

-- migrate:down
DROP FUNCTION comms.managed_phones_for_waba(text);
