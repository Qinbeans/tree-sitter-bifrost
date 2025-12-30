import os
import json
import re

dist_dir = 'dist'
index = {}

wheel_re = re.compile(
    r'^(?P<name>.+)-(?P<version>[^-]+)-(?P<pyver>cp\d+)-(?P<abi>[^-]+)-(?P<platform>[^.]+)'
)

def platform_to_sys(platform):
    if 'win32' in platform or 'win_amd64' in platform:
        return 'win32'
    elif 'manylinux' in platform or 'linux' in platform:
        return 'linux'
    elif 'macosx' in platform or 'macos' in platform:
        return 'darwin'
    else:
        return platform

for root, _, files in os.walk(dist_dir):
    for fname in files:
        if fname.endswith('.whl'):
            m = wheel_re.match(fname)
            if not m:
                continue
            name = m.group('name').replace('_', '-')
            version = m.group('version')
            pyver = m.group('pyver')
            platform = m.group('platform')
            sys_platform = platform_to_sys(platform)
            python_version = pyver[2] + '.' + pyver[3:]  # cp310 -> 3.10
            entry = {
                "url": fname,
                "python_version": python_version,
                "sys_platform": sys_platform
            }
            index.setdefault(name, {}).setdefault(version, []).append(entry)

with open('flat-index.json', 'w') as f:
    json.dump(index, f, indent=2)
