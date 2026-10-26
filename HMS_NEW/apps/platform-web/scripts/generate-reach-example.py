"""Generate explicitly fictional UI examples through the real scoring functions; no network calls."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reach_report import assess_html, google_checks, summarise, unknown_website
from website_fetch import Page
root = Path(__file__).resolve().parents[1]
profile = {"id":"example-clinic", "name":"Example Clinic", "category":"Medical clinic", "address":"A fictional clinic in an example neighbourhood", "phone":"080 0000 0000", "hours":[], "businessStatus":"OPERATIONAL", "website":"https://example.invalid/", "mapsUrl":"", "rating":None, "reviewCount":None, "attributions":[]}
page = Page(profile['website'], 200, {'content-type':'text/html'}, (root/'docs/business-visibility-check/fixtures/example-homepage.html').read_bytes(), 100)
website = {'state':'checked','url':profile['website'],'finalUrl':profile['website'],'message':'Fictional HTML fixture, not a live website.'}
complete = summarise(profile, website, google_checks(profile) + assess_html(page, 'allowed'), example=True)
blocked = {'state':'blocked','url':profile['website'],'finalUrl':profile['website'],'message':'Example: the website blocked automated inspection. Its checks are unassessed and excluded from the score.'}
partial = summarise(profile, blocked, google_checks(profile) + unknown_website(blocked['message']), example=True)
missing_profile = {**profile, 'website': ''}
missing_site = {'state':'not_linked','url':'','finalUrl':'','message':'Google did not return a linked website. The website checks could not be completed.'}
missing = summarise(missing_profile, missing_site, google_checks(missing_profile) + unknown_website(missing_site['message']), example=True)
for name, data in [('example-report.json', complete), ('partial-report.json', partial), ('no-website-report.json', missing)]:
 (root/'src/app/demo/reach-report'/name).write_text(json.dumps(data, indent=2)+'\n')
print(json.dumps({'example_score':complete['score'],'example_counts':complete['counts'],'partial_score':partial['score'],'partial_coverage':partial['coverage']}))
