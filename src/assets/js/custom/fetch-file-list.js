import apiConnector from "./api-connector.js";
import {formatFileSize} from "./tool.js";

document.addEventListener('DOMContentLoaded', () => {
    fetchFileList().then();
});

async function fetchFileList() {
    let response;
    try {
        response = await apiConnector.get('/api/file/getUserFileList');
        const files = response.data.data.files;
        const tbody = document.querySelector('.table-responsive tbody');
        tbody.innerHTML = '';

        files.forEach(file => {
            const tr = document.createElement('tr');

            const nameTd = document.createElement('td');
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('ms-2', 'fw-semibold');
            const nameLink = document.createElement('a');
            nameLink.href = 'javascript:void(0);';
            nameLink.classList.add('text-reset');
            nameLink.textContent = file.filename;
            nameSpan.appendChild(nameLink);
            nameTd.appendChild(nameSpan);
            tr.appendChild(nameTd);

            const modifiedTd = document.createElement('td');
            const modifiedP = document.createElement('p');
            modifiedP.classList.add('mb-0');
            modifiedP.textContent = file.lastAccessTime;
            const modifiedSpan = document.createElement('span');
            modifiedSpan.classList.add('font-12');
            modifiedSpan.textContent = `由 ${file.username}`;
            modifiedTd.appendChild(modifiedP);
            modifiedTd.appendChild(modifiedSpan);
            tr.appendChild(modifiedTd);

            const sizeTd = document.createElement('td');
            sizeTd.textContent = formatFileSize(file.fileSize);
            tr.appendChild(sizeTd);

            const ownerTd = document.createElement('td');
            ownerTd.textContent = file.username;
            tr.appendChild(ownerTd);

            const membersTd = document.createElement('td');
            membersTd.id = `tooltip-container-${file.id}`;
            const avatarGroup = document.createElement('div');
            avatarGroup.classList.add('avatar-group');

            file.shareUsers.forEach(member => {
                const memberLink = document.createElement('a');
                memberLink.href = 'javascript:void(0);';
                memberLink.classList.add('avatar-group-item', 'mb-0');
                memberLink.setAttribute('data-bs-container', `#tooltip-container-${file.id}`);
                memberLink.setAttribute('data-bs-toggle', 'tooltip');
                memberLink.setAttribute('data-bs-placement', 'top');
                memberLink.setAttribute('title', member.name);
                /*
                const memberImg = document.createElement('img');
                memberImg.src = member.avatarUrl;
                memberImg.classList.add('rounded-circle', 'avatar-xs');
                memberImg.alt = '朋友';
                memberLink.appendChild(memberImg);

                 */

                avatarGroup.appendChild(memberLink);
            });

            membersTd.appendChild(avatarGroup);
            tr.appendChild(membersTd);

            const actionsTd = document.createElement('td');

            const btnGroup = document.createElement('div');
            btnGroup.classList.add('btn-group', 'dropdown');

            const actionBtn = document.createElement('a');
            actionBtn.href = '#';
            actionBtn.classList.add('table-action-btn', 'dropdown-toggle', 'arrow-none', 'btn', 'btn-light', 'btn-xs');
            actionBtn.setAttribute('data-bs-toggle', 'dropdown');
            actionBtn.setAttribute('aria-expanded', 'false');
            const dotsIcon = document.createElement('i');
            dotsIcon.classList.add('mdi', 'mdi-dots-horizontal');
            actionBtn.appendChild(dotsIcon);
            btnGroup.appendChild(actionBtn);

            const dropdownMenu = document.createElement('div');
            dropdownMenu.classList.add('dropdown-menu', 'dropdown-menu-end');

            const actions = [
                {icon: 'mdi-share-variant', text: '分享'},
                {icon: 'mdi-link', text: '取得可分享連結'},
                {icon: 'mdi-pencil', text: '重新命名'},
                {icon: 'mdi-download', text: '下載'},
                {icon: 'mdi-delete', text: '移除'},
            ];

            actions.forEach(action => {
                const actionItem = document.createElement('a');
                actionItem.href = '#';
                actionItem.classList.add('dropdown-item', 'notify-item');

                const actionIcon = document.createElement('i');
                actionIcon.classList.add(action.icon, 'me-2', 'text-muted', 'vertical-middle');
                actionItem.appendChild(actionIcon);

                const actionText = document.createElement('span');
                actionText.textContent = action.text;
                actionItem.appendChild(actionText);

                dropdownMenu.appendChild(actionItem);
            });

            btnGroup.appendChild(dropdownMenu);
            actionsTd.appendChild(btnGroup);
            tr.appendChild(actionsTd);

            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
    }
}