import apiConnector from "./api-connector.js";
import {formatFileSize, updatePaginationControls} from "./tool.js";
import config from "../../../../config.js";
import {openEditFileModal} from "./edit-resource.js";
import {openMoveFileModal} from "./folder-tree.js";
import streamSaver from 'streamsaver';
import {getUserInfo} from "./user-info.js";

export let currentFolderId = 0;
const breadcrumb = document.getElementById('breadcrumb');

export async function fetchFileList(folderId = 0, page = 1, updateUrl = true, pageSize, type) {
    currentFolderId = folderId;
    let response;
    try {
        let url = `/api/folders/${folderId}`
        let params = "?";

        if (pageSize) {
            params += `&size=${pageSize}`;
        }

        if (type) {
            params += `&type=${type}`;
        }
        if (page) {
            params += `&page=${page}`;
        }
        if (params !== "?") {
            params = params.replace("?&", "?");
            url += params;
        }
        response = await apiConnector.get(url);
        const files = response.data.data.files.data;
        const tbody = document.querySelector('.table-responsive tbody');
        const username = response.data.data.username;
        const userId = response.data.data.userId;
        const filePaths = response.data.data.filePaths;
        const totalPages = response.data.data.files.totalPages;
        const currentPage = response.data.data.files.currentPage;

        updateBreadcrumb(filePaths);

        tbody.innerHTML = '';

        files.forEach(file => {
            const tr = document.createElement('tr');

            const nameTd = document.createElement('td');
            nameTd.style.maxWidth = '200px';
            nameTd.classList.add('text-truncate');
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('ms-2', 'fw-semibold');
            nameTd.style.maxWidth = '200px';
            const nameLink = document.createElement('a');
            nameLink.href = 'javascript:void(0);';
            nameLink.classList.add('text-reset');
            nameLink.textContent = file.filename;
            nameLink.title = file.filename;
            nameSpan.appendChild(nameLink);
            nameTd.appendChild(nameSpan);
            tr.appendChild(nameTd);

            nameLink.addEventListener('click', async (e) => {
                e.preventDefault();
                if (file.folder) {
                    await fetchFileList(file.id);
                } else if (file.fileType === 'ONLINE_DOCUMENT') {
                    await openEditor(file);
                }
                else {
                    await getFileResource(file.id, 'preview');
                }
            });


            const modifiedTd = document.createElement('td');
            const modifiedP = document.createElement('p');
            modifiedP.classList.add('mb-0');
            modifiedP.textContent = file.lastAccessTime;
            const modifiedSpan = document.createElement('span');
            modifiedSpan.classList.add('font-12');
            modifiedSpan.textContent = `由 ${username}`;
            modifiedTd.appendChild(modifiedP);
            modifiedTd.appendChild(modifiedSpan);
            tr.appendChild(modifiedTd);

            const sizeTd = document.createElement('td');
            const ownerTd = document.createElement('td');
            if (!file.folder) {
                sizeTd.textContent = formatFileSize(file.fileSize);
                ownerTd.textContent = username;
            } else {
                sizeTd.textContent = '-';
                ownerTd.textContent = '-';
            }
            tr.appendChild(sizeTd);
            tr.appendChild(ownerTd);

            const membersTd = document.createElement('td');
            membersTd.id = `tooltip-container-${file.id}`;
            const avatarGroup = document.createElement('div');
            avatarGroup.classList.add('avatar-group');

            file.shareUsers.forEach(member => {
                const memberLink = document.createElement('a');
                memberLink.href = 'javascript:void(0);';
                memberLink.classList.add('avatar-group-item', 'mb-0');
                memberLink.setAttribute('data-bs-container', `#tooltip-container-${file.id}`);
                memberLink.setAttribute('data-bs-toggle', 'tooltip');
                memberLink.setAttribute('data-bs-placement', 'top');
                memberLink.setAttribute('title', member.name);
                /*
                const memberImg = document.createElement('img');
                memberImg.src = member.avatarUrl;
                memberImg.classList.add('rounded-circle', 'avatar-xs');
                memberImg.alt = '朋友';
                memberLink.appendChild(memberImg);

                 */

                avatarGroup.appendChild(memberLink);
            });

            membersTd.appendChild(avatarGroup);
            tr.appendChild(membersTd);

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

            const actions = [
                {icon: 'mdi-share-variant', text: '分享'},
                {icon: 'mdi-link', text: '取得可分享連結'},
                {icon: 'mdi-pencil', text: '重新命名'},
                {icon: 'mdi-file-move', text: '移動'},
                {icon: 'mdi-eye', text: '預覽'},
                {icon: 'mdi-download', text: '下載'},
                {icon: 'mdi-delete', text: '移除'},
            ];

            actions.forEach(action => {
                if (file.folder && (action.text === '預覽' || action.text === '下載')) {
                    return;
                }
                if (file.fileType === 'ONLINE_DOCUMENT' && action.text === '下載') {
                    return;
                }


                const actionItem = document.createElement('a');
                actionItem.href = '#';
                actionItem.classList.add('dropdown-item', 'notify-item');

                const actionIcon = document.createElement('i');
                actionIcon.classList.add("mdi", action.icon, 'me-2', 'text-muted', 'vertical-middle');
                actionItem.appendChild(actionIcon);

                const actionText = document.createElement('span');
                actionText.textContent = action.text;
                actionItem.appendChild(actionText);

                if (action.text === '預覽') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        if (file.fileType === 'ONLINE_DOCUMENT') {
                            await openEditor(file);
                        } else {
                            await getFileResource(file.id, 'preview');
                        }
                    });
                } else if (action.text === '下載') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await getFileResource(file.id, 'download');
                    });
                } else if (action.text === '移除') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await deleteFile(file.id, file.folder);
                    });
                } else if (action.text === '重新命名') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await openEditFileModal(file);
                    });
                } else if (action.text === '移動') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await openMoveFileModal(file);
                    });
                }


                dropdownMenu.appendChild(actionItem);
            });

            btnGroup.appendChild(dropdownMenu);
            actionsTd.appendChild(btnGroup);
            tr.appendChild(actionsTd);

            tbody.appendChild(tr);
        });

        updatePaginationControls(currentPage, totalPages, pageSize, type);

        if (updateUrl) {
            let newUrl = `/web/folder/${folderId}`;
            let paramsName = {}

            if (params !== "?") {
                newUrl += params;
            }

            if (type) {
                paramsName.type = type;
            }
            if (pageSize) {
                paramsName.size = pageSize;
            }
            if (page) {
                paramsName.page = page;
            }
            window.history.pushState(paramsName, '', newUrl);
        }
    } catch (e) {
        console.error(e);
    }
}
async function openEditor(file) {
    window.name = JSON.stringify(file);
    window.location.href = `/editor?id=${file.id}`;
}


async function getFileResource(fileId, action) {
    try {
        if (action === "preview") {
            window.open(`/preview?id=${fileId}`, '_blank');
        } else {
            const response = await fetch(`${config.apiUrl}/api/files/${fileId}?action=download`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.jwt}`
                }
            });

            if (!response.ok) {
                new Error('下載失敗');
            }

            const filename = getFilenameFromHeaders(response.headers);
            const fileStream = streamSaver.createWriteStream(filename, {
                size: response.headers.get('Content-Length')
            })

            const readableStream = response.body;
            if (window.WritableStream && readableStream.pipeTo) {
                return readableStream.pipeTo(fileStream).then(() => {
                })
            }
            window.writer = fileStream.getWriter();
            const reader = response.body.getReader();
            const pump = () => reader.read().then(res => res.done ?
                window.writer.close() : window.writer.write(res.value).then(pump))
            await pump();
        }
    } catch (error) {
        console.error('下載錯誤:', error);
    }
}


function getFilenameFromHeaders(headers) {
    const contentDisposition = headers.get('Content-Disposition');
    if (contentDisposition) {
        const filenameMatch =
            contentDisposition.match(/filename\*=UTF-8''([^;]+)/i) ||
            contentDisposition.match(/filename="?(.+)"?/i);

        return filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'download';
    }
    return 'download';
}

async function deleteFile(fileId, isFolder) {
    if (isFolder) {
        apiConnector.delete(`/api/folders/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            console.error(error);
        });
    } else {
        apiConnector.delete(`/api/files/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            console.error(error);
        });
    }
}

function updateBreadcrumb(filePaths) {
    breadcrumb.innerHTML = '';
    filePaths.reverse().forEach((folder, index) => {
        const breadcrumbItem = document.createElement('li');
        breadcrumbItem.classList.add('breadcrumb-item');
        if (folder.folderId == null) {
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

export default {fetchFileList, currentFolderId};