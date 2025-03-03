import apiConnector, {createWebConnector} from "./api-connector.js";

export const logout = async () => {
    let csrfToken = null;
    let headerName = null;
    apiConnector.get("/api/guest/csrf/token").then(async (response) => {
        if (response.data.status === 200) {
            csrfToken = response.data.data.token;
            headerName = response.data.data.headerName;
            createWebConnector(headerName, csrfToken).post("/web/user/logout").then((response) => {
                if (response.data.status === 200) {
                    window.location.href = "/logout";
                    return;
                }
                throw new Error(response.data.message);
            })
            return;
        }
        throw new Error(response.data.message);
    }).catch((error) => {
        $.NotificationApp.send(`獲取 CSRF Token 失敗: ${error}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    });
};