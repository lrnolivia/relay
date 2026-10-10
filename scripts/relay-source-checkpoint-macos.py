"""macOS descriptor primitives for the existing bounded source checkpoint adapter."""
import base64
import fcntl
import json
import os
import stat
import sys


def descriptor_path(fd):
    if sys.platform != 'darwin' or not hasattr(fcntl, 'F_GETPATH'):
        raise ValueError('Native macOS descriptor verification is unavailable')
    return os.fsdecode(fcntl.fcntl(fd, fcntl.F_GETPATH, b'\0' * 1024).split(b'\0', 1)[0])


def restore(root, files):
    # Node has already validated the complete bundle and created this fresh root.
    if not os.path.isabs(root) or os.path.realpath(root) != root or len(files) > 64:
        raise ValueError('Invalid fresh restore root or inventory')
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    root_fd = os.open(root, flags)
    try:
        root_stat = os.fstat(root_fd)
        if descriptor_path(root_fd) != root or root_stat.st_uid != os.getuid() or stat.S_IMODE(root_stat.st_mode) != 0o700:
            raise ValueError('Restore root descriptor identity changed')
        for entry in files:
            parts = entry['path'].split('/')
            if not parts or any(p in ('', '.', '..') or '\\' in p or '\0' in p for p in parts):
                raise ValueError('Unsafe restore source path')
            if entry['kind'] == 'deleted':
                continue
            if entry['kind'] != 'file' or entry['mode'] not in (0o644, 0o755):
                raise ValueError('Unsupported source entry')
            data = base64.b64decode(entry['data'], validate=True)
            if len(data) != entry['size'] or len(data) > 128 * 1024:
                raise ValueError('Source size mismatch')
            parents = []
            try:
                parent = root_fd
                for i, part in enumerate(parts[:-1]):
                    if descriptor_path(parent) != os.path.join(root, *parts[:i]):
                        raise ValueError('Restore parent descriptor changed')
                    try:
                        os.mkdir(part, 0o700, dir_fd=parent)
                    except FileExistsError:
                        pass
                    parent = os.open(part, flags, dir_fd=parent)
                    parents.append(parent)
                    if descriptor_path(parent) != os.path.join(root, *parts[:i + 1]):
                        raise ValueError('Restore parent descriptor changed')
                if descriptor_path(parent) != os.path.join(root, *parts[:-1]):
                    raise ValueError('Restore parent descriptor changed')
                fd = os.open(parts[-1], os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, entry['mode'], dir_fd=parent)
                try:
                    opened = os.fstat(fd)
                    if descriptor_path(fd) != os.path.join(root, *parts) or not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1:
                        raise ValueError('Restore file descriptor changed; no source bytes written')
                    remaining = memoryview(data)
                    while remaining:
                        written = os.write(fd, remaining)
                        if written <= 0:
                            raise ValueError('Incomplete source write')
                        remaining = remaining[written:]
                    os.fchmod(fd, entry['mode'])
                finally:
                    os.close(fd)
            finally:
                for fd in reversed(parents):
                    os.close(fd)
    finally:
        os.close(root_fd)


def main():
    if len(sys.argv) != 2:
        raise ValueError('Invalid helper invocation')
    operation = sys.argv[1]
    if operation == 'probe':
        if sys.platform != 'darwin' or sys.version_info < (3, 9) or not hasattr(fcntl, 'F_GETPATH') or os.open not in os.supports_dir_fd or os.mkdir not in os.supports_dir_fd:
            raise ValueError('macOS checkpoint primitives are unavailable')
        print(json.dumps({'platform': sys.platform, 'python': sys.version.split()[0], 'executable': os.path.realpath(sys.executable), 'descriptor_identity': 'F_GETPATH', 'anchored_creation': True}))
    elif operation == 'descriptor':
        print(json.dumps({'path': descriptor_path(3)}))
    elif operation == 'restore':
        raw = sys.stdin.buffer.read(256 * 1024 + 1)
        if len(raw) > 256 * 1024:
            raise ValueError('Restore input exceeds bound')
        request = json.loads(raw)
        restore(request['root'], request['files'])
        print(json.dumps({'restored': True}))
    else:
        raise ValueError('Unsupported helper operation')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Paths, file bytes and remote input must never become diagnostics.
        print('macOS checkpoint descriptor operation failed', file=sys.stderr)
        sys.exit(1)
