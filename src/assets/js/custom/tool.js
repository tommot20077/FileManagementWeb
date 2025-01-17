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

export {formatFileSize};