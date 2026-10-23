"""Read-only HTML/asset audit; never invokes a paid lookup or search API."""
import argparse,json,re
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import urlopen
from urllib.parse import urlsplit
class Images(HTMLParser):
    def __init__(self):super().__init__();self.images=[]
    def handle_starttag(self,tag,attrs):
        if tag=='img':self.images.append(dict(attrs))
def image_paths(images):
    return {x['src'] for x in images if x.get('src','').startswith('/assets/') and re.search(r'\.(?:png|jpe?g|webp|gif)$',x['src'])}
parser=argparse.ArgumentParser();parser.add_argument('--origin',required=True);parser.add_argument('--output',default='docs/performance/http-verification.json');parser.add_argument('--baseline',default='docs/performance/home-before.json');parser.add_argument('--check-cache',action='store_true');opts=parser.parse_args()
routes=['/','/product/features','/pricing','/teams','/enterprise','/contact-sales','/blog','/help','/releases','/labs-diagnostics','/specialties/dental','/specialties/physiotherapy','/solutions/ai-receptionist','/solutions/whatsapp-outreach','/solutions/google-business-management','/solutions/clinic-analytics','/solutions/teleconsultations','/blog/a-clearer-front-desk','/blog/a-shared-clinic-day','/blog/follow-ups-with-a-clear-next-step','/resources/clinic-front-desk-checklist','/privacy','/demo/overview']
findings=[];assets=set();home=[]
for route in routes:
    with urlopen(opts.origin+route) as response:assert response.status==200;html=response.read().decode()
    doc=Images();doc.feed(html)
    if route=='/':home=doc.images
    paths=image_paths(doc.images)
    assert all('/assets/optimized/' in path for path in paths),(route,'unoptimized raster',paths)
    for image in doc.images:
        src=image.get('src','')
        if src not in paths:continue
        if route=='/demo/overview' and re.search(r'\.64\.webp$',src):continue  # Original Arc avatar remains eager inside the lazy iframe.
        assert image.get('loading') in ('eager','lazy'),(route,src,'missing initial loading hint')
        assert (image.get('width') and image.get('height')) or ('width:' in image.get('style','') and 'height:' in image.get('style','')),(route,src,'missing dimensions')
        # Saved HTML panels use explicit CSS geometry instead of width/height attributes.
    for image in doc.images:
        src=image.get('src','')
        if src.startswith('/assets/'):assets.add(src)
        for candidate in image.get('srcset','').split(','):
            value=candidate.strip().split(' ')[0]
            if value.startswith('/assets/'):assets.add(value)
    findings.append({'route':route,'images':len(doc.images),'rasterImages':len(paths)})
for src in assets:
    assert Path('public'+urlsplit(src).path).is_file(),('missing asset',src)
sample=next(path for path in image_paths(home) if path.endswith('.webp'))
with urlopen(opts.origin+sample) as response:
    assert response.headers.get_content_type()=='image/webp'
    cache=response.headers.get('Cache-Control','')
    if opts.check_cache:assert 'immutable' in cache and '31536000' in cache,cache
before=image_paths(json.loads(Path(opts.baseline).read_text()));after=image_paths(home)
size=lambda paths:sum(Path('public'+path).stat().st_size for path in paths)
result={'pass':True,'routes':findings,'referencedAssetsChecked':len(assets),'homepageFallbackImageBytes':{'before':size(before),'after':size(after),'reductionPercent':round((1-size(after)/size(before))*100,1)},'cacheHeader':cache,'paidApiCalls':0,'scope':'HTML image references and local file bytes; not a measured network transfer or Core Web Vitals score'}
Path(opts.output).parent.mkdir(parents=True,exist_ok=True);Path(opts.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='routes'}))
