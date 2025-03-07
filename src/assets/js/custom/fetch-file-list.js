import webConnector from "./web-connector.js";
import {formatFileSize, reservedPath, updatePaginationControls} from "./tool.js";
import config from "../../../../config.js";
import {loadEditData, openEditFileModal} from "./edit-resource.js";
import {openMoveFileModal} from "./folder-tree.js";
import streamSaver from 'streamsaver';
import {getUserInfo} from "./user-info.js";

export let currentFolderId = 0;
const breadcrumb = document.getElementById('breadcrumb');

export async function fetchFileList(folderId = 0, updateUrl = true, filter = {}, isSearch = false) {
    currentFolderId = folderId;
    let response;
    try {
        disableButton(folderId, isSearch);
        let url = isSearch ? `/files/search` : `/folders/${folderId}`;

        response = await webConnector.get(formatUrl(url, filter), {xsrfCookieName: "useless"});
        const files = response.data.data.files.data;
        const tbody = document.querySelector('.table-responsive tbody');
        const username = response.data.data.username;
        const userId = response.data.data.userId;
        const filePaths = response.data.data.filePaths;
        const totalPages = response.data.data.files.totalPages;
        const currentPage = response.data.data.files.currentPage;

        const isRecycle = parseInt(String(folderId)) === -4

        updateBreadcrumb(filePaths);

        tbody.innerHTML = '';

        files.forEach(file => {
            const tr = document.createElement('tr');

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
                        await getFileResource(file.id, 'preview');
                    }
                });
            }


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
            ownerTd.textContent = username;
            if (file.fileType !== 'FOLDER') {
                sizeTd.textContent = formatFileSize(file.fileSize);
            } else {
                sizeTd.textContent = '-';
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

            const normalActions = [
                {icon: 'mdi-share-variant', text: '分享'},
                {icon: 'mdi-link', text: '取得可分享連結'},
                {icon: 'mdi-star', text: '加入星號'},
                {icon: 'mdi-star-outline', text: '移除星號'},
                {icon: 'mdi-pencil', text: '重新命名'},
                {icon: 'mdi-file-move', text: '移動'},
                {icon: 'mdi-eye', text: '預覽'},
                {icon: 'mdi-download', text: '下載'},
                {icon: 'mdi-trash-can', text: '移動到回收桶'},
            ];

            const recycleActions = [
                {icon: 'mdi-restore', text: '還原'},
                {icon: 'mdi-delete', text: '永久刪除'},
            ];

            const chooseActions = parseInt(String(folderId)) === -4 ? recycleActions : normalActions;

            chooseActions.forEach(action => {
                if (file.fileType === 'FOLDER' && (action.text === '預覽' || action.text === '下載')) {
                    return;
                }
                if (file.fileType === 'ONLINE_DOCUMENT' && action.text === '下載') {
                    return;
                }
                if ((file.isStar && action.text === '加入星號') || (!file.isStar && action.text === '移除星號')) {
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
                } else if (action.text === '移動到回收桶') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await removeFile(file.id, file.fileType === 'FOLDER');
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
                } else if (action.text === '加入星號' || action.text === '移除星號') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        loadEditData(file)
                        document.getElementById("isStar").value = '加入星號' === action.text;
                        document.getElementById('saveEditFile').click();
                    });
                } else if (action.text === '永久刪除') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await deleteFile(file.id, file.fileType === 'FOLDER');
                    });
                } else if (action.text === '還原') {
                    actionItem.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await restoreFile(file.id, file.fileType === 'FOLDER');
                    });
                }

                dropdownMenu.appendChild(actionItem);
            });

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
    } catch (error) {
        console.error(error);
        $.NotificationApp.send(`${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
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
            const response = await fetch(`${config.backendUrl}/web/v1/files/${fileId}?action=download`, {
                method: 'GET',
                credentials: 'include'
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
        $.NotificationApp.send(`下載錯誤:${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
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
        webConnector.delete(`/folders/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            $.NotificationApp.send(`${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    } else {
        webConnector.delete(`/files/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            $.NotificationApp.send(`${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    }
}

async function removeFile(fileId, isFolder) {
    if (isFolder) {
        webConnector.post(`/folders/remove/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            $.NotificationApp.send(`${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    } else {
        webConnector.post(`/files/remove/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            $.NotificationApp.send(`${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
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
            }
        }).catch(error => {
            $.NotificationApp.send(`${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    } else {
        webConnector.post(`/files/restore/${fileId}`).then(response => {
            const status = response.data.status;
            if (status === 200) {
                fetchFileList(currentFolderId).then();
                getUserInfo(true);
            }
        }).catch(error => {
            $.NotificationApp.send(`${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
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

    if (params !== "?") {
        params = params.replace("?&", "?");
        url += params;
    }
    return url;
}

function disableButton(folderId, isSearch) {
    if (folderId < 0 || isSearch) {
        document.getElementById("add-new-file-button").setAttribute("disabled", "true");
    } else {
        document.getElementById("add-new-file-button").removeAttribute("disabled");
    }
}
export default {fetchFileList, currentFolderId};