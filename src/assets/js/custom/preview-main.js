import config from "../../../../config/config.js";
import videojs from "video.js";
import 'video.js/dist/video-js.css';
import '../../css/custom/video-js.css'
import webConnector from "./web-connector.js";
import Viewer from 'viewerjs';
import 'viewerjs/dist/viewer.css';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs';
import {buttonLoading, handleResponse} from "./component.js";
import * as docxPreview from 'docx-preview';
import * as XLSX from "xlsx";
import canvasDatagrid from 'canvas-datagrid';

let currentFileId
let folderId
let fileType
let fileMimeType
let container

async function getFileMetadata(fileId) {
    try {
        const response = await webConnector.get(`${config.backendUrl}/web/v1/files/${fileId}`, {
            xsrfCookieName: "useless",
            headers: {
                "Range": "bytes=0-0"
            }
        });

        return {
            isSuccess: true,
            mimeType: response.headers.getContentType() || ""
        };
    } catch (error) {
        const errorMessage = error.response?.data?.message || error;
        console.error("獲取檔案資訊錯誤: ", errorMessage);
        return {
            isSuccess: false,
            message: errorMessage
        }
    }
}

async function getFolderMetadata(folderId) {
    try {
        if (!config.previewMutiFile) {
            return {
                isSuccess: true,
                files: [],
            };
        }

        const response = await webConnector.get(`${config.backendUrl}/web/v1/files/search?folder=${folderId}&type=${fileType}`, {xsrfCookieName: "useless"});

        return {
            isSuccess: true,
            files: response.data.data.files.data || [],
        };
    } catch (error) {
        const errorMessage = error.response?.data?.message || error;
        console.error("獲取資料夾資訊錯誤: ", errorMessage);
        return {
            isSuccess: false,
            message: errorMessage
        }
    }
}

export async function loadFilePreview(fileId) {
    container = document.getElementById("previewContainer");
    const progressBar = document.getElementById("loading-progress-bar");

    const promises = [];
    let fileMetadataPromise;
    let folderMetadataPromise;

    if (fileMimeType) {
        fileMetadataPromise = Promise.resolve({
            isSuccess: true,
            mimeType: fileMimeType
        });
    } else {
        fileMetadataPromise = getFileMetadata(fileId);
    }
    promises.push(fileMetadataPromise);

    if (folderId) {
        folderMetadataPromise = getFolderMetadata(folderId);
        promises.push(folderMetadataPromise);
    } else {
        folderMetadataPromise = Promise.resolve({ isSuccess: true, files: [] });
        promises.push(folderMetadataPromise);
    }


    const results = await Promise.all(promises);

    const fileMetadata = results[0];
    const folderMetadata = results.length > 1 ? results[1] : { isSuccess: true, files: [] };


    if (!fileMetadata.isSuccess || !folderMetadata.isSuccess) {
        container.innerHTML = `<p>無法獲取檔案資訊: ${fileMetadata.message}</p>`;
        return;
    }

    const {mimeType} = fileMetadata;
    const {files} = folderMetadata;
    const fileUrl = `${config.backendUrl}/web/v1/files/${fileId}?action=preview`;


    try {
        const needsBlob = supportedTypesForBlob.some(supportedType =>
            mimeType.startsWith(supportedType) || mimeType.includes(supportedType)
        );

        if (!needsBlob) {
            await renderGeneralPreview(null, null, mimeType);
            return;
        }

        if (mimeType.startsWith("image")) {
            renderImagePreview(files);
            return
        }


        if (mimeType.startsWith("video") || mimeType.startsWith("audio")) {
            renderVideoPreview(fileUrl, mimeType);
            return
        }


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

        const blob = new Blob(chunks, {mimeType});
        const url = URL.createObjectURL(blob);

        await renderGeneralPreview(blob, url, mimeType);

        window.addEventListener('beforeunload', () => {
            URL.revokeObjectURL(url);
        });
    } catch (error) {
        console.error("文件載入錯誤:", error);
        container.innerHTML = "<p>文件載入失敗</p>";
        $.NotificationApp.send("錯誤", error.message || "無法載入檔案", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }
}

async function renderGeneralPreview(blob, url, mimeType) {
    container.innerHTML = "";

    let element;
    if (mimeType === "application/pdf" && url) {
        await renderPDFPreview(url);
        return
    } else if (mimeType.includes("wordprocessingml") && blob) {
        await renderWordPreview(blob);
        return
    } else if (mimeType.includes("spreadsheetml") && blob) {
        await renderExcelPreview(blob);
        return
    } else if (blob) {
        await renderPlainTextPreview(blob);
        return
    }


    const button = document.createElement("button");
    button.textContent = "下載檔案";
    button.className = "btn btn-primary";

    element = document.createElement("p");
    element.innerHTML = `無法預覽此檔案類型，請直接下載。 <br>`;
    element.appendChild(button);

    button.addEventListener("click", async () => {
        buttonLoading(button, true, "下載中...");
        await fetch(`${config.backendUrl}/web/v1/files/${currentFileId}?action=download`, {
            method: 'GET',
            credentials: 'include'
        }).then(response => handleResponse(response)).finally(() => {
            buttonLoading(button, false, "下載檔案");
        });
    })
    container.appendChild(element);
}

function renderVideoPreview(url, mimeType) {
    try {
        container.innerHTML = "";
        const element = document.createElement("video");
        element.id = "video-preview";
        element.className = "video-js vjs-theme-sea vjs-big-play-centered";
        element.controls = true;
        element.style.width = "100%";
        container.appendChild(element);

        const player = videojs("video-preview", {
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
            sources: [{src: url, type: mimeType}]
        });

        document.removeEventListener("keydown", videoKeyboardHandler);
        document.addEventListener("keydown", videoKeyboardHandler);

        function videoKeyboardHandler(e) {
            const videoEl = player.el().querySelector("video");
            if (!videoEl) return;

            if (e.key === "ArrowRight") {
                e.preventDefault();
                videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 5);
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const newVolume = Math.min(1, videoEl.volume + 0.1);
                videoEl.volume = newVolume;
                player.volume(newVolume);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const newVolume = Math.max(0, videoEl.volume - 0.1);
                videoEl.volume = newVolume;
                player.volume(newVolume);
            }
        }
    } catch (error) {
        const errorMessages = error.response?.data?.message || error;
        container.innerHTML = "<p>無法預覽此影片</p>";
        $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        console.error(error)
    }
}

function renderImagePreview(files) {
    try {
        container.innerHTML = "";
        const gallery = document.createElement("div");
        gallery.style.display = "none";
        container.appendChild(gallery);

        files.map((file) => {
            const img = document.createElement("img");
            img.src = `${config.backendUrl}/web/v1/files/${file.id}?action=preview`;
            img.dataset.id = file.id;
            if (file.id !== parseInt(currentFileId)) {
                img.loading = "lazy";
            }
            gallery.appendChild(img);
            return img;
        });

        const currentIndex = files.findIndex(file => file.id === parseInt(currentFileId));

        const currentImg = document.createElement("img");
        currentImg.src = `${config.backendUrl}/web/v1/files/${currentFileId}?action=preview`;
        currentImg.style.maxWidth = "100%";
        container.appendChild(currentImg);

        const choose = config.previewMutiFile ? gallery : currentImg
        const viewer = new Viewer(choose, {
            inline: false,
            toolbar: {
                zoomIn: true,
                zoomOut: true,
                oneToOne: true,
                reset: true,
                prev: true,
                next: true,
                rotateLeft: true,
                rotateRight: true,
                flipHorizontal: true,
                flipVertical: true
            },
            initialViewIndex: currentIndex >= 0 ? currentIndex : 0,
            hidden: () => {
                currentImg.style.visibility = "visible";
            },
        });
        currentImg.addEventListener("click", () => {
            currentImg.style.visibility = "hidden";
            viewer.show();
        });
        backgroundLoadImages(files.filter(file => file.id !== parseInt(currentFileId)));
        $.NotificationApp.send("小提示", "可以點擊圖片進行預覽，左右鍵切換圖片", "top-right", "rgba(0,0,0,0.2)", "info");

    } catch (error) {
        const errorMessages = error.response?.data?.message || error;
        $.NotificationApp.send(`${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        console.error(error)
        container.innerHTML = "<p>無法預覽此圖片</p>";
    }
}

function backgroundLoadImages(imageFiles) {
    imageFiles.forEach(file => {
        const img = new Image();
        img.src = `${config.backendUrl}/web/v1/files/${file.id}?action=preview`;
    });
}

async function renderPDFPreview(url) {
    container.innerHTML = "<p>正在載入檔案...</p>";

    container.style.display = "flex";
    container.style.flexDirection = "row";
    container.style.width = "100%";
    container.style.overflowY = "auto";
    container.style.overflowX = "hidden";
    container.style.boxSizing = "border-box";

    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

    try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const totalPages = pdf.numPages;
        let currentPage = 1;
        let currentScale = 1.0;

        const containerWidth = container.clientWidth || 900;
        const thumbnailWidth = containerWidth / 12;
        const mainWidth = containerWidth * 11 / 12;

        const mainCanvas = document.createElement("canvas");
        mainCanvas.style.width = "100%";
        mainCanvas.style.marginBottom = "10px";

        const controls = document.createElement("div");
        controls.style.marginBottom = "10px";
        controls.style.textAlign = "center";
        controls.style.width = "100%";

        const prevButton = document.createElement("button");
        prevButton.textContent = "上一頁";
        prevButton.style.marginRight = "10px";
        prevButton.className = "btn btn-info"
        prevButton.disabled = currentPage === 1;

        const nextButton = document.createElement("button");
        nextButton.textContent = "下一頁";
        nextButton.style.marginLeft = "10px";
        nextButton.className = "btn btn-info"
        nextButton.disabled = currentPage === totalPages;

        const pageInfo = document.createElement("span");
        pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁`;
        pageInfo.style.margin = "0 10px";

        const jumpInput = document.createElement("input");
        jumpInput.type = "number";
        jumpInput.min = "1";
        jumpInput.max = String(totalPages);
        jumpInput.value = currentPage;
        jumpInput.style.width = "60px";
        jumpInput.style.margin = "0 5px";


        const jumpButton = document.createElement("button");
        jumpButton.textContent = "跳轉";
        jumpButton.style.marginLeft = "5px";
        jumpButton.className = "btn btn-success"

        const zoomDropdown = document.createElement("div");
        zoomDropdown.className = "dropdown";
        zoomDropdown.style.display = "inline-block";
        zoomDropdown.style.margin = "0 10px";

        const zoomButton = document.createElement("button");
        zoomButton.className = "btn btn-light dropdown-toggle";
        zoomButton.type = "button";
        zoomButton.id = "zoomDropdown";
        zoomButton.setAttribute("data-bs-toggle", "dropdown");
        zoomButton.setAttribute("aria-haspopup", "true");
        zoomButton.setAttribute("aria-expanded", "false");
        zoomButton.textContent = "100%";

        const zoomMenu = document.createElement("div");
        zoomMenu.className = "dropdown-menu";
        zoomMenu.setAttribute("aria-labelledby", "zoomDropdown");

        const zoomOptions = [
            {value: 0.5, text: "50%"},
            {value: 0.75, text: "75%"},
            {value: 0.9, text: "90%"},
            {value: 1.0, text: "100%"},
            {value: 1.1, text: "110%"},
            {value: 1.25, text: "125%"},
            {value: 1.5, text: "150%"},
            {value: 2.0, text: "200%"},
        ];


        zoomOptions.forEach(option => {
            const zoomItem = document.createElement("a");
            zoomItem.className = "dropdown-item";
            zoomItem.href = "#";
            zoomItem.textContent = option.text;
            zoomItem.addEventListener("click", (e) => {
                e.preventDefault();
                currentScale = option.value;
                zoomButton.textContent = option.text;
                renderPage(currentPage);
            });
            zoomMenu.appendChild(zoomItem);
        });

        zoomDropdown.appendChild(zoomButton);
        zoomDropdown.appendChild(zoomMenu);

        controls.appendChild(prevButton);
        controls.appendChild(pageInfo);
        controls.appendChild(jumpInput);
        controls.appendChild(jumpButton);
        controls.appendChild(zoomDropdown);
        controls.appendChild(nextButton);


        const mainContainer = document.createElement("div");
        mainContainer.style.width = `${mainWidth}px`;
        mainContainer.style.height = "100%";
        mainContainer.style.overflow = "auto";
        mainContainer.style.padding = "10px";
        mainContainer.style.flexShrink = "0";
        mainContainer.appendChild(controls);
        mainContainer.appendChild(mainCanvas);

        const thumbnailContainer = document.createElement("div");
        thumbnailContainer.style.width = `${thumbnailWidth}px`;
        thumbnailContainer.style.height = "100%";
        thumbnailContainer.style.overflowY = "auto";
        thumbnailContainer.style.background = "#f8f8f8";
        thumbnailContainer.style.padding = "10px";
        thumbnailContainer.style.borderRight = "1px solid #ddd";
        thumbnailContainer.style.flexShrink = "0";

        function updateThumbnailBorders(pageNum) {
            Array.from(thumbnailContainer.children).forEach((child, index) => {
                child.style.border = index + 1 === pageNum ? "2px solid #007bff" : "1px solid #ddd";
            });
        }

        async function renderPage(pageNum) {
            const page = await pdf.getPage(pageNum);
            const containerWidth = mainContainer.clientWidth || 600;
            const viewport = page.getViewport({scale: 1.0});
            const scale = containerWidth / viewport.width;
            const finalScale = scale * currentScale;
            const scaledViewport = page.getViewport({scale: finalScale});

            const aspectRatio = viewport.height / viewport.width;
            const scaledWidth = scaledViewport.width;
            const scaledHeight = scaledWidth * aspectRatio

            mainCanvas.style.width = `${scaledWidth}px`;
            mainCanvas.style.height = `${scaledHeight}px`;
            mainCanvas.width = scaledWidth;
            mainCanvas.height = scaledHeight;

            const context = mainCanvas.getContext("2d");
            await page.render({
                canvasContext: context,
                viewport: scaledViewport,
            }).promise;

            mainContainer.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            currentPage = pageNum;
            pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁`;
            jumpInput.value = currentPage;
            prevButton.disabled = currentPage === 1;
            nextButton.disabled = currentPage === totalPages;
            updateThumbnailBorders(currentPage);
        }

        async function renderThumbnails() {
            const observer = new IntersectionObserver(async (entries, obs) => {
                for (let entry of entries) {
                    if (entry.isIntersecting) {
                        const pageNum = parseInt(entry.target.dataset.pageNum, 10);
                        const page = await pdf.getPage(pageNum);
                        const viewport = page.getViewport({scale: 0.2});
                        const context = entry.target.getContext("2d");

                        await page.render({
                            canvasContext: context,
                            viewport: viewport,
                        }).promise;

                        obs.unobserve(entry.target);
                    }
                }
            }, {
                root: thumbnailContainer,
                rootMargin: '0px',
                threshold: 0.1
            });

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({scale: 0.2});

                const thumbCanvas = document.createElement("canvas");
                thumbCanvas.dataset.pageNum = pageNum;
                thumbCanvas.style.width = "100px";
                thumbCanvas.style.height = `${viewport.height}px`;
                thumbCanvas.width = viewport.width;
                thumbCanvas.height = viewport.height;
                thumbCanvas.style.marginBottom = "10px";
                thumbCanvas.style.cursor = "pointer";
                thumbCanvas.style.border = pageNum === currentPage ? "2px solid #007bff" : "1px solid #ddd";

                thumbCanvas.addEventListener("click", () => {
                    renderPage(pageNum);
                });

                thumbnailContainer.appendChild(thumbCanvas);
                observer.observe(thumbCanvas);
            }
        }

        prevButton.addEventListener("click", () => {
            if (currentPage > 1) {
                renderPage(currentPage - 1);
                updateThumbnailBorders(currentPage - 1);
            }
        });

        nextButton.addEventListener("click", () => {
            if (currentPage < totalPages) {
                renderPage(currentPage + 1);
                updateThumbnailBorders(currentPage + 1);
            }
        });

        jumpButton.addEventListener("click", () => {
            const pageNum = parseInt(jumpInput.value);
            if (pageNum >= 1 && pageNum <= totalPages) {
                renderPage(pageNum);
                updateThumbnailBorders(pageNum);
            } else {
                $.NotificationApp.send(`請輸入有效頁碼（1 到 ${totalPages}）`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
                jumpInput.value = currentPage;
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                const currentIndex = zoomOptions.findIndex(opt => opt.value === currentScale);
                if (currentIndex < zoomOptions.length - 1) {
                    currentScale = zoomOptions[currentIndex + 1].value;
                    zoomButton.textContent = zoomOptions[currentIndex + 1].text;
                    renderPage(currentPage);
                }
            } else if (e.key === "-") {
                e.preventDefault();
                const currentIndex = zoomOptions.findIndex(opt => opt.value === currentScale);
                if (currentIndex > 0) {
                    currentScale = zoomOptions[currentIndex - 1].value;
                    zoomButton.textContent = zoomOptions[currentIndex - 1].text;
                    renderPage(currentPage);
                }
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                if (currentPage < totalPages) {
                    renderPage(currentPage + 1);
                }
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                if (currentPage > 1) {
                    renderPage(currentPage - 1);
                }
            }
            if (document.activeElement.tagName !== "INPUT") {
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    mainContainer.scrollBy({
                        top: -100,
                        behavior: "smooth",
                    });
                } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    mainContainer.scrollBy({
                        top: 100,
                        behavior: "smooth",
                    });
                }
            }
        });

        const toggleThumbnails = document.createElement("button");
        toggleThumbnails.textContent = "隱藏縮圖";
        toggleThumbnails.className = "btn btn-secondary";
        toggleThumbnails.style.marginLeft = "10px";
        controls.appendChild(toggleThumbnails);

        toggleThumbnails.addEventListener("click", () => {
            const isHidden = thumbnailContainer.style.display === "none";
            thumbnailContainer.style.display = isHidden ? "block" : "none";
            toggleThumbnails.textContent = isHidden ? "隱藏縮圖" : "顯示縮圖";
            const newContainerWidth = container.clientWidth || 900;
            thumbnailContainer.style.width = isHidden ? `${newContainerWidth / 12}px` : "0px";
            mainContainer.style.width = isHidden ? `${newContainerWidth * 11 / 12}px` : `${newContainerWidth}px`;
            renderPage(currentPage);
        });

        container.innerHTML = "";
        container.appendChild(thumbnailContainer);
        container.appendChild(mainContainer);

        await renderPage(1);
        await renderThumbnails();
    } catch (error) {
        console.error("PDF 渲染錯誤:", error);
        $.NotificationApp.send(`PDF 渲染錯誤`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        container.innerHTML = "<p>無法預覽 PDF</p>";
    }
}


async function renderWordPreview(blob) {
    try {
        container.innerHTML = "<p>正在載入檔案...</p>";
        const blobSource = await blob;
        const arrayBuffer = await blobSource.arrayBuffer();

        container.innerHTML = '';
        container.style.overflowY = "auto";

        await docxPreview.renderAsync(arrayBuffer, container, null, {
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true,
            renderHeaders: true,
            renderFooters: true,
        });

        const docxContent = container.querySelector('div');
        if (docxContent) {
            docxContent.style.height = '100%';
            docxContent.style.width = '100%';
        }
    } catch (error) {
        console.error("Word 渲染錯誤:", error);
        $.NotificationApp.send(`Word 渲染錯誤`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        container.innerHTML = "<p>無法預覽 Word 檔案</p>";
    }
}

async function renderExcelPreview(blob) {
    try {
        container.innerHTML = "<p>正在載入檔案...</p>";
        const blobSource = await blob;
        const arrayBuffer = await blobSource.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), {type: 'array'});

        const sheetNames = workbook.SheetNames;

        let grid = null;
        let jsonData = null;
        let displayedData = null;
        let currentPage = 1;
        let rowsPerPage = 50;
        let totalPages = 1;
        let currentSheetIndex = 0;

        container.innerHTML = '';
        container.style.overflowY = 'hidden';
        container.style.overflowX = 'auto';
        container.style.boxSizing = 'border-box';

        container.innerHTML = `
      <div class="controls">
        <div class="sheet-tabs">
          ${sheetNames.map((name, i) => `
            <button data-sheet="${i}" class="${i === 0 ? 'active' : ''}">${name}</button>
          `).join('')}
        </div>
        <div class="pagination">
          <button class="prev-page" disabled>前一頁</button>
          <span class="page-info"></span>
          <button class="next-page">後一頁</button>
          <input type="number" class="page-jump-input" min="1" placeholder="跳轉頁數" />
          <button class="jump-page">跳轉</button>
        </div>
      </div>
    `;


        const gridContainer = document.createElement('div');
        gridContainer.className = 'excel-preview';
        container.appendChild(gridContainer);

        const rowHeight = 25;
        const headerHeight = 25;
        const containerHeight = container.clientHeight - 70;

        rowsPerPage = Math.floor((containerHeight - headerHeight) / rowHeight) - 1;
        rowsPerPage = Math.max(rowsPerPage, 1);

        const renderPage = (page) => {
            return new Promise((resolve) => {
                requestAnimationFrame(() => {
                    if (!jsonData) {
                        console.error('jsonData 未初始化，無法渲染表格');
                        $.NotificationApp.send(`渲染錯誤`, `數據未正確載入，請刷新頁面`, 'bottom-right', 'rgba(0,0,0,0.2)', 'error');
                        gridContainer.innerHTML = '<p class="preview-error">無法渲染表格</p>';
                        resolve();
                        return;
                    }

                    const start = (page - 1) * rowsPerPage;
                    const end = page * rowsPerPage;
                    displayedData = jsonData.slice(start, end);

                    if (grid && grid.parentNode) {
                        grid.parentNode.removeChild(grid);
                        grid = null;
                    }

                    grid = canvasDatagrid({
                        parentNode: gridContainer,
                        data: displayedData,
                        editable: false,
                    });

                    grid.style.cellBorderStyle = '1px solid #e0e0e0';
                    grid.style.headerBackground = '#f5f5f5';
                    grid.style.rowBackground = (rowIndex) => (rowIndex % 2 === 0 ? '#fafafa' : '#ffffff');
                    grid.style.backgroundColor = '#ffffff';
                    grid.style.cellAutoResize = true;
                    grid.style.cellWidth = 100;
                    grid.style.cellHeight = rowHeight;

                    currentPage = page;
                    const pageInfo = container.querySelector('.page-info');
                    pageInfo.textContent = `${currentPage}/${totalPages}`;

                    const prevBtn = container.querySelector('.prev-page');
                    const nextBtn = container.querySelector('.next-page');
                    prevBtn.disabled = currentPage === 1;
                    nextBtn.disabled = currentPage === totalPages;

                    const input = container.querySelector('.page-jump-input');
                    input.value = currentPage;

                    resolve();
                });
            })
        };

        const renderSheet = (sheetIndex) => {
            return new Promise((resolve) => {
                if (grid && grid.parentNode) {
                    grid.parentNode.removeChild(grid);
                    grid = null;
                }


                currentSheetIndex = sheetIndex;
                const worksheet = workbook.Sheets[sheetNames[sheetIndex]];
                jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1});

                const containerWidth = container.clientWidth;
                const minColumns = Math.floor(containerWidth / 100);
                const maxColumns = jsonData.length > 0 ? Math.max(...jsonData.map(row => row.length)) : 0;

                if (maxColumns < minColumns) {
                    jsonData = jsonData.map(row => {
                        const newRow = [...row];
                        while (newRow.length < minColumns) {
                            newRow.push('');
                        }
                        return newRow;
                    });
                }

                const containerHeight = container.clientHeight - 70;
                const minRows = Math.floor(containerHeight / rowHeight);
                const actualRows = jsonData.length;

                if (actualRows < minRows) {
                    const emptyRow = new Array(jsonData[0].length).fill('');
                    while (jsonData.length < minRows) {
                        jsonData.push([...emptyRow]);
                    }
                }

                totalPages = Math.ceil(jsonData.length / rowsPerPage);
                totalPages = Math.max(totalPages, 1);

                currentPage = 1;
                displayedData = jsonData.slice(0, rowsPerPage);
                renderPage(currentPage).then(resolve);

                container.querySelectorAll('.sheet-tabs button').forEach(b => b.classList.remove('active'));
                container.querySelector(`.sheet-tabs button[data-sheet="${sheetIndex}"]`).classList.add('active');
            });
        };

        container.querySelectorAll('.sheet-tabs button').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                const input = container.querySelector('.page-jump-input');
                input.value = 1
                renderSheet(i);
            });
        });

        container.querySelector('.prev-page').addEventListener('click', () => {
            if (currentPage > 1) {
                const input = container.querySelector('.page-jump-input');
                currentPage--;
                input.value = currentPage;
                renderPage(currentPage);
            }
        });

        container.querySelector('.next-page').addEventListener('click', () => {
            const input = container.querySelector('.page-jump-input');
            if (currentPage < totalPages) {
                currentPage++;
                input.value = currentPage;
                renderPage(currentPage);
            }
        });

        container.querySelector('.jump-page').addEventListener('click', () => {
            jumpPage();
        });

        container.querySelector('.page-jump-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                jumpPage();
            }
        });

        function jumpPage() {
            const input = container.querySelector('.page-jump-input');
            const page = parseInt(input.value, 10);
            if (page && page >= 1 && page <= totalPages) {
                currentPage = page;
                renderPage(currentPage);
            } else {
                $.NotificationApp.send(`頁數無效`, `請輸入 1 到 ${totalPages} 之間的頁數`, 'bottom-right', 'rgba(0,0,0,0.2)', 'warning');
            }
        }

        container.addEventListener('wheel', (e) => {
            e.preventDefault();

            if (e.deltaY < 0) {
                if (currentPage > 1) {
                    currentPage--;
                    renderPage(currentPage);
                    const input = container.querySelector('.page-jump-input');
                    input.value = currentPage;
                }
            } else if (e.deltaY > 0) {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderPage(currentPage);
                    const input = container.querySelector('.page-jump-input');
                    input.value = currentPage;
                }
            }
        });

        await renderSheet(0);
    } catch (error) {
        console.error('Excel 渲染錯誤:', error);
        $.NotificationApp.send(`Excel 渲染錯誤`, '', 'bottom-right', 'rgba(0,0,0,0.2)', 'error');
        container.innerHTML = '<p class="preview-error">無法預覽 Excel 檔案</p>';
    }
}

async function renderPlainTextPreview(blob) {
    container.innerHTML = "<p>正在載入檔案...</p>";
    container.style.overflowY = 'auto';
    container.style.overflowX = 'auto';
    container.style.boxSizing = 'border-box';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'flex-start';

    const text = await blob.text();

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls';

    const switchContainer = document.createElement('div');
    switchContainer.className = 'switch-container';

    const switchLabel = document.createElement('span');
    switchLabel.className = 'switch-label';
    switchLabel.textContent = '自動換行';

    const switchWrapper = document.createElement('label');
    switchWrapper.className = 'switch';

    const switchInput = document.createElement('input');
    switchInput.type = 'checkbox';
    switchInput.checked = true;

    const slider = document.createElement('span');
    slider.className = 'slider';

    switchWrapper.appendChild(switchInput);
    switchWrapper.appendChild(slider);
    switchContainer.appendChild(switchLabel);
    switchContainer.appendChild(switchWrapper);
    controlsDiv.appendChild(switchContainer);

    const previewDiv = document.createElement('div');
    const pre = document.createElement('pre');
    const code = document.createElement('code');

    previewDiv.style.fontSize = '20px';
    previewDiv.style.margin = '0';
    previewDiv.style.padding = '10px';
    previewDiv.style.width = '100%';
    previewDiv.style.overflowX = 'auto';
    previewDiv.style.overflowY = 'auto';
    pre.style.margin = '0';
    pre.style.minWidth = 'max-content';


    const updateTextDisplay = (isAutoWrap) => {
        if (isAutoWrap) {
            pre.style.whiteSpace = 'pre-wrap';
            code.style.whiteSpace = 'pre-wrap';
            code.textContent = text;
        } else {
            pre.style.whiteSpace = 'pre';
            code.style.whiteSpace = 'pre';
            let modifiedText = '';
            let currentLine = '';
            for (let i = 0; i < text.length; i++) {
                currentLine += text[i];
                if (currentLine.length >= 200 && (text[i] === ' ' || text[i] === '\n' || i === text.length - 1)) {
                    modifiedText += currentLine + '\n';
                    currentLine = '';
                }
            }
            if (currentLine) {
                modifiedText += currentLine;
            }
            code.textContent = modifiedText;
        }
    };

    updateTextDisplay(switchInput.checked);


    switchInput.addEventListener('change', () => {
        updateTextDisplay(switchInput.checked);
    });

    pre.appendChild(code);
    previewDiv.appendChild(pre);
    container.innerHTML = '';
    container.appendChild(controlsDiv);
    container.appendChild(previewDiv);
}

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentFileId = urlParams.get("id")
    folderId = urlParams.get("folder")
    fileType = urlParams.get("type")
    fileMimeType = urlParams.get("mime")

    if (currentFileId) {
        loadFilePreview(currentFileId).then(r => {
        });
    } else {
        document.getElementById("previewContainer").textContent = "未提供檔案 ID";
    }
});


const supportedTypesForBlob = [
    "video",
    "audio",
    "image",
    "application/pdf",
    "wordprocessingml",
    "spreadsheetml",
    "plain",
    "text",
    "application/json",
    "xml",
    "javascript",
    "xhtml+xml",
    "x-javascript",
    "x-sh",
    "x-httpd-php",
    "x-php",
    "x-python",
    "x-ruby",
    "x-perl",
    "x-shellscript",
    "x-bash",
    "x-latex",
    "x-sql",
    "x-java",
    "x-c",
    "x-c++",
    "x-csharp",
    "x-go",
    "x-r",
    "x-matlab",
    "x-xml",
    "x-yaml",
    "x-markdown",
    "x-troff",
    "x-csh",
    "x-subrip"
];
//todo 分享頁面預覽會不到其他照片