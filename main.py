import os
import sys
import webbrowser
import threading
import time
import tempfile
from io import BytesIO
from backend.app import create_app

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SERVER_URL = 'http://127.0.0.1:5000'

def log_debug(message):
    try:
        log_path = os.path.join(tempfile.gettempdir(), 'JExcel_debug.log')
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {message}\n")
    except Exception:
        pass

log_debug(f"Python: {sys.version}")
log_debug(f"Frozen: {getattr(sys, 'frozen', False)}")
log_debug(f"Executable: {sys.executable}")
log_debug(f"CWD: {os.getcwd()}")

HAS_TRAY = False
PIL_AVAILABLE = False
PYSTRAY_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
    log_debug("PIL imported successfully")
except ImportError as e:
    log_debug(f"PIL import failed: {e}")

try:
    import pystray
    PYSTRAY_AVAILABLE = True
    log_debug("pystray imported successfully")
except ImportError as e:
    log_debug(f"pystray import failed: {e}")

HAS_TRAY = PIL_AVAILABLE and PYSTRAY_AVAILABLE
log_debug(f"HAS_TRAY: {HAS_TRAY}")

def get_icon_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    if getattr(sys, 'frozen', False):
        icon_path = os.path.join(sys._MEIPASS, 'resources', 'JExcel.ico')
        if not os.path.exists(icon_path):
            icon_path = os.path.join(base_dir, 'resources', 'JExcel.ico')
    else:
        icon_path = os.path.join(base_dir, 'resources', 'JExcel.ico')
    log_debug(f"Icon path: {icon_path}, exists: {os.path.exists(icon_path)}")
    return icon_path

def load_icon_image():
    icon_path = get_icon_path()
    
    if os.path.exists(icon_path):
        try:
            img = Image.open(icon_path)
            img = img.convert('RGBA')
            log_debug(f"Icon loaded from file: {icon_path}")
            return img
        except Exception as e:
            log_debug(f"Failed to load icon from file: {e}")
    
    log_debug("Using default icon")
    if PIL_AVAILABLE:
        return Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    return None

def create_tray_icon():
    log_debug("create_tray_icon called")
    
    if not HAS_TRAY:
        log_debug("HAS_TRAY is False, skipping tray")
        return

    icon_image = load_icon_image()
    if icon_image is None:
        log_debug("icon_image is None, skipping tray")
        return

    log_debug("Creating pystray icon...")

    def on_open_website(icon, item):
        log_debug("on_open_website called")
        webbrowser.open(SERVER_URL)

    def on_exit(icon, item):
        log_debug("on_exit called")
        icon.stop()
        os._exit(0)

    menu = pystray.Menu(
        pystray.MenuItem('打开网页', on_open_website),
        pystray.MenuItem('退出', on_exit)
    )

    icon = pystray.Icon('JExcel', icon_image, 'JExcel', menu)
    log_debug("Starting icon.run()")
    icon.run()

def open_browser():
    time.sleep(1)
    webbrowser.open(SERVER_URL)

def main():
    log_debug("main() started")
    threading.Timer(1, open_browser).start()
    app = create_app()
    try:
        app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
    except KeyboardInterrupt:
        pass
    log_debug("main() ended")

if __name__ == '__main__':
    log_debug("__name__ == __main__")
    log_debug(f"HAS_TRAY={HAS_TRAY}")
    
    if HAS_TRAY:
        log_debug("Starting tray thread...")
        tray_thread = threading.Thread(target=create_tray_icon, daemon=True)
        tray_thread.start()
        log_debug(f"Tray thread started, is_alive: {tray_thread.is_alive()}")
    else:
        log_debug("Tray not available, skipping")
    
    main()
