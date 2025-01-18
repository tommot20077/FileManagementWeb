//todo 引入upload-folder
import Dropzone from 'dropzone';
import SparkMD5 from 'spark-md5';
import Config from "../../../../config.js";
import apiConnector from "./api-connector.js";


// 禁用 Dropzone 的自動發起請求
Dropzone.autoDiscover = false;

// 初始化 Dropzone
let myDropzone;
let ongoingUploads = 0;


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
            const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
            let currentChunk = 0;
            const chunks = Math.ceil(file.size / CHUNK_SIZE);

            document.getElementById("submitUpload").disabled = true;
            file.uploadStatus = "processing";

            function loadNext() {
                const start = currentChunk * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                reader.readAsArrayBuffer(chunk);
            }

            reader.onload = function (e) {
                spark.append(e.target.result);
                currentChunk++;

                const progress = Math.round((currentChunk / chunks) * 100);
                updateProgress(
                    file.previewElement,
                    progress,
                    'calculating',
                    null
                );
                if (currentChunk < chunks) {
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
            };

            loadNext();
        });
    }
});


const MAX_CONCURRENT_UPLOADS = 3;
let currentUploads = 0;
const uploadQueue = [];

//todo 之後改良

function uploadFileInChunks(file, transferTaskId, totalChunks, chunkSize) {
    const uploadTask = () => {
        ongoingUploads += 1;
        const previewElement = file.previewElement;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            currentUploads += 1;

            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunkData = file.slice(start, end);

            const reader = new FileReader();
            reader.onload = function (e) {
                const base64String = arrayBufferToBase64(e.target.result);
                const uploadChunkDTO = {
                    transferTaskId: transferTaskId,
                    totalChunks: totalChunks,
                    chunkIndex: chunkIndex + 1, // 分塊索引從1開始
                    chunkData: base64String // 分塊數據
                };

                // 發送分塊上傳請求
                apiConnector.post(`${Config.apiUrl}/api/file/upload/uploadFileData`, uploadChunkDTO)
                            .then(response => {
                                let data = response.data.data;
                                currentUploads -= 1;
                                if (data.isSuccess) {
                                    updateProgress(previewElement, data.progress, 'uploading', '上傳中');

                                    if (data.progress === 100.0) {
                                        updateProgress(previewElement, 100, 'completed', '上傳完成');
                                        file.uploadStatus = "success";
                                        ongoingUploads -= 1;
                                        if (ongoingUploads === 0) {
                                            toggleUploadButtons(false);
                                        }
                                        processQueue(); // 處理隊列中的下一個任務
                                    }
                                } else {
                                    console.error(`分塊 ${chunkIndex + 1} 上傳失敗：${data.message}`);
                                    updateProgress(previewElement, 0, 'failed', '上傳失敗');
                                    ongoingUploads -= 1;
                                    if (ongoingUploads === 0) {
                                        toggleUploadButtons(false);
                                    }
                                    processQueue(); // 處理隊列中的下一個任務
                                }
                            })
                            .catch(error => {
                                console.error(`分塊 ${chunkIndex + 1} 上傳請求失敗：${error.message}`);
                                updateProgress(previewElement, 0, 'failed', '上傳失敗');
                                ongoingUploads -= 1;
                                currentUploads -= 1;
                                if (ongoingUploads === 0) {
                                    toggleUploadButtons(false);
                                }
                                processQueue(); // 處理隊列中的下一個任務
                            });
            };
            reader.readAsArrayBuffer(chunkData); // 讀取分塊數據
        }
    };

    if (currentUploads < MAX_CONCURRENT_UPLOADS) {
        uploadTask();
    } else {
        uploadQueue.push(uploadTask);
    }
}

function processQueue() {
    if (uploadQueue.length > 0 && currentUploads < MAX_CONCURRENT_UPLOADS) {
        const nextTask = uploadQueue.shift();
        nextTask();
    }
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
    const closeButton = document.getElementById('closeModal');
    if (uploadButton) {
        uploadButton.disabled = disabled;
    }
    if (closeButton) {
        closeButton.disabled = disabled;
    }
}

function checkAllFilesProcessed() {
    const allProcessed = myDropzone.files.every(file => file.uploadStatus !== "processing");
    document.getElementById('submitUpload').disabled = !allProcessed;
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
        progressBar.style.width = `${percentage}%`;
        progressBar.style.backgroundColor = '#2196f3'; // 藍色表示上傳中
        statusText.textContent = `${percentage}% 上傳中...`;
    } else if (status === 'calculating') {
        progressBar.style.width = `${percentage}%`;
        progressBar.style.backgroundColor = '#ffc343'; // 黃色表示計算中
        statusText.textContent = `${percentage}% 雜湊值計算中...`;
    } else {
        progressBar.style.width = '0%';
        statusText.style.backgroundColor = '#f1f1f1'; // 底色略白
        statusText.textContent = message;
    }
}


// 顯示模態框
document.getElementById('upload-new-file').addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('uploadModal').classList.remove('hidden'); // 顯示模態框
    document.body.classList.add('no-scroll');
    document.getElementById("submitUpload").disabled = true;
});

// 隱藏模態框
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('uploadModal').classList.add('hidden'); // 隱藏模態框
    if (myDropzone) {
        myDropzone.removeAllFiles(true); // 清除已選文件
    }
    document.body.classList.remove('no-scroll');
});

// 處理上傳按鈕點擊事件
document.getElementById('submitUpload').addEventListener('click', () => {
    let task = []
    const files = myDropzone.getQueuedFiles();
    if (myDropzone && files.length === 0) {
        alert('請選擇要上傳的文件');
        return;
    }

    toggleUploadButtons(true);
    files.forEach(file => {
        const fileStatus = file.uploadStatus;
        if (fileStatus === "pending") {
            task.push(file);
        } else {
            myDropzone.removeFile(file);
        }
    });

    task.forEach(file => {
        const metadata = file.fileMetadata;
        if (!metadata) {
            console.error(`文件 ${file.name} 沒有 fileMetadata，跳過上傳。`);
            updateProgress(file.previewElement, 0, 'failed', '無效的文件元數據');
            file.uploadStatus = "failed";
            if (ongoingUploads === 0) {
                toggleUploadButtons(false);
            }
            return;
        }

        let data;
        apiConnector.post('/api/file/upload/initialTask', metadata)
                    .then(response => {
                        data = response.data.data;
                        if (data.isFinished) {
                            updateProgress(file.previewElement, 100, 'completed', '上傳完成');
                            file.uploadStatus = "success";
                            if (ongoingUploads === 0) {
                                toggleUploadButtons(false);
                            }
                        } else {
                            // 獲取 transferTaskId 和 totalChunks
                            const transferTaskId = data.transferTaskId;
                            const totalChunks = data.totalChunks;
                            const chunkSize = data.chunkSize;
                            console.log(`文件 ${file.name} 需要分成 ${totalChunks} 個分塊進行上傳`);
                            console.log(`每個分塊大小為 ${chunkSize} 字節`);
                            console.log(`開始上傳文件 ${file.name}，transferTaskId: ${transferTaskId}`);
                            // 開始分塊上傳
                            uploadFileInChunks(file, transferTaskId, totalChunks, chunkSize);
                        }
                    })
                    .catch(error => {
                        data = error.response.data;
                        console.error(`初始請求失敗：${data.message}`);
                        updateProgress(file.previewElement, 0, 'failed', "上傳失敗: " + (data.message || '未知錯誤'));
                        if (ongoingUploads === 0) {
                            toggleUploadButtons(false);
                        }

                        file.uploadStatus = "failed";
                    }).finally(() => {
            console.log('當前上傳任務數量：', ongoingUploads);
        });
    });
    //myDropzone.processQueue();
    //todo 小檔案之後處理
});