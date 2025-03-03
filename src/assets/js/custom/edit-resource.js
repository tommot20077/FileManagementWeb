import apiConnector from "./api-connector.js";
import {currentFolderId, fetchFileList} from "./fetch-file-list.js";
import {buttonLoading} from "./component.js";

document.getElementById("add-new-folder").addEventListener('click', () => {
    document.getElementById("addFolderModal").classList.remove("hidden");
});

document.getElementById("addNewFolder").addEventListener('click', () => {
        const btn = document.getElementById("addNewFolder");
        const folderName = document.getElementById('newFolderName').value.trim();
        const errorContainer = document.getElementById('newFolderNameError');
        errorContainer.textContent = '';
        if (!folderName) {
            errorContainer.textContent = '資料夾名稱不能為空。';
            return;
        }

        buttonLoading(btn, true, '處理中...');

        try {
            const parentFolderId = currentFolderId === 0 ? null : currentFolderId;
            apiConnector.post('/api/folders', {
                filename: folderName,
                parentFolderId: parentFolderId,
                shareUsers: []
            }).then(response => {
                if (response.data.status === 200) {
                    document.getElementById('newFolderName').value = '';
                    document.getElementById("addFolderModal").classList.add("hidden");
                    fetchFileList(currentFolderId).then();
                } else {
                    errorContainer.textContent = response.data.message || '新增資料夾失敗。';
                }
            });
        } catch (error) {
            $.NotificationApp.send(`${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
            errorContainer.textContent = error.response?.data?.message || '發生錯誤，請稍後再試。';
        } finally {
            buttonLoading(btn, false, '新增');
        }

    }
);

document.getElementById("cancelAddNewFolder").addEventListener('click', () => {
    document.getElementById('newFolderName').value = '';
    document.getElementById("addFolderModal").classList.add("hidden");
    document.getElementById('newFolderNameError').textContent = '';
    buttonLoading(document.getElementById("addNewFolder"), false, '新增');
});


export async function openEditFileModal(file) {
    const editFileModalElement = document.getElementById('editFileModal');
    loadEditData(file);
    editFileModalElement.classList.remove('hidden');
}

export function loadEditData(file) {
    document.getElementById('editFileName').value = file.filename;
    document.getElementById('editFileId').value = file.id;
    document.getElementById("fileType").value = file.fileType;
    document.getElementById("isStar").value = file.isStar || false;
    document.getElementById('shareUsers').value = file.shareUsers || [];
    document.getElementById("parentFolderId").value = file.parentFolderId;
    document.getElementById('editFileNameError').textContent = '';
}

function cleanFileInformation() {
    document.getElementById('editFileName').value = '';
    document.getElementById('editFileId').value = '';
    document.getElementById("fileType").value = '';
    document.getElementById("isStar").value = '';
    document.getElementById('shareUsers').value = '';
    document.getElementById("parentFolderId").value = '';
    document.getElementById('editFileNameError').textContent = '';
}


// 編輯檔案模組
document.getElementById("saveEditFile").addEventListener('click', async () => {
    const newFileName = document.getElementById('editFileName').value.trim();
    const fileId = document.getElementById('editFileId').value;
    const isStar = document.getElementById("isStar").value;
    const fileType = document.getElementById("fileType").value;
    const shareUsers = document.getElementById('shareUsers').value;
    const parentFolderId = document.getElementById("parentFolderId").value;
    const errorContainer = document.getElementById('editFileNameError');

    const btn = document.getElementById("saveEditFile");

    // 清除之前的錯誤訊息
    errorContainer.textContent = '';

    if (!newFileName) {
        errorContainer.textContent = '檔案名稱不能為空。';
        return;
    }


    buttonLoading(btn, true, '處理中...');
    const url = (fileType === 'FOLDER') ? '/api/folders' : '/api/files';

    try {
        const response = await apiConnector.put(`${url}`, {
            filename: newFileName,
            fileId: fileId,
            shareUsers: shareUsers,
            parentFolderId: parentFolderId,
            isStar: isStar
        });

        if (response.data.status === 200) {
            cleanFileInformation();
            document.getElementById("editFileModal").classList.add("hidden");
            await fetchFileList(currentFolderId);
        } else {
            errorContainer.textContent = response.data.message || '編輯檔案失敗。';
        }
    } catch (error) {
        $.NotificationApp.send(`${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        errorContainer.textContent = error.response?.data?.message || '發生錯誤，請稍後再試。';
    } finally {
        buttonLoading(btn, false, '儲存');
    }
});

// 取消編輯檔案
document.getElementById("cancelEditFile").addEventListener('click', (e) => {
    e.preventDefault();
    cleanFileInformation();
    document.getElementById("editFileModal").classList.add("hidden");
    buttonLoading(document.getElementById("saveEditFile"), false, '儲存');
});


document.getElementById("addNewOnlineDocument").addEventListener('click', () => {
    let name = document.getElementById('newOnlineDocumentName').value.trim();
    if (!name) {
        $.NotificationApp.send("檔案名稱不能為空", "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return;
    }
    const btn = document.getElementById("addNewOnlineDocument");
    buttonLoading(btn, true, '處理中...');

    apiConnector.post('/api/docs/upload', {
        filename: name,
        parentFolderId: currentFolderId === 0 ? null : currentFolderId,
    }).then(response => {
        if (response.data.status === 200) {
            document.getElementById('newOnlineDocumentName').value = "";
            $.NotificationApp.send("檔案建立成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
            setTimeout(() => {
                $('#add-online-document-modal').modal('hide');
            }, 1000);
            fetchFileList(currentFolderId).then();
            return;
        }
        throw new Error(response.data.message || '新增檔案失敗。');
    }).catch(error => {
        $.NotificationApp.send(`檔案建立失敗:${error.response?.data?.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }).finally(() => {
        buttonLoading(btn, false, '新增');
    });
});

export default {openEditFileModal};