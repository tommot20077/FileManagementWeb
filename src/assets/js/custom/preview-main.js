import config from "../../../../config.js";
import videojs from "video.js";
import 'video.js/dist/video-js.css';
import '@videojs/themes/dist/sea/index.css';
import webConnector from "./web-connector.js";


async function getFileMetadata(fileId) {
    try {
        const response = await webConnector.get(`${config.backendUrl}/web/v1/files/${fileId}/info`);

        if (response.status !== 200) {
            new Error("無法獲取檔案資訊");
        }

        return {
            type: response.data.data["X-File-Content-Type"] || "",
            size: response.data.data["X-File-Size"] || 0
        };
    } catch (error) {
        console.error("獲取檔案資訊錯誤:", error);
        return null;
    }
}

export async function loadFilePreview(fileId) {
    const container = document.getElementById("previewContainer");
    const progressBar = document.getElementById("loading-progress-bar");

    const metadata = await getFileMetadata(fileId);
    if (!metadata) {
        container.innerHTML = "<p>無法獲取檔案資訊</p>";
        return;
    }

    const {type} = metadata;
    const fileUrl = `${config.backendUrl}/web/v1/files/${fileId}?action=preview`;

    try {
        if (type.startsWith("video") || type.startsWith("audio")) {
            container.innerHTML = "";
            const element = document.createElement("video");
            element.id = "video-preview";
            element.className = "video-js vjs-theme-sea vjs-big-play-centered";
            element.controls = true;
            element.style.width = "100%";
            container.appendChild(element);

            videojs("video-preview", {
                controls: true,
                autoplay: false,
                responsive: true,
                preload: "auto",
                html5: {
                    nativeAudioTracks: false,
                    nativeVideoTracks: false,
                    hls: {
                        overrideNative: true
                    },
                    vhs: {
                        cacheEncryptionKeys: true,
                        maxBufferLength: 60
                    }
                },
                sources: [{src: fileUrl, type}]
            });
        } else {
            // 下載文件，並更新進度條
            const response = await fetch(fileUrl, {credentials: "include"});

            if (!response.ok) {
                const errorData = await response.json();
                container.innerHTML = `<p>${errorData.message}</p>`;
                return;
            }

            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;
            const contentLength = parseInt(response.headers.get("Content-Length"), 10) || 0;

            function updateProgress() {
                if (contentLength) {
                    progressBar.style.width = `${(receivedLength / contentLength) * 100}%`;
                }
            }

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                updateProgress();
            }
            progressBar.style.width = "100%";

            const blob = new Blob(chunks, {type});
            const url = URL.createObjectURL(blob);

            renderPreview(url, type);
        }
    } catch (error) {
        console.error("文件載入錯誤:", error);
        container.innerHTML = "<p>文件載入失敗</p>";
    }
}

function renderPreview(url, type) {
    const container = document.getElementById("previewContainer");
    container.innerHTML = "";

    let element;
    if (type.startsWith("image")) {
        element = document.createElement("img");
        element.src = url;
        element.style.maxWidth = "100%";
    } else if (type === "application/pdf" || type.includes("msword") || type.includes("openxmlformats") || type.startsWith("text")) {
        element = document.createElement("iframe");
        element.src = url;
        element.style.width = "100%";
        element.style.height = "800px";
    } else {
        element = document.createElement("p");
        element.textContent = "無法預覽此檔案類型";
    }

    container.appendChild(element);
}

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get("id");

    if (fileId) {
        loadFilePreview(fileId);
    } else {
        document.getElementById("previewContainer").textContent = "未提供檔案 ID";
    }
});
