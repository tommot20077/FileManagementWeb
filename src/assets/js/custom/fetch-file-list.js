import apiConnector from "./api-connector.js";
import {formatFileSize} from "./tool.js";
import config from "../../../../config.js";
import {openEditFileModal} from "./edit-resource.js";
import {openMoveFileModal} from "./folder-tree.js";

export let currentFolderId = 0;
const breadcrumb = document.getElementById('breadcrumb');
const pathStack = [{
    id: 0,
    name: '根目錄'
}];


export async function fetchFileList(folderId = 0, shouldPush = true) {
    currentFolderId = folderId;
    let response;
    try {
        response = await apiConnector.get(`/api/folders/${folderId}`);
        const files = response.data.data.files;
        const tbody = document.querySelector('.table-responsive tbody');
        const username = response.data.data.username;
        const userId = response.data.data.userId;

        if (folderId === 0) {
            pathStack.length = 1;
        } else if (shouldPush) {
            const currentFolderName = response.data.data.parentFolder.filename || '資料夾';
            pathStack.push({
                id: folderId,
                name: currentFolderName
            });
        }

        updateBreadcrumb();

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
                } else {
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
                if (file.folder && action.text === '預覽') {
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
                        await getFileResource(file.id, 'preview');
                    });
                } else if (action.text === '下載') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await getFileResource(file.id,'download');
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

    } catch (e) {
        console.error(e);
    }
}

async function getFileResource(fileId, action) {
    try {
        const previewResponse = await fetch(`${config.apiUrl}/api/files/${fileId}?action=${action}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.jwt}`
            }
        });
        if (previewResponse.ok) {
            const blob = await previewResponse.blob();
            const url = URL.createObjectURL(blob);
            if (action === 'preview') {
                window.open(url, '_blank');
            } else {
                const a = document.createElement('a');
                a.href = url;
                const contentDisposition = previewResponse.headers.get('Content-Disposition');
                let fileName = 'file';
                if (contentDisposition && contentDisposition.includes('filename=')) {
                    fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
                }
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }
        } else {
            console.error('下載失敗');
        }
    } catch (error) {
        console.error('錯誤:', error);
    }
}

async function deleteFile(fileId, isFolder) {
    if (isFolder) {
        apiConnector.delete(`/api/folders/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId, false).then();
            }
        } ).catch(error => {
            console.error(error);
        });
    } else {
        apiConnector.delete(`/api/files/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId, false).then();
            }
        }).catch(error => {
            console.error(error);
        });
    }
}

function updateBreadcrumb() {
    breadcrumb.innerHTML = '';

    pathStack.forEach((folder, index) => {
        if (index > 0) {
            const separator = document.createElement('li');
            separator.classList.add('breadcrumb-item', 'separator');
            separator.innerHTML = `<i class="mdi mdi-chevron-right"></i>`;
            breadcrumb.appendChild(separator);
        }

        const breadcrumbItem = document.createElement('li');
        breadcrumbItem.classList.add('breadcrumb-item');

        if (index === pathStack.length - 1) {
            breadcrumbItem.classList.add('active');
            breadcrumbItem.textContent = folder.name;
        } else {
            const breadcrumbLink = document.createElement('a');
            breadcrumbLink.href = `?parent-folder-id=${folder.id}`;
            breadcrumbLink.textContent = folder.name;
            breadcrumbItem.appendChild(breadcrumbLink);
        }

        breadcrumb.appendChild(breadcrumbItem);
    });
}
export default {fetchFileList, currentFolderId};