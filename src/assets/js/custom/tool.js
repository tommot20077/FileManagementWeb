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

function updatePaginationControls(currentPage, totalPages, fatherDocument, filter = {}, isSearch = false) {
    let paginationContainer;
    if (fatherDocument) {
        paginationContainer = fatherDocument;
    } else {
        paginationContainer = document.querySelector('.pagination');
    }

    paginationContainer.innerHTML = '';

    const createPageItem = (page, isActive = false) => {
        const li = document.createElement('li');
        li.classList.add('page-item');
        if (isActive) li.classList.add('active');

        const a = document.createElement('a');
        a.classList.add('page-link');
        a.href = 'javascript:void(0);';
        a.textContent = page;
        a.addEventListener('click', () => {
            if (page !== currentPage) {
                filter.page = page;
                fetchFileList(currentFolderId, true, filter, isSearch)
            }
        });

        li.appendChild(a);
        return li;
    };

    // 上一頁按鈕
    const prevLi = document.createElement('li');
    prevLi.classList.add('page-item');
    if (currentPage === 1) prevLi.classList.add('disabled');

    const prevA = document.createElement('a');
    prevA.classList.add('page-link');
    prevA.href = 'javascript:void(0);';
    prevA.setAttribute('aria-label', 'Previous');
    prevA.innerHTML = '<span aria-hidden="true">&laquo;</span>';
    prevA.addEventListener('click', () => {
        if (currentPage > 1) {
            filter.page = currentPage - 1;
            fetchFileList(currentFolderId, true, filter, isSearch)
        }
    });

    prevLi.appendChild(prevA);
    paginationContainer.appendChild(prevLi);

    // 動態添加分頁按鈕
    for (let i = 1; i <= totalPages; i++) {
        paginationContainer.appendChild(createPageItem(i, i === currentPage));
    }

    // 下一頁按鈕
    const nextLi = document.createElement('li');
    nextLi.classList.add('page-item');
    if (currentPage === totalPages) nextLi.classList.add('disabled');

    const nextA = document.createElement('a');
    nextA.classList.add('page-link');
    nextA.href = 'javascript:void(0);';
    nextA.setAttribute('aria-label', 'Next');
    nextA.innerHTML = '<span aria-hidden="true">&raquo;</span>';
    nextA.addEventListener('click', () => {
        if (currentPage < totalPages) {
            filter.page = currentPage + 1;
            fetchFileList(currentFolderId, true, filter, isSearch)
        }
    });

    nextLi.appendChild(nextA);
    paginationContainer.appendChild(nextLi);
}

function convertToISOFormat(dateStr) {
    if (!dateStr || dateStr.trim().length === 0) return null;
    const formattedDate = dateStr.replace(/\s+/g, '').replace(/\//g, '-');
    const date = new Date(formattedDate);
    return date.toISOString().split("T")[0] + "T00:00:00";
}

export {formatFileSize, updatePaginationControls, convertToISOFormat};