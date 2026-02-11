import re, os, collections

os.chdir('/Users/amohammed/Desktop/CodeMe/openRadius/Backend')

# Find all class definitions to detect duplicate class names in different namespaces
classes = collections.defaultdict(list)

for root, dirs, files in os.walk('.'):
    # Skip obj, bin, Migrations, Temp
    dirs[:] = [d for d in dirs if d not in ('obj', 'bin', 'Migrations', 'Temp', 'node_modules')]
    for fname in files:
        if not fname.endswith('.cs'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath) as f:
            content = f.read()
        
        # Find namespace
        ns_match = re.search(r'namespace\s+([\w.]+)', content)
        namespace = ns_match.group(1) if ns_match else '<none>'
        
        # Find class/record/enum definitions
        for m in re.finditer(r'(?:public|internal)\s+(?:sealed\s+|abstract\s+|partial\s+|static\s+)*(?:class|record|enum|struct)\s+(\w+)', content):
            cname = m.group(1)
            classes[cname].append((namespace, fpath))

print('=== DUPLICATE CLASS NAMES (different namespaces = potential Swagger SchemaId conflict) ===')
found = False
for cname, locations in sorted(classes.items()):
    namespaces = set(ns for ns, _ in locations)
    if len(namespaces) > 1:
        found = True
        print(f'\nClass "{cname}" found in {len(namespaces)} namespaces:')
        for ns, fpath in sorted(locations):
            print(f'  {ns} -> {fpath}')
if not found:
    print('  None found')

# Also check DTOs folder specifically
print('\n=== DTO FILES ===')
dto_classes = collections.defaultdict(list)
for root, dirs, files in os.walk('DTOs'):
    for fname in files:
        if not fname.endswith('.cs'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath) as f:
            content = f.read()
        ns_match = re.search(r'namespace\s+([\w.]+)', content)
        namespace = ns_match.group(1) if ns_match else '<none>'
        for m in re.finditer(r'(?:public|internal)\s+(?:sealed\s+|abstract\s+|partial\s+|static\s+)*(?:class|record|enum|struct)\s+(\w+)', content):
            dto_classes[m.group(1)].append((namespace, fpath))

for cname, locations in sorted(dto_classes.items()):
    namespaces = set(ns for ns, _ in locations)
    if len(namespaces) > 1:
        print(f'\nDTO "{cname}" in {len(namespaces)} namespaces:')
        for ns, fpath in sorted(locations):
            print(f'  {ns} -> {fpath}')
