#!/usr/bin/env node
// Labber motorunu (src/sim, köprü: src/sim-bridge) tek bir IIFE'ye derler.
//
// Çıktı: src/sim.generated.js — commit edilir ve tools/build_html.py ile HTML'ye
// `//@@module SIM@@` yer tutucusundan gömülür. Global ad yalnızca `AgLabSim`.
//
// Determinizm: esbuild sürümü package-lock.json ile sabit; kaynak haritası, zaman
// damgası ve mutlak yol yok (absWorkingDir depo kökü). CI aynı komutu çalıştırıp
// `git diff --exit-code -- src/sim.generated.js` ile tekrar üretimi doğrular.
'use strict';
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const outfile = path.join(root, 'src', 'sim.generated.js');

esbuild.buildSync({
  absWorkingDir: root,
  entryPoints: ['src/sim-bridge/index.ts'],
  outfile,
  bundle: true,
  format: 'iife',
  globalName: 'AgLabSim',
  platform: 'browser',
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'warning',
  banner: {
    js: '// ÜRETİLMİŞ DOSYA — elle düzenlemeyin. Kaynak: src/sim (Labber), src/sim-bridge.\n// Yeniden üretmek için: npm run build:sim',
  },
});
console.log('wrote ' + path.relative(root, outfile));
