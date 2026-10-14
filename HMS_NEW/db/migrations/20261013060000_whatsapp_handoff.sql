-- migrate:up
ALTER TABLE comms.conversation ADD COLUMN automation_state text NOT NULL DEFAULT 'automation'
 CHECK (automation_state IN ('automation','handoff_requested','human'));
-- Historical threads were manually operated. Do not enable automation on deployment.
UPDATE comms.conversation SET automation_state=CASE WHEN assigned_staff_id IS NOT NULL THEN 'human' ELSE 'handoff_requested' END;
ALTER TABLE comms.conversation ADD CONSTRAINT conversation_human_assignee
 CHECK ((automation_state='human')=(assigned_staff_id IS NOT NULL));
-- migrate:down
ALTER TABLE comms.conversation DROP CONSTRAINT conversation_human_assignee, DROP COLUMN automation_state;
