import fcntl
import hashlib
import json
import pathlib
import shutil
import sys

kind, source, target, artifacts, manifest = sys.argv[1:]
source_path = pathlib.Path(source)
digest = hashlib.sha256(source_path.read_bytes()).hexdigest()
destination_dir = pathlib.Path(artifacts)
destination_dir.mkdir(parents=True, exist_ok=True)
destination = destination_dir / (digest + (".so" if kind == "library" else ""))
shutil.copy2(source_path, destination)
if kind == "executable":
    source_path.unlink()

manifest_path = pathlib.Path(manifest)
lock_path = manifest_path.with_suffix(manifest_path.suffix + ".lock")
with lock_path.open("a") as lock_file:
    fcntl.flock(lock_file, fcntl.LOCK_EX)
    try:
        values = json.loads(manifest_path.read_text())
    except FileNotFoundError:
        values = {}
    values[target] = digest
    temporary_path = manifest_path.with_suffix(manifest_path.suffix + ".tmp")
    temporary_path.write_text(json.dumps(values, indent=2) + "\n")
    temporary_path.replace(manifest_path)
