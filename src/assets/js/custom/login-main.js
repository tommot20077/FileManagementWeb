import {buttonLoading} from "./component.js";
import webConnector from "./web-connector.js";

document.getElementById("sign-in-form").addEventListener("submit", function (event) {
    event.preventDefault();

    const button = document.getElementById("sign-in-button");
    const username = document.getElementById("username");
    const password = document.getElementById("password");

    if (!username.value || !password.value) {
        $.NotificationApp.send("請輸入帳號密碼", "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return;
    }

    buttonLoading(button, true, "登入中...");
    let csrfToken = null;
    let headerName = null;
    const data = {
        username: username.value, password: password.value
    }

    webConnector.post("/guest/login", JSON.stringify(data)).then((response) => {
        if (response.data.status === 200) {
            document.getElementById("user_token").innerHTML = `${response.data.data.token}`
            $.NotificationApp.send("登入成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
            document.getElementById("success-header-modal-button").click();
            buttonLoading(button, false, "登入");
        } else {
            buttonLoading(button, false, "登入");
            $.NotificationApp.send(`登入失敗: ${response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        }
    }).catch((error) => {
        const errorMessages = error.response?.data?.message || error;
        buttonLoading(button, false, "登入");
        $.NotificationApp.send(`登入失敗: ${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    });
});

document.getElementById("back-index").addEventListener("click", function (event) {
    document.getElementById("user_token").innerText = "";
    event.preventDefault();
    window.location.href = "/";
});

window.addEventListener('beforeunload', function (event) {
    document.getElementById("user_token").innerText = "";
});