-- migrate:up
-- Patient-facing clinic information, edited from the Hospital catalogue: a directions link and arrival
-- instructions (where to park, which entrance, what to bring). Channels (website, WhatsApp, voice) read them.
ALTER TABLE platform.facility
  ADD COLUMN directions_url       text CHECK (directions_url ~ '^https://[^[:space:]]{3,}$' AND char_length(directions_url) <= 500),
  ADD COLUMN arrival_instructions text CHECK (char_length(arrival_instructions) <= 1000);

-- migrate:down
ALTER TABLE platform.facility DROP COLUMN arrival_instructions, DROP COLUMN directions_url;
