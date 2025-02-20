import Dropzone from 'dropzone';
import SparkMD5 from 'spark-md5';
import Config from "../../../../config.js";
import uploadManager from "./upload-manager.js";

import ChunkUploadManager from "./chunk-upload-manager.js";
import {fetchFileList, currentFolderId} from "./fetch-file-list.js";
import {getUserInfo} from "./user-info.js";

// 禁用 Dropzone 的自動發起請求
Dropzone.autoDiscover = false;

// 初始化 Dropzone
let myDropzone;
let jwtToken = null;

document.addEventListener('DOMContentLoaded', () => {
    // 確保 Dropzone 僅初始化一次
    const dropzoneElement = document.getElementById('dropzone');
    if (dropzoneElement && !dropzoneElement.dropzone) {
        myDropzone = new Dropzone(dropzoneElement, {
            url: `${Config.apiUrl}/api/files/upload`,
            autoProcessQueue: false, // 禁用自動上傳
            previewsContainer: "#file-previews",
            previewTemplate: document.querySelector("#uploadPreviewTemplate").innerHTML,
            clickable: ".dz-message.needsclick"
        });

        // 成功添加文件的處理
        myDropzone.on("addedfile", function (file) {
            const spark = new SparkMD5.ArrayBuffer();
            const reader = new FileReader();
            const CHUNK_SIZE = Config.MD5ChunkSize || 1024 * 1024 * 2

            const chunks = Math.ceil(file.size / CHUNK_SIZE);

            toggleUploadButtons(true, false);
            file.uploadStatus = "processing";

            function loadNext() {
                const start = (file.currentChunk || 0) * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                reader.readAsArrayBuffer(chunk);
            }

            reader.onload = function (e) {
                spark.append(e.target.result);
                file.currentChunk = (file.currentChunk || 0) + 1;

                const progress = Math.round((file.currentChunk / chunks) * 100);
                updateProgress(
                    file.previewElement,
                    progress,
                    'calculating',
                    null
                );
                if (file.currentChunk < chunks) {
                    loadNext();
                } else {
                    const FileMD5 = spark.end();
                    let parentFolderId = ""
                    if (currentFolderId > 0) {
                        parentFolderId = currentFolderId;
                    }

                    file.fileMetadata = {
                        filename: file.name,
                        parentFolderId: parentFolderId,
                        md5: FileMD5,
                        fileSize: file.size,
                    };
                    file.uploadStatus = "pending";
                    updateProgress(file.previewElement, 0, 'pending', '等待上傳');
                    checkAllFilesProcessed();
                }
            };
            reader.onerror = function () {
                updateProgress(file.previewElement, 0, 'error', '雜湊值計算失敗');
                $.NotificationApp.send("檔案讀取錯誤", "", "bottom-right", "rgba(0,0,0,0.2)", "error");
                file.uploadStatus = "failed";
                checkAllFilesProcessed();
            };
            loadNext();
        });
    }
});

// 處理上傳按鈕點擊事件
document.getElementById('submitUpload').addEventListener('click', () => {
    removeDropzoneHandleFile(myDropzone);
    const files = myDropzone.files;
    if (myDropzone && files.length === 0) {
        $
        return;
    }

    toggleUploadButtons(true);

    files.forEach(file => {
        const metadata = file.fileMetadata;
        if (!metadata) {
            $.NotificationApp.send("文件 ${file.name} 沒有 fileMetadata，跳過上傳。", "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
            updateProgress(file.previewElement, 0, 'failed', '無效的文件元數據');
            file.uploadStatus = "failed";
            if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                toggleUploadButtons(false);
            }
            return;
        }

        const uploadTask = () => {
            return new Promise((resolve, reject) => {
                const chunkManager = new ChunkUploadManager(
                    file,
                    'http',
                    (percentage, status, message) => {
                        updateProgress(file.previewElement, percentage, status, message);
                    },
                    () => {
                        resolve();
                        // 檢查是否所有任務完成
                        if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                            toggleUploadButtons(false);
                        }
                    },
                    (error) => {
                        $.NotificationApp.send(`文件 ${file.name} 上傳失敗`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
                        toggleUploadButtons(false);
                        reject(error);
                    },
                    Config.maxConcurrentChunks || 5,
                    jwtToken
                );

                chunkManager.start();
            });
        };

        uploadManager.enqueue(uploadTask)
                     .then(() => {
                         // 檢查是否所有任務完成
                         if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                             toggleUploadButtons(false);
                         }
                     })
                     .catch(err => {
                         $.NotificationApp.send(`文件 ${file.name} 上傳失敗:${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
                         if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                             toggleUploadButtons(false);
                         }
                     });
    });
});

document.getElementById("submitToken").addEventListener("click", (e) => {
    e.preventDefault()
    jwtToken = document.getElementById("jwtToken").value;
});

document.getElementById('submitUploadWs').addEventListener('click', () => {
    if (!jwtToken) {
        $.NotificationApp.send("請輸入 JWT 憑證", "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        document.getElementById("check-ws-upload-modal-button").click();
        return;
    }

    removeDropzoneHandleFile(myDropzone);
    const files = myDropzone.files;
    if (files.length === 0) {
        $.NotificationApp.send("沒有待上傳的文件", "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return;
    }

    toggleUploadButtons(true); // 開始上傳時禁用按鈕

    files.forEach(file => {
        const metadata = file.fileMetadata;
        if (!metadata) {
            $.NotificationApp.send(`文件 ${file.name} 沒有 fileMetadata，跳過上傳。`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
            updateProgress(file.previewElement, 0, 'failed', '無效的文件元數據');
            file.uploadStatus = "failed";
            return;
        }

        const uploadTask = () => {
            return new Promise((resolve, reject) => {
                const chunkManager = new ChunkUploadManager(
                    file,
                    'ws',
                    (percentage, status, message) => {
                        updateProgress(file.previewElement, percentage, status, message);
                    },
                    () => {
                        resolve();
                        // 檢查是否所有任務完成
                        if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                            toggleUploadButtons(false); // 所有上傳完成後恢復按鈕
                        }
                    },
                    (error) => {
                        $.NotificationApp.send(`文件 ${file.name} 通過 WebSocket 上傳失敗: ${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
                        toggleUploadButtons(false); // 上傳失敗後恢復按鈕
                        reject(error);
                    },
                    Config.maxConcurrentChunks || 5,
                    jwtToken
                );

                chunkManager.start();
            });
        };

        uploadManager.enqueue(uploadTask)
                     .then(() => {
                         // 檢查是否所有任務完成
                         if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                             toggleUploadButtons(false); // 所有上傳完成後恢復按鈕
                         }
                     })
                     .catch(err => {
                         $.NotificationApp.send(`文件 ${file.name} 通過 WebSocket 上傳失敗:${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
                         if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                             toggleUploadButtons(false); // 上傳失敗後恢復按鈕
                         }
                     });
    });
});

function toggleUploadButtons(disabled, close = disabled) {
    const uploadButton = document.getElementById('submitUpload');
    const uploadWsButton = document.getElementById('submitUploadWs');
    const closeButton = document.getElementById('closeModal');

    if (uploadButton) {
        uploadButton.disabled = disabled;
    }
    if (uploadWsButton) {
        uploadWsButton.disabled = disabled;
    }
    if (closeButton) {
        closeButton.disabled = close;
    }
}

function checkAllFilesProcessed() {
    const allProcessed = myDropzone.files.every(file => file.uploadStatus !== "processing");
    if (allProcessed) {
        toggleUploadButtons(false);
    } else {
        toggleUploadButtons(true, false);
    }
}

function updateProgress(previewElement, percentage, status, message) {
    const progressBar = previewElement.querySelector('.upload-progress-bar');
    const statusText = previewElement.querySelector('.status-text');

    if (!progressBar || !statusText) return;

    if (status === 'completed') {
        progressBar.style.width = '100%';
        statusText.style.backgroundColor = '#4caf50'; // 綠色表示完成
        statusText.textContent = message;
    } else if (status === 'failed') {
        progressBar.style.width = '0%';
        statusText.style.backgroundColor = '#f44336'; // 紅色表示失敗
        statusText.textContent = message;
    } else if (status === 'uploading') {
        progressBar.style.width = `${Number(percentage).toFixed(2)}%`;
        progressBar.style.backgroundColor = '#2196f3'; // 藍色表示上傳中
        statusText.textContent = `${Number(percentage).toFixed(2)}% 上傳中...`;
    } else if (status === 'calculating') {
        progressBar.style.width = `${Number(percentage).toFixed(2)}%`;
        progressBar.style.backgroundColor = '#ffc343'; // 黃色表示計算中
        statusText.textContent = `${Number(percentage).toFixed(2)}% 雜湊值計算中...`;
    } else if (status === 'pending') {
        progressBar.style.width = '0%';
        progressBar.style.backgroundColor = '#9e9e9e'; // 灰色表示等待
        statusText.textContent = message;
    } else {
        progressBar.style.width = '0%';
        progressBar.style.backgroundColor = '#f1f1f1'; // 底色略白
        statusText.textContent = message;
    }
}

function removeDropzoneHandleFile(myDropzone) {
    myDropzone.files.forEach(file => {
        const fileStatus = file.uploadStatus;
        if (fileStatus === "success") {
            myDropzone.removeFile(file);
        }
    });
}


// 顯示模態框
document.getElementById('upload-new-file').addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('uploadModal').classList.remove('hidden'); // 顯示模態框
    document.body.classList.add('no-scroll');
    toggleUploadButtons(true, false);
});

// 隱藏模態框
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('uploadModal').classList.add('hidden'); // 隱藏模態框
    if (myDropzone) {
        myDropzone.removeAllFiles(true); // 清除已選文件
    }
    document.body.classList.remove('no-scroll');
    toggleUploadButtons(false);
    fetchFileList(currentFolderId).then();
    getUserInfo(true);
});

export default {};