import apiConnector from "./api-connector.js";
import {buttonLoading} from "./component.js";

let mail = null
let password = null
let passwordConfirm = null
let code = null
document.getElementById('reset-password-btn').addEventListener('click', function (event) {
    const form = event.target.closest('form');
    if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
        $.NotificationApp.send(`請輸入有效的電子郵件`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return;
    }
    event.preventDefault();
    mail = document.getElementById('email').value;

    buttonLoading(this, true, "處理中...");
    apiConnector.post("/api/guest/sendResetPasswordMail", JSON.stringify({email: mail})).then((response) => {
        if (response.status === 200) {
            $.NotificationApp.send(`驗證碼已發送至 ${mail}`, "", "bottom-right", "rgba(0,0,0,0.2)", "success");
            buttonLoading(this, false, "重置密碼");
            document.getElementById('reset-password-modal-btn').click();
            return
        }
        throw new Error(response.data.message)
    }).catch((error) => {
        $.NotificationApp.send(`驗證碼發送失敗 ${error.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        buttonLoading(this, false, "重置密碼");
    });
});
document.getElementById('code').addEventListener('input', function (event) {
    this.value = this.value.replace(/\D/g, '').slice(0, 6);
});
document.getElementById('reset-password').addEventListener('click', function (event) {
    event.preventDefault();
    if (document.getElementById('code').value === null || document.getElementById('code')
                                                                  .value
                                                                  .trim() === "" || document.getElementById('code').value.length !== 6) {
        $.NotificationApp.send(`請輸入驗證碼`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return
    }
    if (document.getElementById('password').value === null || document.getElementById('password').value.trim() === "") {
        $.NotificationApp.send(`請輸入密碼`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return
    }
    if (document.getElementById('password-confirm').value === null || document.getElementById('password-confirm').value.trim() === "") {
        $.NotificationApp.send(`請再次輸入密碼`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return
    }
    if (document.getElementById('password').value !== document.getElementById('password-confirm').value) {
        $.NotificationApp.send(`兩次密碼不一致`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        return
    }
    buttonLoading(this, true, "處理中...");
    password = document.getElementById('password').value
    passwordConfirm = document.getElementById('password-confirm').value
    code = document.getElementById('code').value

    const data = {
        "verificationCode": code,
        "email": mail,
        "newPassword": password,
        "confirmPassword": passwordConfirm
    }
    apiConnector.put('/api/guest/resetPassword', JSON.stringify(data)).then((response) => {
        if (response.status === 200) {
            $.NotificationApp.send(`密碼重設成功`, "", "bottom-right", "rgba(0,0,0,0.2)", "success");

            setTimeout(() => {
                window.location.href = "/login.html"
            }, 2000)
            buttonLoading(this, false, "重置密碼");
            this.disabled = true;
            return
        }
        throw new Error(response.data.message)
    }).catch((error) => {
        $.NotificationApp.send(`密碼重設失敗 ${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
        buttonLoading(this, false, "重置密碼");
    })
});