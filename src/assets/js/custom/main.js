import './api-connector.js';
import './chunk-upload-manager.js';
import editResource from './edit-resource.js';
import fetchFileListModule from './fetch-file-list.js';
import {formatFileSize, reservedPath} from './tool.js';
import uploadContainer from './upload-container.js';
import uploadManager from './upload-manager.js';
import {WSConnector} from './ws-connectoer.js';
import {getUserInfo} from "./user-info.js";
import fetchFileList from "./fetch-file-list.js";
import {logout} from "./logout-main.js";

document.addEventListener('DOMContentLoaded', () => {

    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page') || 1;
    const pageSize = urlParams.get('size');
    const type = urlParams.get('type');

    const pathParts = window.location.pathname.split('/');

    let folderId;
    if (pathParts[pathParts.length - 1] in reservedPath && isNaN(parseInt(pathParts[pathParts.length - 1]))) {
        folderId = reservedPath[pathParts[pathParts.length - 1]];
    } else {
        folderId = parseInt(pathParts[pathParts.length - 1]) || 0;
    }

    fetchFileListModule.fetchFileList(folderId, page, true, pageSize, type).then(() => {
    });
    getUserInfo();


    if (folderId < 0) {
        document.getElementById("add-new-file-button").setAttribute("disabled", "true");
    }
    pageState();
});

window.addEventListener("popstate", (event) => {
    if (event.state) {
        fetchFileListModule.fetchFileList(event.state.folderId, event.state.page, false).then(() => {
        });
    }
});

document.getElementById("logoutBtn")?.addEventListener("click", logout);

document.getElementById("index-btn")?.addEventListener("click", () => {
    fetchFileListModule.fetchFileList(0, 1, true).then(() => {
    });
});

document.getElementById("stars-btn")?.addEventListener("click", () => {
    fetchFileListModule.fetchFileList(-2, 1, true).then(() => {
    });
});

document.getElementById("recently-btn")?.addEventListener("click", () => {
    fetchFileListModule.fetchFileList(-3, 1, true).then(() => {
    });
});
document.getElementById("recycle-btn")?.addEventListener("click", () => {
    fetchFileListModule.fetchFileList(-4, 1, true).then(() => {
    });
});


function pageState() {
    const body = document.body;

    const defaultSettings = {
        "data-color-scheme-mode": "light",  // dark or light
        "data-theme": "light", // default or dark or light
        "data-width": "fluid",   // fluid or boxed
        "data-compact": "" // scrollable, condensed, fixed
    };
    const map = {
        "data-color-scheme-mode": "data-layout-color",
        "data-theme": "data-leftbar-theme",
        "data-width": "data-layout-mode",
        "data-compact": "data-leftbar-compact-mode"
    }

    Object.keys(defaultSettings).forEach(key => {
        const savedValue = localStorage.getItem(key) || defaultSettings[key];
        body.setAttribute(map[key], savedValue);

        const input = document.querySelector(`input[name="${key.replace("data-", "")}"][value="${savedValue}"]`);
        if (input) input.click();

    });

    document.querySelectorAll('.form-check-input').forEach(input => {
        input.addEventListener("change", function () {
            if (this.checked) {
                const attrKey = `data-${this.name}`;
                body.setAttribute(attrKey, this.value);
                localStorage.setItem(attrKey, this.value);
            }
        });
    });

    // 重置按鈕
    document.getElementById("resetBtn").addEventListener("click", function () {
        Object.keys(defaultSettings).forEach(key => {
            localStorage.removeItem(key);
            body.setAttribute(key, defaultSettings[key]);

            const defaultInput = document.querySelector(`input[name="${key.replace("data-", "")}"][value="${defaultSettings[key]}"]`);
            if (defaultInput) defaultInput.checked = true;
        });
    });
}