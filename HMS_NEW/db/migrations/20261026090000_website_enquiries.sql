-- migrate:up
CREATE TABLE booking.website_enquiry (
 id uuid PRIMARY KEY DEFAULT uuidv7(),
 tenant_id uuid NOT NULL REFERENCES platform.tenant(id),
 facility_id uuid NOT NULL,
 request_key uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 email text NOT NULL CHECK(length(email)<=254),
 topic text NOT NULL CHECK(length(topic) BETWEEN 1 AND 100),
 message text NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),
 context text CHECK(length(context)<=200),
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid,
 version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,facility_id,request_key),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES platform.facility(tenant_id,id)
);
SELECT platform.setup_tenant_table('booking.website_enquiry','mod_booking');
-- migrate:down
DROP TABLE booking.website_enquiry;
