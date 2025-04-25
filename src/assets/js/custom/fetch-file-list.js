import webConnector from "./web-connector.js";
import {copyToClipboard, formatFileSize, reservedPath, updatePaginationControls} from "./tool.js";
import config from "../../../../config/config.js";
import {loadEditData, openEditFileModal} from "./edit-resource.js";
import {openMoveFileModal} from "./folder-tree.js";
import {getUserInfo, isGuest} from "./user-info.js";
import {handleResponse} from "./component.js";

export let currentFolderId = 0;
const breadcrumb = document.getElementById('breadcrumb');
let currentContextMenuFile = null;

export async function fetchFileList(folderId = 0, updateUrl = true, filter = {}, isSearch = false) {
    currentFolderId = folderId;
    let response;
    try {
        disableButton(folderId, isSearch);

        let url = isSearch ? `/files/search` : `/folders/${formatSpecificPath(folderId)}`;

        response = await webConnector.get(formatUrl(url, filter), {xsrfCookieName: "useless"});
        const files = response.data.data.files.data;
        const tbody = document.querySelector('.table-responsive tbody');
        const owner = response.data.data.owner;
        const filePaths = response.data.data.filePaths;
        const totalPages = response.data.data.files.totalPages;
        const currentPage = response.data.data.files.currentPage;

        const isRecycle = parseInt(String(folderId)) === -4

        updateBreadcrumb(filePaths);

        tbody.innerHTML = '';

        const typeOrder = {"FOLDER": 0, "ONLINE_DOCUMENT": 1};

        files.sort((a, b) => {
            if (typeOrder[a.fileType] === undefined) {
                typeOrder[a.fileType] = Object.keys(typeOrder).length;
            }
            if (typeOrder[b.fileType] === undefined) {
                typeOrder[b.fileType] = Object.keys(typeOrder).length;
            }

            const typeComparison = typeOrder[a.fileType] - typeOrder[b.fileType];
            return typeComparison !== 0 ? typeComparison : a.filename.localeCompare(b.filename, undefined, {sensitivity: 'base'});
        });

        files.forEach(file => {
            const tr = document.createElement('tr');
            tr.dataset.file = JSON.stringify(file);

            const nameTd = document.createElement('td');
            nameTd.style.width = '400px';
            nameTd.classList.add('text-truncate');
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('ms-2', 'fw-semibold');
            const nameLink = document.createElement('a');
            nameLink.href = 'javascript:void(0);';
            nameLink.classList.add('text-reset');
            nameLink.style.fontSize = '1.05rem';
            nameLink.innerHTML = getLabelName(file);
            nameLink.title = file.filename;
            nameSpan.appendChild(nameLink);
            nameTd.appendChild(nameSpan);
            tr.appendChild(nameTd);

            if (!isRecycle) {
                nameLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if (file.fileType === 'FOLDER') {
                        await fetchFileList(file.id);
                    } else if (file.fileType === 'ONLINE_DOCUMENT') {
                        await openEditor(file);
                    } else {
                        await getFileResource(file, 'preview');
                    }
                });
            }


            const modifiedTd = document.createElement('td');
            const modifiedP = document.createElement('p');
            modifiedP.classList.add('mb-0');
            modifiedP.textContent = file.lastAccessTime;
            const modifiedSpan = document.createElement('span');
            modifiedSpan.classList.add('font-12');
            modifiedSpan.textContent = `由 ${owner}`;
            modifiedTd.appendChild(modifiedP);
            modifiedTd.appendChild(modifiedSpan);
            tr.appendChild(modifiedTd);

            const sizeTd = document.createElement('td');
            const ownerTd = document.createElement('td');
            ownerTd.textContent = owner;
            if (file.fileType !== 'FOLDER') {
                sizeTd.textContent = formatFileSize(file.fileSize);
            } else {
                sizeTd.textContent = '-';
            }
            tr.appendChild(sizeTd);
            tr.appendChild(ownerTd);

            const shareTypeTd = document.createElement('td');
            const type = {
                "NONE": "關閉分享",
                "DEFAULT": "預設分享",
                'PRIVATE': "私有分享",
                'PUBLIC': "公開分享"
            }

            shareTypeTd.textContent = type[file.shareType];
            tr.appendChild(shareTypeTd);

            const actionsTd = document.createElement('td');

            const btnGroup = document.createElement('div');
            btnGroup.classList.add('btn-group', 'dropdown');

            const actionBtn = document.createElement('a');
            actionBtn.href = '#';
            actionBtn.classList.add('table-action-btn', 'dropdown-toggle', 'arrow-none', 'btn', 'btn-light', 'btn-xs');
            actionBtn.setAttribute('data-bs-toggle', 'dropdown');
            actionBtn.setAttribute('aria-expanded', 'false');
            const dotsIcon = document.createElement('i');
            dotsIcon.classList.add('mdi', 'mdi-dots-horizontal');
            actionBtn.appendChild(dotsIcon);
            btnGroup.appendChild(actionBtn);

            const dropdownMenu = document.createElement('div');
            dropdownMenu.classList.add('dropdown-menu', 'dropdown-menu-end');

            generateActionItems(dropdownMenu, file, isRecycle);

            btnGroup.appendChild(dropdownMenu);
            actionsTd.appendChild(btnGroup);
            tr.appendChild(actionsTd);

            tbody.appendChild(tr);
        });

        updatePaginationControls(currentPage, totalPages, null, filter, isSearch);

        if (updateUrl) {
            let anotherPathname = String(folderId);

            if (String(folderId) in reservedPath && !isNaN(folderId)) {
                anotherPathname = reservedPath[String(folderId)];
            }

            let newUrl = isSearch ? `/web/files/search` : `/web/folder/${anotherPathname}`;
            window.history.pushState(filter, '', formatUrl(newUrl, filter));
        }


        if (!tbody.dataset.contextBound) {
            tbody.addEventListener('contextmenu', (event) => {
                const tr = event.target.closest('tr');
                if (!tr || !tbody.contains(tr)) return;

                event.preventDefault();

                document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
                    const instance = bootstrap.Dropdown.getInstance(toggle);
                    if (instance) {
                        instance.hide();
                    }
                });

                const clickedFile = JSON.parse(tr.dataset.file);
                currentContextMenuFile = clickedFile;

                const isRecycle = parseInt(String(currentFolderId)) === -4;
                const contextDropdown = document.getElementById('contextDropdownContainer');
                const contextMenu = document.getElementById('contextDropdownMenu');
                const contextToggle = document.getElementById('contextDropdownToggle');

                contextMenu.innerHTML = '';
                generateActionItems(contextMenu, clickedFile, isRecycle);

                const container = document.querySelector('.table-responsive');
                const containerRect = container.getBoundingClientRect();

                const left = event.clientX - containerRect.left + container.scrollLeft;
                const top = event.clientY - containerRect.top + container.scrollTop;

                contextDropdown.style.left = `${left}px`;
                contextDropdown.style.top = `${top}px`;
                contextDropdown.style.display = 'block';

                const oldInstance = bootstrap.Dropdown.getInstance(contextToggle);
                if (oldInstance) oldInstance.dispose();

                const bsDropdown = new bootstrap.Dropdown(contextToggle);
                bsDropdown.show();
            });

            tbody.dataset.contextBound = 'true';
        }
    } catch (error) {
        const errorMessages = error.response?.data?.message || error;
        $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }
}


document.addEventListener('click', async (event) => {
    const actionItem = event.target.closest('.dropdown-item[data-action]');
    if (!actionItem) return;

    event.preventDefault();

    const action = actionItem.dataset.action;
    const file = JSON.parse(actionItem.dataset.file)
    const isFolder = file.fileType === 'FOLDER';

    document.querySelectorAll('.dropdown-menu.show')?.forEach(menu => menu.classList.remove('show'));

    switch (action) {
        case '預覽':
            if (file.fileType === 'ONLINE_DOCUMENT') {
                await openEditor(file);
            } else {
                await getFileResource(file, 'preview');
            }
            break;
        case '下載':
            if (file.fileType === 'FOLDER') {
                await getFolderResource(file.id);
            } else if (file.fileType === 'ONLINE_DOCUMENT') {
                await getOnlineFileResource(file.id);
            } else {
                await getFileResource(file, 'download');
            }
            break;
        case '移動到回收桶':
            await removeFile(file.id, isFolder);
            break;
        case '永久刪除':
            await deleteFile(file.id, isFolder);
            break;
        case '還原':
            await restoreFile(file.id, isFolder);
            break;
        case '重新命名':
            await openEditFileModal(file, false);
            break;
        case '移動':
            await openMoveFileModal(file);
            break;
        case '分享':
            await openEditFileModal(file, true);
            break;
        case '加入星號':
        case '移除星號':
            loadEditData(file);
            document.getElementById("isStar").value = (action === '加入星號');
            document.getElementById('saveRenameEditFile')?.click();
            break;
        case '取得可分享連結':
            let link
            if (file.fileType === 'FOLDER') {
                link = `${window.location.origin}/web/folder/${file.id}`;
            } else if (file.fileType === 'ONLINE_DOCUMENT') {
                link = `${window.location.origin}/editor?id=${file.id}`;
            } else {
                link = `${window.location.origin}/preview?id=${file.id}`;
            }
            await copyToClipboard(link);
            break
        default:
            console.warn('未知操作：', action);
    }
});

async function openEditor(file) {
    window.name = JSON.stringify(file);
    window.location.href = `/editor?id=${file.id}`;
}


async function getFileResource(file, action) {
    try {
        if (action === "preview") {
            const folderId = file.parentFolderId ? file.parentFolderId : 0;
            window.open(`/preview?id=${file.id}&folder=${folderId}&type=${file.fileType}`, '_blank');
        } else {
            await fetch(`${config.backendUrl}/web/v1/files/${file.id}?action=download`, {
                method: 'GET',
                credentials: 'include'
            }).then(response => handleResponse(response));
        }
    } catch (error) {
        const errorMessages = error.response?.data?.message || error.message;
        $.NotificationApp.send(`下載錯誤:${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }
}

async function getFolderResource(folderId) {
    try {
        await fetch(`${config.backendUrl}/web/v1/folders/${folderId}/download`, {
            method: 'GET',
            credentials: 'include'
        }).then(response => handleResponse(response));

    } catch (error) {
        const errorMessages = error.response?.data?.message || error.message;
        $.NotificationApp.send(`下載錯誤:${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }
}

async function getOnlineFileResource(fileId) {
    try {
        await fetch(`${config.backendUrl}/web/v1/docs/${fileId}?action=download`, {
            method: 'GET',
            credentials: 'include'
        }).then(response => handleResponse(response));

    } catch (error) {
        const errorMessages = error.response?.data?.message || error.message;
        $.NotificationApp.send(`下載錯誤:${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }
}

async function deleteFile(fileId, isFolder) {
    if (isFolder) {
        webConnector.delete(`/folders/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            const errorMessages = error.response?.data?.message || error;
            $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    } else {
        webConnector.delete(`/files/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            const errorMessages = error.response?.data?.message || error;
            $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    }
}

async function removeFile(fileId, isFolder) {
    if (isFolder) {
        webConnector.post(`/folders/remove/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                $.NotificationApp.send(`成功移動到回收站`, "", "bottom-right", "rgba(0,0,0,0.2)", "success");
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            const errorMessages = error.response?.data?.message || error;
            $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    } else {
        webConnector.post(`/files/remove/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                $.NotificationApp.send(`成功移動到回收站`, "", "bottom-right", "rgba(0,0,0,0.2)", "success");
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            const errorMessages = error.response?.data?.message || error;
            $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    }
}

async function restoreFile(fileId, isFolder) {
    if (isFolder) {
        webConnector.post(`/folders/restore/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
                $.NotificationApp.send(`成功還原資料夾`, "", "bottom-right", "rgba(0,0,0,0.2)", "success");
            }
        }).catch(error => {
            const errorMessages = error.response?.data?.message || error;
            $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    } else {
        webConnector.post(`/files/restore/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
                $.NotificationApp.send(`成功還原檔案`, "", "bottom-right", "rgba(0,0,0,0.2)", "success");
            }
        }).catch(error => {
            const errorMessages = error.response?.data?.message || error;
            $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    }
}


function updateBreadcrumb(filePaths) {
    breadcrumb.innerHTML = '';
    filePaths.reverse().forEach((folder, index) => {
        const breadcrumbItem = document.createElement('li');
        breadcrumbItem.classList.add('breadcrumb-item');
        if (folder.folderId == null || folder.folderId === 0) {
            folder.folderId = 0;
            folder.name = '根目錄';
        }

        if (folder.folderId === currentFolderId || folder.folderId === null) {
            breadcrumbItem.classList.add('active');
            breadcrumbItem.textContent = folder.name;
        } else {
            const breadcrumbLink = document.createElement('a');
            breadcrumbLink.href = `javascript:void(0);`;
            breadcrumbLink.textContent = folder.name;
            breadcrumbLink.addEventListener('click', async () => {
                let folderId = folder.folderId == null ? 0 : folder.folderId;
                await fetchFileList(folderId);
            });
            breadcrumbItem.appendChild(breadcrumbLink);
        }

        breadcrumb.appendChild(breadcrumbItem);
    });
}

function getLabelName(file) {
    let name = file.filename;
    let label = document.createElement('i')
    label.classList.add('mdi', 'me-2', "text-primary", "mdi-24px");
    if (file.fileType === 'FOLDER') {
        label.classList.add('mdi-folder');
    } else if (file.fileType === 'ONLINE_DOCUMENT') {
        label.classList.add('mdi-file-document-edit');
    } else if (file.fileType === 'IMAGE') {
        label.classList.add('mdi-file-image');
    } else if (file.fileType === 'MUSIC') {
        label.classList.add('mdi-file-music');
    } else if (file.fileType === 'VIDEO') {
        label.classList.add('mdi-file-video');
    } else if (file.fileType === 'DOCUMENT') {
        label.classList.add('mdi-file-document');
    } else if (file.fileType === 'ZIP') {
        label.classList.add('mdi-zip-box');
    } else {
        label.classList.add('mdi-file');
    }
    name = label.outerHTML + name;


    if (file.isStar) {
        name += '<i class="mdi mdi-star text-warning ms-1"></i>';
    }
    return name;
}

function formatUrl(url, filter) {
    let params = "?";

    if (filter.size) {
        params += `&size=${filter.size}`;
    }

    if (filter.type) {
        params += `&type=${filter.type}`;
    }

    if (filter.page > 1) {
        params += `&page=${filter.page}`;
    }

    if (filter.keyword) {
        params += `&keyword=${filter.keyword}`;
    }

    if (filter.folder) {
        params += `&folder=${filter.folder}`;
    }

    if (filter.start) {
        params += `&start=${filter.start}`;
    }

    if (filter.end) {
        params += `&end=${filter.end}`;
    }

    if (filter.deleted) {
        params += `&deleted=${filter.deleted}`;
    }

    if (filter.shared) {
        params += `&shared=${filter.shared}`;
    }

    if (params !== "?") {
        params = params.replace("?&", "?");
        url += params;
    }
    return url;
}

function disableButton(folderId, isSearch) {
    if (folderId < 0 || isSearch) {
        document.getElementById("add-new-file-button")?.setAttribute("disabled", "true");
    } else {
        document.getElementById("add-new-file-button")?.removeAttribute("disabled");
    }
}

function generateActionItems(targetMenuElement, file, isRecycle) {
    targetMenuElement.innerHTML = '';

    const normalActions = [
        {icon: 'mdi-share-variant', text: '分享', condition: () => !isRecycle},
        {icon: 'mdi-link', text: '取得可分享連結', condition: () => !isRecycle},
        {icon: 'mdi-star', text: '加入星號', condition: (f) => !isRecycle && !f.isStar},
        {icon: 'mdi-star-outline', text: '移除星號', condition: (f) => !isRecycle && f.isStar},
        {icon: 'mdi-pencil', text: '重新命名', condition: () => !isRecycle},
        {icon: 'mdi-file-move', text: '移動', condition: () => !isRecycle},
        {icon: 'mdi-eye', text: '預覽', condition: (f) => !isRecycle && f.fileType !== 'FOLDER'},
        {icon: 'mdi-download', text: '下載', condition: () => !isRecycle},
        {icon: 'mdi-trash-can', text: '移動到回收桶', condition: () => !isRecycle},
    ];

    const recycleActions = [
        {icon: 'mdi-restore', text: '還原', condition: () => isRecycle},
        {icon: 'mdi-delete', text: '永久刪除', condition: () => isRecycle},
    ];

    const guestActions = [
        {icon: 'mdi-link', text: '取得可分享連結', condition: () => !isRecycle},
        {icon: 'mdi-eye', text: '預覽', condition: (f) => !isRecycle && f.fileType !== 'FOLDER'},
        {icon: 'mdi-download', text: '下載', condition: () => !isRecycle},
    ]

    let chooseActions;

    if (isGuest) {
        chooseActions = guestActions;
    } else if (isRecycle) {
        chooseActions = recycleActions;
    } else {
        chooseActions = normalActions;
    }


    chooseActions.forEach(action => {
        if (action.condition && !action.condition(file)) {
            return;
        }

        const actionItem = document.createElement('a');
        actionItem.href = '#';
        actionItem.classList.add('dropdown-item', 'notify-item');
        actionItem.dataset.action = action.text;
        actionItem.dataset.file = JSON.stringify(file)


        const actionIcon = document.createElement('i');
        actionIcon.classList.add("mdi", action.icon, 'me-2', 'text-muted', 'vertical-middle');
        actionItem.appendChild(actionIcon);

        const actionText = document.createElement('span');
        actionText.textContent = action.text;
        actionItem.appendChild(actionText);

        targetMenuElement.appendChild(actionItem);
    });
}

function formatSpecificPath(folderId) {
    const stringFolderId = String(folderId);
    return reservedPath[stringFolderId] || folderId;
}

export default {fetchFileList, currentFolderId};