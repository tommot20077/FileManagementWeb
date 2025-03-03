import {buttonLoading} from "./component.js";
import apiConnector from "./api-connector.js";

document.getElementById("sign-up-form").addEventListener("submit", function(event) {
    if (!this.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
        $.NotificationApp.send(`請輸入完整資訊`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return;
    }

    event.preventDefault();
    const button = document.getElementById("submit_form");

    let username = document.getElementById("username").value;
    let email = document.getElementById("email").value;
    let password = document.getElementById("password").value;
    let passwordConfirm = document.getElementById("confirm-password").value;

    let errormessage = "";
    if (password !== passwordConfirm) {
        errormessage = "密碼不一致";
    } else if (username.trim() === "" || email.trim() === "" || password.trim() === "") {
        errormessage = "請填寫完整資訊";
    } else if (password.length < 6 || passwordConfirm.length < 6 || password.length > 30 || passwordConfirm.length > 30) {
        errormessage = "密碼長度不足";
    } else if (email.indexOf("@") === -1) {
        errormessage = "Email格式錯誤";
    } else if (username.length < 4 || username.length > 30) {
        errormessage = "帳號長度不符合";
    }

    if (errormessage !== "") {
        $.NotificationApp.send(`${errormessage}`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return;
    }

    buttonLoading(button, true, "註冊中...");
    const data = {
        username: username,
        email: email,
        password: password,
        confirmPassword: passwordConfirm
    }

    apiConnector.post("/api/guest/register", JSON.stringify(data)).then((response) => {
        if (response.data.status === 201) {
            buttonLoading(button, false, "註冊");
            $.NotificationApp.send("註冊成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
            document.getElementById("modal-button").click();
            return;
        }
        $.NotificationApp.send(`註冊失敗: ${response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }).catch((error) => {
        buttonLoading(button, false, "註冊");
        $.NotificationApp.send(`註冊失敗: ${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    })

});

document.getElementById("back-login").addEventListener("click", function(e) {
    e.preventDefault();
    window.location.href = "/login";
});