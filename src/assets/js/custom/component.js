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
        let errorBody;
        try {
            errorBody = await response.json();
        } catch {
            errorBody = {message: "未知錯誤", status: response.status};
        }
        throw errorBody;
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

export function hideGuest(isGuest) {
    document.querySelectorAll(".guest-hide").forEach(el => {
        if (isGuest) {
            el.style.display = "none";
        } else {
            el.style.display = "block";
        }
    });

    document.querySelectorAll(".guest-show").forEach(el => {
        if (isGuest) {
            el.style.display = "block";
        } else {
            el.style.display = "none";
        }
    });

    document.querySelectorAll(".guest-disabled").forEach(el => {
        if (isGuest) {
            el.classList.add("disabled");
        } else {
            el.classList.remove("disabled");
        }
    });
}

export function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

export function checkLoginStatus() {
    const hasGuestCheck = getCookie('hasGuestCheck') || 'false';
    if (hasGuestCheck !== 'true') {
        window.location.href = '/login.html';
    }
}