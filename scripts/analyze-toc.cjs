const JSZip = require('jszip');
const fs = require('fs');
const zip = new JSZip();
zip.loadAsync(fs.readFileSync('test.epub')).then(async z => {
  const files = Object.keys(z.files);
  const opfFile = files.find(f => f.endsWith('.opf'));
  const opfXml = await z.file(opfFile).async('string');
  const opfDir = opfFile.replace(/[^/]+$/, '');

  // Extract spine
  const manifest = new Map();
  const itemRe = /<item\b([^>]*?)\/?>/gi;
  let m;
  while ((m = itemRe.exec(opfXml)) !== null) {
    const attrs = parseAttrs(m[1]);
    if (attrs.id && attrs.href) manifest.set(attrs.id, attrs.href);
  }

  const spine = [];
  const itemrefRe = /<itemref\b([^>]*?)\/?>/gi;
  while ((m = itemrefRe.exec(opfXml)) !== null) {
    const attrs = parseAttrs(m[1]);
    if (attrs.idref && manifest.has(attrs.idref)) {
      spine.push({ id: attrs.idref, href: (opfDir + manifest.get(attrs.idref)).replace(/\/+/g, '/') });
    }
  }

  // Extract NCX toc
  const tocAttr = /<spine\b([^>]*?)\/?>/i.exec(opfXml);
  const tocId = tocAttr ? parseAttrs(tocAttr[1]).toc : null;
  console.log('opfDir:', opfDir);
  console.log('tocId:', tocId);
  console.log('\nSpine (first 5):');
  spine.slice(0, 5).forEach(s => console.log('  ', s.href));

  if (tocId && manifest.has(tocId)) {
    const ncxHref = (opfDir + manifest.get(tocId)).replace(/\/+/g, '/');
    const ncxXml = await z.file(ncxHref).async('string');
    console.log('\nNCX navPoints:');
    const navRe = /<navPoint\b([^>]*?)>([\s\S]*?)<\/navPoint>/gi;
    let nm;
    while ((nm = navRe.exec(ncxXml)) !== null) {
      const body = nm[2];
      const label = /<text>([^<]*)<\/text>/i.exec(body)?.[1]?.trim();
      const src = /<content\b([^>]*?)\/?>/i.exec(body);
      const srcAttr = src ? parseAttrs(src[1]).src : '';
      console.log('  label:', label, '| src:', srcAttr);
    }
  }
});

function parseAttrs(str) {
  const attrs = {};
  const re = /(\w[\w:-]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(str)) !== null) attrs[m[1].toLowerCase()] = m[2];
  return attrs;
}
