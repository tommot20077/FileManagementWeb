import './web-connector.js';
import './chunk-upload-manager.js';
import editResource from './edit-resource.js';
import fetchFileListModule from './fetch-file-list.js';
import {convertToISOFormat, formatFileSize, reservedPath} from './tool.js';
import uploadContainer from './upload-container.js';
import uploadManager from './upload-manager.js';
import {WSConnector} from './ws-connectoer.js';
import {getUserInfo} from "./user-info.js";
import fetchFileList from "./fetch-file-list.js";
import {logout} from "./logout-main.js";
import {openMoveFileModal} from "./folder-tree.js";
import moment from "moment";
import {buttonLoading} from "./component.js";

document.addEventListener('DOMContentLoaded', () => {

    const urlParams = new URLSearchParams(window.location.search);

    let isSearch = false;
    const filter = {
        page: urlParams.get('page') || 1,
        size: urlParams.get('size'),
        type: urlParams.get('type'),
        keyword: urlParams.get('keyword'),
        folder: urlParams.get('folder'),
        start: urlParams.get('start'),
        end: urlParams.get('end')
    }

    const pathParts = window.location.pathname.split('/');

    let folderId;
    if (pathParts[pathParts.length - 1] in reservedPath && isNaN(parseInt(pathParts[pathParts.length - 1]))) {
        folderId = reservedPath[pathParts[pathParts.length - 1]];
    } else if (window.location.pathname === "/web/files/search") {
        isSearch = true;
    } else {
        folderId = parseInt(pathParts[pathParts.length - 1]) || 0;
    }

    fetchFileListModule.fetchFileList(folderId, true, filter, isSearch).then(() => {
    });
    getUserInfo();
    htmlStyle();
    timeRangeSetting();
});

window.addEventListener("popstate", (event) => {
    if (event.state) {
        fetchFileListModule.fetchFileList(event.state.folderId, false, event.state).then(() => {
        });
    }
});

document.getElementById("logoutBtn")?.addEventListener("click", logout);

document.getElementById("index-btn")?.addEventListener("click", () => {
    fetchFileListModule.fetchFileList(0, 1, true).then(() => {
    });
});

document.getElementById("stars-btn")?.addEventListener("click", () => {
    fetchFileListModule.fetchFileList(-2, 1, true).then(() => {
    });
});

document.getElementById("recently-btn")?.addEventListener("click", () => {
    fetchFileListModule.fetchFileList(-3, 1, true).then(() => {
    });
});
document.getElementById("recycle-btn")?.addEventListener("click", () => {
    fetchFileListModule.fetchFileList(-4, 1, true).then(() => {
    });
});


function htmlStyle() {
    const body = document.body;

    const defaultSettings = {
        "data-color-scheme-mode": "light",  // dark or light
        "data-theme": "light", // default or dark or light
        "data-width": "fluid",   // fluid or boxed
        "data-compact": "" // scrollable, condensed, fixed
    };
    const map = {
        "data-color-scheme-mode": "data-layout-color",
        "data-theme": "data-leftbar-theme",
        "data-width": "data-layout-mode",
        "data-compact": "data-leftbar-compact-mode"
    }

    Object.keys(defaultSettings).forEach(key => {
        const savedValue = localStorage.getItem(key) || defaultSettings[key];
        body.setAttribute(map[key], savedValue);

        const input = document.querySelector(`input[name="${key.replace("data-", "")}"][value="${savedValue}"]`);
        if (input) input.click();

    });

    document.querySelectorAll('.form-check-input').forEach(input => {
        input.addEventListener("change", function () {
            if (this.checked) {
                const attrKey = `data-${this.name}`;
                body.setAttribute(attrKey, this.value);
                localStorage.setItem(attrKey, this.value);
            }
        });
    });

    document.getElementById("resetBtn").addEventListener("click", function () {
        Object.keys(defaultSettings).forEach(key => {
            localStorage.removeItem(key);
            body.setAttribute(key, defaultSettings[key]);

            const defaultInput = document.querySelector(`input[name="${key.replace("data-", "")}"][value="${defaultSettings[key]}"]`);
            if (defaultInput) defaultInput.checked = true;
        });
    });

    document.getElementById("choose-folder-btn").addEventListener("click", async function () {
        await openMoveFileModal(null, document.getElementById("advance-folder"), true);
    });

    document.getElementById("base-search-btn").addEventListener("click", async function () {
        const btn = document.getElementById("base-search-btn");
        const keyword = document.getElementById("base-file-search-keyword").value;
        if (!keyword || keyword.trim().length < 2) {
            $.NotificationApp.send(`關鍵字長度需大於2`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
            return
        }
        buttonLoading(btn, true, "搜尋中");
        fetchFileListModule.fetchFileList(-1, true, {keyword: keyword}, true).finally(() => {
            buttonLoading(btn, false, "搜尋");
        });
    });

    document.getElementById("advance-search-btn").addEventListener("click", async function () {
        const btn = document.getElementById("advance-search-btn");

        const keyword = document.getElementById("advance-keyword").value;
        const folder = document.getElementById("advance-folder").value;
        const selectedTypes = Array.from(document.getElementById("choose-type").selectedOptions).map(option => option.value);
        const timeRange = document.getElementById("time-range").innerText.trim();
        let startDate = null;
        let endDate = null;
        if (timeRange) {
            const com = timeRange.split(" - ");
            startDate = com[0]
            endDate = com[1]
        }

        const typeString = selectedTypes.join(",").trim().length > 0 ? selectedTypes.join(",") : null;
        const filter = {
            type: typeString,
            keyword: keyword.trim().length > 0 ? keyword : null,
            folder: folder.trim().length > 0 ? folder : null,
            start: convertToISOFormat(startDate),
            end: convertToISOFormat(endDate)
        }
        if (keyword && keyword.trim().length < 2) {
            $.NotificationApp.send(`關鍵字長度需大於2`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
            return
        }


        let flag = false;
        for (const key in filter) {
            if (filter[key]) {
                flag = true;
                break;
            }
        }
        if (!flag) {
            $.NotificationApp.send(`查詢條件不可為空`, "", "bottom-right", "rgba(0,0,0,0.2)", "warning");
            return;
        }
        buttonLoading(btn, true, "搜尋中...");
        fetchFileListModule.fetchFileList(-1, true, filter, true).then(() => {
            document.getElementById("close-advance-search-btn").click();
        }).finally(() => {
            buttonLoading(btn, false, "搜尋");
        });
    });
}

document.getElementById("advance-reset-btn").addEventListener("click", function () {
    timeRangeSetting();
});

document.getElementById("time-range")?.addEventListener("click", function () {
    timeRangeSetting();
});

function timeRangeSetting() {
    document.getElementById("calendar-range").innerHTML =
        `
            <label for="selectedValue" class="col-3 col-form-label">選擇時間</label>
                <div class='col-9'>
                    <div id='time-range' style='z-index: 1050' class="form-control" data-toggle="date-picker-range" data-target-display="#selectedValue" data-cancel-class="btn-light">
                    <i class="mdi mdi-calendar"></i>
                    <span id="selectedValue"></span> <i class="mdi mdi-menu-down"></i>
                </div>
            </div>
        `
    let start = moment().subtract(29, 'days');
    let end = moment();
    function cb(start, end) {
        $('#time-range span').html(start.format('YYYY/MM/DD') + ' - ' + end.format('YYYY/MM/DD'));
    }

    $('#time-range').daterangepicker({
        parentEl: 'body',
        locale: {
            format: 'YYYY-MM-DD'
        },
        drops: "auto",
        applyButtonClasses: "btn-info",
        startDate: start,
        endDate: end,
        ranges: {
            '今天': [moment(), moment()],
            '昨天': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            '最近1周': [moment().subtract(6, 'days'), moment()],
            '本月': [moment().startOf('month'), moment().endOf('month')],
            '上個月': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        },
        zIndex: 9999
    }, cb);
}