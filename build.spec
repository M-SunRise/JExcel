# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from pathlib import Path

try:
    project_root = os.path.abspath(os.path.dirname(__file__))
except NameError:
    project_root = os.path.abspath('.')

dist_path = os.path.join(project_root, 'dist')

# Add conda library bin to PATH so PyInstaller can find native DLLs
conda_prefix = os.path.dirname(os.path.dirname(sys.executable))
library_bin = os.path.join(conda_prefix, 'Library', 'bin')
os.environ['PATH'] = library_bin + os.pathsep + os.environ.get('PATH', '')
if hasattr(os, 'add_dll_directory'):
    try:
        os.add_dll_directory(library_bin)
    except Exception:
        pass

added_files = [
    ('frontend', 'frontend'),
    ('resources', 'resources'),
]

hidden_imports = [
    'flask',
    'openpyxl',
    'chardet',
    'pathlib',
    'psutil',
    'PIL',
    'PIL.Image',
    'PIL.ImageDraw',
    'pystray',
    'pystray._win32',
]

excludes = [
    'pkg_resources',
    'torch', 'torchvision', 'torchaudio',
    'tensorflow', 'tensorboard',
    'transformers', 'datasets', 'tokenizers',
    'scipy', 'scipy.special', 'scipy.linalg', 'scipy.sparse',
    'scipy.stats', 'scipy.io', 'scipy.optimize',
    'scipy.signal', 'scipy.spatial', 'scipy.integrate',
    'sklearn', 'sklearn.cluster', 'sklearn.ensemble',
    'sklearn.metrics', 'sklearn.neighbors', 'sklearn.tree',
    'sklearn.linear_model', 'sklearn.utils',
    'matplotlib', 'seaborn', 'plotly',
    'pyarrow', 'fastparquet',
    'dask', 'distributed',
    'fsspec', 'gcsfs', 's3fs',
    'boto3', 'botocore',
    'zmq', 'pyzmq',
    'notebook', 'jupyter_client', 'ipykernel',
    'tornado',
    'greenlet',
    'pip', 'wheel',
]

a = Analysis(
    ['main.py'],
    pathex=[project_root],
    binaries=[],
    datas=added_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[os.path.join(project_root, 'rthook_add_dll_path.py')],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='JExcel',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='resources/JExcel.ico',
)

if sys.platform == 'win32':
    import PyInstaller.config
    PyInstaller.config.CONF['workpath'] = os.path.join(project_root, 'build')
