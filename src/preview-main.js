import config from "../config.js";

export async function loadFilePreview(fileId) {
    try {
        const response = await fetch(`${config.apiUrl}/api/files/${fileId}?action=preview`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.jwt}`
            }
        });
        if (!response.ok) {
            new Error('無法加載檔案');
        }

        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = 0;


        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
        }
        let type = response.headers.get('Content-Type');
        const blob = new Blob(chunks, { type: type });

        const url = URL.createObjectURL(blob);

        const container = document.getElementById('previewContainer');
        container.innerHTML = '';
        let element;
        if (type.startsWith("image")) {
            element = document.createElement("img");
            element.src = url;
        } else if (type.startsWith("video")) {
            element = document.createElement("video");
            element.controls = true;
            let source = document.createElement("source");
            source.src = url;
            source.type = type;
            element.appendChild(source);
        } else if (type.startsWith("audio")) {
            element = document.createElement("audio");
            element.controls = true;
            let source = document.createElement("source");
            source.src = url;
            source.type = type;
            element.appendChild(source);
        } else if (type === "application/pdf" || type.includes("msword") || type.includes("openxmlformats") || type.startsWith("text")) {
            element = document.createElement("iframe");
            element.src = url;
            element.style.width = "100%";
            element.style.height = "100%";
        } else if (type === "application/zip" || type.includes("x-rar") || type.includes("x-7z")) {
            element = document.createElement("p");
            element.textContent = "此為壓縮檔案，請下載後解壓縮。";
        } else {
            element = document.createElement("p");
            element.textContent = "無法預覽此檔案類型";
        }
        container.appendChild(element);
    } catch (error) {
        console.error('錯誤:', error);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('id');
    if (fileId) {
        loadFilePreview(fileId).then(r => {});
    } else {
        document.getElementById('previewContainer').textContent = '未提供檔案 ID';
    }
});