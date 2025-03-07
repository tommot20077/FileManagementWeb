import webConnector from "./web-connector.js";
import {formatFileSize} from "./tool.js";

export function getUserInfo(storageOnly = false) {
    const response = webConnector.get('/user/info', {xsrfCookieName: "useless"});

    if (document.getElementById('user-operation-list') && !storageOnly) {
        response.then(response => {
            if (response.data.status === 200) {
                document.querySelector('.account-user-name').textContent = response.data.data.username;
                document.querySelector('.account-position').textContent = response.data.data.role;
            }
        });
    }

    const container = document.getElementById('user-storage-status')
    if (container) {
        response.then(response => {
            if (response.data.status === 200) {
                if (response.data.data.role === 'ADMIN') {
                    document.getElementById('user-storage-level').textContent = '管理';
                } else if (response.data.data.role === 'ADVANCED_USER') {
                    document.getElementById('user-storage-level').textContent = '付費';
                } else if (response.data.data.role === 'USER') {
                    document.getElementById('user-storage-level').textContent = '免費';
                } else {
                    document.getElementById('user-storage-level').textContent = '遊客';
                }

                const bar = container.querySelector('.progress-bar');
                const text = container.querySelector('.text-muted');
                const percent = response.data.data.storageLimit === -1 ? 0 : Math.round(response.data.data.usedStorage / response.data.data.storageLimit * 100).toFixed(2);
                if (percent >90) {
                    bar.classList.add('bg-danger');
                } else if (percent > 70) {
                    bar.classList.add('bg-warning');
                } else {
                    bar.classList.add('bg-success');
                }
                bar.style.width = `${percent}%`;
                if (response.data.data.storageLimit === -1) {
                    text.textContent = `${formatFileSize(response.data.data.usedStorage)}\u00A0(${percent}%)\u00A0\u00A0/\u00A0\u00A0無限制`;
                } else {
                    text.textContent = `${formatFileSize(response.data.data.usedStorage)}  (${percent}%)  /  ${formatFileSize(response.data.data.storageLimit)}`;
                }
            }
        });
    }
}