#!/usr/bin/env python3
"""Exercise the SSH helper entirely against temporary fake credentials/hosts."""
import os
from pathlib import Path
import subprocess
import tempfile

source = Path(__file__).with_name('vinta-push-secrets.sh').read_text()
with tempfile.TemporaryDirectory(prefix='ub4bb8k-test-') as root:
    root = Path(root)
    local, remote, binaries = (root / name for name in ('local', 'remote', 'bin'))
    binaries.mkdir()
    for home in (local, remote):
        (home / 'dirhaven/server').mkdir(parents=True)
        (home / '.cloudflared').mkdir()
    tunnel = '.cloudflared/1cacfa16-3569-419a-ad5d-52981c6a803f.json'
    paths = ['dirhaven/server/.env', tunnel]
    for path in paths:
        (local / path).write_text('fake-test-secret\n')
        (remote / path).write_text('previous\n')
    script = root / 'helper.sh'
    script.write_text(source.replace('/home/vinta', str(local)))
    ssh = binaries / 'ssh'
    ssh.write_text('''#!/usr/bin/env python3
import os, subprocess, sys
assert 'StrictHostKeyChecking=yes' in sys.argv
assert 'BatchMode=yes' in sys.argv
assert 'ConnectTimeout=10' in sys.argv
if os.environ.get('FAIL_SSH') == '1': sys.exit(255)
command=sys.argv[-1].replace(os.environ['LOCAL'],os.environ['REMOTE'])
if command == 'bash -s':
    body=sys.stdin.read().replace(os.environ['LOCAL'],os.environ['REMOTE'])
    sys.exit(subprocess.run(['bash','-c',body]).returncode)
if os.environ.get('TRUNCATE') == '1':
    sys.exit(subprocess.run(['bash','-c',command], input=sys.stdin.buffer.read()[:2]).returncode)
sys.exit(subprocess.run(['bash','-c',command]).returncode)
''')
    ssh.chmod(0o755)
    identity = binaries / 'id'
    identity.write_text('#!/bin/sh\necho vinta\n')
    identity.chmod(0o755)
    env = dict(os.environ, PATH=str(binaries) + ':' + os.environ['PATH'],
               LOCAL=str(local), REMOTE=str(remote))
    def run(mode, extra=None):
        return subprocess.run(['bash', str(script), mode], env=env | (extra or {}),
                              capture_output=True, text=True, timeout=10)
    assert run('--check').returncode == 0
    assert all((remote / p).read_text() == 'previous\n' for p in paths)
    assert run('--push', {'FAIL_SSH': '1'}).returncode == 255
    assert all((remote / p).read_text() == 'previous\n' for p in paths)
    assert run('--push', {'TRUNCATE': '1'}).returncode != 0
    assert all((remote / p).read_text() == 'previous\n' for p in paths)
    pushed = run('--push')
    assert pushed.returncode == 0, pushed.stderr
    assert 'fake-test-secret' not in pushed.stdout + pushed.stderr
    for path in paths:
        assert (remote / path).read_bytes() == (local / path).read_bytes()
        assert (remote / path).stat().st_mode & 0o777 == 0o600
    (local / paths[0]).write_text('')
    assert run('--push').returncode != 0
    assert (remote / paths[0]).read_text() == 'fake-test-secret\n'
    assert run('--invalid').returncode == 2
    assert not list(remote.rglob('*.push.*'))
    print('PASS: read-only check, SSH failure preserves files, checksum mismatch preserves files, exact transfers, mode 600, no secret output, empty-source refusal, bad-mode refusal, temporary-file cleanup')
