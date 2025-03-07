import webConnector from "./web-connector.js";

export const logout = async () => {
    let csrfToken = null;
    let headerName = null;
    webConnector(headerName, csrfToken).post("/user/logout").then((response) => {
        if (response.data.status === 200) {
            window.location.href = "/logout";
            return;
        }
        throw new Error(response.data.message);
    })
};