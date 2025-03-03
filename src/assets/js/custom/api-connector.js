import axios from 'axios';
import Config from "../../../../config";

const apiConnector = axios.create({
    baseURL: Config.backendUrl,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

export function createWebConnector(headerName, token) {
    return axios.create({
        baseURL: Config.backendUrl,
        withCredentials: true,
        headers: {
            'Content-Type': 'application/json',
            [headerName]: token
        }
    });
}


apiConnector.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            const {status} = error.response.data;
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

export default apiConnector;