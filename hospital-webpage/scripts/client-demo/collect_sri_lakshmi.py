#!/usr/bin/env python3
"""Archive public Sri Lakshmi content and media with source provenance (no form submissions)."""
import concurrent.futures, datetime, hashlib, json, re, subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote, quote

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'research/sri-lakshmi'
MEDIA = ROOT / 'public/clients/sri-lakshmi'
ORIGIN = 'https://slsshospitals.com'
class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=set(); self.assets=set(); self.text=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag in ('script','style'): self.skip+=1
        if tag=='a' and a.get('href'): self.links.add(urljoin(ORIGIN, a['href']))
        for key in ('src','data-src','data-lazy-src','poster'):
            if a.get(key): self.asset(a[key])
        for key in ('srcset','data-srcset','data-lazy-srcset'):
            for item in a.get(key,'').split(','):
                if item.strip(): self.asset(item.strip().split()[0])
        if tag=='link' and a.get('rel')=='stylesheet': self.asset(a.get('href',''))
    def asset(self,url):
        url=urljoin(ORIGIN,url)
        if urlsplit(url).hostname in ('slsshospitals.com','www.slsshospitals.com'): self.assets.add(url)
    def handle_endtag(self,tag):
        if tag in ('script','style') and self.skip: self.skip-=1
    def handle_data(self,data):
        if not self.skip and data.strip(): self.text.append(data.strip())

def fetch(url,path):
    url=quote(url,safe=':/?=&%+@,;')
    path.parent.mkdir(parents=True,exist_ok=True)
    result=subprocess.run(['curl','-4','-fLsS','--connect-timeout','8','--max-time','35','--retry','1',url,'-o',str(path)],capture_output=True)
    if result.returncode: return {'url':url,'error':result.stderr.decode().strip()[:250]}
    data=path.read_bytes()
    return {'url':url,'path':str(path.relative_to(ROOT)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}

def slug(url): return urlsplit(url).path.strip('/').replace('/','--') or 'home'

def main():
    OUT.mkdir(parents=True,exist_ok=True); MEDIA.mkdir(parents=True,exist_ok=True)
    seen=set(); queue={ORIGIN+'/'}; pages=[]; assets=set(); extra=[]
    while queue:
        batch=sorted(queue-seen); queue=set()
        if not batch: break
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results=list(pool.map(lambda u: fetch(u,OUT/'pages'/f'{slug(u)}.html.source'),batch))
        for u,result in zip(batch,results):
            seen.add(u); pages.append(result)
            if 'error' in result: continue
            html=(ROOT/result['path']).read_text(errors='replace'); p=PageParser();p.feed(html)
            (OUT/'pages'/f'{slug(u)}.txt').write_text('\n'.join(p.text)+'\n')
            assets |= p.assets
            for url in re.findall(r'(?:https?:)?//slsshospitals\.com/[^\s"<>\\)]+',html):
                if '/wp-content/uploads/' in url: assets.add(url.split('?')[0])
            for link in p.links:
                v=urlsplit(link)
                if v.hostname in ('slsshospitals.com','www.slsshospitals.com') and not v.query and not v.fragment:
                    if re.search(r'\.(pdf|jpg|jpeg|png|webp|avif|svg)$',v.path,re.I): assets.add(link)
                    elif not any(x in v.path for x in ('wp-admin','wp-json','feed','wp-login')): queue.add(ORIGIN+v.path)
            print('PAGE',u,flush=True)
    # Archive metadata endpoints as additional inventory; never crawl admin surfaces.
    for name,path in [('robots','/robots.txt'),('sitemap','/sitemap_index.xml'),('wp-pages','/wp-json/wp/v2/pages?per_page=100'),('wp-media','/wp-json/wp/v2/media?per_page=100')]:
        record=fetch(ORIGIN+path,OUT/f'{name}.json' if name.startswith('wp-') else OUT/f'{name}.txt'); extra.append(record)
        if name=='wp-media' and 'error' not in record:
            try:
                for item in json.loads((ROOT/record['path']).read_text()):
                    if isinstance(item,dict) and item.get('source_url'): assets.add(item['source_url'])
            except (ValueError,TypeError): pass
    # Save images/documents and the site's own generated CSS (backgrounds and palette).
    candidates=sorted(u.split('?')[0] for u in assets if '/uploads/' in u)
    candidates=sorted(set(candidates)); media=[]
    def download(u):
        name=unquote(urlsplit(u).path).split('/')[-1]
        name=re.sub(r'[^A-Za-z0-9._-]','-',name)
        local=MEDIA/(hashlib.sha256(u.encode()).hexdigest()[:8]+'-'+name)
        return fetch(u,local)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for result in pool.map(download,candidates):
            media.append(result)
            print('ASSET',result['url'],result.get('bytes',result.get('error')),flush=True)
    (OUT/'manifest.json').write_text(json.dumps({'collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':ORIGIN,'pages':pages,'assets':media,'inventoryEndpoints':extra},indent=2)+'\n')
    print('DONE',len(pages),'pages',len(media),'assets')
if __name__=='__main__': main()
