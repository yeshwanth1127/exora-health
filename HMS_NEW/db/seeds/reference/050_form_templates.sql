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
