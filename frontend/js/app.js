// app.js - JSON转Excel工具前端逻辑

class JSONToExcelApp {
    constructor() {
        this.selectedFields = new Set();
        this.columnMapping = {};
        this.codeMappings = {};
        this.structure = [];
        this.currentFile = null;
        this.sessionId = null;
        this.lastPreviewData = null;
        this.lastPreviewFields = null;
    }

    init() {
        this.bindEvents();
        this.initTheme();
    }

    bindEvents() {
        const changeFileBtn = document.getElementById('change-file-btn');
        if (changeFileBtn) {
            changeFileBtn.onclick = () => this.resetFile();
        }

        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });
            dropZone.addEventListener('drop', (e) => this.handleFileDrop(e));
        }

        const selectAllBtn = document.getElementById('select-all-btn');
        if (selectAllBtn) {
            selectAllBtn.onclick = () => this.handleSelectAll();
        }

        const deselectAllBtn = document.getElementById('deselect-all-btn');
        if (deselectAllBtn) {
            deselectAllBtn.onclick = () => this.handleDeselectAll();
        }

        const expandAllBtn = document.getElementById('expand-all-btn');
        if (expandAllBtn) {
            expandAllBtn.onclick = () => this.handleExpandAll();
        }

        const collapseAllBtn = document.getElementById('collapse-all-btn');
        if (collapseAllBtn) {
            collapseAllBtn.onclick = () => this.handleCollapseAll();
        }

        const refreshBtn = document.getElementById('refresh-preview-btn');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.handleRefreshPreview();
        }

        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.onclick = () => this.handleExport();
        }

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.onclick = () => this.toggleTheme();
        }

        const closeModalBtn = document.getElementById('close-modal-btn');
        if (closeModalBtn) {
            closeModalBtn.onclick = () => this.closeCodeMappingModal();
        }

        const cancelModalBtn = document.getElementById('cancel-modal-btn');
        if (cancelModalBtn) {
            cancelModalBtn.onclick = () => this.closeCodeMappingModal();
        }

        const saveMappingBtn = document.getElementById('save-mapping-btn');
        if (saveMappingBtn) {
            saveMappingBtn.onclick = () => this.saveCodeMapping();
        }

        const addMappingBtn = document.getElementById('add-mapping-btn');
        if (addMappingBtn) {
            addMappingBtn.onclick = () => this.addMappingRuleRow();
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            await this.uploadFile(file);
        }
    }

    async handleFileDrop(e) {
        e.preventDefault();
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.classList.remove('drag-over');
        }
        const file = e.dataTransfer.files[0];
        if (file) {
            await this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        console.log('Uploading file:', file.name, 'size:', file.size);

        const ext = file.name.split('.').pop().toLowerCase();
        if (!['json', 'txt'].includes(ext)) {
            this.showToast('只支持 .json 和 .txt 文件', 'error');
            return;
        }

        this.showLoading('正在加载文件...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            console.log('Sending request to /api/upload');
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            console.log('Response status:', response.status);
            const result = await response.json();
            console.log('Response data:', result);

            if (result.success) {
                this.sessionId = result.session_id;
                this.structure = result.field_tree || [];
                this.selectedFields.clear();
                this.columnMapping = {};
                this.codeMappings = {};

                this.updateFileInfo(result.file_name, result.record_count);

                const fieldsSection = document.getElementById('fields-section');
                if (fieldsSection) fieldsSection.style.display = 'block';

                const codeMappingSection = document.getElementById('code-mapping-section');
                if (codeMappingSection) codeMappingSection.style.display = 'block';

                this.renderFieldTree();

                const emptyState = document.getElementById('empty-state');
                const previewSection = document.getElementById('preview-section');
                if (emptyState) emptyState.style.display = 'none';
                if (previewSection) previewSection.style.display = 'flex';

                this.updateStatus('已加载: ' + result.file_name, result.record_count);
                this.showToast('成功加载 ' + result.record_count + ' 条记录', 'success');

                setTimeout(() => this.handleSelectAll(), 100);
            } else {
                this.showToast(result.error || '加载失败', 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('网络错误: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleSelectAll() {
        const checkboxes = document.querySelectorAll('.field-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb && cb.dataset && cb.dataset.path) {
                cb.checked = true;
                this.selectedFields.add(cb.dataset.path);
            }
        });
        this.updateFieldCount();
        setTimeout(() => this.handleRefreshPreview(), 100);
    }

    handleDeselectAll() {
        const checkboxes = document.querySelectorAll('.field-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb) {
                cb.checked = false;
                if (cb.dataset && cb.dataset.path) {
                    this.selectedFields.delete(cb.dataset.path);
                }
            }
        });
        this.updateFieldCount();
    }

    handleExpandAll() {
        const expandIcons = document.querySelectorAll('.expand-icon');
        expandIcons.forEach(icon => {
            icon.classList.add('expanded');
            const childrenContainer = icon.closest('li').querySelector('.field-children');
            if (childrenContainer) {
                childrenContainer.style.display = 'block';
            }
        });
    }

    handleCollapseAll() {
        const expandIcons = document.querySelectorAll('.expand-icon');
        expandIcons.forEach(icon => {
            icon.classList.remove('expanded');
            const childrenContainer = icon.closest('li').querySelector('.field-children');
            if (childrenContainer) {
                childrenContainer.style.display = 'none';
            }
        });
    }

    async handleRefreshPreview() {
        if (!this.sessionId) {
            this.showToast('请先上传文件', 'warning');
            return;
        }

        if (this.selectedFields.size === 0) {
            this.showToast('请先选择字段', 'warning');
            return;
        }

        this.showLoading('正在生成预览...');

        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    selected_fields: Array.from(this.selectedFields),
                    column_mapping: this.columnMapping,
                    code_mappings: this.codeMappings
                })
            });
            const result = await response.json();

            if (result.success && result.preview) {
                this.lastPreviewData = result.preview;
                this.lastPreviewFields = result.headers || [];
                this.renderPreviewTable(result.preview, result.headers || []);
            } else {
                this.showToast('预览生成失败', 'error');
            }
        } catch (error) {
            console.error('Preview error:', error);
            this.showToast('预览失败: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleExport() {
        if (!this.sessionId) {
            this.showToast('请先上传文件', 'warning');
            return;
        }

        if (this.selectedFields.size === 0) {
            this.showToast('请先选择字段', 'warning');
            return;
        }

        this.showLoading('正在导出...');

        try {
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    filename: `export_${Date.now()}.xlsx`,
                    code_mappings: this.codeMappings
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = 'export.xlsx';
                if (contentDisposition && contentDisposition.includes('filename=')) {
                    filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
                }
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                this.showToast('导出成功!', 'success');
            } else {
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    this.showToast(errorJson.error || '导出失败', 'error');
                } catch {
                    this.showToast('导出失败: ' + errorText, 'error');
                }
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('导出失败: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    resetFile() {
        this.currentFile = null;
        this.sessionId = null;
        this.structure = [];
        this.selectedFields.clear();
        this.columnMapping = {};
        this.codeMappings = {};
        this.lastPreviewData = null;
        this.lastPreviewFields = null;

        const dropZoneContent = document.querySelector('.drop-zone-content');
        const fileInfo = document.getElementById('file-info');
        const fieldsSection = document.getElementById('fields-section');
        const fieldsContainer = document.getElementById('fields-container');
        const codeMappingSection = document.getElementById('code-mapping-section');
        const codeMappingContainer = document.getElementById('code-mapping-container');
        const emptyState = document.getElementById('empty-state');
        const previewSection = document.getElementById('preview-section');
        const fileInput = document.getElementById('file-input');

        if (dropZoneContent) dropZoneContent.style.display = 'block';
        if (fileInfo) fileInfo.classList.add('hidden');
        if (fieldsSection) fieldsSection.style.display = 'none';
        if (fieldsContainer) fieldsContainer.innerHTML = '';
        if (codeMappingSection) codeMappingSection.style.display = 'none';
        if (codeMappingContainer) codeMappingContainer.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        if (previewSection) previewSection.style.display = 'none';
        if (fileInput) fileInput.value = '';

        this.updateStatus('准备就绪', 0);
    }

    updateFileInfo(fileName, recordCount) {
        const dropZoneContent = document.querySelector('.drop-zone-content');
        const fileInfo = document.getElementById('file-info');
        const fileNameEl = document.getElementById('file-name');
        const fileMetaEl = document.getElementById('file-meta');

        if (dropZoneContent) dropZoneContent.style.display = 'none';
        if (fileInfo) fileInfo.classList.remove('hidden');
        if (fileNameEl) fileNameEl.textContent = fileName || '';
        if (fileMetaEl) fileMetaEl.textContent = recordCount + ' 条记录';
    }

    renderFieldTree() {
        const container = document.getElementById('fields-container');
        if (!container) return;

        container.innerHTML = '';

        if (!this.structure || this.structure.length === 0) {
            container.innerHTML = '<p style="padding:10px;color:#888;">未识别到字段</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'field-tree';
        this.renderTreeNodes(this.structure, ul);
        container.appendChild(ul);

        const fieldCountEl = document.getElementById('field-count');
        if (fieldCountEl) {
            const count = this.countAllFields(this.structure);
            fieldCountEl.textContent = count;
        }
    }

    countAllFields(nodes) {
        let count = 0;
        const collect = (items) => {
            if (!items || !Array.isArray(items)) return;
            items.forEach(item => {
                if (item && item.path) count++;
                if (item && item.children) {
                    collect(item.children);
                }
            });
        };
        collect(nodes);
        return count;
    }

    renderTreeNodes(nodes, parentElement) {
        if (!nodes || !Array.isArray(nodes)) return;

        nodes.forEach(field => {
            if (!field || !field.path) return;

            const li = document.createElement('li');
            const fieldItem = document.createElement('div');
            fieldItem.className = 'field-item';

            const hasChildren = field.hasChildren && field.children && field.children.length > 0;

            if (hasChildren) {
                const expandIcon = document.createElement('span');
                expandIcon.className = 'expand-icon';
                expandIcon.innerHTML = '▶';
                expandIcon.onclick = (e) => {
                    e.stopPropagation();
                    const childrenContainer = li.querySelector('.field-children');
                    if (childrenContainer) {
                        const isExpanded = expandIcon.classList.contains('expanded');
                        expandIcon.classList.toggle('expanded');
                        childrenContainer.style.display = isExpanded ? 'none' : 'block';
                    }
                };
                fieldItem.appendChild(expandIcon);
            } else {
                const spacer = document.createElement('span');
                spacer.className = 'field-spacer';
                fieldItem.appendChild(spacer);
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'field-' + field.path;
            checkbox.dataset.path = field.path;
            checkbox.onchange = (e) => this.onFieldToggle(e, field.path);
            fieldItem.appendChild(checkbox);

            const label = document.createElement('label');
            label.htmlFor = 'field-' + field.path;
            label.textContent = field.name || '';
            label.style.cursor = 'pointer';

            if (field.type) {
                const typeSpan = document.createElement('span');
                typeSpan.className = 'field-type';
                typeSpan.textContent = field.type;
                typeSpan.style.marginLeft = '8px';
                label.appendChild(typeSpan);

                label.ondblclick = (e) => {
                    e.stopPropagation();
                    this.editColumnName(field.path, label);
                };
            }

            fieldItem.appendChild(label);

            if (hasChildren) {
                const actionsSpan = document.createElement('span');
                actionsSpan.className = 'node-actions';
                actionsSpan.style.display = 'inline-flex';
                actionsSpan.style.gap = '4px';
                actionsSpan.style.marginLeft = '8px';

                const selectAllBtn = document.createElement('button');
                selectAllBtn.className = 'node-action-btn select-children-btn';
                selectAllBtn.textContent = '全选';
                selectAllBtn.type = 'button';
                selectAllBtn.dataset.parentPath = field.path;
                selectAllBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.selectChildren(field.path);
                };

                const deselectAllBtn = document.createElement('button');
                deselectAllBtn.className = 'node-action-btn deselect-children-btn';
                deselectAllBtn.textContent = '全不选';
                deselectAllBtn.type = 'button';
                deselectAllBtn.dataset.parentPath = field.path;
                deselectAllBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deselectChildren(field.path);
                };

                actionsSpan.appendChild(selectAllBtn);
                actionsSpan.appendChild(deselectAllBtn);
                fieldItem.appendChild(actionsSpan);
            } else {
                const codeMappingBtn = document.createElement('button');
                codeMappingBtn.className = 'node-action-btn code-mapping-btn';
                codeMappingBtn.innerHTML = '≡';
                codeMappingBtn.title = '码值替换';
                codeMappingBtn.type = 'button';
                codeMappingBtn.style.marginLeft = '8px';
                codeMappingBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.openCodeMappingModal(field.path);
                };
                fieldItem.appendChild(codeMappingBtn);
            }

            li.appendChild(fieldItem);

            if (hasChildren) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'field-children';
                childrenContainer.style.display = 'none';

                const childrenUl = document.createElement('ul');
                childrenUl.className = 'field-tree';
                this.renderTreeNodes(field.children, childrenUl);
                childrenContainer.appendChild(childrenUl);
                li.appendChild(childrenContainer);
            }

            parentElement.appendChild(li);
        });
    }

    onFieldToggle(e, path) {
        if (!e || !e.target) return;

        if (e.target.checked) {
            this.selectedFields.add(path);
            this.checkChildFields(path, true);
        } else {
            this.selectedFields.delete(path);
            this.uncheckChildFields(path, false);
        }

        this.updateAllCheckboxes();
        this.updateFieldCount();
    }

    selectChildren(parentPath) {
        const prefix = parentPath + '.';
        const checkboxes = document.querySelectorAll('.field-item input[type="checkbox"]');

        checkboxes.forEach(cb => {
            if (cb && cb.dataset && cb.dataset.path) {
                if (cb.dataset.path.startsWith(prefix)) {
                    cb.checked = true;
                    this.selectedFields.add(cb.dataset.path);
                }
            }
        });

        this.updateAllCheckboxes();
        this.updateFieldCount();
        setTimeout(() => this.handleRefreshPreview(), 100);
    }

    deselectChildren(parentPath) {
        const prefix = parentPath + '.';
        const checkboxes = document.querySelectorAll('.field-item input[type="checkbox"]');

        checkboxes.forEach(cb => {
            if (cb && cb.dataset && cb.dataset.path) {
                if (cb.dataset.path.startsWith(prefix)) {
                    cb.checked = false;
                    this.selectedFields.delete(cb.dataset.path);
                }
            }
        });

        this.updateAllCheckboxes();
        this.updateFieldCount();
        setTimeout(() => this.handleRefreshPreview(), 100);
    }

    checkChildFields(parentPath, checked) {
        const prefix = parentPath + '.';
        const checkboxes = document.querySelectorAll('.field-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb && cb.dataset && cb.dataset.path && cb.dataset.path.startsWith(prefix)) {
                cb.checked = true;
                this.selectedFields.add(cb.dataset.path);
            }
        });
    }

    uncheckChildFields(parentPath, unchecked) {
        const prefix = parentPath + '.';
        const checkboxes = document.querySelectorAll('.field-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb && cb.dataset && cb.dataset.path && cb.dataset.path.startsWith(prefix)) {
                cb.checked = false;
                this.selectedFields.delete(cb.dataset.path);
            }
        });
    }

    updateAllCheckboxes() {
        const checkboxes = document.querySelectorAll('.field-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb && cb.dataset && cb.dataset.path) {
                cb.checked = this.selectedFields.has(cb.dataset.path);
            }
        });
    }

    updateFieldCount() {
        const count = this.selectedFields.size;
        const fieldCountEl = document.getElementById('field-count');
        const previewCountEl = document.getElementById('preview-count');

        if (fieldCountEl) fieldCountEl.textContent = count;
        if (previewCountEl) previewCountEl.textContent = '前10条 (' + count + '列)';
    }

    editColumnName(path, labelElement) {
        if (!path || !labelElement) return;

        const currentName = this.columnMapping[path] || path.split('.').pop();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'column-mapping-input';
        input.value = currentName;

        const originalContent = labelElement.innerHTML;
        labelElement.innerHTML = '';
        labelElement.appendChild(input);
        input.focus();
        input.select();

        const saveName = () => {
            const newName = input.value.trim();
            if (newName) {
                this.columnMapping[path] = newName;
            }
            this.updateFieldLabel(labelElement, path, newName || path.split('.').pop());
            setTimeout(() => this.handleRefreshPreview(), 100);
        };

        input.onblur = saveName;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                saveName();
            } else if (e.key === 'Escape') {
                labelElement.innerHTML = originalContent;
                labelElement.ondblclick = () => this.editColumnName(path, labelElement);
            }
        };
    }

    updateFieldLabel(labelElement, path, displayName) {
        if (!labelElement || !path) return;

        labelElement.textContent = displayName;

        const fieldInfo = this.structure.find(f => f && f.path === path);
        if (fieldInfo && fieldInfo.type) {
            const typeSpan = document.createElement('span');
            typeSpan.className = 'field-type';
            typeSpan.textContent = fieldInfo.type;
            typeSpan.style.marginLeft = '8px';
            labelElement.appendChild(typeSpan);
        }

        labelElement.ondblclick = () => this.editColumnName(path, labelElement);
    }

    editHeaderColumnName(field, thTextElement) {
        if (!field || !thTextElement) return;

        const currentName = this.columnMapping[field] || field.split('.').pop();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'header-edit-input';
        input.value = currentName;

        const thContent = thTextElement.parentElement;
        const originalContent = thContent.innerHTML;
        thContent.innerHTML = '';
        thContent.appendChild(input);
        input.focus();
        input.select();

        const saveName = () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                this.columnMapping[field] = newName;
                this.showToast('列名已更新: ' + newName, 'success');
            }
            this.renderPreviewTable(this.lastPreviewData || [], this.lastPreviewFields || []);
        };

        input.onblur = saveName;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                saveName();
                input.blur();
            } else if (e.key === 'Escape') {
                thContent.innerHTML = originalContent;
                const newThText = thContent.querySelector('.th-text');
                if (newThText) {
                    newThText.onclick = () => this.editHeaderColumnName(field, newThText);
                }
                const newEditIcon = thContent.querySelector('.th-edit-icon');
                if (newEditIcon) {
                    newEditIcon.onclick = () => this.editHeaderColumnName(field, newThText);
                }
            }
        };
    }

    renderPreviewTable(data, fields) {
        const thead = document.getElementById('preview-thead');
        const tbody = document.getElementById('preview-tbody');

        if (!thead || !tbody) {
            console.error('Preview table elements not found');
            return;
        }

        if (!data || !Array.isArray(data)) {
            data = [];
        }
        if (!fields || !Array.isArray(fields)) {
            fields = [];
        }

        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (data.length === 0 || fields.length === 0) {
            const row = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = fields.length > 0 ? fields.length : 1;
            td.textContent = '暂无数据';
            td.style.cssText = 'text-align:center;padding:40px;color:#888;';
            row.appendChild(td);
            tbody.appendChild(row);
            return;
        }

        const headerRow = document.createElement('tr');
        fields.forEach(field => {
            if (!field) return;

            const th = document.createElement('th');
            const defaultName = field.split('.').pop();
            const displayName = this.columnMapping[field] || defaultName;

            const thContent = document.createElement('div');
            thContent.className = 'th-content';

            const thText = document.createElement('span');
            thText.className = 'th-text';
            thText.textContent = displayName;
            thText.title = field;
            thText.style.cursor = 'pointer';
            thText.onclick = () => this.editHeaderColumnName(field, thText);

            const editIcon = document.createElement('span');
            editIcon.className = 'th-edit-icon';
            editIcon.innerHTML = '✏';
            editIcon.style.cursor = 'pointer';
            editIcon.onclick = () => this.editHeaderColumnName(field, thText);

            thContent.appendChild(thText);
            thContent.appendChild(editIcon);
            th.appendChild(thContent);
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        const displayData = data.slice(0, 10);
        displayData.forEach(record => {
            if (!record) return;

            const row = document.createElement('tr');
            fields.forEach(field => {
                const td = document.createElement('td');
                let value = record[field];

                if (value === null || value === undefined) {
                    value = '-';
                } else if (typeof value === 'object') {
                    const jsonStr = JSON.stringify(value);
                    value = jsonStr.length > 100 ? jsonStr.substring(0, 100) + '...' : jsonStr;
                }

                const text = String(value);
                td.textContent = text.length > 50 ? text.substring(0, 50) + '...' : text;
                td.title = text;
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
    }

    updateStatus(text, recordCount) {
        const statusText = document.getElementById('status-text');
        const recordCountEl = document.getElementById('record-count');

        if (statusText) statusText.textContent = text || '';
        if (recordCountEl) recordCountEl.textContent = recordCount + ' 条记录';
    }

    showLoading(text) {
        const loadingText = document.getElementById('loading-text');
        const loadingOverlay = document.getElementById('loading-overlay');

        if (loadingText) loadingText.textContent = text || '处理中...';
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }

    showToast(message, type) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');

        if (!toast || !toastMessage) {
            console.log('Toast: ' + message);
            return;
        }

        toastMessage.textContent = message || '';
        toast.style.background = 'var(--bg-secondary)';
        toast.style.color = 'var(--text-primary)';

        if (type === 'error') {
            toast.style.borderLeft = '4px solid #ef4444';
        } else if (type === 'warning') {
            toast.style.borderLeft = '4px solid #f59e0b';
        } else {
            toast.style.borderLeft = '4px solid #10b981';
        }

        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    handleCodeMappingFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                if (jsonData.length === 0) {
                    this.showToast('映射表数据为空', 'warning');
                    return;
                }

                let mappingsImported = 0;
                const fieldsWithoutMapping = [];
                const invalidFields = new Set();

                jsonData.forEach(row => {
                    const keys = Object.keys(row);
                    if (keys.length >= 3) {
                        const fieldPath = String(row[keys[0]] || '').trim();
                        const sourceValue = String(row[keys[1]] || '').trim();
                        const targetValue = String(row[keys[2]] || '').trim();

                        if (fieldPath && sourceValue && targetValue) {
                            if (!this.codeMappings[fieldPath]) {
                                this.codeMappings[fieldPath] = [];
                            }
                            if (!Array.isArray(this.codeMappings[fieldPath])) {
                                const oldMappings = this.codeMappings[fieldPath];
                                this.codeMappings[fieldPath] = [];
                                Object.entries(oldMappings).forEach(([s, t]) => {
                                    this.codeMappings[fieldPath].push({ source: s, target: t, disabled: false });
                                });
                            }
                            const exists = this.codeMappings[fieldPath].find(m => m.source === sourceValue);
                            if (!exists) {
                                this.codeMappings[fieldPath].push({ source: sourceValue, target: targetValue, disabled: false });
                                mappingsImported++;
                            }
                        }

                        if (fieldPath && !this.selectedFields.has(fieldPath)) {
                            invalidFields.add(fieldPath);
                        }
                    } else if (keys.length === 2) {
                        const sourceValue = String(row[keys[0]] || '').trim();
                        const targetValue = String(row[keys[1]] || '').trim();
                        if (sourceValue && targetValue) {
                            this.codeMappings['_global_'] = this.codeMappings['_global_'] || {};
                            if (!this.codeMappings['_global_'][sourceValue] || this.codeMappings['_global_'][sourceValue].disabled) {
                                this.codeMappings['_global_'][sourceValue] = { target: targetValue, disabled: false };
                                mappingsImported++;
                            }
                        }
                    }
                });

                this.renderCodeMappingList(invalidFields);

                if (invalidFields.size > 0) {
                    const fieldsArray = Array.from(invalidFields);
                    this.showToast(`成功导入 ${mappingsImported} 条规则，${fieldsArray.length} 个字段未选择（标黄显示）`, 'warning');
                } else {
                    this.showToast(`成功导入 ${mappingsImported} 条映射规则`, 'success');
                }

                setTimeout(() => this.handleRefreshPreview(), 100);
            } catch (error) {
                console.error('Error parsing Excel file:', error);
                this.showToast('解析映射文件失败: ' + error.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    }

    renderCodeMappingList(invalidFields = new Set()) {
        const container = document.getElementById('code-mapping-container');
        if (!container) return;

        const mappingKeys = Object.keys(this.codeMappings).filter(k => k !== '_global_');
        const globalMappings = this.codeMappings['_global_'] || {};

        if (mappingKeys.length === 0 && Object.keys(globalMappings).length === 0) {
            container.innerHTML = '<p style="padding:10px;color:#888;font-size:12px;">点击字段旁的≡按钮配置码值替换规则，或导入映射表</p>';
            return;
        }

        let html = '';

        if (mappingKeys.length > 0) {
            html += '<div style="margin-bottom:12px;"><strong style="font-size:12px;color:var(--text-secondary);">字段级映射：</strong></div>';
            mappingKeys.slice(0, 10).forEach((field) => {
                const mappings = this.codeMappings[field];
                const fieldMappings = Array.isArray(mappings) ? mappings : [];
                const activeMappings = fieldMappings.filter(m => !m.disabled);
                const disabledMappings = fieldMappings.filter(m => m.disabled);
                const mappingCount = activeMappings.length;
                const displayMappings = activeMappings.slice(0, 3);
                const fieldName = this.columnMapping[field] || field.split('.').pop();
                const isInvalid = invalidFields.has(field);
                const isDisabled = disabledMappings.length > 0;

                html += `
                    <div class="code-mapping-item ${isInvalid ? 'invalid-field' : ''}" ${isInvalid ? 'title="字段未选择，映射规则不生效"' : ''}>
                        <div class="code-mapping-item-header">
                            <span class="code-mapping-field">${this.escapeHtml(fieldName)}</span>
                            <span class="code-mapping-count">${mappingCount}条规则${isDisabled ? ' <span style="color:#f59e0b;">(' + disabledMappings.length + '条失效)</span>' : ''}</span>
                            <button class="btn-icon" title="${isDisabled ? '禁用该字段所有映射' : '启用该字段所有映射'}" style="margin-left:auto;opacity:0.6;" onclick="app.toggleFieldMappings('${this.escapeHtml(field)}')">
                                ${isDisabled ? `
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                </svg>` : `
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>`}
                            </button>
                        </div>
                        <div class="code-mapping-rules">
                            ${displayMappings.map(m => `
                                <div class="code-mapping-rule">
                                    <span>${this.escapeHtml(String(m.source))}</span>
                                    <span class="code-mapping-arrow">→</span>
                                    <span>${this.escapeHtml(String(m.target))}</span>
                                    <button class="btn-icon" title="生效" style="margin-left:8px;opacity:0.5;" onclick="app.toggleSingleMapping('${this.escapeHtml(field)}', '${this.escapeHtml(String(m.source))}')">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    </button>
                                </div>
                            `).join('')}
                            ${mappingCount > 3 ? `<div style="color:var(--text-muted);font-size:11px;">...还有 ${mappingCount - 3} 条</div>` : ''}
                            ${disabledMappings.length > 0 ? disabledMappings.map(m => `
                                <div class="code-mapping-rule" style="opacity:0.5;" title="已失效，点击启用">
                                    <span style="text-decoration:line-through;">${this.escapeHtml(String(m.source))}</span>
                                    <span class="code-mapping-arrow">→</span>
                                    <span style="text-decoration:line-through;">${this.escapeHtml(String(m.target))}</span>
                                    <button class="btn-icon" title="失效" style="margin-left:8px;" onclick="app.toggleSingleMapping('${this.escapeHtml(field)}', '${this.escapeHtml(String(m.source))}')">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                            <line x1="1" y1="1" x2="23" y2="23"></line>
                                        </svg>
                                    </button>
                                </div>
                            `).join('') : ''}
                        </div>
                    </div>
                `;
            });

            if (mappingKeys.length > 10) {
                html += `<p style="padding:8px;font-size:11px;color:var(--text-muted);">还有 ${mappingKeys.length - 10} 个字段有映射规则...</p>`;
            }
        }

        const globalActiveMappings = Object.entries(globalMappings).filter(([_, m]) => !m.disabled);
        const globalDisabledMappings = Object.entries(globalMappings).filter(([_, m]) => m.disabled);

        if (globalActiveMappings.length > 0 || globalDisabledMappings.length > 0) {
            const toggleBtnHtml = `<button class="btn-icon" title="${globalActiveMappings.length > 0 ? '禁用全部全局映射' : '启用全部全局映射'}" style="margin-left:8px;opacity:0.6;" onclick="app.toggleGlobalMappings()">
                        ${globalActiveMappings.length > 0 ? `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>` : `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>`}
                    </button>`;
            html += `<div style="margin:12px 0 8px 0;"><strong style="font-size:12px;color:var(--text-secondary);">全局映射：</strong>${toggleBtnHtml}</div>`;
            
            const displayGlobals = globalActiveMappings.slice(0, 5);
            displayGlobals.forEach(([s, m]) => {
                html += `
                    <div class="code-mapping-item" style="padding:6px 10px;">
                        <span style="font-size:12px;color:var(--text-secondary);">${this.escapeHtml(String(s))}</span>
                        <span class="code-mapping-arrow">→</span>
                        <span style="font-size:12px;color:var(--text-primary);">${this.escapeHtml(String(m.target))}</span>
                        <button class="btn-icon" title="失效" style="margin-left:8px;opacity:0.5;" onclick="app.toggleSingleGlobalMapping('${this.escapeHtml(String(s))}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                        </button>
                    </div>
                `;
            });
            
            if (globalDisabledMappings.length > 0) {
                const displayDisabled = globalDisabledMappings.slice(0, 3);
                displayDisabled.forEach(([s, m]) => {
                    html += `
                        <div class="code-mapping-item" style="padding:6px 10px;opacity:0.5;" title="已失效，点击启用">
                            <span style="font-size:12px;text-decoration:line-through;color:var(--text-secondary);">${this.escapeHtml(String(s))}</span>
                            <span class="code-mapping-arrow">→</span>
                            <span style="font-size:12px;text-decoration:line-through;color:var(--text-primary);">${this.escapeHtml(String(m.target))}</span>
                            <button class="btn-icon" title="生效" style="margin-left:8px;" onclick="app.toggleSingleGlobalMapping('${this.escapeHtml(String(s))}')">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                        </div>
                    `;
                });
            }
        }

        if (invalidFields.size > 0) {
            html += `<div style="margin-top:12px;padding:8px;background:#fef3c7;border-radius:6px;border:1px solid #f59e0b;">
                <span style="font-size:11px;color:#92400e;">⚠️ ${invalidFields.size} 个字段未选择，映射规则不生效</span>
            </div>`;
        }

        container.innerHTML = html;
        
        const totalMappings = mappingKeys.length + Object.keys(globalMappings).length;
        const clearAllBtn = document.getElementById('code-mapping-actions-bottom');
        if (clearAllBtn && totalMappings > 0) {
            clearAllBtn.style.display = 'block';
        }
    }

    openCodeMappingModal(path = null) {
        const modal = document.getElementById('code-mapping-modal');
        const fieldSelect = document.getElementById('modal-field-select');
        const container = document.getElementById('mapping-rules-container');

        if (!modal || !fieldSelect || !container) return;

        const configModal = document.getElementById('field-config-modal');
        if (configModal) {
            configModal.classList.add('hidden');
        }

        fieldSelect.innerHTML = '';
        const selectedFieldsArray = Array.from(this.selectedFields);
        selectedFieldsArray.forEach(field => {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = this.columnMapping[field] || field;
            fieldSelect.appendChild(option);
        });

        if (path && selectedFieldsArray.includes(path)) {
            fieldSelect.value = path;
        }

        container.innerHTML = '';
        const currentField = fieldSelect.value;
        const fieldMappings = this.getMappingsForField(currentField);
        fieldMappings.forEach(mapping => {
            this.addMappingRuleRow(mapping.source, mapping.target);
        });

        if (fieldMappings.length === 0) {
            this.addMappingRuleRow();
        }

        modal.classList.remove('hidden');
    }

    closeCodeMappingModal() {
        const modal = document.getElementById('code-mapping-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        
        const configModal = document.getElementById('field-config-modal');
        if (configModal) {
            configModal.classList.remove('hidden');
        }
    }

    addMappingRuleRow(source = '', target = '') {
        const container = document.getElementById('mapping-rules-container');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'mapping-rule-row';
        row.innerHTML = `
            <input type="text" class="form-control source-value" placeholder="源值" value="${this.escapeHtml(source)}">
            <span class="mapping-arrow">→</span>
            <input type="text" class="form-control target-value" placeholder="目标值" value="${this.escapeHtml(target)}">
            <button class="btn-icon remove-mapping-btn" title="删除">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        row.querySelector('.remove-mapping-btn').onclick = () => {
            row.remove();
        };

        container.appendChild(row);
    }

    saveCodeMapping() {
        const fieldSelect = document.getElementById('modal-field-select');
        const container = document.getElementById('mapping-rules-container');
        if (!fieldSelect || !container) return;

        const field = fieldSelect.value;
        const rows = container.querySelectorAll('.mapping-rule-row');
        const mappings = [];

        rows.forEach(row => {
            const source = row.querySelector('.source-value').value.trim();
            const target = row.querySelector('.target-value').value.trim();
            if (source) {
                mappings.push({ source, target, disabled: false });
            }
        });

        if (mappings.length > 0) {
            this.codeMappings[field] = mappings;
        } else {
            delete this.codeMappings[field];
        }

        this.renderCodeMappingList();
        this.closeCodeMappingModal();
        
        const configModal = document.getElementById('field-config-modal');
        if (configModal) {
            configModal.classList.remove('hidden');
        }
        
        this.showToast('码值映射已保存', 'success');
        setTimeout(() => this.handleRefreshPreview(), 100);
    }

    getMappingsForField(path) {
        if (!this.codeMappings[path]) return [];
        if (Array.isArray(this.codeMappings[path])) {
            return this.codeMappings[path];
        }
        const mapping = this.codeMappings[path];
        return Object.keys(mapping).map(source => ({
            source,
            target: mapping[source],
            disabled: false
        }));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggleFieldMappings(fieldPath) {
        if (!fieldPath || !this.codeMappings[fieldPath]) return;
        
        const mappings = this.codeMappings[fieldPath];
        if (!Array.isArray(mappings)) return;
        
        const activeCount = mappings.filter(m => !m.disabled).length;
        const allDisabled = activeCount === 0;
        
        mappings.forEach(m => {
            m.disabled = !allDisabled;
        });
        
        this.renderCodeMappingList();
        this.showToast(allDisabled ? '已启用字段所有映射' : '已禁用字段所有映射', 'success');
        setTimeout(() => this.handleRefreshPreview(), 100);
    }

    toggleSingleMapping(fieldPath, sourceValue) {
        if (!fieldPath || !sourceValue || !this.codeMappings[fieldPath]) return;
        
        const mappings = this.codeMappings[fieldPath];
        if (!Array.isArray(mappings)) return;
        
        const mapping = mappings.find(m => m.source === sourceValue);
        if (mapping) {
            mapping.disabled = !mapping.disabled;
            this.renderCodeMappingList();
            this.showToast(mapping.disabled ? '映射已失效' : '映射已生效', 'success');
            setTimeout(() => this.handleRefreshPreview(), 100);
        }
    }

    toggleGlobalMappings() {
        if (!this.codeMappings['_global_']) return;
        
        const mappings = this.codeMappings['_global_'];
        const entries = Object.entries(mappings);
        const activeCount = entries.filter(([_, m]) => !m.disabled).length;
        const allDisabled = activeCount === 0;
        
        entries.forEach(([key, m]) => {
            m.disabled = !allDisabled;
        });
        
        this.renderCodeMappingList();
        this.showToast(allDisabled ? '已启用全局所有映射' : '已禁用全局所有映射', 'success');
        setTimeout(() => this.handleRefreshPreview(), 100);
    }

    toggleSingleGlobalMapping(sourceValue) {
        if (!sourceValue || !this.codeMappings['_global_']) return;
        
        const mapping = this.codeMappings['_global_'][sourceValue];
        if (mapping) {
            mapping.disabled = !mapping.disabled;
            this.renderCodeMappingList();
            this.showToast(mapping.disabled ? '映射已失效' : '映射已生效', 'success');
            setTimeout(() => this.handleRefreshPreview(), 100);
        }
    }

    disableAllMappings() {
        let hasAnyEnabled = false;
        Object.keys(this.codeMappings).forEach(key => {
            if (key === '_global_') {
                Object.entries(this.codeMappings['_global_']).forEach(([k, m]) => {
                    if (!m.disabled) hasAnyEnabled = true;
                    m.disabled = true;
                });
            } else if (Array.isArray(this.codeMappings[key])) {
                this.codeMappings[key].forEach(m => {
                    if (!m.disabled) hasAnyEnabled = true;
                    m.disabled = true;
                });
            }
        });
        
        if (!hasAnyEnabled) {
            this.enableAllMappings();
            this.showToast('已启用所有映射规则', 'success');
        } else {
            this.renderCodeMappingList();
            this.showToast('已禁用所有映射规则', 'success');
        }
        setTimeout(() => this.handleRefreshPreview(), 100);
    }

    enableAllMappings() {
        Object.keys(this.codeMappings).forEach(key => {
            if (key === '_global_') {
                Object.entries(this.codeMappings['_global_']).forEach(([k, m]) => {
                    m.disabled = false;
                });
            } else if (Array.isArray(this.codeMappings[key])) {
                this.codeMappings[key].forEach(m => m.disabled = false);
            }
        });
        this.renderCodeMappingList();
        this.showToast('已启用所有映射规则', 'success');
        setTimeout(() => this.handleRefreshPreview(), 100);
    }

    downloadTemplate() {
        const headers = ['字段路径', '源值', '目标值'];
        const exampleData = [
            ['status', '01', 'A'],
            ['status', '02', 'B'],
            ['gender', 'male', '男'],
            ['gender', 'female', '女'],
            ['', '0', '否'],
            ['', '1', '是']
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '码值映射模板');
        XLSX.writeFile(wb, '码值映射模板.xlsx');
    }

    openFieldConfigWindow() {
        const modal = document.getElementById('field-config-modal');
        const treeContainer = document.getElementById('field-config-tree');
        
        if (!modal || !treeContainer) return;

        this.renderFieldConfigTree();
        this.updateConfigFieldCount();
        
        modal.classList.remove('hidden');
        
        const closeBtn = document.getElementById('close-field-config-btn');
        const closeConfigBtn = document.getElementById('close-config-btn');
        
        if (closeBtn) {
            closeBtn.onclick = () => this.closeFieldConfigWindow();
        }
        if (closeConfigBtn) {
            closeConfigBtn.onclick = () => this.closeFieldConfigWindow();
        }

        const searchInput = document.getElementById('config-search-input');
        if (searchInput) {
            searchInput.oninput = (e) => this.filterFieldConfigTree(e.target.value);
        }

        const selectAllBtn = document.getElementById('config-select-all-btn');
        const deselectAllBtn = document.getElementById('config-deselect-all-btn');
        const expandAllBtn = document.getElementById('config-expand-all-btn');
        const collapseAllBtn = document.getElementById('config-collapse-all-btn');
        
        if (selectAllBtn) selectAllBtn.onclick = () => this.handleSelectAll();
        if (deselectAllBtn) deselectAllBtn.onclick = () => this.handleDeselectAll();
        if (expandAllBtn) expandAllBtn.onclick = () => this.handleExpandAll();
        if (collapseAllBtn) collapseAllBtn.onclick = () => this.handleCollapseAll();
    }

    closeFieldConfigWindow() {
        const modal = document.getElementById('field-config-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    renderFieldConfigTree(filterText = '') {
        const container = document.getElementById('field-config-tree');
        if (!container) return;

        container.innerHTML = '';

        if (!this.structure || this.structure.length === 0) {
            container.innerHTML = '<p style="padding:10px;color:#888;">未识别到字段</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'field-tree';
        this.renderConfigTreeNodes(this.structure, ul, filterText);
        container.appendChild(ul);
        
        this.updateConfigFieldCount();
    }

    renderConfigTreeNodes(nodes, parentElement, filterText = '') {
        if (!nodes || !Array.isArray(nodes)) return;

        nodes.forEach(field => {
            if (!field || !field.path) return;

            const displayName = this.columnMapping[field.path] || field.name || '';
            if (filterText && !displayName.toLowerCase().includes(filterText.toLowerCase()) && 
                !field.path.toLowerCase().includes(filterText.toLowerCase())) {
                if (field.children) {
                    const filteredChildren = field.children.filter(child => {
                        const childName = this.columnMapping[child.path] || child.name || '';
                        return childName.toLowerCase().includes(filterText.toLowerCase()) || 
                               child.path.toLowerCase().includes(filterText.toLowerCase());
                    });
                    if (filteredChildren.length === 0) return;
                } else {
                    return;
                }
            }

            const li = document.createElement('li');
            const fieldItem = document.createElement('div');
            fieldItem.className = 'field-item';

            const hasChildren = field.hasChildren && field.children && field.children.length > 0;

            if (hasChildren) {
                const expandIcon = document.createElement('span');
                expandIcon.className = 'expand-icon';
                expandIcon.innerHTML = '▶';
                expandIcon.onclick = (e) => {
                    e.stopPropagation();
                    const childrenContainer = li.querySelector('.field-children');
                    if (childrenContainer) {
                        const isExpanded = expandIcon.classList.contains('expanded');
                        expandIcon.classList.toggle('expanded');
                        childrenContainer.style.display = isExpanded ? 'none' : 'block';
                    }
                };
                fieldItem.appendChild(expandIcon);
            } else {
                const spacer = document.createElement('span');
                spacer.className = 'field-spacer';
                fieldItem.appendChild(spacer);
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'config-field-' + field.path;
            checkbox.dataset.path = field.path;
            checkbox.checked = this.selectedFields.has(field.path);
            checkbox.onchange = (e) => this.onConfigFieldToggle(e, field.path);
            fieldItem.appendChild(checkbox);

            const label = document.createElement('label');
            label.htmlFor = 'config-field-' + field.path;
            label.textContent = displayName;
            label.style.cursor = 'pointer';

            if (field.type) {
                const typeSpan = document.createElement('span');
                typeSpan.className = 'field-type';
                typeSpan.textContent = field.type;
                typeSpan.style.marginLeft = '8px';
                label.appendChild(typeSpan);

                label.ondblclick = (e) => {
                    e.stopPropagation();
                    this.editColumnName(field.path, label);
                };
            }

            fieldItem.appendChild(label);

            const actionsSpan = document.createElement('span');
            actionsSpan.className = 'node-actions';
            actionsSpan.style.display = 'inline-flex';
            actionsSpan.style.gap = '4px';
            actionsSpan.style.marginLeft = '8px';

            const codeMappingBtn = document.createElement('button');
            codeMappingBtn.className = 'node-action-btn code-mapping-btn';
            codeMappingBtn.innerHTML = '≡';
            codeMappingBtn.title = '码值替换';
            codeMappingBtn.type = 'button';
            codeMappingBtn.onclick = (e) => {
                e.stopPropagation();
                this.openCodeMappingModal(field.path);
            };
            actionsSpan.appendChild(codeMappingBtn);

            fieldItem.appendChild(actionsSpan);

            li.appendChild(fieldItem);

            if (hasChildren) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'field-children';
                childrenContainer.style.display = 'none';

                const childrenUl = document.createElement('ul');
                childrenUl.className = 'field-tree';
                this.renderConfigTreeNodes(field.children, childrenUl, filterText);
                childrenContainer.appendChild(childrenUl);
                li.appendChild(childrenContainer);
            }

            parentElement.appendChild(li);
        });
    }

    onConfigFieldToggle(e, path) {
        if (!e || !e.target) return;

        if (e.target.checked) {
            this.selectedFields.add(path);
        } else {
            this.selectedFields.delete(path);
        }

        const checkboxes = document.querySelectorAll('#field-config-tree input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb && cb.dataset && cb.dataset.path) {
                cb.checked = this.selectedFields.has(cb.dataset.path);
            }
        });

        this.updateConfigFieldCount();
        setTimeout(() => this.handleRefreshPreview(), 100);
    }

    updateConfigFieldCount() {
        const count = this.selectedFields.size;
        const countEl = document.getElementById('config-field-count');
        if (countEl) {
            countEl.textContent = `已选择: ${count} 个字段`;
        }
    }

    filterFieldConfigTree(filterText) {
        this.renderFieldConfigTree(filterText);
    }
}
