"""Restore the verified CI archive as data; never execute archived programs."""
import hashlib
import json
import pathlib
import stat
import sys
import zipfile


def restore(archive, directory, source_sha, expected_digest):
    raw = pathlib.Path(archive).read_bytes()
    assert len(raw) <= 8 * 1024 * 1024 and hashlib.sha256(raw).hexdigest() == expected_digest, 'Archive digest mismatch'
    destination = pathlib.Path(directory)
    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    expected = {'bundle/README.md', 'bundle/index.js', 'bundle/index.js.map', 'probe.json', 'result.json'}
    files = []
    with zipfile.ZipFile(archive) as zipped:
        entries = zipped.infolist()
        assert len(entries) == 5 and {entry.filename for entry in entries} == expected, 'Unexpected archive entries'
        assert sum(entry.file_size for entry in entries) <= 16 * 1024 * 1024, 'Expanded archive exceeds limit'
        for entry in entries:
            mode = entry.external_attr >> 16
            assert not entry.is_dir() and not entry.flag_bits & 1 and stat.S_IFMT(mode) in (0, stat.S_IFREG), 'Unsupported archive entry'
            data = zipped.read(entry)
            assert len(data) == entry.file_size, 'Restored entry size mismatch'
            target = destination / entry.filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            target.chmod(0o600)
            digest = hashlib.sha256(data).hexdigest()
            assert hashlib.sha256(target.read_bytes()).hexdigest() == digest, 'Restoration readback mismatch'
            files.append({'path': entry.filename, 'bytes': len(data), 'sha256': digest})
    result = json.loads((destination / 'result.json').read_text())
    probe = json.loads((destination / 'probe.json').read_text())
    assert result['schema'] == 1 and result['kind'] == 'relay-worker-runtime' and result['state'] == 'passed' and result['stage'] == 'complete', 'Runtime evidence is incomplete'
    assert result['identity']['source_sha'] == source_sha and probe['checks'] == result['checks'], 'Runtime source/probe mismatch'
    assert result['runtime'] == 'local-workerd' and result['bundle']['status'] == 'passed' and result['bundle']['exit_code'] == 0, 'Compiled runtime did not pass'
    recorded = result['artifacts']
    assert len(recorded) == 3 and {item['path'] for item in recorded} == {'README.md', 'index.js', 'index.js.map'}, 'Compiled artifact manifest is incomplete'
    actual = {item['path'].removeprefix('bundle/'): item for item in files if item['path'].startswith('bundle/')}
    for item in recorded:
        assert actual[item['path']]['bytes'] == item['bytes'] and actual[item['path']]['sha256'] == item['sha256'], 'Compiled artifact digest mismatch'
    checks = result['checks']
    assert any(c.get('criterion') == 'website-source' and c.get('source_sha') == source_sha and c.get('status') == 200 for c in checks), 'Website source evidence is missing'
    assert any(c.get('criterion') == 'worker-health' and c.get('status') == 200 for c in checks), 'Worker health evidence is missing'
    for path in ['/mcp', '/api/panel']:
        assert any(c.get('criterion') == 'unauthenticated-rejection' and c.get('path') == path and c.get('status') == 401 for c in checks), 'Authentication evidence is missing'
    for scope in ['global', 'relay']:
        assert any(c.get('criterion') == 'durable-safety-status' and c.get('scope') == scope and c.get('held') is False for c in checks), 'Safety runtime evidence is missing'
    return {'schema': 1, 'source_sha': source_sha, 'archive_sha256': expected_digest, 'file_count': len(files), 'files': sorted(files, key=lambda item: item['path']), 'host_restore_verified': True, 'compiled_ci_runtime_evidence_verified': True, 'runtime_reexecuted': False, 'production_rollback_performed': False}


if __name__ == '__main__':
    try:
        print(json.dumps(restore(*sys.argv[1:]), sort_keys=True))
    except Exception as error:
        # ZIP metadata and remote bytes are untrusted data, not diagnostics.
        print('Release archive restoration failed: ' + type(error).__name__, file=sys.stderr)
        sys.exit(1)
