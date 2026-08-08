const JSZip = require('jszip');
const fs = require('fs');
const zip = new JSZip();
zip.loadAsync(fs.readFileSync('test.epub')).then(async z => {
  const files = Object.keys(z.files);
  console.log('Total files:', files.length);

  // container.xml
  const container = z.file('META-INF/container.xml');
  if (container) console.log('\n=== container.xml ===\n', await container.async('string'));

  // Find OPF
  const opfFile = files.find(f => f.endsWith('.opf'));
  if (opfFile) {
    const opf = await z.file(opfFile).async('string');
    console.log('\n=== OPF (first 3000) ===\n', opf.slice(0, 3000));
  }

  // Find CSS files
  const cssFiles = files.filter(f => f.endsWith('.css'));
  console.log('\n=== CSS files ===', cssFiles);
  for (const cf of cssFiles.slice(0, 2)) {
    const css = await z.file(cf).async('string');
    console.log(`\n=== ${cf} (first 2000) ===\n`, css.slice(0, 2000));
  }

  // Find first xhtml
  const xhtmlFiles = files.filter(f => f.endsWith('.xhtml') || f.endsWith('.html'));
  console.log('\n=== XHTML files ===', xhtmlFiles.slice(0, 10));
  if (xhtmlFiles[0]) {
    const xhtml = await z.file(xhtmlFiles[0]).async('string');
    console.log('\n=== First XHTML (first 3000) ===\n', xhtml.slice(0, 3000));
  }
  // Second xhtml (content)
  if (xhtmlFiles[1]) {
    const xhtml = await z.file(xhtmlFiles[1]).async('string');
    console.log('\n=== Second XHTML (first 3000) ===\n', xhtml.slice(0, 3000));
  }
});
