-- migrate:up
-- A clinic setup request is not an Apple/provider connection or activation.
ALTER TABLE comms.channel_onboarding
  DROP CONSTRAINT channel_onboarding_channel_check;
ALTER TABLE comms.channel_onboarding
  ADD CONSTRAINT channel_onboarding_channel_check
  CHECK (channel IN ('voice', 'whatsapp', 'apple_messages'));

-- migrate:down
-- Intentionally refuse rollback while Apple requests exist rather than delete them.
ALTER TABLE comms.channel_onboarding
  DROP CONSTRAINT channel_onboarding_channel_check;
ALTER TABLE comms.channel_onboarding
  ADD CONSTRAINT channel_onboarding_channel_check
  CHECK (channel IN ('voice', 'whatsapp'));
