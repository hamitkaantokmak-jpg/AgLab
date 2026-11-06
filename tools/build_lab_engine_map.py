#!/usr/bin/env python3
"""Derive structural eligibility from the actual 40 immutable student labs.

Eligibility is not an execution claim. No teacher solutions are consumed.
"""
import hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'real-lab'))
from shared_topology import convert
from routed_topology import convert as convert_routed
def render():
 lines=['# Akademi laboratuvar–motor haritası','','Bu tablo gerçek öğrenci JSON içeriklerinden üretilir. Yapısal adaylık, aktarım veya başarılı native test anlamına gelmez. AğLab JS mevcut görev/grading motorudur. MIT yalnız access LAN karşılaştırmasıdır. Linux bridge dönüştürücüsü sınırlı PC/switch ormanlarını kabul eder. FRR dönüştürücüsü sınırlı PC/router ve VLAN1 access-köprü şemasını ayrı doğrular; şema kabulü native test başarısı değildir.','','| Lab | Gerçek konu | Cihaz/bağ | AğLab JS | MIT NetSim | Linux bridge | FRR | Öğrenci JSON SHA256 |','|---|---|---|---|---|---|---|---|']
 for p in sorted((ROOT/'academy/student').glob('AGL-*.json')):
  raw=p.read_bytes();lab=json.loads(raw);t=lab['initial_topology'];ds=t['devices'];router=any(d['type']=='Router' for d in ds)
  trunk=any(c.get('mode')=='trunk' for d in ds for c in d.get('interfaces',{}).values())
  vlan=any(c.get('vlan',1)!=1 for d in ds for c in d.get('interfaces',{}).values())
  mit='Yok (routing)' if router else 'Sınırlı aday; unused trunk portları da reddedilir' if trunk else 'Access LAN adayı; görev/CLI aktarılmaz'
  if router:linux='L2 dönüştürücü değil; FRR yoluna bakınız'
  else:
   try:convert(t);linux='Başlangıç şeması kabul edilir; native görev testi yok'
   except ValueError as error:linux='Başlangıç reddedilir: '+str(error)+'; onarım sonrası yeniden değerlendir'
  if lab['id']=='AGL-024':linux='Native arıza/onarım senaryosu; sonuç CI kanıtında'
  frr='Gerekmez'
  if router:
   try:convert_routed(t);frr='Başlangıç şeması kabul; native görev testi yok'
   except ValueError as error:frr='Başlangıç reddedilir: '+str(error)
   if lab['id'] in ('AGL-034','AGL-035'):frr='Başlangıç/çözüm native CI geçti (a1d6382; kanıt aşağıda)'
  lines.append(f"| {lab['id']} | {lab['title'].replace('|','/')} | {len(ds)}/{len(t['links'])} | Mevcut | {mit} | {linux} | {frr} | `{hashlib.sha256(raw).hexdigest()}` |")
 lines.extend(['','ACL/NAT için security_smoke ayrı native operatör örnekleridir; mevcut 40 görevin ACL/NAT alanlarını dönüştürdüğü veya native doğruladığı iddia edilmez. TCP/UDP gerçek soket ve kernel firewall/NAT kabulü ayrı CI raporundan okunur.','','AGL-034/035 native kanıtı: [42192382258, a1d6382](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42192382258), `aglab-integration-routed_smoke` artefaktı. Diğer labların dönüştürücü kabulü native başarı iddiası değildir.','','AGL-024 gerçekte dört PC, iki switch, VLAN10 ve VLAN20 içerir; örnek görev tablosundan varsayım yapılmamıştır. Native test ilk VLAN10 başarısızlığını, uplink trunk onarımını ve iki VLAN’ın gerçek ICMP trafiğini denetler. AGL-034/035 özgün başlangıç/çözüm topolojileri değiştirilmeden FRR kabul takımına bağlandı; başlangıç arızası, CLI rota onarımı, ICMP, RIB/FIB ve shutdown/no shutdown native CI’da geçti. Yeni IPv6/multi-area ve bağımsız iki/üç router örnekleri özgün 40 lab dışında operatör senaryolarıdır.',''])
 return '\n'.join(lines)
if __name__=='__main__':(ROOT/'docs/LAB_MOTOR_HARITASI.md').write_text(render(),encoding='utf-8')
