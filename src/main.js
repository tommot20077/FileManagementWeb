import './assets/js/custom/api-connector.js';
import './assets/js/custom/chunk-upload-manager.js';
import editResource from './assets/js/custom/edit-resource.js';
import fetchFileListModule from './assets/js/custom/fetch-file-list.js';
import {formatFileSize} from './assets/js/custom/tool.js';
import uploadContainer from './assets/js/custom/upload-container.js';
import uploadManager from './assets/js/custom/upload-manager.js';
import {WSConnector} from './assets/js/custom/ws-connectoer.js';
import {getUserInfo} from "./assets/js/custom/user-info.js";
import fetchFileList from "./assets/js/custom/fetch-file-list.js";
import {logout} from "./logout-main.js";


document.addEventListener('DOMContentLoaded', () => {

    const urlParams = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/');
    const folderId = parseInt(pathParts[pathParts.length - 1]) || 0;
    const page = urlParams.get('page') || 1;
    const pageSize = urlParams.get('size');
    const type = urlParams.get('type');
    fetchFileListModule.fetchFileList(folderId, page, true, pageSize, type).then(r => {
    });
    getUserInfo();


    if (folderId < 0) {
        document.getElementById("add-new-file-button").setAttribute("disabled", "true");
    }
});

window.addEventListener("popstate", (event) => {
    if (event.state) {
        fetchFileListModule.fetchFileList(event.state.folderId, event.state.page, false).then(r => {
        });
    }
});

document.getElementById("logoutBtn")?.addEventListener("click", logout);


