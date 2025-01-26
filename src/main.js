import './assets/js/custom/api-connector.js';
import './assets/js/custom/chunk-upload-manager.js';
import editResource from './assets/js/custom/edit-resource.js';
import fetchFileListModule from './assets/js/custom/fetch-file-list.js';
import { formatFileSize } from './assets/js/custom/tool.js';
import uploadContainer from './assets/js/custom/upload-container.js';
import uploadManager from './assets/js/custom/upload-manager.js';
import { WSConnector } from './assets/js/custom/ws-connectoer.js';

// 初始化模組（根據需要調整）
document.addEventListener('DOMContentLoaded', () => {
    // 例如初始化文件列表
    fetchFileListModule.fetchFileList().then(r => {});

    // 其他初始化操作
});