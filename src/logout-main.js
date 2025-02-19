import apiConnector from "./assets/js/custom/api-connector.js";

export const logout = async () => {
    try {
        await apiConnector.post("/web/user/logout");
        window.location.href = "/logout";
    } catch (error) {
        $.NotificationApp.send("登出失敗", "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }
};