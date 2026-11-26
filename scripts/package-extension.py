"""Create the public download ZIP with extension files at the archive root."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

source = Path('.pages/files')
target = Path('.pages/glasstab-extension.zip')
with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(source).as_posix())

print(f'Packaged {target}')
