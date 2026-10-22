"""Repack @jsquash/webp with the verified, rebuilt libwebp codec (no npm publish)."""

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import tempfile


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("upstream_package", type=Path)
parser.add_argument("codec", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()

expected = "KggLoj2MnRSfIqTeKe1EmbljTX2vuV7mh79k89PCL1pyqiDULcPM1L47twxXt0hkb68F70bXiL31MxsuoZtKFw=="
actual = base64.b64encode(hashlib.sha512(args.upstream_package.read_bytes()).digest()).decode()
if actual != expected:
    raise SystemExit("Upstream npm package integrity mismatch")

with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    with tarfile.open(args.upstream_package, "r:gz") as archive:
        archive.extractall(root, filter="data")
    package = root / "package"
    metadata_path = package / "package.json"
    metadata = json.loads(metadata_path.read_text())
    if metadata["name"] != "@jsquash/webp" or metadata["version"] != "1.5.0":
        raise SystemExit("Unexpected upstream package")
    metadata["version"] = "1.5.0-security.1"
    metadata["x-katoline-libwebp-version"] = "1.6.0"
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")

    for directory, stem in [("enc", "webp_enc"), ("dec", "webp_dec")]:
        for extension in ["js", "wasm"]:
            filename = f"{stem}.{extension}"
            shutil.copyfile(args.codec / directory / filename, package / "codec" / directory / filename)
    # Baseline only: never fall back to an old SIMD encoder from the npm package.
    encode_path = package / "encode.js"
    encode = encode_path.read_text()
    encode = encode.replace("import { simd } from 'wasm-feature-detect';\n", "")
    start = encode.index("    if (await simd()) {")
    end = encode.index("    const webpEncoder = await import('./codec/enc/webp_enc.js');", start)
    encode_path.write_text(encode[:start] + encode[end:])
    for obsolete in (package / "codec" / "enc").glob("webp_enc_simd.*"):
        obsolete.unlink()
    (package / "SECURITY-PATCH.md").write_text(
        "Local security build, not an upstream npm release.\n\n"
        "libwebp 1.6.0: 4fa21912338357f89e4fd51cf2368325b59e9bd9\n"
        "jSquash glue: 641dcc6b853382d57450466bd61b76f9d022242e\n"
        "Emscripten: 3.1.45\n\n"
        "Replaces both encoder and decoder, including fixes for CVE-2023-4863 "
        "and CVE-2023-1999. Uses the baseline encoder on all devices. "
        "Lossless/lossy APIs are preserved; SIMD acceleration is temporarily absent.\n"
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as output:
        with gzip.GzipFile(filename="", mode="wb", fileobj=output, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as archive:
                for path in sorted(package.rglob("*")):
                    info = archive.gettarinfo(str(path), str(path.relative_to(root)))
                    info.uid = info.gid = info.mtime = 0
                    info.uname = info.gname = ""
                    if path.is_file():
                        with path.open("rb") as source:
                            archive.addfile(info, source)
                    else:
                        archive.addfile(info)
print(hashlib.sha256(args.output.read_bytes()).hexdigest(), args.output)
