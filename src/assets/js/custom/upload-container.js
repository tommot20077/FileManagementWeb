//todo 引入upload-folder
import Dropzone from 'dropzone';
import SparkMD5 from 'spark-md5';
import Config from "../../../../config.js";
import apiConnector from "./api-connector.js";


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

            reader.onload = function (e) {
                spark.append(e.target.result);
                const FileMD5 = spark.end();
                console.log(`文件 ${file.name} 的 MD5：${FileMD5}`);

                const fileMetadata = {
                    fileName: file.name,
                    filePath: "/upload/" + file.name,
                    //filePath: file.path || file.name, // 根據需要設置文件路徑 //todo 後期處理
                    md5: FileMD5,
                    fileSize: file.size,
                    userId: 1 // 根據實際情況設置用戶ID //todo 後期處理
                };

                apiConnector.post('/api/file/upload/initialTask', fileMetadata)
                            .then(response => {
                                let data = response.data;
                                console.log('初始請求成功：', data);
                                if (data.status !== 200) {
                                    alert(`初始請求失敗：${data.message}`);
                                    return;
                                }
                                data = data.data;
                                if (data.isFinished) {
                                    alert(`文件 ${file.name} 已經存在，無需上傳。`);
                                } else {
                                    // 獲取 transferTaskId 和 totalChunks
                                    const transferTaskId = data.transferTaskId;
                                    const totalChunks = data.totalChunks; // 假設後端返回總分塊數
                                    const chunkSize = data.chunkSize; // 假設後端返回分塊大小
                                    console.log(`文件 ${file.name} 需要分成 ${totalChunks} 個分塊進行上傳`);
                                    console.log(`每個分塊大小為 ${chunkSize} 字節`);
                                    console.log(`開始上傳文件 ${file.name}，transferTaskId: ${transferTaskId}`);
                                    // 開始分塊上傳
                                    uploadFileInChunks(file, transferTaskId, totalChunks, chunkSize);
                                }
                            })
                            .catch(error => {
                                alert(`初始請求失敗：${error.message}`);
                            });
            };
            reader.readAsArrayBuffer(file);
        });


        // 可選：處理上傳成功和失敗
        myDropzone.on("success", function (file, response) {
            alert(`文件 ${file.name} 上傳成功！`);
            // 隱藏模態框
            document.getElementById('uploadModal').classList.add('hidden');
        });

        myDropzone.on("error", function (file, response) {
            alert(`文件 ${file.name} 上傳失敗：${response}`);
        });
    }
});

function uploadFileInChunks(file, transferTaskId, totalChunks, chunkSize) {

    console.log(`開始分塊上傳文件 ${file.name}，共 ${totalChunks} 個分塊`);
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunkData = file.slice(start, end);

        const reader = new FileReader();
        reader.onload = function(e) {
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
                     let data = response.data;
                     console.log(`分塊 ${chunkIndex + 1} 上傳請求成功：`, data);
                     if (response.status !== 200) {
                         console.error(`分塊 ${chunkIndex + 1} 上傳失敗：${response.data.message}`);
                         return;
                     }

                     data = data.data;
                     console.log("inner data: ", data);

                     if (data.isSuccess) {
                         console.log(`分塊 ${chunkIndex + 1} 上傳成功`);
                     } else {
                         console.error(`分塊 ${chunkIndex + 1} 上傳失敗：${data.message}`);
                     }
                 })
                 .catch(error => {
                     console.error(`分塊 ${chunkIndex + 1} 上傳請求失敗：${error.message}`);
                 });
        };

        reader.readAsArrayBuffer(chunkData); // 讀取分塊數據
    }
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for(let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}





// 顯示模態框
document.getElementById('upload-new-file').addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('uploadModal').classList.remove('hidden'); // 顯示模態框
});

// 隱藏模態框
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('uploadModal').classList.add('hidden'); // 隱藏模態框
    if (myDropzone) {
        myDropzone.removeAllFiles(true); // 清除已選文件
    }
});

// 處理上傳按鈕點擊事件
document.getElementById('submitUpload').addEventListener('click', () => {
    if (myDropzone && myDropzone.getAcceptedFiles().length > 0) {
        // 處理文件上傳
        myDropzone.processQueue(); // 手動觸發上傳
    } else {
        alert('請選擇至少一個文件進行上傳。');
    }
});