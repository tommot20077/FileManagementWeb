## 檔案管理平台前端介紹

### 範例網站: [點擊前往](https://file.900303.xyz/)

- **帳號**: `user123`
- **密碼**: `Aa12345678`

---

## 主要特色

### 1. 高效的API處理以及整合

- 透過 RESTful API 與後端進行資料交換
- 建立全局的 Axios 請求攔截器，統一處理 Token 驗證、錯誤攔截等
- 支援 **即時更新** 減少頁面的重新載入提高使用者體驗

### 2. 使用者友善的 UI/UX 設計

- 選用 現成 UI 元件庫，確保一致的視覺風格與良好的用戶體驗。
- 響應式設計，適配桌面與行動端設備。
- 提供 黑暗模式 / 主題切換，提升使用舒適度。

### 3. 完整的檔案管理功能

- **檔案列表顯示** : 支援檔案列表顯示，提供檔案名稱、大小、分享狀態等資訊。
- **檔案搜索** : 支援檔案搜索，提供檔案名稱、類型、修改時間等的搜索功能。
- **檔案預覽以及下載** : 支援檔案預覽，提供圖片、影片、音樂等檔案的預覽功能並支援檔案下載。
- **多檔案上傳** : 支援檔案上傳，提供拖曳上傳、選擇檔案上傳等方式並與後端的分片上傳機制整合，確保大檔案穩定傳輸。
- **檔案分享** : 支援檔案分享，並可選擇分享類型以及用戶，確保檔案安全性。

### 4. 快速的部屬以及維護

- 使用環境變數進行配置，可輕鬆切換 API 端點（開發 / 測試 / 生產），方便部屬與維護。
- 使用 Docker 容器化部屬，提供一致的部屬環境，減少部屬問題。

---

## 安裝說明

### 1. **環境要求**

- **docker**: 20.10.0+
- **docker-compose**: 1.29.2+

### 2. **安裝步驟**

1. 下載位於 [/docker](https://github.com/tommot20077/FileManagement/tree/develop/docker/src) 內的 `docker-compose.yml`
   以及 `Dockerfile` 檔案
2. 於放置 `docker-compose.yml` 的資料夾內執行以下指令
    ```bash
    docker-compose up -d
    ```
3. 於瀏覽器輸入 `http://localhost:8078` 即可進入前端頁面
4. 若要關閉服務，請執行以下指令
    ```bash
    docker-compose down
    ```

**注意:**
此處安裝只包含前端，如果需要啟動則還需要安裝後端 [點擊前往](https://github.com/tommot20077/FileManagement)
---

## 總結

本前端專案以 **簡潔、易維護、快速開發**
為目標，選擇適合的模板並進行必要的整合與優化，確保與後端的高效交互。用戶能夠流暢地管理檔案、進行權限設定，並獲得良好的使用體驗。雖然前端不是主要開發重點，但仍確保基礎功能完善，未來若有需求可進一步擴展與優化。

