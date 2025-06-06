import SparkMD5 from 'spark-md5';
import Config from "../../../../config/config.js";
import webConnector from "./web-connector.js";
import {WSConnector} from "./ws-connectoer.js";

class ChunkUploadManager {
    constructor(file, uploadMethod, onProgress, onComplete, onError, maxConcurrentChunks = 5) {
        this.file = file;
        this.uploadMethod = uploadMethod; // 'http' 或 'ws'
        this.onProgress = onProgress;
        this.onComplete = onComplete;
        this.onError = onError;
        this.maxConcurrentChunks = maxConcurrentChunks;
        this.currentConcurrent = 0;
        this.queue = [];
        this.transferTaskId = null;
        this.totalChunks = 0;
        this.chunkSize = 0;
        this.ws = null; // 只在 WebSocket 方法中使用
        this.retryCounts = {};
        this.hasFailed = false;
    }

    start() {
        if (this.uploadMethod === 'http') {
            this.initHttpUpload();
        } else if (this.uploadMethod === 'ws') {
            this.initWsUpload();
        }
    }

    initHttpUpload() {
        const metadata = this.file.fileMetadata;
        webConnector.post('/files/upload', metadata)
                    .then(response => {
                        const data = response.data.data;
                        if (data.isFinished) {
                            this.onProgress(100, 'completed', '上傳完成');
                            this.file.uploadStatus = 'success';
                            this.onComplete();
                        } else {
                            this.transferTaskId = data.transferTaskId;
                            this.totalChunks = data.totalChunks;
                            this.chunkSize = data.chunkSize;
                            this.enqueueChunks();
                            this.processQueue();
                        }
                    })
                    .catch(error => {
                        const errorMessages = error.response?.data?.message || error;
                        this.onProgress(0, 'failed', `上傳失敗: ${errorMessages}`);
                        this.file.uploadStatus = 'failed';
                        this.onError(error);
                    });
    }

    initWsUpload() {
        const metadata = this.file.fileMetadata;
        this.ws = new WSConnector(`${Config.wsUrl}/file/upload`);
        this.ws.addEventListener('open', () => {
            const initialUploadMessage = {
                type: "initialUpload",
                data: metadata,
            };
            this.ws.send(initialUploadMessage);
        });

        this.ws.addEventListener('message', (response) => {
            if (response.message === "初始化上傳任務成功") {
                this.transferTaskId = response.data.transferTaskId;
                this.totalChunks = response.data.totalChunks;
                this.chunkSize = response.data.chunkSize;
                this.enqueueChunks();
                this.processQueue();
            } else if (response.message.includes("建立上傳任務失敗")) {
                this.onProgress(0, 'failed', `上傳失敗: ${response.message}`);
                this.onError(new Error(response.message));
                this.ws.close();
            } else if (response.message === "上傳任務完成") {
                this.onProgress(100, 'completed', '上傳完成');
                this.file.uploadStatus = 'success';
                this.onComplete();
                this.ws.close();
            } else if (response.message === "分塊上傳成功") {
                this.onProgress(response.data.progress, 'uploading', `上傳中 ${response.data.progress}%`);
                this.currentConcurrent--;
                this.processQueue();
            } else if (response.message.includes("分塊上傳失敗")) {
                const chunkIndex = response.data.chunkIndex != null ? response.data.chunkIndex : 0;
                this.handleChunkError(chunkIndex, new Error(response.data.message));
                if (this.hasFailed && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
            } else {
                this.onProgress(0, 'failed', `連線失敗: ${response.message}`);
                this.onError(new Error(response.message));
                this.file.uploadStatus = 'failed';
                this.ws.close();
            }
        });

        this.ws.addEventListener('error', (error) => {
            this.onProgress(0, 'failed', "WebSocket 發生錯誤。");
            this.file.uploadStatus = 'failed';
            this.onError(error);
            this.ws.close();
        });


        this.ws.addEventListener('close', () => {
            if (this.currentConcurrent === 0 && this.queue.length === 0) {
                // 所有分塊已處理完畢
                if (this.transferTaskId) {
                    this.onProgress(100, 'completed', '上傳完成');
                    this.onComplete();
                }
            }
        });
    }

    enqueueChunks() {
        for (let chunkIndex = 1; chunkIndex <= this.totalChunks; chunkIndex++) {
            this.queue.push(chunkIndex);
            this.retryCounts[chunkIndex] = 0;
        }
    }

    processQueue() {
        if (this.hasFailed) return;
        while (this.currentConcurrent < this.maxConcurrentChunks && this.queue.length > 0) {
            const chunkIndex = this.queue.shift();
            this.currentConcurrent++;
            if (this.uploadMethod === 'http') {
                this.uploadChunkHttp(chunkIndex)
                    .then((data) => {
                        this.currentConcurrent--;
                        this.onProgress(data.progress, 'uploading', `上傳中 ${data.progress}%`);
                        this.processQueue();
                    })
                    .catch((err) => {
                        console.error("收到錯誤:", err);
                        this.currentConcurrent--;
                        this.handleChunkError(chunkIndex, err);
                        if (!this.hasFailed && (this.queue.length > 0 || this.currentConcurrent > 0)) {
                            this.processQueue();
                        }
                    });
            } else if (this.uploadMethod === 'ws') {
                this.uploadChunkWs(chunkIndex)
                    .then(() => {
                    })
                    .catch((err) => {
                        this.handleChunkError(chunkIndex, err);
                        this.processQueue();
                    });
            }
        }

        // 當所有分塊上傳完成
        if (this.currentConcurrent === 0 && this.queue.length === 0) {
            this.onProgress(100, 'completed', '上傳完成');
            this.file.uploadStatus = 'success';
            this.onComplete();
        }
    }

    uploadChunkHttp(chunkIndex) {
        return new Promise((resolve, reject) => {
            const start = (chunkIndex - 1) * this.chunkSize;
            const end = Math.min(start + this.chunkSize, this.file.size);
            const chunk = this.file.slice(start, end);

            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = arrayBufferToBase64(e.target.result);

                const uploadChunkDTO = {
                    transferTaskId: this.transferTaskId,
                    totalChunks: this.totalChunks,
                    chunkIndex: chunkIndex,
                    chunkData: base64String,
                };

                webConnector.post(`/files/upload-chunk`, uploadChunkDTO)
                            .then(response => {
                                const data = response.data.data;
                                if (data.isSuccess) {
                                    resolve(data);
                                } else {
                                    reject(new Error(data.message));
                                }
                            })
                            .catch(error => {
                                const errorMessages = error.response?.data?.message || error;
                                reject(new Error(errorMessages));
                            });
            };
            reader.onerror = () => {
                reject(new Error(`分塊 ${chunkIndex} 讀取失敗`));
            };
            reader.readAsArrayBuffer(chunk);
        });
    }

    uploadChunkWs(chunkIndex) {
        return new Promise((resolve, reject) => {
            const start = (chunkIndex - 1) * this.chunkSize;
            const end = Math.min(start + this.chunkSize, this.file.size);
            const blob = this.file.slice(start, end);

            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = arrayBufferToBase64(e.target.result);

                const bufferUploadMessage = {
                    type: "bufferUpload",
                    data: {
                        transferTaskId: this.transferTaskId,
                        chunkIndex: chunkIndex,
                        chunkData: base64String,
                        totalChunks: this.totalChunks,
                    },
                };

                this.ws.send(bufferUploadMessage);
                resolve();
            };
            reader.onerror = () => {
                reject(new Error(`分塊 ${chunkIndex} 讀取失敗`));
            };
            reader.readAsArrayBuffer(blob);
        });
    }

    handleChunkError(chunkIndex, error) {
        const maxRetries = Config.maxChunkRetries || 3;
        this.retryCounts[chunkIndex] = (this.retryCounts[chunkIndex] || 0) + 1;

        if (this.retryCounts[chunkIndex] <= maxRetries) {
            console.warn(`分塊 ${chunkIndex} 上傳失敗，正在重試 (${this.retryCounts[chunkIndex]}/${maxRetries})`);
            this.queue.push(chunkIndex);
        } else {
            $.NotificationApp.send(`分塊 ${chunkIndex} 上傳失敗，已達最大重試次數`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
            this.onError(new Error(`分塊 ${chunkIndex} 上傳失敗，錯誤內容: ${error}。`));
            this.hasFailed = true;
            this.queue = [];
            this.currentConcurrent--;
            if (this.currentConcurrent < 0) {
                this.currentConcurrent = 0;
            }
            this.file.uploadStatus = 'failed';
            this.onProgress(0, 'failed', `分塊 ${chunkIndex} 上傳失敗，錯誤原因: ${error.message || error}`);
            this.onError(new Error(`分塊 ${chunkIndex} 上傳失敗，錯誤內容: ${error.message || error}。已達最大重試次數。`));
        }
    }
}

// MD5 計算和 Base64 編碼函數
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

export default ChunkUploadManager;