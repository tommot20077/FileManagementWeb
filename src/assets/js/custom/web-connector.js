import axios from "axios";
import Config from "../../../../config/config.js";

async function fetchCsrfToken() {
    try {
        const response = await axios.get(`${Config.backendUrl}/api/v1/guest/csrf/token`, { withCredentials: true });
        if (response.data.status === 200) {
            return {
                headerName: response.data.data.headerName,
                csrfToken: response.data.data.token
            };
        }
    } catch (error) {
        const errorMessages = error.response?.data?.message || error;
        $.NotificationApp.send(`獲取 CSRF Token 失敗: ${errorMessages}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    }
    return null;
}
const webConnector = axios.create({
    baseURL: `${Config.backendUrl}/web/v1`,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});
webConnector.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error(error.response?.data?.message || error);
        if (error.response) {
            const { status } = error.response.data;
            if (status === 1124 || status === 1108) {
                $.NotificationApp.send("授權驗證失敗", "", "bottom-right", "rgba(0,0,0,0.2)", "error");
                setTimeout(() => {
                    window.location.href = "/login";
                }, 2000);
            }
        }
        return Promise.reject(error);
    }
);
webConnector.interceptors.request.use(
    async (config) => {
        if (config.xsrfCookieName === "useless") {
            return config;
        }
        const csrfData = await fetchCsrfToken();
        if (csrfData) {
            config.headers[csrfData.headerName] = csrfData.csrfToken;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default webConnector;