INSERT INTO platform.permission(code,module_code,description,is_sensitive) VALUES
 ('campaigns.manage','comms','Prepare local outreach campaigns',true),('campaigns.approve','comms','Approve outreach audience and budget',true),
 ('voice.read','comms','Read staff call history and consented transcripts',true),('voice.recordings.read','comms','Review voice recordings and access history',true),
 ('voice.manage','comms','Request the clinic voice agent and changes to it',true),
 ('growth.read','comms','Read clinic booking links and aggregate growth metrics',false),('growth.manage','comms','Manage clinic booking links',false)
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description,is_sensitive=EXCLUDED.is_sensitive;
WITH bundle(role_code,permission_code) AS (
 SELECT 'tenant_admin',code FROM platform.permission WHERE module_code='comms'
 UNION ALL SELECT 'front_desk',unnest(ARRAY['voice.read','growth.read','campaigns.manage'])
)
INSERT INTO platform.role_permission(role_id,permission_id)
SELECT r.id,p.id FROM bundle b JOIN platform.role r ON r.tenant_id IS NULL AND r.code=b.role_code
JOIN platform.permission p ON p.code=b.permission_code ON CONFLICT DO NOTHING;
