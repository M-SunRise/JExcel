import os
import tempfile

class Config:
    SECRET_KEY = os.urandom(24)
    JSON_SENSOR_MAX_SIZE = 100 * 1024 * 1024
    PREVIEW_ROWS = 10
    MAX_EXPORT_ROWS = 1000000

    _temp_dir = tempfile.gettempdir()

    @staticmethod
    def get_upload_folder():
        return os.path.join(Config._temp_dir, 'jsonExcel_uploads')

    @staticmethod
    def get_export_folder():
        return os.path.join(Config._temp_dir, 'jsonExcel_exports')
