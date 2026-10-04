import json, sys
from packaging.version import Version, InvalidVersion
from packaging.specifiers import Specifier, InvalidSpecifier
req = json.load(sys.stdin)
out = []
for c in req:
    k = c['k']
    try:
        if k == 'norm':
            out.append(str(Version(c['s'])))
        elif k == 'cmp':
            a, b = Version(c['a']), Version(c['b'])
            out.append((a > b) - (a < b))
        elif k == 'spec':
            sp = Specifier(c['spec'])
            out.append(bool(sp.contains(c['v'], prereleases=True)))
    except (InvalidVersion, InvalidSpecifier):
        out.append('ERR')
    except Exception as e:
        out.append('ERR')
json.dump(out, sys.stdout)
