import {currentFolderId, fetchFileList} from "./fetch-file-list.js";

const unit = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export const reservedPath = {
    "all": "-1",
    "star": "-2",
    "recently": "-3",
    "recycle": "-4",
    "shared": "-5",

    "-1": "all",
    "-2": "star",
    "-3": "recently",
    "-4": "recycle",
    "-5": "shared"
}

function formatFileSize(size) {
    if (typeof size !== 'number' || isNaN(size)) {
        return 'Invalid size';
    }

    let unitIndex = 0;
    while (size >= 1024) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${unit[unitIndex]}`;
}

function updatePaginationControls(currentPage, totalPages, fatherDocument, filter = {}, isSearch = false, pageChangeCallback = null) {
    let paginationContainer;
    if (fatherDocument) {
        paginationContainer = fatherDocument;
    } else {
        paginationContainer = document.querySelector('.pagination');
    }

    paginationContainer.innerHTML = '';

    const isSmallScreen = window.innerWidth <= 768;

    const createPageItem = (page, text, isActive = false, isDisabled = false) => {
        const li = document.createElement('li');
        li.classList.add('page-item');
        if (isActive) li.classList.add('active');
        if (isDisabled) li.classList.add('disabled');

        const a = document.createElement('a');
        a.classList.add('page-link');
        a.href = 'javascript:void(0);';
        a.innerHTML = text;

        if (!isDisabled && !isActive) {
            a.addEventListener('click', () => {
                filter.page = page;
                if (pageChangeCallback) {
                    pageChangeCallback(page);
                } else {
                    fetchFileList(currentFolderId, true, filter, isSearch);
                }
            });
        }

        li.appendChild(a);
        return li;
    };

    if (currentPage > 1) {
        paginationContainer.appendChild(createPageItem(1, '&laquo;&laquo;'));
    }

    if (currentPage > 1) {
        paginationContainer.appendChild(createPageItem(currentPage - 1, '&laquo;'));
    }

    let startPage;
    let endPage;

    if (isSmallScreen) {
        startPage = currentPage;
        endPage = currentPage;
    } else {
        startPage = Math.max(1, currentPage - 2);
        endPage = Math.min(totalPages, currentPage + 2);

        if (endPage - startPage < 4) {
            if (currentPage - startPage < 2) {
                endPage = Math.min(totalPages, startPage + 4);
            } else {
                startPage = Math.max(1, endPage - 4);
            }
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationContainer.appendChild(createPageItem(i, i, i === currentPage));
    }

    if (currentPage < totalPages) {
        paginationContainer.appendChild(createPageItem(currentPage + 1, '&raquo;'));
    }


    if (currentPage < totalPages) {
        paginationContainer.appendChild(createPageItem(totalPages, '&raquo;&raquo;'));
    }
}

function convertToISOFormat(dateStr) {
    if (!dateStr || dateStr.trim().length === 0) return null;
    const formattedDate = dateStr.replace(/\s+/g, '').replace(/\//g, '-');
    const date = new Date(formattedDate);
    return date.toISOString().split("T")[0] + "T00:00:00";
}

export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        $.NotificationApp.send("複製連接成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
    } catch (error) {
        console.error('複製失敗:', error);
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                $.NotificationApp.send("複製連接成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
            } else {
                $.NotificationApp.send("複製失敗", "請手動複製鏈接", "bottom-right", "rgba(0,0,0,0.2)", "error");
            }
        } catch (err) {
            console.error('備用方法複製失敗:', err);
            $.NotificationApp.send("複製失敗", "請手動複製鏈接", "bottom-right", "rgba(0,0,0,0.2)", "error");
        } finally {
            document.body.removeChild(textarea);
        }
    }
}

export {formatFileSize, updatePaginationControls, convertToISOFormat};
