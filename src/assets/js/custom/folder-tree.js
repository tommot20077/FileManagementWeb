import webConnector from "./web-connector.js";
import {currentFolderId, fetchFileList} from "./fetch-file-list.js";
import {updatePaginationControls} from "./tool.js";

class FolderTree {
    constructor(file, targetElement = null, isSearch = false) {
        this.container = document.getElementById("moveFileContainer");
        this.file = file;
        this.isSearch = isSearch;
        this.targetElement = targetElement;
        this.selectedFolderId = null;
        this.currentFolders = [];
        this.folderCache = {};
        this.init().then(() => {
        });
    }

    async init() {
        this.container.innerHTML = '';

        const breadcrumbNav = document.createElement('nav');
        breadcrumbNav.className = 'mb-3';
        breadcrumbNav.innerHTML = `
            <ol class="breadcrumb">
            </ol>
        `;
        this.container.appendChild(breadcrumbNav);

        const ul = document.createElement('ul');
        ul.className = 'side-nav-second-level folder-list';
        await this.generateFolderList(0, ul).then(() => {
            this.updateBreadcrumb(0);
        });
        this.container.appendChild(ul);

        this.addActionButtons(this.isSearch, this.targetElement);

    }

    async getData(folderId, page = 1) {
        const cacheKey = `${folderId}-${page}`;

        if (this.folderCache[cacheKey]) {
            return this.folderCache[cacheKey];
        }

        const response = await webConnector.get(`/folders/${folderId}?page=${page}`, {xsrfCookieName: "useless"});
        this.folderCache[cacheKey] = response.data.data;
        return response.data.data;
    }


    async generateFolderList(folderId, parentElement) {
        parentElement.innerHTML = ''

        const urlParams = new URLSearchParams(window.location.search);
        let currentPage = parseInt(urlParams.get("page")) || 1;

        const folderData = await this.getData(folderId, currentPage);
        const folders = folderData.files.data;
        const totalPages = folderData.files.totalPages;
        this.currentFolders = folderData.filePaths


        if (folderId !== 0) {
            const backLi = document.createElement('li');
            backLi.className = 'side-nav-item folder-item';
            backLi.innerHTML = `
                <a href="#" class="side-nav-link">
                    <i class="uil-arrow-left"></i>
                    <span>.</span>
                </a>
            `;

            const backLink = backLi.querySelector('a');
            backLink.addEventListener('click', async (e) => {
                e.preventDefault();
                if (this.currentFolders.length > 1) {
                    await this.loadFolder(this.currentFolders[1].folderId);
                }
            });

            parentElement.appendChild(backLi);
        }

        if (!this.selectedFolderId) {
            this.selectedFolderId = folderId === 0 ? null : folderId;
        }

        folders.forEach((folder) => {
            if (!folder.filename || folder.fileType !== 'FOLDER' || this.file && (folder.id === this.file.id)) {
                return;
            }

            const li = document.createElement('li');
            li.className = 'side-nav-item folder-item';
            li.innerHTML = `
                <a href="#" class="side-nav-link">
                    <i class="uil-folder-plus"></i>
                    <span>${folder.filename}</span>
                </a>
            `;

            const folderLink = li.querySelector('a');
            folderLink.addEventListener('click', async (e) => {
                e.preventDefault();
                let folderId = folder.id == null ? 0 : folder.id;
                await this.loadFolder(folderId);
            });

            parentElement.appendChild(li);
        });
        await this.createPaginationControls(parentElement).then((paginationUl) => {
            let showPage = totalPages === 0 ? 1 : totalPages
            updatePaginationControls(currentPage, showPage, paginationUl);
        });
    }

    async createPaginationControls(parentElement) {
        const paginationContainer = document.createElement('nav');
        const paginationUl = document.createElement('ul');
        paginationUl.className = 'pagination pagination-sm pagination-rounded mb-0 justify-content-center';


        paginationContainer.appendChild(paginationUl);
        parentElement.appendChild(paginationContainer);
        return paginationUl
    }

    async loadFolder(folderId) {
        this.selectedFolderId = folderId === 0 ? null : folderId;
        folderId = folderId === null ? 0 : folderId;
        const ul = this.container.querySelector('ul');
        await this.generateFolderList(folderId, ul).then(() => {
            this.updateBreadcrumb(folderId);
        });
    }


    updateBreadcrumb(folderId) {
        if (!Array.isArray(this.currentFolders)) {
            return;
        }

        const filePaths = [...this.currentFolders].reverse();


        const breadcrumb = this.container.querySelector('.breadcrumb');
        if (!breadcrumb) {
            return;
        }


        this.selectedFolderId = folderId;

        breadcrumb.innerHTML = '';

        filePaths.forEach((folder, index) => {
            if (!folder || !folder.name) {
                return;
            }

            const li = document.createElement('li');
            li.className = 'breadcrumb-item';

            if (index === filePaths.length - 1) {
                li.classList.add('active');
                li.textContent = folder.name;
            } else {
                const a = document.createElement('a');
                a.href = '#';
                a.textContent = folder.name;
                a.addEventListener('click', async (e) => {
                    e.preventDefault();
                    folderId = folder.folderId == null ? 0 : folder.folderId;
                    await this.loadFolder(folderId);
                });
                li.appendChild(a);
            }

            breadcrumb.appendChild(li);
        });
    }

    addActionButtons(isSearch, targetElement) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'action-buttons mt-3';
        if (isSearch) {
            buttonContainer.innerHTML = `
            <button class="btn btn-success me-2" id="chooseButton" style="display: inline-block;">確定當前資料夾</button>
            <button class="btn btn-info me-2" id="resetButton" style="display: inline-block;">重置</button>
            <button class="btn btn-secondary" id="cancelButton" style="display: inline-block;">取消</button>
        `;
        } else {
            buttonContainer.innerHTML = `
            <button class="btn btn-primary me-2" id="moveButton" style="display: inline-block;">移動</button>
            <button class="btn btn-secondary" id="cancelButton" style="display: inline-block;">取消</button>
        `;
        }

        this.container.appendChild(buttonContainer);

        const moveButton = document.getElementById('moveButton');
        const cancelButton = document.getElementById('cancelButton');
        const chooseButton = document.getElementById('chooseButton');
        const resetButton = document.getElementById('resetButton');

        moveButton?.addEventListener('click', async () => {
            const FolderId = this.selectedFolderId === 0 ? null : this.selectedFolderId;
            const data = {
                fileId: this.file.id,
                filename: this.file.filename,
                parentFolderId: FolderId,
                shareUserIds: this.file.shareUsers
            }
            let url;
            if (this.file.fileType === 'FOLDER') {
                url = '/folders';
            } else {
                url = '/files';
            }

            try {
                const response = await webConnector.put(`${url}`, data)
                if (response.status === 200) {
                    closeMoveFileModal();
                }
            } catch (error) {
                const errorMessages = error.response?.data?.message || error;
                $.NotificationApp.send(`移動失敗:${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
            }
        });
        chooseButton?.addEventListener('click', async () => {
            targetElement.value = this.selectedFolderId;
            closeMoveFileModal();
        });

        cancelButton.addEventListener('click', () => {
            closeMoveFileModal(false);
        });

        resetButton?.addEventListener('click', () => {
            targetElement.value = null;
            closeMoveFileModal(false);
        });
    }
}


export function openMoveFileModal(file = null, targetElement = null, isSearch = false) {
    new FolderTree(file, targetElement, isSearch);
    document.getElementById('moveFileModal').classList.remove("hidden");
}

function closeMoveFileModal(reset = true) {
    document.getElementById('moveFileModal').classList.add("hidden");
    document.getElementById('moveFileContainer').innerHTML = '';
    if (reset) {
        fetchFileList(currentFolderId).then(() => {
        });
    }
}


export default {FolderTree, openMoveFileModal};