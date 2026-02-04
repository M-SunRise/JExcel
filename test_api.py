import sys
import os
import json
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app import create_app
from backend.json_parser import JSONParser
from backend.excel_exporter import ExcelExporter

def test_api():
    app = create_app()
    app.config['TESTING'] = True

    with app.test_client() as client:
        test_data = [
            {"name": "张三", "age": 25, "city": "北京"},
            {"name": "李四", "age": 30, "city": "上海"}
        ]

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(test_data, f)
            temp_path = f.name

        with open(temp_path, 'rb') as f:
            response = client.post('/api/upload', data={'file': f})

        result = json.loads(response.data)
        print('Upload response:', result)

        if result.get('success'):
            session_id = result['session_id']
            print('Session ID:', session_id)
            print('Field tree:', json.dumps(result.get('field_tree', []), ensure_ascii=False, indent=2))

            preview_resp = client.get(f'/api/preview?session_id={session_id}')
            preview_result = json.loads(preview_resp.data)
            print('Preview response:', json.dumps(preview_result, ensure_ascii=False, indent=2))

        os.unlink(temp_path)

if __name__ == '__main__':
    test_api()
