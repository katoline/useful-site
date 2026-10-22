"""検証済みのGifsicle 1.98から、既存APIを維持するローカル配布物を作る。"""

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import tarfile
import tempfile


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("upstream_package", type=Path)
parser.add_argument("runtime", type=Path)
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()

expected_package = "f2j2QXvryrxake2DdeAaI96LfZ8adb62UUs9C2eNuQiTDiysh9aBPmyw1Q8fHe+x+is+RHXDEXvVQSELONwmhw=="
if base64.b64encode(hashlib.sha512(args.upstream_package.read_bytes()).digest()).decode() != expected_package:
    raise SystemExit("Upstream npm integrity mismatch")
if hashlib.sha256(args.source.read_bytes()).hexdigest() != "8620d29336b555a4c122d8c736c41900706d61e77ecade2d9051d114a92d0626":
    raise SystemExit("Official Gifsicle source hash mismatch")

# ブラウザ側の既存APIは残し、古いWASMとその実行用glueをまとめて交換する。
worker = args.runtime.read_text() + r"""
self.onmessage = async ({data: request}) => {
  try {
    const module = await GifsicleModule({
      noInitialRun: true,
      print: (line) => console.log(line),
      printErr: () => {},
    });
    module.FS.mkdir('/out');
    module.FS.mkdir('/tem');
    for (const folder of request.folder || []) module.FS.mkdirTree(folder);
    for (const input of request.data || []) {
      module.FS.writeFile('/' + input.name, new Uint8Array(input.file));
    }
    for (const command of request.command || []) {
      const status = module.callMain(command.trim().split(/\s+/));
      if (status !== 0) throw new Error('GIF processing failed');
    }
    const outputs = module.FS.readdir('/out')
      .filter((name) => name !== '.' && name !== '..')
      .map((name) => ({name, file: module.FS.readFile('/out/' + name)}));
    self.postMessage(outputs);
  } catch {
    self.postMessage(null);
  }
};
"""

with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    with tarfile.open(args.upstream_package) as archive:
        archive.extractall(root, filter="data")
    package = root / "package"
    metadata_path = package / "package.json"
    metadata = json.loads(metadata_path.read_text())
    if metadata["name"] != "gifsicle-wasm-browser" or metadata["version"] != "1.5.19":
        raise SystemExit("Unexpected upstream package")
    metadata["version"] = "1.5.19-security.1"
    metadata["x-katoline-gifsicle-version"] = "1.98"
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
    entry = package / "dist" / "gifsicle.min.js"
    source = entry.read_text()
    start_marker = "workerLocalUrl:'"
    end_marker = "',workerBlobUrl:"
    if source.count(start_marker) != 1 or source.count(end_marker) != 1:
        raise SystemExit("Unexpected upstream worker layout")
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    entry.write_text(source[:start] + "workerLocalUrl:" + json.dumps(worker) + source[end + 1:])
    # GPLの対応ソースとビルド手順を同梱する。古いWASMは配布物に残さない。
    (package / "source").mkdir(exist_ok=True)
    (package / "source" / "gifsicle-1.98.tar.gz").write_bytes(args.source.read_bytes())
    with tarfile.open(args.source) as archive:
        copying = next(member for member in archive.getmembers() if member.name.endswith("/COPYING"))
        (package / "LICENSE.gifsicle").write_bytes(archive.extractfile(copying).read())
    (package / "SECURITY-PATCH.md").write_text(
        "ローカルセキュリティビルド（上流npmリリースではありません）。\n\n"
        "Gifsicle 1.98: 8ff3057b736141b406be621830b851fdf4285689\n"
        "Emscripten 3.1.45: c8dcb45665fec5e743336703f1d22a191810f2a8\n\n"
        "1.92のWASMとglueを両方交換し、1.98のメモリ安全性修正を取り込みます。\n"
        "対応ソースはsource/gifsicle-1.98.tar.gz、ライセンスはLICENSE.gifsicle。\n"
        "再ビルドはkatoline/useful-siteの.github/workflows/rebuild-gif-codec.ymlと\n"
        "scripts/package-gif-security.pyを参照してください。\n"
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
