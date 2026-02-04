# JSON转Excel工具

一个现代化的Windows桌面应用程序，用于将JSON数据转换为Excel格式。

## 功能特性

- **文件加载**：支持拖拽和点击选择JSON/TXT文件，自动检测编码格式
- **结构解析**：自动提取字段路径，识别数据类型，构建层级树
- **字段选择**：支持单选、全选、批量选择，级联联动
- **列名自定义**：双击字段名可自定义Excel列名
- **数据预览**：实时预览转换效果
- **Excel导出**：支持格式化输出，自动列宽调整

## 安装与运行

1. 创建conda环境（已存在）：
```bash
conda activate json-to-excel
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

3. 运行程序：
```bash
python main.py
```

程序启动后会自动打开浏览器访问 http://127.0.0.1:5000

## 项目结构

```
jsonExcel/
├── main.py              # 程序入口
├── config.py            # 配置文件
├── requirements.txt    # 依赖列表
├── test_data.json      # 测试数据
├── backend/
│   ├── __init__.py
│   ├── app.py          # Flask应用
│   ├── json_parser.py  # JSON解析模块
│   ├── excel_exporter.py # Excel导出模块
│   └── utils.py        # 工具函数
├── frontend/
│   ├── index.html      # 主页面
│   ├── css/
│   │   └── style.css   # 样式文件
│   └── js/
│       └── app.js      # 前端逻辑
├── uploads/            # 上传文件目录
└── exports/           # 导出文件目录
```

## 技术栈

- 后端：Python 3.11 + Flask
- 数据处理：Pandas + OpenPyXL
- 编码检测：Chardet
- 前端：HTML5 + CSS3 + JavaScript
