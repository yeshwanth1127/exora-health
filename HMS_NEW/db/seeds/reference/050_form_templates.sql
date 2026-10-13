-- System note templates (tenant_id NULL), available to every tenant.
INSERT INTO clinical.form_template (tenant_id, code, template_version, name, note_type, status, schema) VALUES
  (NULL, 'opd_consultation', 1, 'OPD consultation (SOAP)', 'consultation', 'published', '{
     "type": "object",
     "properties": {
       "subjective": {"type": "string", "title": "History / complaints"},
       "objective":  {"type": "string", "title": "Examination findings"},
       "assessment": {"type": "string", "title": "Assessment"},
       "plan":       {"type": "string", "title": "Plan / advice"}
     },
     "additionalProperties": false
   }'),
  (NULL, 'nursing_note', 1, 'Nursing note', 'nursing', 'published', '{
     "type": "object",
     "properties": {"note": {"type": "string"}},
     "additionalProperties": false
   }')
ON CONFLICT (tenant_id, code, template_version) DO NOTHING;

-- Version 2 adds `propertyOrder`: jsonb doesn't keep key order, so forms render fields in this order.
-- Same fields as version 1, which is retired here; notes written against it stay valid.
INSERT INTO clinical.form_template (tenant_id, code, template_version, name, note_type, status, schema) VALUES
  (NULL, 'opd_consultation', 2, 'OPD consultation (SOAP)', 'consultation', 'published', '{
     "type": "object",
     "properties": {
       "subjective": {"type": "string", "title": "History / complaints"},
       "objective":  {"type": "string", "title": "Examination findings"},
       "assessment": {"type": "string", "title": "Assessment"},
       "plan":       {"type": "string", "title": "Plan / advice"}
     },
     "propertyOrder": ["subjective", "objective", "assessment", "plan"],
     "additionalProperties": false
   }'),
  (NULL, 'nursing_note', 2, 'Nursing note', 'nursing', 'published', '{
     "type": "object",
     "properties": {"note": {"type": "string"}},
     "propertyOrder": ["note"],
     "additionalProperties": false
   }')
ON CONFLICT (tenant_id, code, template_version) DO NOTHING;
UPDATE clinical.form_template SET status = 'retired'
WHERE tenant_id IS NULL AND code IN ('opd_consultation', 'nursing_note') AND template_version = 1 AND status = 'published';
