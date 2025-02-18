import apiConnector from "./api-connector.js";
import {currentFolderId, fetchFileList} from "./fetch-file-list.js";

document.getElementById("add-new-folder").addEventListener('click', () => {
    document.getElementById("addFolderModal").classList.remove("hidden");
});

document.getElementById("addNewFolder").addEventListener('click', () => {
        const folderName = document.getElementById('newFolderName').value.trim();
        const errorContainer = document.getElementById('newFolderNameError');
        errorContainer.textContent = '';
        if (!folderName) {
            errorContainer.textContent = '資料夾名稱不能為空。';
            return;
        }

        try {
            const parentFolderId = currentFolderId === 0 ? null : currentFolderId;
            apiConnector.post('/api/folders', {
                fileName: folderName,
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
            console.error(error);
            errorContainer.textContent = error.response?.data?.message || '發生錯誤，請稍後再試。';
        }

    }
);

document.getElementById("cancelAddNewFolder").addEventListener('click', () => {
    document.getElementById('newFolderName').value = '';
    document.getElementById("addFolderModal").classList.add("hidden");
    document.getElementById('newFolderNameError').textContent = '';
});


export async function openEditFileModal(file) {
    const editFileModalElement = document.getElementById('editFileModal');
    document.getElementById('editFileName').value = file.filename;
    document.getElementById('editFileId').value = file.id;
    document.getElementById("isFolder").value = file.folder;
    document.getElementById('shareUsers').value = file.shareUsers || [];
    document.getElementById("parentFolderId").value = file.parentFolderId;
    document.getElementById('editFileNameError').textContent = '';
    editFileModalElement.classList.remove('hidden');
}

// 編輯檔案模組
document.getElementById("saveEditFile").addEventListener('click', async () => {
    const newFileName = document.getElementById('editFileName').value.trim();
    const fileId = document.getElementById('editFileId').value;
    const isFolder = document.getElementById("isFolder").value;
    const shareUsers = document.getElementById('shareUsers').value;
    const parentFolderId = document.getElementById("parentFolderId").value;
    const errorContainer = document.getElementById('editFileNameError');

    // 清除之前的錯誤訊息
    errorContainer.textContent = '';

    if (!newFileName) {
        errorContainer.textContent = '檔案名稱不能為空。';
        return;
    }

    const url = isFolder === 'true' ? '/api/folders' : '/api/files';

    try {
        const response = await apiConnector.put(`${url}`, {
            fileName: newFileName,
            fileId: fileId,
            shareUsers: shareUsers,
            parentFolderId: parentFolderId
        });

        if (response.data.status === 200) {
            // 編輯成功
            document.getElementById('editFileName').value = '';
            document.getElementById('editFileId').value = '';
            document.getElementById("isFolder").value = '';
            document.getElementById("editFileModal").classList.add("hidden");
            await fetchFileList(currentFolderId);
        } else {
            // 後端返回錯誤狀態
            errorContainer.textContent = response.data.message || '編輯檔案失敗。';
        }
    } catch (error) {
        console.error(error);
        errorContainer.textContent = error.response?.data?.message || '發生錯誤，請稍後再試。';
    }
});

// 取消編輯檔案
document.getElementById("cancelEditFile").addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('editFileName').value = '';
    document.getElementById('editFileId').value = '';
    document.getElementById("editFileModal").classList.add("hidden");
    document.getElementById('editFileNameError').textContent = '';
});


document.getElementById("addNewOnlineDocument").addEventListener('click', () => {
    const name = document.getElementById('newOnlineDocumentName').value.trim();
    if (!name) {
        $.NotificationApp.send("檔案名稱不能為空","","bottom-right","rgba(0,0,0,0.2)","warning");
        return;
    }


    apiConnector.post('/api/docs/upload', {
        fileName:  name,
        parentFolderId: currentFolderId === 0 ? null : currentFolderId,
    }).then(response => {
        if (response.data.status === 200) {

            $.NotificationApp.send("檔案建立成功","","bottom-right","rgba(0,0,0,0.2)","success");
            setTimeout(() => {
                $('#add-online-document-modal').modal('hide');
            }, 1000);
            fetchFileList(currentFolderId).then();
            return;
        }
        throw new Error(response.data.message || '新增檔案失敗。');
    }).catch(error => {
        console.error(error);
        $.NotificationApp.send(`檔案建立失敗: ${error}`,"","bottom-right","rgba(0,0,0,0.2)","error");
    });
});




export default {openEditFileModal};