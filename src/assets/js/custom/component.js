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