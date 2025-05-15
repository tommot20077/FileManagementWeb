export class WSConnector {
    constructor(url) {
        this.ws = new WebSocket(url);
        this.listeners = {};
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.ws.onclose = this.onClose.bind(this);
    }

    onOpen() {
        if (this.listeners['open']) {
            this.listeners['open'].forEach(callback => callback());
        }
    }

    onMessage(event) {
        const response = JSON.parse(event.data);
        if (this.listeners['message']) {
            this.listeners['message'].forEach(callback => callback(response));
        }
    }

    onError(error) {
        const errorMessage = error?.response?.data?.message || "WebSocket 發生未知錯誤: " + error
        $.NotificationApp.send(`WebSocket 錯誤: ${errorMessage}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");

        if (this.listeners['error']) {
            this.listeners['error'].forEach(callback => callback(error));
        }
    }

    onClose() {
        if (this.listeners['close']) {
            this.listeners['close'].forEach(callback => callback());
        }
    }

    send(data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            $.NotificationApp.send("WebSocket 尚未開啟，無法發送資料", "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
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
