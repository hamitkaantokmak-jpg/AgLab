#!/usr/bin/env python3
"""Restore the exact original .pkt bytes embedded by convert_pkt_to_aglab.py."""
import argparse, base64, hashlib, json
from pathlib import Path

p=argparse.ArgumentParser(description='AğLab JSON arşivinden özgün Packet Tracer .pkt dosyasını geri çıkarır.')
p.add_argument('json_file', help='sourceArchive içeren AğLab JSON dosyası')
p.add_argument('-o','--output', help='çıktı .pkt yolu; varsayılan restored-original.pkt')
a=p.parse_args()
obj=json.loads(Path(a.json_file).read_text(encoding='utf-8'))
archive=obj.get('sourceArchive') or {}
encoded=archive.get('originalPacketBase64')
expected=archive.get('originalPacketSha256')
if not encoded or not expected:
    raise SystemExit('HATA: JSON içinde özgün .pkt arşivi bulunamadı.')
data=base64.b64decode(encoded, validate=True)
actual=hashlib.sha256(data).hexdigest()
if actual != expected:
    raise SystemExit(f'HATA: SHA-256 doğrulaması başarısız. Beklenen {expected}, bulunan {actual}.')
out=Path(a.output) if a.output else Path('restored-original.pkt')
out.write_bytes(data)
print(f'OK: {out} — {len(data)} bayt; SHA-256 doğrulandı: {actual}')
