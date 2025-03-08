import webConnector from "./web-connector.js";

export const logout = async () => {
    webConnector.post("/user/logout").then((response) => {
        if (response.data.status === 200) {
            window.location.href = "/logout";
            return;
        }
        throw new Error(response.data.message);
    })
};