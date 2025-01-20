import config from "../../../../config.js";
import ChunkUploadManager from "./chunk-upload-manager.js";

class UploadManager {
    constructor(maxConcurrent = 3, maxConcurrentChunks = 5) {
        this.maxConcurrent = maxConcurrent; // 最大同時上傳任務數量
        this.currentUploads = 0; // 當前上傳中的任務數量
        this.queue = []; // 上傳任務隊列
        this.maxConcurrentChunks = maxConcurrentChunks; // 每個任務的最大同時分塊數量
    }

    // 將上傳任務加入隊列
    enqueue(uploadTask) {
        return new Promise((resolve, reject) => {
            this.queue.push({ uploadTask, resolve, reject });
            this.schedule();
        });
    }

    // 調度上傳任務
    schedule() {
        while (this.currentUploads < this.maxConcurrent && this.queue.length > 0) {
            const { uploadTask, resolve, reject } = this.queue.shift();
            this.currentUploads++;
            uploadTask()
                .then(result => {
                    this.currentUploads--;
                    resolve(result);
                    this.schedule(); // 調度下一個任務
                })
                .catch(err => {
                    this.currentUploads--;
                    reject(err);
                    this.schedule(); // 調度下一個任務
                });
        }
    }

    createAndStartChunkUpload(file, uploadMethod, onProgress, onComplete, onError) {
        const chunkManager = new ChunkUploadManager(
            file,
            uploadMethod,
            onProgress,
            onComplete,
            onError,
            this.maxConcurrentChunks
        );
        chunkManager.start();
    }
}

// 建立單例實例
const uploadManager = new UploadManager(config.globalUploadTaskLimit || 3, config.maxConcurrentChunks || 5); // 您可以根據需要調整最大同時上傳任務數量及每個任務的最大同時分塊數量
export default uploadManager;