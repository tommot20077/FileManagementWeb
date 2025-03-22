import webConnector from "./web-connector.js";
import {currentFolderId, fetchFileList} from "./fetch-file-list.js";
import {buttonLoading} from "./component.js";

document.getElementById("add-new-folder").addEventListener('click', () => {
    document.getElementById("addFolderModal").classList.remove("hidden");
});

document.getElementById("addNewFolder").addEventListener('click', async () => {
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
            const response = await webConnector.post('/folders', {
                filename: folderName,
                parentFolderId: parentFolderId,
            });

            if (response.data.status === 200) {
                document.getElementById('newFolderName').value = '';
                document.getElementById("addFolderModal").classList.add("hidden");
                fetchFileList(currentFolderId).then(() => {
                    buttonLoading(btn, false, '新增');
                });
                $.NotificationApp.send("新增資料夾成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
                return;
            }
            errorContainer.textContent = response.data.message || '新增資料夾失敗。';
            Error(response.data.message)

        } catch (error) {
            buttonLoading(btn, false, '新增');
            const errorMessages = error.response?.data?.message || error;
            $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
            errorContainer.textContent = errorMessages
        }

    }
);

document.getElementById("cancelAddNewFolder").addEventListener('click', () => {
    document.getElementById('newFolderName').value = '';
    document.getElementById("addFolderModal").classList.add("hidden");
    document.getElementById('newFolderNameError').textContent = '';
    buttonLoading(document.getElementById("addNewFolder"), false, '新增');
});


export async function openEditFileModal(file, isEditShare) {
    loadEditData(file)
    if (isEditShare) {
        document.getElementById("recursiveSettingSwitch").disabled = file.fileType !== "FOLDER";

        const shareUsersElement = $('#shareUsers');
        const chooseShareTypeElement = document.getElementById('share-type');

        shareUsersElement.select2({
            placeholder: "選擇用戶",
            allowClear: true,
            tags: true,
        });

        if (chooseShareTypeElement.value === 'NONE') {
            shareUsersElement.prop('disabled', true);
        } else {
            shareUsersElement.prop('disabled', false);
        }
        const existingUsers = await formatShareUsers(file.shareUsers)
        document.getElementById("existShareUsers").value = existingUsers.map((user) => user[1]);
        const shareUsers = document.getElementById('shareUsers')


        existingUsers.forEach(user => {
            let option = document.createElement("option");
            option.text = user[0];
            option.value = user[1];
            option.selected = true;
            shareUsers.appendChild(option);
        });
    }

    const id = isEditShare ? 'editShareFileModal' : 'renameFileModal';
    const element = document.getElementById(`${id}`);
    element.classList.remove('hidden');

}

export function loadEditData(file) {
    document.getElementById('editFileName').value = file.filename;
    document.getElementById('editFileId').value = file.id;
    document.getElementById("fileType").value = file.fileType;
    document.getElementById("isStar").value = file.isStar || false;
    document.getElementById("parentFolderId").value = file.parentFolderId;
    document.getElementById('renameFileNameError').textContent = '';
    document.getElementById('editFileShareError').textContent = ''
    document.getElementById('shareUsers').innerHTML = '';
    document.getElementById('share-type').value = String(file.shareType)?.toUpperCase() || 'NONE';

    return file
}

async function formatShareUsers(userIds) {
    let shareUsers = [];
    try {
        if (userIds.length === 0) {
            return shareUsers;
        }

        const response = await webConnector.get("/user/info/search", {
            xsrfCookieName: 'useless',
            params: {userInfos: userIds, type: 'id'}
        });

        if (response.data.status === 200) {
            const userInfosMap = response.data.data.foundUser;
            userIds.forEach((userId) => {
                if (userInfosMap[userId]) {
                    shareUsers.push([userInfosMap[userId], userId]);
                }
            });
        }
        new Error(response.data.message)
    } catch (error) {
        $.NotificationApp.send(`${error.response?.data?.message || '取得使用者資訊失敗。'}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        cleanFileInformation();
        document.getElementById("renameFileModal").classList.add("hidden");
    }
    return shareUsers;
}

function cleanFileInformation() {
    document.getElementById('editFileName').value = '';
    document.getElementById('editFileId').value = '';
    document.getElementById("fileType").value = '';
    document.getElementById("isStar").value = '';
    document.getElementById('existShareUsers').value = [];
    document.getElementById("parentFolderId").value = '';
    document.getElementById('renameFileNameError').textContent = '';
    document.getElementById("recursiveSettingSwitch").checked = false;
}

async function saveEditFile(isEditShare) {
    const fileName = document.getElementById('editFileName').value.trim();
    const fileId = document.getElementById('editFileId').value;
    const isStar = document.getElementById("isStar").value;
    const fileType = document.getElementById("fileType").value;
    const parentFolderId = document.getElementById("parentFolderId").value;
    const shareType = document.getElementById('share-type').value;
    const isRecurseSetting = document.getElementById('recursiveSettingSwitch').checked;
    const errorContainer = isEditShare ? document.getElementById('editFileShareError') : document.getElementById('renameFileNameError');

    const btn = isEditShare ? document.getElementById("saveShareEditFile") : document.getElementById("saveRenameEditFile");

    errorContainer.textContent = '';

    if (!fileName) {
        errorContainer.textContent = '檔案名稱不能為空。';
        return;
    }

    buttonLoading(btn, true, '處理中...');
    const url = (fileType === 'FOLDER') ? '/folders' : '/files';


    const sendData = {
        filename: fileName,
        fileId: fileId,
        parentFolderId: parentFolderId,
        isStar: isStar
    }


    try {
        if (isEditShare) {
            let selectedUsers = $('#shareUsers').val() || [];

            const existingUserIds = [...document.getElementById("existShareUsers").value.split(",")];

            const addUsernames = selectedUsers.filter(id => !existingUserIds.includes(id));
            const removeUsers = existingUserIds.filter(id => !selectedUsers.includes(id)).filter(id => id !== null && id !== "");
            const noChangeUsers = existingUserIds.filter(id => selectedUsers.includes(id));
            const editUsers = [
                ...removeUsers.map(userId => ({userId, editType: 'remove'})),
            ];
            if (addUsernames.length > 0) {
                await webConnector.get("/user/info/search", {
                    xsrfCookieName: 'useless',
                    params: {userInfos: addUsernames}
                }).then(response => {
                    if (response.data.status === 200) {
                        if (response.data.data.notFoundUser.length !== 0) {
                            throw new Error("使用者不存在：" + response.data.data.notFoundUser.join(", "));
                        }
                        const userInfosMap = response.data.data.foundUser;
                        addUsernames.forEach((username) => {
                            editUsers.push({userId: userInfosMap[username], editType: 'add'});
                        })
                        return
                    }
                    throw new Error(response.data.message || '取得使用者資訊失敗。');
                })
            }
            if (isRecurseSetting) {
                noChangeUsers.forEach((userId) => {
                    editUsers.push({userId, editType: 'update'});
                })
            }

            sendData.shareUsers = editUsers
            sendData.shareType = shareType;
            sendData.recursiveSetting = isRecurseSetting;
        }
        const response = await webConnector.put(`${url}`, sendData);

        if (response.data.status === 200) {
            $.NotificationApp.send("檔案編輯成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
            cleanFileInformation();
            if (isEditShare) {
                document.getElementById("editShareFileModal").classList.add("hidden");
            } else {
                document.getElementById("renameFileModal").classList.add("hidden");
            }

            await fetchFileList(currentFolderId);
        } else {
            errorContainer.textContent = response.data.message || '編輯檔案失敗。';
        }
    } catch (error) {
        const errorMessages = error.response?.data?.message || error;
        $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        errorContainer.textContent = errorMessages;
    } finally {
        buttonLoading(btn, false, '儲存');
    }
}

document.getElementById("saveRenameEditFile").addEventListener('click', () => saveEditFile(false));
document.getElementById("saveShareEditFile").addEventListener('click', () => saveEditFile(true));

document.getElementById("cancelRenameEditFile").addEventListener('click', (e) => {
    cleanEditFile(e, false);
});
document.getElementById("cancelShareEditFile").addEventListener('click', (e) => {
    cleanEditFile(e, true);
})

function cleanEditFile(e, isEditShare) {
    e.preventDefault();
    cleanFileInformation();
    if (isEditShare) {
        document.getElementById("editShareFileModal").classList.add("hidden");
        buttonLoading(document.getElementById("saveShareEditFile"), false, '儲存');
    } else {
        document.getElementById("renameFileModal").classList.add("hidden");
        buttonLoading(document.getElementById("saveRenameEditFile"), false, '儲存');
    }
}


document.getElementById("share-type").addEventListener('change', (e) => {
    const shareUsers = $('#shareUsers');
    if (e.target.value === 'NONE') {
        shareUsers.prop('disabled', true);
    } else {
        shareUsers.prop('disabled', false);
    }
})


document.getElementById("addNewOnlineDocument").addEventListener('click', () => {
    let name = document.getElementById('newOnlineDocumentName').value.trim();
    if (!name) {
        $.NotificationApp.send("檔案名稱不能為空", "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return;
    }
    const btn = document.getElementById("addNewOnlineDocument");
    buttonLoading(btn, true, '處理中...');

    webConnector.post('/docs/upload', {
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
        const errorMessages = error.response?.data?.message || error;
        $.NotificationApp.send(`檔案建立失敗:${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }).finally(() => {
        buttonLoading(btn, false, '新增');
    });
});

export default {openEditFileModal: openEditFileModal};