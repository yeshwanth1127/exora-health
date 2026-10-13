-- First communications slice. Content/contact reads contain personal information.
INSERT INTO platform.permission(code,module_code,description,is_sensitive) VALUES
 ('comms.read','comms','Read clinic communications and contact consent',true),
 ('comms.reply','comms','Record evidenced care consent and withdraw messaging consent',true),
 ('comms.manage','comms','Manage clinic communications and marketing consent',true)
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description,is_sensitive=EXCLUDED.is_sensitive;
WITH bundle(role_code,permission_code) AS (
 SELECT 'tenant_admin',code FROM platform.permission WHERE code LIKE 'comms.%'
 UNION ALL SELECT 'front_desk',unnest(ARRAY['comms.read','comms.reply'])
)
INSERT INTO platform.role_permission(role_id,permission_id)
SELECT r.id,p.id FROM bundle b JOIN platform.role r ON r.tenant_id IS NULL AND r.code=b.role_code
JOIN platform.permission p ON p.code=b.permission_code ON CONFLICT DO NOTHING;
