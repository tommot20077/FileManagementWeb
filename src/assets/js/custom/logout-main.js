import webConnector from "./web-connector.js";
import {setCookie} from "./component.js";

export const logout = async () => {
    webConnector.post("/user/logout").then((response) => {
        if (response.data.status === 200) {
            setCookie('hasGuestCheck', 'false', 1);
            window.location.href = "/logout";
            return;
        }
        throw new Error(response.data.message);
    })
};