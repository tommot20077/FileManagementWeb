import streamSaver from "streamsaver";

export function buttonLoading(button, isLoading, useContent) {
    const span1 = document.createElement("span");
    const span2 = document.createElement("span");
    span1.classList.add("spinner-border", "spinner-border-sm", "me-1");
    span1.role = "status";
    span1.ariaHidden = "true";
    span2.classList.add("visually-hidden");

    if (isLoading) {
        button.innerText = useContent || '處理中...';
        button.disabled = true;

        button.appendChild(span1);
        button.appendChild(span2);
    } else {
        span1.remove();
        span2.remove();

        button.innerText = useContent || '執行';
        button.disabled = false;
    }
}

export async function handleResponse(response) {
    if (!response.ok) {
        new Error('下載失敗');
    }

    const filename = getFilenameFromHeaders(response.headers);
    const fileStream = streamSaver.createWriteStream(filename, {
        size: response.headers.get('Content-Length')
    })

    const readableStream = response.body;
    if (window.WritableStream && readableStream.pipeTo) {
        return readableStream.pipeTo(fileStream).then(() => {
        })
    }
    window.writer = fileStream.getWriter();
    const reader = response.body.getReader();
    const pump = () => reader.read().then(res => res.done ?
        window.writer.close() : window.writer.write(res.value).then(pump))
    await pump();
}

function getFilenameFromHeaders(headers) {
    const contentDisposition = headers.get('Content-Disposition');
    if (contentDisposition) {
        const filenameMatch =
            contentDisposition.match(/filename\*=UTF-8''([^;]+)/i) ||
            contentDisposition.match(/filename="?(.+)"?/i);

        return filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'download';
    }
    return 'download';
}