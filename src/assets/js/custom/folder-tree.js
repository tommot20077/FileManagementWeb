import apiConnector from "./api-connector.js";
import {fetchFileList} from "./fetch-file-list.js";

class FolderTree {
    constructor(file) {
        this.container = document.getElementById("moveFileContainer");
        this.file = file;
        this.selectedFolderId = null;
        this.pathStack = [{
            id: 0,
            name: '根目錄'
        }];
        this.init().then(() => {});
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
        await this.generateFolderList(0, ul);
        this.container.appendChild(ul);

        this.addActionButtons();
        this.updateBreadcrumb();
    }


    async generateFolderList(folderId, parentElement) {
        parentElement.innerHTML = ''; // 清空現有內容

        // 如果不是根目錄，添加返回上層選項
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
                this.pathStack.pop();
                const parentFolder = this.pathStack[this.pathStack.length - 1];
                await this.loadFolder(parentFolder.id);
            });

            parentElement.appendChild(backLi);
        }
        const response = await apiConnector.get(`/api/folders/${folderId}`);
        const folders = response.data.data.files;
        if (!this.selectedFolderId) {
            this.selectedFolderId = folderId === 0 ? null : folderId;
        }


        folders.forEach((folder) => {
            if (!folder.folder) return;

            const li = document.createElement('li');
            li.className = 'side-nav-item folder-item';
            li.innerHTML = `
                <a href="#" class="side-nav-link ${folder.id === this.selectedFolderId ? 'active' : ''}">
                    <i class="uil-folder-plus"></i>
                    <span>${folder.filename}</span>
                </a>
            `;

            const folderLink = li.querySelector('a');
            folderLink.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.loadFolder(folder.id, folder.filename);
            });

            parentElement.appendChild(li);
        });
    }

    async loadFolder(folderId, folderName = '') {
        // 更新選中的資料夾ID
        this.selectedFolderId = folderId;

        // 更新路徑堆疊
        if (folderId !== null) {
            this.pathStack.push({
                id: folderId,
                name: folderName
            });
        }

        // 重新載入資料夾列表
        const ul = this.container.querySelector('ul');
        await this.generateFolderList(folderId, ul);

        // 更新麵包屑
        this.updateBreadcrumb();
    }


    updateBreadcrumb() {
        const breadcrumb = this.container.querySelector('.breadcrumb');
        breadcrumb.innerHTML = '';

        this.pathStack.forEach((folder, index) => {
            const li = document.createElement('li');
            li.className = 'breadcrumb-item';

            if (index === this.pathStack.length - 1) {
                li.classList.add('active');
                li.textContent = folder.name;
            } else {
                const a = document.createElement('a');
                a.href = '#';
                a.textContent = folder.name;
                a.addEventListener('click', async (e) => {
                    e.preventDefault();
                    this.pathStack = this.pathStack.slice(0, index + 1);
                    await this.loadFolder(folder.id);
                });
                li.appendChild(a);
            }

            breadcrumb.appendChild(li);
        });
    }

    addActionButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'action-buttons mt-3';
        buttonContainer.innerHTML = `
            <button class="btn btn-primary me-2" id="moveButton" style="display: inline-block;">移動</button>
            <button class="btn btn-secondary" id="cancelButton" style="display: inline-block;">取消</button>
        `;

        this.container.appendChild(buttonContainer);

        const moveButton = document.getElementById('moveButton');
        const cancelButton = document.getElementById('cancelButton');

        // 移動按鈕事件
        moveButton.addEventListener('click', async () => {
            const data = {
                fileId: this.file.id,
                fileName: this.file.filename,
                parentFolderId: this.selectedFolderId,
                shareUserIds: this.file.shareUsers
            }
            let url;
            if (this.file.folder) {
                url = '/api/folders';
            } else {
                url = '/api/files';
            }

            try {
                const response = await apiConnector.put(`${url}`, data)
                if (response.status === 200) {
                    closeMoveFileModal();
                }
            } catch (error) {
                console.error('移動失敗:', error);
                alert('移動失敗，請稍後再試');
            }
        });

        // 取消按鈕事件
        cancelButton.addEventListener('click', () => {
            closeMoveFileModal();
        });
    }
}



export function openMoveFileModal(file) {
    new FolderTree(file);
    document.getElementById('moveFileModal').classList.remove("hidden");
}

function closeMoveFileModal() {
    document.getElementById('moveFileModal').classList.add("hidden");
    document.getElementById('moveFileContainer').innerHTML = '';
    fetchFileList().then(() => {
    });
}


export default {FolderTree, openMoveFileModal};