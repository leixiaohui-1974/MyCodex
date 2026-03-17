#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  cat > "${ENV_FILE}" <<ENVEOF
JWT_SECRET=${JWT_SECRET}
GITEA_CLIENT_ID=your_gitea_client_id
GITEA_CLIENT_SECRET=your_gitea_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
ENVEOF
  echo "[deploy] .env 未找到，已生成默认配置（含随机 JWT_SECRET）"
  echo "[deploy] 请编辑 ${ENV_FILE} 填入真实的 OAuth 凭证"
else
  echo "[deploy] .env 已存在，使用现有配置"
fi

cd "${SCRIPT_DIR}"
docker compose up -d --build

echo ""
echo "======================================"
echo "  MyCodex 部署完成"
echo "======================================"
echo "  应用:  http://localhost"
echo "  Gitea: http://localhost/gitea"
echo "  API:   http://localhost/api/"
echo "======================================"
