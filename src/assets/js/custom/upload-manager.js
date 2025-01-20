import config from "../../../../config.js";

class UploadManager {
    constructor(maxConcurrent = 3) {
        this.maxConcurrent = maxConcurrent; // 最大同時上傳數量
        this.currentUploads = 0; // 當前上傳中的數量
        this.queue = []; // 上傳隊列
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
}

// 建立單例實例
const uploadManager = new UploadManager(config.globalUploadTaskLimit || 3); // 您可以根據需要調整最大同時上傳數量
export default uploadManager;