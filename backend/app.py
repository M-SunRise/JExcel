from flask import Flask, request, jsonify, send_from_directory, send_file
import os
import sys
import uuid
import json
from io import BytesIO

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root_dir)

from backend.json_parser import JSONParser
from backend.excel_exporter import ExcelExporter
from backend.utils import read_file_with_encoding, detect_encoding
from config import Config

if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'frontend')
    static_folder = os.path.join(sys._MEIPASS, 'frontend')
else:
    template_folder = '../frontend'
    static_folder = '../frontend'

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
app.config['MAX_CONTENT_LENGTH'] = Config.JSON_SENSOR_MAX_SIZE

sessions = {}

os.makedirs(Config.get_upload_folder(), exist_ok=True)
os.makedirs(Config.get_export_folder(), exist_ok=True)

@app.route('/')
def index():
    if getattr(sys, 'frozen', False):
        return send_from_directory(os.path.join(sys._MEIPASS, 'frontend'), 'index.html')
    return send_from_directory('../frontend', 'index.html')

@app.route('/static/<path:filename>')
def serve_static(filename):
    if getattr(sys, 'frozen', False):
        return send_from_directory(os.path.join(sys._MEIPASS, 'frontend'), filename)
    return send_from_directory('../frontend', filename)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "没有文件"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "没有选择文件"}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.json', '.txt']:
        return jsonify({"success": False, "error": "只支持 .json 和 .txt 文件"}), 400

    session_id = str(uuid.uuid4())

    file_content = file.read()
    content = read_file_with_encoding(file_content) if isinstance(file_content, bytes) else file_content

    parser = JSONParser()
    success, message = parser.parse(content)

    if not success:
        return jsonify({"success": False, "error": message}), 400

    sessions[session_id] = {
        'parser': parser,
        'data': parser.data,
        'content': content,
        'file_name': file.filename,
        'column_mapping': {},
        'code_mappings': {},
        'selected_fields': []
    }

    field_tree = parser.get_field_tree()
    return jsonify({
        "success": True,
        "session_id": session_id,
        "file_name": file.filename,
        "record_count": parser.record_count,
        "field_count": len(parser.fields),
        "field_tree": field_tree
    })

@app.route('/api/fields', methods=['GET'])
def get_fields():
    session_id = request.args.get('session_id')
    if session_id not in sessions:
        return jsonify({"success": False, "error": "会话过期"}), 400

    session = sessions[session_id]
    return jsonify({
        "success": True,
        "field_tree": session['parser'].get_field_tree()
    })

@app.route('/api/select-fields', methods=['POST'])
def select_fields():
    data = request.json
    session_id = data.get('session_id')
    selected_fields = data.get('selected_fields', [])
    column_mapping = data.get('column_mapping', {})
    code_mappings = data.get('code_mappings', {})

    if session_id not in sessions:
        return jsonify({"success": False, "error": "会话过期"}), 400

    sessions[session_id]['selected_fields'] = selected_fields
    sessions[session_id]['column_mapping'] = column_mapping
    if 'code_mappings' not in sessions[session_id]:
        sessions[session_id]['code_mappings'] = {}
    sessions[session_id]['code_mappings'].update(code_mappings)

    return jsonify({"success": True})

@app.route('/api/preview', methods=['POST'])
def get_preview():
    data = request.json
    session_id = data.get('session_id')
    if session_id not in sessions:
        return jsonify({"success": False, "error": "会话过期"}), 400

    selected = data.get('selected_fields', [])
    column_mapping = data.get('column_mapping', {})
    code_mappings = data.get('code_mappings', {})

    session = sessions[session_id]
    session['selected_fields'] = selected
    session['column_mapping'] = column_mapping
    if code_mappings:
        session.setdefault('code_mappings', {}).update(code_mappings)

    # 优先使用缓存的解析后数据，避免重复 parse 整个 JSON 字符串
    data_obj = session.get('data')
    parser = session['parser']

    if data_obj is None:
        # 兜底：缓存被清理时重新解析
        parse_success, parse_message = parser.parse(session['content'])
        if not parse_success:
            return jsonify({"success": False, "error": parse_message}), 400
        data_obj = parser.data
        session['data'] = data_obj

    if not selected:
        selected = list(parser.fields.keys())

    preview_data = parser.flatten_data(
        data_obj, selected, column_mapping,
        session.get('code_mappings', {}),
        limit=Config.PREVIEW_ROWS
    )

    headers = []
    if preview_data:
        headers = list(preview_data[0].keys())

    return jsonify({
        "success": True,
        "preview": preview_data,
        "headers": headers
    })

@app.route('/api/export', methods=['POST'])
def export_excel():
    data = request.json
    session_id = data.get('session_id')
    output_filename = data.get('filename', 'export.xlsx')
    code_mappings = data.get('code_mappings', {})

    if session_id not in sessions:
        return jsonify({"success": False, "error": "会话过期"}), 400

    session = sessions[session_id]

    # 优先使用缓存的解析后数据
    data_obj = session.get('data')
    parser = session['parser']

    if data_obj is None:
        parse_success, parse_message = parser.parse(session['content'])
        if not parse_success:
            return jsonify({"success": False, "error": parse_message}), 400
        data_obj = parser.data
        session['data'] = data_obj

    selected = session.get('selected_fields', [])
    mapping = session.get('column_mapping', {})

    if not selected:
        selected = list(parser.fields.keys())

    final_code_mappings = {**session.get('code_mappings', {}), **code_mappings}

    # 统一使用 session 中的 parser 进行扁平化（确保数组展开逻辑与预览一致）
    flat_data = parser.flatten_data(
        data_obj, selected, mapping, code_mappings=final_code_mappings
    )

    exporter = ExcelExporter()
    result = exporter.export(
        flat_data=flat_data,
        output_path=None,
        auto_width=True
    )

    if result['success']:
        buffer = result.pop('buffer')
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=output_filename
        )

    return jsonify(result)

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(Config.get_export_folder(), filename)

@app.route('/api/system/info', methods=['GET'])
def system_info():
    import psutil
    return jsonify({
        "memory": psutil.virtual_memory().percent,
        "cpu": psutil.cpu_percent()
    })

def create_app():
    return app
