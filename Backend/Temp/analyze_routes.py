import re, os, collections

os.chdir('/Users/amohammed/Desktop/CodeMe/openRadius/Backend')

# Extract all route patterns from controllers
routes = []
for root, dirs, files in os.walk('Controllers'):
    for fname in files:
        if not fname.endswith('.cs'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath) as f:
            content = f.read()
            lines = content.split('\n')
        
        # Find class-level route
        class_route = None
        for line in lines:
            m = re.search(r'\[Route\("(.+?)"\)\]', line)
            if m:
                class_route = m.group(1)
                break
        
        # Find all Http method attributes with their routes
        for i, line in enumerate(lines):
            m = re.search(r'\[(Http(Get|Post|Put|Delete|Patch))(?:\("(.+?)"\))?\]', line)
            if m:
                method = m.group(2)
                action_route = m.group(3) or ''
                full_route = f'{class_route}/{action_route}' if class_route else action_route
                routes.append((method, full_route, fpath, i+1))

# Group by method+route to find duplicates
route_map = collections.defaultdict(list)
for method, route, fpath, line in routes:
    route_map[(method, route)].append((fpath, line))

print('=== POTENTIAL DUPLICATE ROUTES (same method + same template) ===')
found_dup = False
for (method, route), locations in sorted(route_map.items()):
    if len(locations) > 1:
        found_dup = True
        print(f'\n[Http{method}] "{route}" found {len(locations)} times:')
        for fpath, line in locations:
            print(f'  {fpath}:{line}')
if not found_dup:
    print('  None found (before resolving [controller] tokens)')

# Resolve [controller] tokens and check again
print('\n=== DUPLICATE ROUTES AFTER RESOLVING [controller] ===')
resolved_map = collections.defaultdict(list)
for method, route, fpath, line in routes:
    cname = os.path.basename(fpath).replace('Controller.cs', '')
    resolved = route.replace('[controller]', cname)
    resolved_map[(method, resolved.lower())].append((fpath, line, route))

found_resolved_dup = False
for (method, route), locations in sorted(resolved_map.items()):
    if len(locations) > 1:
        found_resolved_dup = True
        print(f'\n[Http{method}] "{route}" found {len(locations)} times:')
        for fpath, line, orig in locations:
            print(f'  {fpath}:{line} (original: {orig})')
if not found_resolved_dup:
    print('  None found')

print('\n=== TOTAL ROUTES: {} ==='.format(len(routes)))
