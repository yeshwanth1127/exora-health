"""Verify HTTP-delivered marketing HTML and crawler access; never call paid lookup modes."""
import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

AGENTS = ['Mozilla/5.0', 'Googlebot', 'bingbot', 'OAI-SearchBot', 'GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User']
ROUTES = ['/', '/product/features', '/pricing', '/teams', '/enterprise', '/contact-sales', '/blog', '/blog/a-clearer-front-desk', '/help', '/releases', '/solutions/ai-receptionist', '/solutions/clinic-analytics', '/specialties/dental', '/resources/clinic-front-desk-checklist', '/privacy', '/solutions/whatsapp-outreach', '/solutions/google-business-management', '/solutions/teleconsultations', '/labs-diagnostics', '/specialties/physiotherapy', '/blog/a-shared-clinic-day', '/blog/follow-ups-with-a-clear-next-step']

class Document(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip=0; self.head=False; self.h1=False; self.text=[]; self.heading=[]; self.title=''; self.in_title=False; self.canonical=None; self.robots=''; self.scripts=[]; self.assets=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='head': self.head=True
        if tag in ('script','style'): self.skip+=1
        if tag=='script': self.scripts.append(a)
        if tag=='h1': self.h1=True
        if tag=='title' and self.head: self.in_title=True
        if tag=='link' and a.get('rel')=='canonical' and self.head: self.canonical=a.get('href')
        if tag=='meta' and a.get('name')=='robots' and self.head: self.robots=a.get('content','')
        if tag=='link' and a.get('rel')=='stylesheet': self.assets.append(a.get('href'))
    def handle_endtag(self, tag):
        if tag=='head': self.head=False
        if tag in ('script','style'): self.skip=max(0,self.skip-1)
        if tag=='h1': self.h1=False
        if tag=='title': self.in_title=False
    def handle_data(self, value):
        if self.skip: return
        if self.in_title: self.title+=value
        if self.h1: self.heading.append(value)
        if value.strip(): self.text.append(value.strip())

def fetch(base, route, agent='Mozilla/5.0', method='GET'):
    request=Request(base+route,headers={'User-Agent':agent,'Accept':'text/html,application/xhtml+xml'},method=method)
    try:
        with urlopen(request,timeout=30) as response: return response.status,{k.lower():v for k,v in response.headers.items()},response.read().decode('utf8',errors='replace')
    except HTTPError as response: return response.code,{k.lower():v for k,v in response.headers.items()},response.read().decode('utf8',errors='replace')

def verify(base, preview):
    results=[]; nonce_values=[]
    status,headers,robots=fetch(base,'/robots.txt'); assert status==200
    parser=RobotFileParser(); parser.parse(robots.splitlines())
    for agent in AGENTS:
        assert parser.can_fetch(agent,base+'/') is (not preview), (agent,'robots policy')
        status,headers,html=fetch(base,'/',agent)
        assert status==200,(agent,status)
        doc=Document();doc.feed(html)
        assert 'Where care teams' in ' '.join(doc.heading),(agent,'missing server H1')
        assert 'Can customers find you?' in ' '.join(doc.text),(agent,'missing search section HTML')
        assert 'Answer calls, coordinate appointments' in ' '.join(doc.text),(agent,'missing body copy')
        assert doc.title and len(' '.join(doc.text))>1500,(agent,'thin HTML')
        assert headers.get('x-capture-render')=='ssr',(agent,'server marker')
        csp=headers.get('Content-Security-Policy',headers.get('content-security-policy',''))
        nonce=re.search(r"'nonce-([^']+)'",csp); assert nonce,(agent,'missing nonce CSP')
        nonce_values.append(nonce.group(1))
        scripts=[s for s in doc.scripts if not s.get('src') and s.get('type','') not in ('application/ld+json','application/json')]
        assert scripts and all(s.get('nonce')==nonce.group(1) for s in scripts),(agent,'hydration script nonce mismatch')
        response_robots=headers.get('X-Robots-Tag',headers.get('x-robots-tag',''))
        if preview:
            assert 'noindex' in doc.robots and 'noindex' in response_robots,(agent,'preview not protected')
        else:
            assert doc.canonical in (base, base+'/') and 'noindex' not in doc.robots and 'noindex' not in response_robots,(agent,'production indexing blocked')
        results.append({'agent':agent,'status':status,'h1':' '.join(doc.heading),'body_chars':len(' '.join(doc.text))})
    assert len(set(nonce_values))==len(nonce_values),'nonce reused between requests'
    routes=[]
    for route in ROUTES[1:]:
        status,headers,html=fetch(base,route,'OAI-SearchBot');doc=Document();doc.feed(html)
        assert status==200 and doc.heading and doc.title and len(' '.join(doc.text))>150,(route,'missing initial HTML')
        if not preview: assert doc.canonical==base+route,(route,'wrong canonical')
        routes.append({'route':route,'status':status,'title':doc.title,'h1':' '.join(doc.heading)})
    for route in ['/business-report','/demo/reach-report']:
        status,headers,html=fetch(base,route); assert status==200 and 'noindex' in headers.get('X-Robots-Tag',headers.get('x-robots-tag','')),(route,'private report indexable')
    status,headers,html=fetch(base,'/demo/reach-report?state=no-website');doc=Document();doc.feed(html)
    assert 'reach-website-priority' in html and 'No website link found' in ' '.join(doc.text),'missing-website priority absent from initial SSR HTML'
    for route in ['/admin','/.env.maps.local','/assets/source.zip']:
        assert fetch(base,route)[0]==404,(route,'unexpected exposure')
    assert fetch(base,'/',method='POST')[0]==405,'marketing server accepts POST'
    status,headers,payload=fetch(base,'/business-lookup?mode=status');assert status==200 and set(json.loads(payload))=={'configured'},'lookup proxy status failed'
    assert fetch(base,'/llms.txt')[0]==200
    status,headers,sitemap=fetch(base,'/sitemap.xml');assert status==200
    if not preview: assert base+'/' in sitemap and '/business-report' not in sitemap and '/demo/' not in sitemap
    # Verify an actual SSR stylesheet response, not just its link tag.
    status,headers,html=fetch(base,'/');doc=Document();doc.feed(html)
    assert doc.assets and fetch(base,doc.assets[0])[0]==200,'missing CSS asset'
    return {'mode':'preview' if preview else 'production','origin':base,'agents':results,'routes':routes,'fresh_nonce_per_request':True,'private_routes_noindex':True,'source_and_post_blocking':True,'lookup_status_only':True,'paid_lookup_requests':0,'note':'HTTP with claimed crawler agents; not a provider crawl, indexing or citation acceptance test.'}

if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('--origin',required=True);args.add_argument('--preview',action='store_true');args.add_argument('--output');opts=args.parse_args()
    base=opts.origin.rstrip('/');parts=urlsplit(base)
    if not opts.preview and parts.scheme!='https': raise SystemExit('Production checks require HTTPS')
    result=verify(base,opts.preview)
    if opts.output: Path(opts.output).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'PASS':True,'agents':len(result['agents']),'public_routes':len(result['routes'])+1,'paid_lookup_requests':0,'mode':result['mode']}))
