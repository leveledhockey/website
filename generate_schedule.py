#!/usr/bin/env python3
"""
Run this script whenever programs.csv is updated:
    python3 generate_schedule.py

It reads programs.csv and writes schedule-data.js, which register.html
loads as a plain <script> tag — no server required.
"""

import csv
import json
import os

CSV_PATH = os.path.join(os.path.dirname(__file__), 'programs.csv')
OUT_PATH = os.path.join(os.path.dirname(__file__), 'schedule-data.js')

rows = []
with open(CSV_PATH, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Skip completely empty rows
        if any(v.strip() for v in row.values()):
            rows.append({k.strip(): v.strip() for k, v in row.items()})

js = '// Auto-generated from programs.csv — do not edit by hand.\n'
js += '// Re-run generate_schedule.py after updating programs.csv.\n'
js += 'window.SCHEDULE_DATA = ' + json.dumps(rows, indent=2) + ';\n'

with open(OUT_PATH, 'w', encoding='utf-8') as f:
    f.write(js)

print(f'Written {len(rows)} session(s) to schedule-data.js')
