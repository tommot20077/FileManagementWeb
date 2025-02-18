import {currentFolderId, fetchFileList} from "./fetch-file-list.js";

const unit = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

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
function updatePaginationControls(currentPage, totalPages, pageSize, type, fatherDocument) {
    let paginationContainer;
    if (fatherDocument) {
        paginationContainer = fatherDocument;
    } else {
        paginationContainer= document.querySelector('.pagination');
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
        a.addEventListener('click', () => fetchFileList(currentFolderId, page, true, pageSize, type));

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
        if (currentPage > 1) fetchFileList(currentFolderId, currentPage - 1, true);
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
        if (currentPage < totalPages) fetchFileList(currentFolderId, currentPage + 1, true);
    });

    nextLi.appendChild(nextA);
    paginationContainer.appendChild(nextLi);
}
export {formatFileSize, updatePaginationControls};