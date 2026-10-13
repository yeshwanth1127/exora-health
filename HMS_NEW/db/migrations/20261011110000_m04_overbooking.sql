-- migrate:up
-- Overbooking (per clinic, opt-in): an extra appointment into a taken slot of a published session.
-- 'overbooked' sits outside the exclusion predicate, so held/booked slots still can't double-book.
-- The clinic switch is platform.config_setting key 'booking.overbooking'; the per-session cap (3) is
-- enforced by the booking command under the resource row lock.
ALTER TABLE booking.reservation DROP CONSTRAINT reservation_status_check;
ALTER TABLE booking.reservation
  ADD CONSTRAINT reservation_status_check CHECK (status IN ('held', 'booked', 'overbooked', 'released', 'expired')),
  ADD COLUMN overbook_reason text CHECK (char_length(overbook_reason) BETWEEN 3 AND 500),
  ADD CONSTRAINT reservation_overbook_owned CHECK (status <> 'overbooked' OR (owner_id IS NOT NULL AND overbook_reason IS NOT NULL));
CREATE INDEX reservation_overbooked ON booking.reservation (resource_id, period) WHERE status = 'overbooked';

-- migrate:down
-- Dev only: fails while overbooked rows exist.
DROP INDEX booking.reservation_overbooked;
ALTER TABLE booking.reservation DROP CONSTRAINT reservation_overbook_owned, DROP COLUMN overbook_reason, DROP CONSTRAINT reservation_status_check;
ALTER TABLE booking.reservation ADD CONSTRAINT reservation_status_check CHECK (status IN ('held', 'booked', 'released', 'expired'));
