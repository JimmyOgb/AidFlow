import os
import re

terms = [
    'mock', 'demo', 'fake', 'placeholder', 'sample', 'dummy', 'seed',
    'fixture', 'hardcoded', 'fallback', 'testCampaign', 'mockCampaign',
    'demoCampaign', 'fakeBalance', 'fakeEvidence', 'fakeActivity', 'fakeStats',
    'Community Food Relief', '0x1111', '0x2222', '0x3333', '0x4444'
]

frontend_src = os.path.join('frontend', 'src')
results = []

for root, dirs, files in os.walk(frontend_src):
    for f in files:
        if not (f.endswith('.ts') or f.endswith('.tsx') or f.endswith('.json')):
            continue
        filepath = os.path.join(root, f)
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as fh:
            lines = fh.readlines()
            for line_no, line in enumerate(lines, 1):
                for term in terms:
                    if re.search(r'\b' + re.escape(term) + r'\b', line, re.IGNORECASE):
                        results.append((filepath, line_no, term, line.strip()))

print(f"Total audit hits found: {len(results)}")
for r in results:
    print(f"{r[0]}:{r[1]} [{r[2]}] -> {r[3][:100]}")
