import hljs from 'highlight.js';
import Quill, {Delta} from "quill";
import apiConnector from "./assets/js/custom/api-connector.js";
import {buttonLoading} from "./assets/js/custom/component.js";
import {logout} from "./logout-main.js";

let fileId = null;
let filename = null;
document.addEventListener("DOMContentLoaded", function () {
    if (window.name) {
        let file = JSON.parse(window.name);
        fileId = file.id;
        window.name = "";
        const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?id=${fileId}`;
        window.history.pushState({path: newUrl}, '', newUrl);
    } else {
        const params = new URLSearchParams(window.location.search);
        if (!params.has("id")) {
            $.NotificationApp.send(`文件ID不存在`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
            return
        }
        if (!params.get("id") || isNaN(parseInt(params.get("id")))) {
            $.NotificationApp.send(`文件ID格式不正确`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
            return
        }
        fileId = params.get("id");
    }


    apiConnector.get(`api/docs/${fileId}`).then((response) => {
        if (response.data.status === 200) {
            const data = {ops: response.data.data.content.delta};
            quill.setContents(new Delta(data));
            filename = response.data.data.filename;
            return
        }
        throw new Error(response.data.message || "文件不存在");
    }).catch((error) => {
        $.NotificationApp.send(`${error.response.data.message || error}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
    });

    getUserHistoryVersion().then(r => {});

});
let quill = new Quill("#editor", {
    theme: "snow",
    modules: {
        toolbar: [
            [{font: []}, {size: []}],
            ["bold", "italic", "underline", "strike"],
            [{color: []}, {background: []}],
            [{script: "super"}, {script: "sub"}],
            [{header: [!1, 1, 2, 3, 4, 5, 6]}, "blockquote", "code-block"],
            [{list: "ordered"}, {list: "bullet"}, {indent: "-1"}, {indent: "+1"}],
            ["direction", {align: []}],
            ["link"], ["clean"]
        ],
        syntax: {hljs},
    }
});

document.getElementById("back-btn").addEventListener("click", function () {
    window.history.back();
    window.history.back();
});

document.getElementById("update-btn").addEventListener("click", function () {

    let doc = document.getElementById("update-btn");
    buttonLoading(doc, true, "更新中...");

    if (!fileId || !filename) {
        const msg = !fileId ? "文件ID不存在" : "文件名不存在";
        $.NotificationApp.send(msg, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        buttonLoading(doc, false, "更新");
        return
    }

    let data = {
        fileId: fileId,
        filename: filename,
        content: {delta: quill.getContents().ops},
        editType: "EDIT_CONTENT"
    }
    apiConnector.put("api/docs", JSON.stringify(data)).then((response) => {
        if (response.data.status === 200) {
            $.NotificationApp.send("更新成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
            buttonLoading(doc, false, "更新");
            return
        }
        throw new Error(response.data.message || "更新失敗");
    }).catch((error) => {
        $.NotificationApp.send(`更新失敗: ${error.response.data.message || error}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        buttonLoading(doc, false, "更新");
    })
});

async function getUserHistoryVersion () {
    if (!fileId) {
        $.NotificationApp.send("文件ID不存在", "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        return
    }
    apiConnector(`/api/docs/history/${fileId}`).then((response) => {
        const data = response.data.data;
        data.data.forEach((content => {
            let historyList = document.getElementById("userHistoryList");
            const card = document.createElement("div");
            card.className = "card mb-0";

            const cardHeader = document.createElement("div");
            cardHeader.className = "card-header";
            cardHeader.id = `version-${content.version}`;

            let title = document.createElement("h5");
            title.className = "m-0";

            let a = document.createElement("a");
            a.className = "custom-accordion-title d-block pt-2 pb-2";
            a.setAttribute("data-bs-toggle", "collapse");
            a.href = `#collapse-${content.version}`;
            a.setAttribute("aria-expanded", "false");
            a.setAttribute("aria-controls", `collapse-${content.version}`);

            a.innerHTML = `版本 ${content.version}`;
            title.appendChild(a);
            cardHeader.appendChild(title);
            card.appendChild(cardHeader);

            let collapse = document.createElement("div");
            collapse.id = `collapse-${content.version}`;
            collapse.className = "collapse";
            collapse.setAttribute("aria-labelledby", `version-${content.version}`);
            collapse.setAttribute("data-bs-parent", "#userHistoryList");

            let cardBody = document.createElement("div");
            cardBody.className = "card-body";



            cardBody.innerHTML = `        
                <div class="card-body">
                    <p class="card-text">
                        <strong>備註:</strong> ${content.note || "無備註"} <br>
                        <strong>最後修改者:</strong> ${content.modifiedBy} <br>
                        <strong>修改時間:</strong> ${content.modifiedTime} <br>
                        
                    </p>
                    <button class="btn btn-primary btn-sm" data-id='${content.version}' data-bs-toggle="modal" href="#checkRevertToggle">還原</button>
                </div>`

            collapse.appendChild(cardBody);
            card.appendChild(collapse);
            historyList.appendChild(card);
        }))

        const buttons = document.getElementById("userHistoryList").querySelectorAll('.btn.btn-primary.btn-sm');
        buttons.forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                document.getElementById("checkRevertContent").innerHTML = '<p class="h4">確定要還原至版本 ' + `<a class="text-warning h4">${id}</a>`+ ' ?</p>';
                document.getElementById("checkRevertButton").setAttribute("data-id", id);
            });
        });
    });

    document.getElementById("checkRevertButton").addEventListener("click", function() {
        const id = this.getAttribute("data-id");
        if(id === null) {
            $.NotificationApp.send("版本ID不存在", "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        }
        buttonLoading(this, true, "復原中...");

        const data = {
            fileId: fileId,
            filename: filename,
            version: id,
            editType: "REVERT_HISTORY_RECORD"
        }
        apiConnector.put('api/docs', JSON.stringify(data)).then((response) => {
            if (response.data.status === 200) {
                buttonLoading(this, false, "復原");
                $.NotificationApp.send("還原成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
                this.setAttribute("data-id", null);
                this.setAttribute("disabled", "disabled");
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
                return
            }
            throw new Error(response.data.message || "還原失敗");
        }).catch((error) => {
            buttonLoading(this, false, "復原");
            $.NotificationApp.send(`還原失敗: ${error.response.data.message || error}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        })
    });

    document.getElementById("checkBuildHistoryBottom").addEventListener("click", function() {
        let note = document.getElementById("NewHistoryNote").value;
        buttonLoading(this, true, "建立中...");
        const data = {
            fileId: fileId,
            filename: filename,
            editType: "BUILD_HISTORY_RECORD",
            content: {delta: quill.getContents().ops},
            note: note
        }

        apiConnector.put("/api/docs", JSON.stringify(data)).then((response) => {
            if (response.data.status === 200) {
                $.NotificationApp.send("建立版本成功", "", "bottom-right", "rgba(0,0,0,0.2)", "success");
                buttonLoading(this, false, "建立");
                this.setAttribute("disabled", "disabled");
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        }).catch((error) => {
            buttonLoading(this, false, "建立");
            $.NotificationApp.send(`建立版本失敗: ${error.response.data.message}`, "", "bottom-right", "rgba(0,0,0,0.2)", "error");
        });
    });
}
document.getElementById("logoutBtn")?.addEventListener("click", logout);

