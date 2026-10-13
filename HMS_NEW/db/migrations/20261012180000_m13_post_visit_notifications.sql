-- migrate:up
ALTER TABLE comms.followup_rule DROP CONSTRAINT followup_rule_kind_check;
ALTER TABLE comms.followup_rule ADD CONSTRAINT followup_rule_kind_check
 CHECK(kind IN ('day_before','same_day','follow_up','feedback','no_show','reschedule','cancellation'));
ALTER TABLE comms.followup_rule ADD CONSTRAINT followup_rule_immediate_delay_check
 CHECK(kind NOT IN ('reschedule','cancellation') OR delay_hours=0);
ALTER TABLE comms.reminder_job DROP CONSTRAINT reminder_job_kind_check;
ALTER TABLE comms.reminder_job ADD CONSTRAINT reminder_job_kind_check
 CHECK(kind IN ('confirmation','reschedule','cancellation','day_before','same_day','follow_up','feedback','no_show','waitlist_offer'));
-- migrate:down
DO $$ BEGIN IF EXISTS(SELECT 1 FROM comms.reminder_job WHERE kind IN ('feedback','no_show')) OR EXISTS(SELECT 1 FROM comms.followup_rule WHERE kind IN ('feedback','no_show','reschedule','cancellation')) THEN RAISE EXCEPTION 'Post-visit records exist; use a forward migration rather than removing workflow history'; END IF; END $$;
ALTER TABLE comms.followup_rule DROP CONSTRAINT followup_rule_kind_check,
 DROP CONSTRAINT followup_rule_immediate_delay_check;
ALTER TABLE comms.followup_rule ADD CONSTRAINT followup_rule_kind_check
 CHECK(kind IN ('day_before','same_day','follow_up'));
ALTER TABLE comms.reminder_job DROP CONSTRAINT reminder_job_kind_check;
ALTER TABLE comms.reminder_job ADD CONSTRAINT reminder_job_kind_check
 CHECK(kind IN ('confirmation','reschedule','cancellation','day_before','same_day','follow_up','waitlist_offer'));
