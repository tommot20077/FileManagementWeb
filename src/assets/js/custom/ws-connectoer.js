export class WSConnector {
    constructor(url, token) {
        this.ws = new WebSocket(url, [`jwt.${token}`]);
        this.listeners = {};
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.ws.onclose = this.onClose.bind(this);
    }

    onOpen() {
        console.log("WebSocket 連接已建立");
        if (this.listeners['open']) {
            this.listeners['open'].forEach(callback => callback());
        }
    }

    onMessage(event) {
        const response = JSON.parse(event.data);
        console.log("收到 WebSocket 服務器消息:", response);
        if (this.listeners['message']) {
            this.listeners['message'].forEach(callback => callback(response));
        }
    }

    onError(error) {
        console.error("WebSocket 錯誤:", error);
        if (this.listeners['error']) {
            this.listeners['error'].forEach(callback => callback(error));
        }
    }

    onClose() {
        console.log("WebSocket 連接已關閉");
        if (this.listeners['close']) {
            this.listeners['close'].forEach(callback => callback());
        }
    }

    send(data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.error("WebSocket 尚未開啟，無法發送資料");
        }
    }

    addEventListener(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    removeEventListener(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    close() {
        this.ws.close();
    }
}
