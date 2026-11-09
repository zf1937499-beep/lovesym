# 运行与部署

## 1. 本地跑起来

```bash
node server.mjs            # http://localhost:4321
PORT=8080 node server.mjs  # 换端口
```

需要 Node 18+（用到全局 fetch、`node:` 前缀模块）。零依赖，不用 npm install。

第一次打开页面时，服务端还没有数据，浏览器会把本地的初始数据推上去，
之后所有改动都会自动存到服务端。

## 2. 目录与数据

```
data/db.json          两个人共享的全部数据（日记、相册索引、愿望、打卡、券…）
data/uploads/*.jpg    上传的照片与头像
```

- `db.json` 写入是「先写 .tmp 再 rename」的原子替换，断电不会写坏；
- 图片按 `<时间戳>-<随机>.<ext>` 命名，不会重名也不会被猜路径；
- 备份 = 打包 `data/` 目录，恢复 = 解压回去重启。

```bash
tar -czf backup-$(date +%F).tar.gz data/
```

## 3. 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 存活检查，返回当前数据版本 |
| GET | `/api/state` | 取全量数据 `{rev, updatedAt, data}` |
| PUT | `/api/state` | 保存，body `{rev, data}`；版本不匹配返回 409 |
| POST | `/api/upload?ext=jpg` | 原始二进制上传，返回 `{url}` |
| GET | `/api/weather` | 双方天气（服务端缓存 30 分钟） |

### 冲突处理

每次保存带上次的 `rev`。如果对方在你编辑期间改过，服务端返回 `409` + 最新数据，
前端提示「对方刚更新了内容，正在同步…」并刷新页面。对两个人的场景足够用，
也避免了"最后写入的人覆盖一切"。

## 4. 部署到服务器

### 方式 A：systemd（推荐，最省事）

```ini
# /etc/systemd/system/love.service
[Unit]
Description=Hanhai Yimeng love space
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/love
ExecStart=/usr/bin/node server.mjs
Environment=PORT=4321
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now love
sudo systemctl status love
```

### 方式 B：pm2

```bash
npm i -g pm2
pm2 start server.mjs --name love
pm2 save && pm2 startup
```

### Nginx 反代 + HTTPS

```nginx
server {
    listen 80;
    server_name love.example.com;

    client_max_body_size 10m;   # 图片上传

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

证书用 certbot：`sudo certbot --nginx -d love.example.com`。

### 建议加一层访问控制

这是两个人的私密空间，别直接裸露在公网。任选其一：

- Nginx Basic Auth（最快）
  ```bash
  sudo htpasswd -c /etc/nginx/.htpasswd hanhan
  # nginx 的 location / 里加：
  #   auth_basic "Private";
  #   auth_basic_user_file /etc/nginx/.htpasswd;
  ```
- 或者干脆只挂 Tailscale / frp 内网，不对公网开放。

## 5. 升级与注意

- 前端已经做了降级：**服务端挂了 / 直接双击 html** 时会退回 localStorage 模式，
  页面照样能用，只是两台设备不同步；
- 新增数据字段不用迁移，读取时会用默认值补齐；
- 上传限制 8MB/张，前端会先压到 1280px 再传，正常一张 100~300KB；
- 想重置：停服务 → `rm -rf data` → 重启 → 浏览器再推一次初始数据。

## 6. 为什么不用 Next.js / 数据库

两个人的数据量，一个 JSON 文件 + 一个 Node 进程足够，运维成本几乎为零：
不需要数据库、不需要构建、改完文件重启就行。真到了要多端实时协同的规模，
再换 SQLite/Postgres 也不迟——接口形状不用变，前端只认 `/api/state`。
