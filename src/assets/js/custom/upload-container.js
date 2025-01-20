//todo 引入upload-folder
import Dropzone from 'dropzone';
import SparkMD5 from 'spark-md5';
import Config from "../../../../config.js";
import apiConnector from "./api-connector.js";
import {WSConnector} from "./ws-connectoer.js";
import uploadManager from "./upload-manager.js";


// 禁用 Dropzone 的自動發起請求
Dropzone.autoDiscover = false;

// 初始化 Dropzone
let myDropzone;

document.addEventListener('DOMContentLoaded', () => {
    // 確保 Dropzone 僅初始化一次
    const dropzoneElement = document.getElementById('dropzone');
    if (dropzoneElement && !dropzoneElement.dropzone) {
        myDropzone = new Dropzone(dropzoneElement, {
            url: `${Config.apiUrl}/api/file/upload/initialTask`, // 實際上傳 URL
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

            toggleUploadButtons(true);
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
                    file.fileMetadata = {
                        fileName: file.name,
                        filePath: "/upload/" + file.name,
                        //filePath: file.path || file.name, // 根據需要設置文件路徑 //todo 後期處理
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
                console.error('檔案讀取錯誤');
                file.uploadStatus = "failed";
                checkAllFilesProcessed();
            };
            loadNext();
        });
    }
});

//todo 之後改良

// 處理上傳按鈕點擊事件
document.getElementById('submitUpload').addEventListener('click', () => {
    removeDropzoneHandleFile(myDropzone);
    const files = myDropzone.files;
    if (myDropzone && files.length === 0) {
        alert('請選擇要上傳的文件');
        return;
    }

    toggleUploadButtons(true);

    files.forEach(file => {
        const metadata = file.fileMetadata;
        if (!metadata) {
            console.error(`文件 ${file.name} 沒有 fileMetadata，跳過上傳。`);
            updateProgress(file.previewElement, 0, 'failed', '無效的文件元數據');
            file.uploadStatus = "failed";
            if (uploadManager.queue === 0) {
                toggleUploadButtons(false);
            }
            return;
        }

        const uploadTask = () => {
            return new Promise((resolve, reject) => {
                apiConnector.post('/api/file/upload/initialTask', metadata)
                            .then(response => {
                                const data = response.data.data;
                                if (data.isFinished) {
                                    updateProgress(file.previewElement, 100, 'completed', '上傳完成');
                                    file.uploadStatus = "success";
                                    resolve();
                                } else {
                                    const transferTaskId = data.transferTaskId;
                                    const totalChunks = data.totalChunks;
                                    const chunkSize = data.chunkSize;
                                    console.log(`開始上傳文件 ${file.name}，transferTaskId: ${transferTaskId}`);

                                    uploadChunksViaAxios(file, transferTaskId, totalChunks, chunkSize)
                                        .then(() => resolve())
                                        .catch(err => reject(err));
                                }
                            }).catch(error => {
                    const data = error.response ? error.response.data : {};
                    console.error(`初始請求失敗：${data.message}`);
                    updateProgress(file.previewElement, 0, 'failed', "上傳失敗: " + (data.message || '未知錯誤'));
                    file.uploadStatus = "failed";
                    reject(new Error(data.message || '未知錯誤'));
                });
            });
        };

        uploadManager.enqueue(uploadTask)
                     .then(() => {
                         console.log(`文件 ${file.name} 上傳完成`);
                         // 檢查是否所有任務完成
                         if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                             toggleUploadButtons(false);
                         }
                     })
                     .catch(err => {
                         console.error(`文件 ${file.name} 上傳失敗:`, err);
                         if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                             toggleUploadButtons(false);
                         }
                     });
    });
});


document.getElementById('submitUploadWs').addEventListener('click', () => {
    removeDropzoneHandleFile(myDropzone);
    const files = myDropzone.files;
    if (files.length === 0) {
        alert("沒有待上傳的文件。");
        return;
    }

    toggleUploadButtons(true); // 開始上傳時禁用按鈕

    files.forEach(file => {
        const metadata = file.fileMetadata;
        if (!metadata) {
            console.error(`文件 ${file.name} 沒有 fileMetadata，跳過上傳。`);
            updateProgress(file.previewElement, 0, 'failed', '無效的文件元數據');
            file.uploadStatus = "failed";
            return;
        }

        // 定義 WebSocket 上傳任務
        const uploadTask = () => {
            return new Promise((resolve, reject) => {
                const ws = new WSConnector(`${Config.wsUrl}/file/upload`, Config.jwt);

                ws.addEventListener('open', () => {
                    const initialUploadMessage = {
                        type: "initialUpload",
                        data: metadata,
                    };
                    ws.send(initialUploadMessage);
                });

                ws.addEventListener('message', (response) => {
                    if (response.message === "初始化上傳任務成功") {
                        const transferTaskId = response.data.transferTaskId;
                        console.log(`初始化上傳任務成功，transferTaskId: ${transferTaskId}`);

                        uploadChunksViaWebSocket(ws, file, transferTaskId, response.data.totalChunks, response.data.chunkSize)
                            .then(() => {
                                resolve();
                                ws.close();
                            })
                            .catch(err => {
                                reject(err);
                                ws.close();
                            });
                    } else if (response.message === "上傳任務完成") {
                            if (response.data.isFinished) {
                                console.log(`文件 ${file.name} 上傳完成`);
                                updateProgress(file.previewElement, 100, 'completed', '上傳完成');
                                file.uploadStatus = "success";
                                resolve();
                                ws.close();
                            }

                    } else if (response.message.startsWith("上傳失敗") || response.message.startsWith("建立上傳任務失敗")) {
                        const errorMessage = response.message;
                        console.error(`上傳失敗：${errorMessage}`);
                        updateProgress(file.previewElement, 0, 'failed', errorMessage);
                        reject(new Error(errorMessage));
                        ws.close();
                    }
                });

                ws.addEventListener('error', (error) => {
                    console.error("WebSocket 錯誤:", error);
                    updateProgress(file.previewElement, 0, 'failed', "WebSocket 發生錯誤。");
                    reject(error);
                    ws.close();
                });
            });
        };

        // 將 WebSocket 上傳任務加入上傳管理器
        uploadManager.enqueue(uploadTask)
                     .then(() => {
                         console.log(`文件 ${file.name} 通過 WebSocket 上傳完成！`);
                         // 檢查是否所有任務完成
                         if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                             toggleUploadButtons(false); // 所有上傳完成後恢復按鈕
                         }
                     })
                     .catch(err => {
                         console.error(`文件 ${file.name} 通過 WebSocket 上傳失敗:`, err);
                         if (uploadManager.currentUploads === 0 && uploadManager.queue.length === 0) {
                             toggleUploadButtons(false); // 上傳失敗後恢復按鈕
                         }
                     });
    });
});

function uploadChunksViaAxios(file, transferTaskId, totalChunks, chunkSize) {
    return new Promise((resolve, reject) => {
        for (let chunkIndex = 1; chunkIndex <= totalChunks; chunkIndex++) {
            const start = (chunkIndex - 1) * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);

            const reader = new FileReader();
            reader.onload = function (e) {
                const base64String = arrayBufferToBase64(e.target.result);
                const currentChunkMd5 = calculateMD5BlobSync(e.target.result); // 同步計算 MD5

                const uploadChunkDTO = {
                    transferTaskId: transferTaskId,
                    totalChunks: totalChunks,
                    chunkIndex: chunkIndex,
                    chunkData: base64String, // 分塊數據
                    md5: currentChunkMd5
                };

                apiConnector.post(`${Config.apiUrl}/api/file/upload/uploadFileData`, uploadChunkDTO)
                            .then(response => {
                                const data = response.data.data;
                                if (data.isSuccess) {
                                    updateProgress(file.previewElement, data.progress, 'uploading', `上傳中 ${data.progress}%`);
                                    if (data.progress === 100.0) {
                                        updateProgress(file.previewElement, 100, 'completed', '上傳完成');
                                        file.uploadStatus = "success";
                                        resolve();
                                    }
                                } else {
                                    console.error(`分塊 ${chunkIndex} 上傳失敗：${data.message}`);
                                    updateProgress(file.previewElement, 0, 'failed', '上傳失敗');
                                    file.uploadStatus = "failed";
                                    reject(new Error(data.message));
                                }
                            })
                            .catch(error => {
                                console.error(`分塊 ${chunkIndex} 上傳請求失敗：${error.message}`);
                                updateProgress(file.previewElement, 0, 'failed', '上傳失敗');
                                file.uploadStatus = "failed";
                                reject(error);
                            });
            };
            reader.onerror = function () {
                console.error(`分塊 ${chunkIndex} 讀取失敗`);
                updateProgress(file.previewElement, 0, 'failed', '讀取分塊失敗');
                file.uploadStatus = "failed";
                reject(new Error('讀取分塊失敗'));
            };
            reader.readAsArrayBuffer(chunk);
        }
    });
}

function uploadChunksViaWebSocket(ws, file, transferTaskId, totalChunks, chunkSize) {
    return new Promise((resolve, reject) => {
        ws.addEventListener('message', function handleMessage(response) {
            if (response.message === "分塊上傳成功" || response.message === "上傳任務完成") {
                const data = response.data;
                if (data.isFinished) {
                    console.log(`文件 ${file.name} 上傳完成`);
                    updateProgress(file.previewElement, 100, 'completed', '上傳完成');
                    file.uploadStatus = "success";
                    resolve();
                    ws.removeEventListener('message', handleMessage);
                } else {
                    console.log(`分塊 ${data.chunkIndex} 上傳成功`);
                    updateProgress(file.previewElement, data.progress, 'uploading', `上傳中 ${data.progress}%`);
                }
            } else if (response.message.startsWith("上傳失敗")) {
                console.error(`上傳失敗：${response.message}`);
                updateProgress(file.previewElement, 0, 'failed', response.message);
                file.uploadStatus = "failed";
                reject(new Error(response.message));
                ws.removeEventListener('message', handleMessage);
            }
        });

        for (let chunkIndex = 1; chunkIndex <= totalChunks; chunkIndex++) {
            const start = (chunkIndex - 1) * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const blob = file.slice(start, end);

            const reader = new FileReader();
            reader.onload = function (e) {
                const base64String = arrayBufferToBase64(e.target.result);
                const currentChunkMd5 = calculateMD5BlobSync(e.target.result); // 同步計算 MD5

                const bufferUploadMessage = {
                    type: "bufferUpload",
                    data: {
                        transferTaskId: transferTaskId,
                        chunkIndex: chunkIndex,
                        chunkData: base64String,
                        totalChunks: totalChunks,
                        md5: currentChunkMd5,
                    },
                };

                ws.send(bufferUploadMessage);
            };
            reader.onerror = function () {
                console.error(`分塊 ${chunkIndex} 讀取失敗`);
                updateProgress(file.previewElement, 0, 'failed', '讀取分塊失敗');
                file.uploadStatus = "failed";
                reject(new Error('讀取分塊失敗'));
            };
            reader.readAsArrayBuffer(blob); // 讀取分塊數據
        }
    });
}


function calculateMD5BlobSync(arrayBuffer) {
    const spark = new SparkMD5.ArrayBuffer();
    spark.append(arrayBuffer);
    return spark.end();
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}


function toggleUploadButtons(disabled) {
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
        closeButton.disabled = disabled;
    }
}

function checkAllFilesProcessed() {
    const allProcessed = myDropzone.files.every(file => file.uploadStatus !== "processing");
    if (allProcessed) {
        toggleUploadButtons(false);
    } else {
        toggleUploadButtons(true);
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
        console.log("獲取進度更新")
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
        if (fileStatus !== "pending") {
            myDropzone.removeFile(file);
        }
    });
}


// 顯示模態框
document.getElementById('upload-new-file').addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('uploadModal').classList.remove('hidden'); // 顯示模態框
    document.body.classList.add('no-scroll');
    toggleUploadButtons(true);
});

// 隱藏模態框
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('uploadModal').classList.add('hidden'); // 隱藏模態框
    if (myDropzone) {
        myDropzone.removeAllFiles(true); // 清除已選文件
    }
    document.body.classList.remove('no-scroll');
    toggleUploadButtons(false);
});
