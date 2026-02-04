import chardet
import os
from typing import Optional, Tuple, Union

def detect_encoding(data: Union[str, bytes]) -> Tuple[Optional[str], float]:
    if isinstance(data, str):
        return 'utf-8', 1.0
    result = chardet.detect(data[:1024 * 1024])
    return result.get('encoding'), result.get('confidence', 0)

def read_file_with_encoding(file_path_or_data: Union[str, bytes]) -> str:
    if isinstance(file_path_or_data, bytes):
        encoding, confidence = detect_encoding(file_path_or_data)
        if encoding is None:
            encoding = 'utf-8'
        try:
            return file_path_or_data.decode(encoding, errors='replace')
        except Exception:
            return file_path_or_data.decode('utf-8', errors='replace')
    else:
        encoding, confidence = detect_encoding(file_path_or_data)
        if encoding is None:
            encoding = 'utf-8'
        try:
            with open(file_path_or_data, 'r', encoding=encoding, errors='replace') as f:
                return f.read()
        except Exception:
            with open(file_path_or_data, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()

def format_file_size(size: float) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"

def sanitize_filename(filename: str) -> str:
    return "".join(c if c.isalnum() or c in '-_.' else '_' for c in filename)
