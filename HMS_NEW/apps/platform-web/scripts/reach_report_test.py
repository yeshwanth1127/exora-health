import json
import socket
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import business_lookup
import reach_report as report
import website_fetch as web

PROFILE = {"id": "example123", "name": "Example Clinic", "category": "Medical clinic", "address": "Example neighbourhood", "phone": "080 0000 0000", "hours": ["Monday: 9am–6pm"], "businessStatus": "OPERATIONAL", "website": "https://example.invalid", "mapsUrl": "", "attributions": []}
GOOD_HTML = '<html><head><title>Example Clinic</title><meta name="description" content="Care in your neighbourhood"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Care close to home</h1><p>Our clinic offers consultations with a team of doctors and nurses. Visit our clinic to discuss your care needs, arrange your next visit and contact the reception team for help.</p><a href="tel:08000000000">Call</a><a href="/book">Book an appointment</a><a href="/contact">Contact</a></body></html>'


def page(html=GOOD_HTML, status=200, url="https://example.invalid/", headers=None):
    return web.Page(url, status, headers or {"content-type": "text/html"}, html.encode(), 100)


def sample_fetch(url, **kwargs):
    if url.endswith('/robots.txt'):
        return page('User-agent: *\nAllow: /', headers={"content-type": "text/plain"}, url=url)
    return page(url=url)


class ReachReportTests(unittest.TestCase):
    def test_complete_observations_score_100(self):
        website, checks = report.audit_website(PROFILE['website'], sample_fetch)
        result = report.summarise(PROFILE, website, report.google_checks(PROFILE) + checks)
        self.assertEqual(result['score'], 100)
        self.assertEqual(result['coverage'], 100)
        self.assertEqual(result['counts'], {'pass': 18, 'review': 0, 'unknown': 0})

    def test_missing_website_is_profile_only_not_a_website_zero(self):
        result = report.build_report({**PROFILE, 'website': ''})
        self.assertTrue(result['partial'])
        self.assertEqual(result['scoreLabel'], 'Google profile score')
        self.assertEqual(result['coverage'], 40)
        self.assertTrue(all(c['score'] is None for c in result['categories'][1:]))
        self.assertEqual(result['websiteIssue']['severity'], 'high')
        self.assertIn('No website link', result['websiteIssue']['title'])
        self.assertEqual(result['score'], 80)
        self.assertEqual(next(c for c in result['checks'] if c['id']=='google_website')['status'], 'review')

    def test_blocked_website_does_not_masquerade_as_failed_checks(self):
        def blocked(url, **kwargs): return sample_fetch(url, **kwargs) if url.endswith('/robots.txt') else page(status=403, url=url)
        site, checks = report.audit_website(PROFILE['website'], blocked)
        self.assertEqual(site['state'], 'blocked')
        self.assertTrue(all(c['status'] == 'unknown' for c in checks))
        result = report.summarise(PROFILE, site, report.google_checks(PROFILE) + checks)
        self.assertEqual(result['scoreLabel'], 'Google profile score')
        self.assertEqual(result['coverage'], 40)
        self.assertIsNone(result['websiteIssue'])  # Bot blocking is not proof of a broken customer website.

    def test_robots_disallow_skips_homepage(self):
        calls = []
        def disallowed(url, **kwargs):
            calls.append(url)
            return page('User-agent: *\nDisallow: /', url=url)
        site, checks = report.audit_website(PROFILE['website'], disallowed)
        self.assertEqual(len(calls), 1)
        self.assertEqual(site['state'], 'robots_blocked')
        self.assertTrue(all(c['status'] == 'unknown' for c in checks))

    def test_googlebot_specific_block_is_observed(self):
        def fetch(url, **kwargs):
            return page('User-agent: Googlebot\nDisallow: /\nUser-agent: *\nAllow: /', url=url) if url.endswith('/robots.txt') else page()
        _, checks = report.audit_website(PROFILE['website'], fetch)
        self.assertEqual(next(c for c in checks if c['id']=='indexing')['status'], 'review')

    def test_javascript_and_invalid_markup_do_not_invent_signals_or_crash(self):
        html = '<html><meta name="viewport"><title></title><script>"<h1>Fake</h1>"</script><a href="http://[invalid">Contact</a><h1></h1></html>'
        checks = {c['id']: c for c in report.assess_html(page(html), 'allowed')}
        self.assertEqual(checks['heading']['status'], 'review')
        self.assertEqual(checks['viewport']['status'], 'review')
        self.assertEqual(checks['content']['status'], 'unknown')

    def test_noindex_and_dead_links_are_detected(self):
        html = GOOD_HTML.replace('<head>', '<head><meta name="robots" content="noindex">').replace('href="/book"', 'href="#"').replace('href="/contact"', 'href="javascript:alert(1)"')
        checks = {c['id']: c for c in report.assess_html(page(html), 'allowed')}
        self.assertEqual(checks['indexing']['status'], 'review')
        self.assertEqual(checks['booking']['status'], 'review')
        self.assertEqual(checks['contact']['status'], 'review')

    def test_unknown_points_are_excluded_with_explicit_coverage(self):
        checks = [report.check('one','google','One',4,'pass','Seen'), report.check('two','google','Two',8,'unknown','Unavailable')]
        result = report.summarise(PROFILE, {'state':'unavailable'}, checks)
        self.assertEqual(result['score'], 100)
        self.assertEqual(result['coverage'], 4)
        self.assertTrue(result['partial'])

    def test_http_failure_only_marks_observed_failure(self):
        def fetch(url, **kwargs): return page(status=404, url=url)
        _, checks = report.audit_website(PROFILE['website'], fetch)
        self.assertEqual(sum(c['status']=='review' for c in checks), 1)
        self.assertEqual(next(c for c in checks if c['id']=='available')['status'], 'review')
        result = report.summarise(PROFILE, {'state':'unavailable'}, report.google_checks(PROFILE) + checks)
        self.assertEqual(result['websiteIssue']['severity'], 'high')
        self.assertIn('urgent review', result['websiteIssue']['title'])

    def test_network_failure_is_prominent_but_does_not_claim_universal_outage(self):
        checks = report.unknown_website('Connection timed out')
        result = report.summarise(PROFILE, {'state':'unavailable'}, report.google_checks(PROFILE) + checks)
        self.assertIn('does not prove', result['websiteIssue']['message'])
        self.assertTrue(all(c['status']=='unknown' for c in checks))

    def test_report_adapter_fetches_google_once_and_propagates_result(self):
        with patch.object(business_lookup, 'google_request', return_value={'id':'example123','displayName':{'text':'Example'}}) as google, patch.object(business_lookup, 'scan', return_value={'status':'unsupported'}), patch.object(business_lookup, 'build_report', return_value={'score':80}) as build:
            self.assertEqual(business_lookup.lookup('mode=report&id=example123'), {'report':{'score':80,'ranking':{'status':'unsupported'}}})
            self.assertEqual(google.call_count, 1)
            self.assertEqual(build.call_args.args[0]['name'], 'Example')

    def test_quota_error_does_not_run_or_fabricate_a_report(self):
        with patch.object(business_lookup, 'google_request', side_effect=business_lookup.LookupError('QUOTA_EXCEEDED','Quota reached',429)), patch.object(business_lookup, 'build_report') as build:
            with self.assertRaises(business_lookup.LookupError): business_lookup.lookup('mode=report&id=example123')
            build.assert_not_called()


class PublicFetchTests(unittest.TestCase):
    def test_private_loopback_metadata_and_special_addresses_rejected(self):
        for value in ['127.0.0.1','10.1.1.1','192.168.1.1','169.254.169.254','::1','::ffff:127.0.0.1','fc00::1','224.0.0.1','0.0.0.0','2002:7f00:1::']:
            self.assertFalse(web.public_address(value), value)
        self.assertTrue(web.public_address('8.8.8.8'))

    def test_unsafe_urls_never_resolve_or_connect(self):
        for url in ['file:///etc/passwd','http://localhost/','https://example.com:444/','https://u:p@example.com/','https://example.com/\nheader','http://service.internal/']:
            with patch.object(web.socket, 'getaddrinfo') as dns, self.assertRaises(web.WebsiteFetchError): web.public_target(url)
            dns.assert_not_called()

    def test_mixed_public_private_dns_is_rejected(self):
        answers = [(socket.AF_INET,socket.SOCK_STREAM,6,'',('8.8.8.8',443)),(socket.AF_INET,socket.SOCK_STREAM,6,'',('127.0.0.1',443))]
        with patch.object(web.socket,'getaddrinfo',return_value=answers), self.assertRaises(web.WebsiteFetchError): web.public_target('https://example.com/')

    def test_connection_uses_pinned_ip_without_second_hostname_resolution(self):
        with patch.object(web.socket,'create_connection') as connect:
            client = web.PinnedHTTP('example.com',80,'8.8.8.8',3)
            client.connect()
            connect.assert_called_once_with(('8.8.8.8',80),3)

    def test_redirect_to_private_network_is_revalidated(self):
        class Response:
            status = 302
            def getheaders(self): return [('Location','http://127.0.0.1/')]
        class Connection:
            def __init__(self,*args): pass
            def request(self,*args,**kwargs): pass
            def getresponse(self): return Response()
            def close(self): pass
        targets = [('http://example.com/','example.com',80,'8.8.8.8'), web.WebsiteFetchError('UNSAFE_TARGET','Blocked')]
        with patch.object(web,'public_target',side_effect=targets) as target, patch.object(web,'PinnedHTTP',Connection), self.assertRaises(web.WebsiteFetchError): web.fetch_public('http://example.com/')
        self.assertEqual(target.call_count,2)

    def test_https_connection_preserves_hostname_certificate_check(self):
        with patch.object(web.ssl, 'create_default_context') as context, patch.object(web.socket, 'create_connection') as connect:
            client = web.PinnedHTTPS('example.com',443,'8.8.8.8',3)
            client.connect()
            connect.assert_called_once_with(('8.8.8.8',443),3)
            context.return_value.wrap_socket.assert_called_once_with(connect.return_value,server_hostname='example.com')

    def test_redirect_loop_is_bounded(self):
        class Response:
            status=302
            def getheaders(self): return [('Location','/again')]
        class Connection:
            def __init__(self,*args): pass
            def request(self,*args,**kwargs): pass
            def getresponse(self): return Response()
            def close(self): pass
        with patch.object(web,'public_target',return_value=('http://example.com/','example.com',80,'8.8.8.8')) as target, patch.object(web,'PinnedHTTP',Connection), self.assertRaises(web.WebsiteFetchError) as error:
            web.fetch_public('http://example.com/')
        self.assertEqual(error.exception.code,'TOO_MANY_REDIRECTS')
        self.assertEqual(target.call_count,4)

    def test_https_downgrade_is_blocked(self):
        class Response:
            status=302
            def getheaders(self): return [('Location','http://example.com/')]
        class Connection:
            def __init__(self,*args): pass
            def request(self,*args,**kwargs): pass
            def getresponse(self): return Response()
            def close(self): pass
        with patch.object(web,'public_target',return_value=('https://example.com/','example.com',443,'8.8.8.8')), patch.object(web,'PinnedHTTPS',Connection), self.assertRaises(web.WebsiteFetchError) as error:
            web.fetch_public('https://example.com/')
        self.assertEqual(error.exception.code,'INSECURE_REDIRECT')

    def test_oversized_response_is_rejected_before_reading(self):
        class Response:
            status=200
            def getheaders(self): return [('Content-Length','9999999')]
        class Connection:
            def __init__(self,*args): pass
            def request(self,*args,**kwargs): pass
            def getresponse(self): return Response()
            def close(self): pass
        with patch.object(web,'public_target',return_value=('http://example.com/','example.com',80,'8.8.8.8')), patch.object(web,'PinnedHTTP',Connection), self.assertRaises(web.WebsiteFetchError) as error: web.fetch_public('http://example.com/')
        self.assertEqual(error.exception.code,'PAGE_TOO_LARGE')




class OperationalAuditTests(unittest.TestCase):
    def test_broken_booking_destination_is_flagged_even_when_homepage_link_exists(self):
        def fetch(url,**kwargs):
            return page(status=404,url=url) if url.endswith('/book') else sample_fetch(url,**kwargs)
        _,checks=report.audit_website(PROFILE['website'],fetch)
        booking=next(c for c in checks if c['id']=='booking')
        self.assertEqual(booking['status'],'review')
        self.assertIn('404',booking['evidence'])
        self.assertTrue(booking['fix'])
        self.assertEqual(next(c for c in checks if c['id']=='contact')['status'],'pass')
    def test_invalid_phone_and_whatsapp_links_do_not_pass(self):
        html=GOOD_HTML.replace('tel:08000000000','tel:invalid').replace('</body>','<a href="https://wa.me/">WhatsApp</a></body>')
        checks=report.assess_html(page(html),'allowed')
        self.assertEqual(next(c for c in checks if c['id']=='phone_link')['status'],'review')
    def test_later_index_tag_does_not_erase_an_earlier_noindex(self):
        html=GOOD_HTML.replace('<head>','<head><meta name="robots" content="noindex"><meta name="robots" content="index">')
        self.assertEqual(next(c for c in report.assess_html(page(html),'allowed') if c['id']=='indexing')['status'],'review')
    def test_redirect_hosts_are_checked_for_robots_before_homepage(self):
        fetched=[]
        def fetch(url,**kwargs):
            fetched.append(url)
            if url=='https://example.invalid':
                kwargs['redirect_check']('https://redirect.example/')
                self.fail('Blocked redirect must not be followed')
            if url=='https://redirect.example/robots.txt':
                return page('User-agent: *\nDisallow: /',url=url)
            return sample_fetch(url,**kwargs)
        website,checks=report.audit_website(PROFILE['website'],fetch)
        self.assertEqual(website['state'],'robots_blocked')
        self.assertNotIn('https://redirect.example/',fetched)
    def test_robot_failure_does_not_turn_into_an_indexability_pass(self):
        def fetch(url,**kwargs):return page(status=503,url=url)
        website,checks=report.audit_website(PROFILE['website'],fetch)
        self.assertTrue(all(c['status']=='unknown' for c in checks))

class CompressedFetchTests(unittest.TestCase):
    def test_compression_bomb_cannot_bypass_decoded_size_limit(self):
        import gzip
        import io
        class Response:
            status=200
            def __init__(self):self.body=io.BytesIO(gzip.compress(b'a'*2000))
            def getheaders(self):return [('Content-Encoding','gzip')]
            def read1(self,size):return self.body.read(size)
        class Connection:
            sock=None
            def __init__(self,*args):pass
            def request(self,*args,**kwargs):pass
            def getresponse(self):return Response()
            def close(self):pass
        with patch.object(web,'public_target',return_value=('https://example.com/','example.com',443,'8.8.8.8')), patch.object(web,'PinnedHTTPS',Connection), self.assertRaises(web.WebsiteFetchError) as error:
            web.fetch_public('https://example.com/',max_bytes=1024)
        self.assertEqual(error.exception.code,'PAGE_TOO_LARGE')


if __name__=="__main__": unittest.main()
