import json
import chardet
from typing import Any, Dict, List, Set, Tuple, Optional
from collections import defaultdict


class JSONParser:
    def __init__(self):
        self.data = None
        self.structure = None
        self.fields = {}
        self.field_types = {}
        self.record_count = 0

    def parse(self, content: str) -> Tuple[bool, str]:
        try:
            self.data = self._parse_content(content)

            if self.data is None:
                return False, "无法解析JSON数据"

            if not isinstance(self.data, list):
                self.data = [self.data]

            self._analyze_structure()
            self.record_count = self._count_expanded_records(list(self.fields.keys()))

            return True, "解析成功"
        except json.JSONDecodeError as e:
            return False, f"JSON解析错误: {str(e)}"
        except Exception as e:
            return False, f"解析失败: {str(e)}"

    def _parse_content(self, content: str) -> Any:
        stripped = content.strip()
        if not stripped:
            return None
        if stripped.startswith('[') and stripped.endswith(']'):
            return json.loads(stripped)
        elif stripped.startswith('{') and stripped.endswith('}'):
            return json.loads(stripped)
        else:
            lines = stripped.split('\n')
            records = []
            for line in lines:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
            return records if records else None

    def _count_expanded_records(self, selected_fields: List[str]) -> int:
        if not self.data:
            return 0
        total = 0
        for record in self.data:
            expanded = self._expand_record_with_arrays(record, selected_fields)
            total += len(expanded)
        return total

    def _analyze_structure(self) -> None:
        self.fields = {}
        self.field_types = {}

        all_paths = set()
        for record in self.data:
            paths = self._extract_paths(record)
            all_paths.update(paths)

        for path in sorted(all_paths):
            self._get_field_info(path)

    def _extract_paths(self, obj: Any, prefix: str = '') -> Set[str]:
        paths = set()
        stack = [(obj, prefix, 0)]
        max_depth = 15

        while stack:
            current, path_prefix, depth = stack.pop()
            if depth > max_depth:
                continue

            if isinstance(current, dict):
                for key, value in current.items():
                    full_path = f"{path_prefix}.{key}" if path_prefix else key
                    if full_path not in paths:
                        paths.add(full_path)
                        if isinstance(value, (dict, list)):
                            stack.append((value, full_path, depth + 1))

            elif isinstance(current, list):
                for item in current:
                    stack.append((item, path_prefix, depth + 1))

        return paths

    def _get_field_info(self, path: str) -> None:
        sample_values = []

        for record in self.data[:10]:
            value = self._get_value_by_path(record, path)
            if value is not None:
                sample_values.append(value)

        if not sample_values:
            field_type = 'string'
        else:
            first_value = sample_values[0]
            if isinstance(first_value, bool):
                field_type = 'boolean'
            elif isinstance(first_value, int):
                field_type = 'integer'
            elif isinstance(first_value, float):
                field_type = 'float'
            elif isinstance(first_value, str):
                field_type = 'string'
            elif isinstance(first_value, list):
                field_type = 'array'
            elif isinstance(first_value, dict):
                field_type = 'object'
            else:
                field_type = 'string'

        self.fields[path] = {'type': field_type}

    def _get_value_by_path(self, obj: Any, path: str) -> Any:
        keys = path.split('.')
        current = obj

        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            elif isinstance(current, list) and len(current) > 0:
                if isinstance(current[0], dict):
                    current = current[0].get(key)
                else:
                    return None
            else:
                return None

        return current

    def flatten_data(self, data: Any, selected_fields: List[str],
                      column_mapping: Dict[str, str],
                      code_mappings: Optional[Dict[str, Dict[str, str]]] = None,
                      limit: Optional[int] = None) -> List[Dict]:
        if not data:
            return []

        if not isinstance(data, list):
            data = [data]

        result = []
        code_mappings = code_mappings or {}

        for record in data:
            if limit and len(result) >= limit:
                break
            expanded = self._expand_record_with_arrays(
                record, selected_fields, limit=(limit - len(result)) if limit else None
            )
            for flat in expanded:
                new_record = {}
                for path, value in flat.items():
                    col_name = column_mapping.get(path, path.split('.')[-1])
                    mapped_value = self._apply_code_mapping(value, path, code_mappings)
                    if isinstance(mapped_value, (dict, list)):
                        mapped_value = json.dumps(mapped_value, ensure_ascii=False)
                    new_record[col_name] = mapped_value
                result.append(new_record)
                if limit and len(result) >= limit:
                    return result

        return result

    def _apply_code_mapping(self, value: Any, path: str,
                           code_mappings: Dict[str, Dict[str, str]]) -> Any:
        if value is None or value == '':
            return value

        str_value = str(value)

        field_mappings = code_mappings.get(path, {})
        if str_value in field_mappings:
            return field_mappings[str_value]

        global_mappings = code_mappings.get('_global_', {})
        if str_value in global_mappings:
            return global_mappings[str_value]

        return value

    def _expand_record_with_arrays(self, record: Dict, selected_fields: List[str],
                                    limit: Optional[int] = None) -> List[Dict]:
        array_paths = self._find_array_paths(selected_fields)

        if not array_paths:
            return [self._flatten_single_record(record, selected_fields)]

        deepest_array_path = max(array_paths, key=lambda p: len(p.split('.')))
        array_items = self._get_array_items(record, deepest_array_path)

        if not array_items:
            return [self._flatten_single_record(record, selected_fields)]

        expanded_records = []
        for idx, item in enumerate(array_items):
            if limit and len(expanded_records) >= limit:
                break
            if isinstance(item, dict):
                new_record = self._merge_array_item(record, deepest_array_path, item)
                flattened = self._flatten_single_record(new_record, selected_fields)
                expanded_records.append(flattened)
            else:
                expanded_records.append(self._flatten_single_record(record, selected_fields))

        return expanded_records

    def _find_array_paths(self, selected_fields: List[str]) -> Set[str]:
        array_paths = set()

        for field in selected_fields:
            path_parts = field.split('.')
            for i, part in enumerate(path_parts[:-1]):
                potential_path = '.'.join(path_parts[:i + 1])
                if self._is_array_placeholder(potential_path):
                    array_paths.add(potential_path)

        return array_paths

    def _is_array_placeholder(self, path: str) -> bool:
        if not self.data:
            return False

        for record in self.data[:5]:
            current = record
            parts = path.split('.')
            last_value = None

            try:
                for part in parts:
                    if isinstance(current, dict) and part in current:
                        last_value = current[part]
                        current = current[part]
                    elif isinstance(current, list):
                        if len(current) > 0:
                            last_value = current[0]
                            current = current[0]
                        else:
                            current = None
                            last_value = None
                    else:
                        current = None
                        last_value = None
                        break

                if current is not None and isinstance(current, list):
                    return True
            except:
                continue

        return False

    def _get_array_items(self, record: Dict, array_path: str) -> List:
        parts = array_path.split('.')
        current = record

        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return []

        if isinstance(current, list):
            return current
        return []

    def _merge_array_item(self, record: Dict, array_path: str, item: Any) -> Dict:
        parts = array_path.split('.')
        new_record = dict(record)

        current_new = new_record
        for part in parts[:-1]:
            current_new[part] = dict(current_new[part])
            current_new = current_new[part]

        current_new[parts[-1]] = item
        return new_record

    def _flatten_single_record(self, record: Dict, selected_fields: List[str]) -> Dict:
        flat_record = {}

        for field in selected_fields:
            value = self._get_value_by_path_expanded(record, field)

            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False)

            flat_record[field] = value

        return flat_record

    def _get_value_by_path_expanded(self, obj: Any, path: str) -> Any:
        keys = path.split('.')
        current = obj

        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            elif isinstance(current, list):
                idx = 0
                if key.isdigit():
                    idx = int(key)
                if idx < len(current):
                    current = current[idx]
                else:
                    return None
            else:
                return None

        return current

    def _format_value(self, value: Any) -> Any:
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return value

    def get_field_tree(self) -> List[Dict]:
        paths_by_parent = defaultdict(list)
        for path in self.fields.keys():
            parts = path.split('.')
            if len(parts) == 1:
                paths_by_parent[''].append(path)
            else:
                paths_by_parent['.'.join(parts[:-1])].append(path)

        def build_node(parent_path: str) -> List[Dict]:
            result = []
            for path in paths_by_parent.get(parent_path, []):
                parts = path.split('.')
                name = parts[-1]
                children = build_node(path)
                result.append({
                    'name': name,
                    'path': path,
                    'type': self.fields.get(path, {}).get('type', 'string'),
                    'expanded': False,
                    'hasChildren': len(children) > 0,
                    'children': children
                })
            return result

        return build_node('')
