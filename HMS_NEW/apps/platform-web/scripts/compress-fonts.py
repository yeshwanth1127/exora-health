"""Lossless WOFF2 versions. Requires fonttools[woff]; original fonts stay intact."""
from pathlib import Path
from hashlib import sha256
from fontTools.ttLib import TTFont
import json
root=Path(__file__).resolve().parents[1]
rows=[]
for relative,css in [('assets/capture-brand/bricolage-grotesque.ttf','src/app/brand.css'),('assets/cloned/fonts/51ed8ad4b862.ttf','src/app/globals.css')]:
    source=root/'public'/relative
    fingerprint=sha256(source.read_bytes()).hexdigest()[:10]
    target_relative=f'assets/optimized/fonts/{source.stem}.{fingerprint}.woff2'
    target=root/'public'/target_relative
    target.parent.mkdir(parents=True,exist_ok=True)
    font=TTFont(source,recalcTimestamp=False);font.flavor='woff2';font.save(target)
    compressed=TTFont(target)
    assert font.getBestCmap()==compressed.getBestCmap(), 'Font character coverage changed'
    assert font.getGlyphOrder()==compressed.getGlyphOrder(), 'Font glyph ordering changed'
    sheet=root/css
    text=sheet.read_text().replace('/'+relative,'/'+target_relative).replace("format('truetype')","format('woff2')") if css.endswith('brand.css') else sheet.read_text().replace(f'url("/{relative}") format("truetype")',f'url("/{target_relative}") format("woff2")')
    sheet.write_text(text)
    rows.append({'source':relative,'sourceSha256':sha256(source.read_bytes()).hexdigest(),'originalBytes':source.stat().st_size,'optimized':target_relative,'optimizedBytes':target.stat().st_size,'glyphMapPreserved':True})
(root/'docs/performance').mkdir(parents=True,exist_ok=True)
(root/'docs/performance/font-inventory.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows))
