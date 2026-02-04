import pandas as pd
import os
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, Fill, PatternFill, Border, Side, Alignment
from openpyxl.utils.dataframe import dataframe_to_rows
from typing import List, Dict, Any, Optional, Union
from backend.json_parser import JSONParser

class ExcelExporter:
    HEADER_FILL = PatternFill(start_color="1E90FF", end_color="1E90FF", fill_type="solid")
    HEADER_FONT = Font(color="FFFFFF", bold=True)
    CELL_ALIGNMENT = Alignment(horizontal="left", vertical="center")
    BORDER = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC")
    )

    def __init__(self):
        pass

    def export(self, data: Any, column_mapping: Dict[str, str], output_path: Optional[str] = None,
               selected_fields: Optional[List[str]] = None,
               auto_width: bool = True,
               code_mappings: Optional[Dict[str, Dict[str, str]]] = None) -> Dict[str, Any]:
        try:
            parser = JSONParser()
            parser.data = data if isinstance(data, list) else [data]
            parser.fields = {}
            parser.field_types = {}

            all_paths = set()
            for record in parser.data:
                paths = parser._extract_paths(record)
                all_paths.update(paths)

            for path in sorted(all_paths):
                sample_values = []
                for record in parser.data[:10]:
                    value = parser._get_value_by_path(record, path)
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
                    parser.fields[path] = {'type': field_type}

            flat_data = parser.flatten_data(data, selected_fields or [], column_mapping, code_mappings)

            if not flat_data:
                return {"success": False, "error": "没有可导出的数据"}

            df = pd.DataFrame(flat_data)

            if df.empty:
                return {"success": False, "error": "数据为空"}

            rows = dataframe_to_rows(df, index=False, header=True)
            wb = Workbook()
            ws = wb.active
            ws.title = "Data"

            for r_idx, row in enumerate(rows, 1):
                for c_idx, value in enumerate(row, 1):
                    cell = ws.cell(row=r_idx, column=c_idx, value=value)
                    cell.alignment = self.CELL_ALIGNMENT
                    cell.border = self.BORDER

                    if r_idx == 1:
                        cell.fill = self.HEADER_FILL
                        cell.font = self.HEADER_FONT

            if auto_width:
                for column in ws.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            cell_value = str(cell.value)
                            if len(cell_value) > max_length:
                                max_length = len(cell_value)
                        except:
                            pass
                    adjusted_width = min(max_length + 2, 50)
                    ws.column_dimensions[column_letter].width = adjusted_width

            ws.freeze_panes = "A2"

            if output_path:
                wb.save(output_path)
                return {
                    "success": True,
                    "rows": len(flat_data),
                    "columns": len(df.columns),
                    "path": output_path
                }
            else:
                buffer = BytesIO()
                wb.save(buffer)
                buffer.seek(0)
                return {
                    "success": True,
                    "rows": len(flat_data),
                    "columns": len(df.columns),
                    "buffer": buffer
                }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def generate_preview(self, data: Any, column_mapping: Dict[str, str],
                        selected_fields: Optional[List[str]] = None,
                        limit: int = 10,
                        code_mappings: Optional[Dict[str, Dict[str, str]]] = None) -> List[Dict]:
        parser = JSONParser()
        parser.data = data if isinstance(data, list) else [data]
        flat_data = parser.flatten_data(data, selected_fields or [], column_mapping, code_mappings)
        return flat_data[:limit]
