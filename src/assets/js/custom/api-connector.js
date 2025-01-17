import axios from 'axios';
import Config from "../../../../config";

//todo 之後移除JWT
const apiConnector = axios.create({

    baseURL: Config.apiUrl,
    //withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        "Authorization": "Bearer " + Config.jwt
    }
});

export default apiConnector;