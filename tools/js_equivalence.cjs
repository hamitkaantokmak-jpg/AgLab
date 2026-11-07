#!/usr/bin/env node
// Biçim değişikliklerinin davranışı değiştirmediğini kanıtlar.
//
// Her dosya çifti esbuild ile yalnızca boşluk küçültmesinden (minifyWhitespace)
// geçirilir. Yorumlar atılır, tırnak/parantez/noktalı virgül tek biçime indirgenir.
// İki çıktı bayt bayt aynıysa sözdizim ağaçları (AST) eşdeğerdir; yani değişiklik
// yalnızca biçimseldir. Ad değiştirme veya sözdizim sadeleştirmesi yapılmaz.
//
// Katı karşılaştırma farklıysa ikinci kademe denenir: esbuild'in anlamı koruyan
// sözdizim normalleştirmesi (minifySyntax; ör. `a||(b||c)` -> `a||b||c`). Bu kademede
// eşleşen dosyalar ayrıca "sözdizim normalleştirmesiyle" diye raporlanır ki inceleme
// bunları tek tek görebilsin.
//
// Kullanım:
//   node tools/js_equivalence.cjs <eski-kök> <yeni-kök> [eski=yeni ...] <dosya...>
//   node tools/js_equivalence.cjs /tmp/main-checkout . src/app/main.js simulator/icmp.js
//   node tools/js_equivalence.cjs /tmp/main-checkout . simulator/test_x.cjs=tests/node/test_x.cjs
// "eski=yeni" biçimi taşınan dosyalar içindir. Bir fark varsa çıkış kodu 1'dir.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

function normalize(file, minifySyntax = false) {
  const ext = path.extname(file);
  const loader = ext === '.css' ? 'css' : ext === '.ts' ? 'ts' : 'js';
  return esbuild.transformSync(fs.readFileSync(file, 'utf8'), {
    loader,
    minifyWhitespace: true,
    minifySyntax,
    legalComments: 'none',
    charset: 'utf8',
  }).code;
}

function main(argv) {
  const [oldRoot, newRoot, ...pairs] = argv;
  if (!oldRoot || !newRoot || !pairs.length) {
    console.error(
      'Kullanım: node tools/js_equivalence.cjs <eski-kök> <yeni-kök> <dosya|eski=yeni>...',
    );
    return 2;
  }
  let failures = 0;
  let syntaxOnly = 0;
  for (const pair of pairs) {
    const [before, after = before] = pair.split('=');
    const a = normalize(path.join(oldRoot, before));
    const b = normalize(path.join(newRoot, after));
    const label = before === after ? before : `${before} -> ${after}`;
    if (a === b) {
      console.log(`EŞDEĞER  ${label}`);
    } else if (
      normalize(path.join(oldRoot, before), true) === normalize(path.join(newRoot, after), true)
    ) {
      syntaxOnly++;
      console.log(`EŞDEĞER  ${label} (sözdizim normalleştirmesiyle)`);
    } else {
      failures++;
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      console.log(`FARKLI   ${pair} (ilk fark ${i}. karakterde)`);
      console.log(`  eski: ${JSON.stringify(a.slice(Math.max(0, i - 60), i + 60))}`);
      console.log(`  yeni: ${JSON.stringify(b.slice(Math.max(0, i - 60), i + 60))}`);
    }
  }
  console.log(
    `${pairs.length - failures}/${pairs.length} dosya eşdeğer` +
      (syntaxOnly ? ` (${syntaxOnly} tanesi sözdizim normalleştirmesiyle)` : ''),
  );
  return failures ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
