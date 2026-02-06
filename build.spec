# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from pathlib import Path

try:
    project_root = os.path.abspath(os.path.dirname(__file__))
except NameError:
    project_root = os.path.abspath('.')

dist_path = os.path.join(project_root, 'dist')

added_files = [
    ('frontend', 'frontend'),
    ('resources', 'resources'),
]

hidden_imports = [
    'flask',
    'flask.send_file',
    'pandas',
    'openpyxl',
    'chardet',
    'json',
    'pathlib',
    'psutil',
    'importlib.resources',
    'importlib.resources.files',
    'PIL',
    'PIL.Image',
    'PIL.ImageDraw',
    'pystray',
    'pystray._win32',
    'pystray._win32ffi',
    'ctypes',
    'ctypes.wintypes',
]

a = Analysis(
    ['main.py'],
    pathex=[project_root],
    binaries=[],
    datas=added_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pkg_resources'],
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
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='resources/JExcel.ico',
    distpath=dist_path,
)

if sys.platform == 'win32':
    import PyInstaller.config
    PyInstaller.config.CONF['workpath'] = os.path.join(project_root, 'build')
