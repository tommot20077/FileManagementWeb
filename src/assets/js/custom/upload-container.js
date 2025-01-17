//todo 引入upload-folder
import Dropzone from 'dropzone';
import Config from "../../../../config.js";

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

        // 可選：處理上傳成功和失敗
        myDropzone.on("success", function(file, response) {
            alert(`文件 ${file.name} 上傳成功！`);
            // 隱藏模態框
            document.getElementById('uploadModal').classList.add('hidden');
        });

        myDropzone.on("error", function(file, response) {
            alert(`文件 ${file.name} 上傳失敗：${response}`);
        });
    }
});

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