import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import audit_cache
import reach_report


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.environment=patch.dict(os.environ, {'CAPTURE_AUDIT_CACHE_DB':str(Path(self.folder.name)/'cache.sqlite3')})
        self.environment.start()
    def tearDown(self):
        self.environment.stop()
        self.folder.cleanup()
    def test_shared_website_result_is_reused_until_its_weekly_expiry(self):
        payload={'website':{'checkedAt':'2026-10-24T10:00:00+00:00'},'checks':[]}
        audit_cache.publish('website_audit','key',payload,now=1000)
        self.assertEqual(audit_cache.read('website_audit','key',now=1001),payload)
        self.assertIsNone(audit_cache.read('website_audit','key',now=1000+7*86400))
    def test_places_content_cannot_be_stored_even_by_calling_store_directly(self):
        for source in ['google_places','google_maps','dataforseo','unknown']:
            with self.assertRaises(ValueError): audit_cache.publish(source,'key',{'results':[]})
            with self.assertRaises(ValueError): audit_cache.read(source,'key')
    def test_cross_worker_refresh_lease_expires_and_can_be_released(self):
        self.assertTrue(audit_cache.claim('website_audit','key',now=100))
        self.assertFalse(audit_cache.claim('website_audit','key',now=101))
        self.assertTrue(audit_cache.claim('website_audit','key',now=191))
        audit_cache.release('website_audit','key')
        self.assertTrue(audit_cache.claim('website_audit','key',now=192))
    def test_rubric_or_website_change_has_a_different_cache_key(self):
        keys=[audit_cache.cache_key({'url':u,'rubric':v}) for u,v in [('https://a.example','v1'),('https://a.example','v2'),('https://b.example','v1')]]
        self.assertEqual(len(set(keys)),3)
    def test_repeated_report_calls_reuse_only_independent_website_findings(self):
        with patch.object(reach_report,'audit_website',return_value=({'state':'checked','url':'https://example.test','message':'Checked'},[{'id':'title','status':'pass'}])) as fetch:
            first,checks=reach_report.cached_website('https://example.test')
            second,checks=reach_report.cached_website('https://example.test')
            self.assertEqual(fetch.call_count,1)
            self.assertEqual(first['cacheStatus'],'miss')
            self.assertEqual(second['cacheStatus'],'hit')
            self.assertEqual(first['checkedAt'],second['checkedAt'])

if __name__=='__main__':unittest.main()
