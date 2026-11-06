#!/usr/bin/env python3
"""Derive structural eligibility from the actual 40 immutable student labs.

Eligibility is not an execution claim. No teacher solutions are consumed.
"""
import hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'real-lab'))
from shared_topology import convert
def render():
 lines=['# Akademi laboratuvar–motor haritası','','Bu tablo gerçek öğrenci JSON içeriklerinden üretilir. Yapısal adaylık, aktarım veya başarılı native test anlamına gelmez. AğLab JS mevcut görev/grading motorudur. MIT yalnız access LAN karşılaştırmasıdır. Linux dönüştürücü yalnız sınırlı PC/switch ormanlarını kabul eder; FRR için ortak router dönüştürücüsü henüz yoktur.','','| Lab | Gerçek konu | Cihaz/bağ | AğLab JS | MIT NetSim | Linux bridge | FRR | Öğrenci JSON SHA256 |','|---|---|---|---|---|---|---|---|']
 for p in sorted((ROOT/'academy/student').glob('AGL-*.json')):
  raw=p.read_bytes();lab=json.loads(raw);t=lab['initial_topology'];ds=t['devices'];router=any(d['type']=='Router' for d in ds)
  trunk=any(c.get('mode')=='trunk' for d in ds for c in d.get('interfaces',{}).values())
  vlan=any(c.get('vlan',1)!=1 for d in ds for c in d.get('interfaces',{}).values())
  mit='Yok (routing)' if router else 'Sınırlı aday; unused trunk portları da reddedilir' if trunk else 'Access LAN adayı; görev/CLI aktarılmaz'
  if router:linux='Yok (router dönüşümü yok)'
  else:
   try:convert(t);linux='Başlangıç şeması kabul edilir; native görev testi yok'
   except ValueError as error:linux='Başlangıç reddedilir: '+str(error)+'; onarım sonrası yeniden değerlendir'
  if lab['id']=='AGL-024':linux='Native arıza/onarım senaryosu; sonuç CI kanıtında'
  frr='Protokol altyapısı uygun; bu görevin ortak dönüşümü yok' if router else 'Gerekmez'
  lines.append(f"| {lab['id']} | {lab['title'].replace('|','/')} | {len(ds)}/{len(t['links'])} | Mevcut | {mit} | {linux} | {frr} | `{hashlib.sha256(raw).hexdigest()}` |")
 lines.extend(['','AGL-024 gerçekte dört PC, iki switch, VLAN10 ve VLAN20 içerir; örnek görev tablosundan varsayım yapılmamıştır. Native test ilk VLAN10 başarısızlığını, uplink trunk onarımını ve iki VLAN’ın gerçek ICMP trafiğini denetler. Yeni IPv6/multi-area görevleri özgün 40 lab dışında operatör senaryolarıdır.',''])
 return '\n'.join(lines)
if __name__=='__main__':(ROOT/'docs/LAB_MOTOR_HARITASI.md').write_text(render(),encoding='utf-8')
