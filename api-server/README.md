# Boss计时器 - 多人共享版

基于文件存储的多人共享Boss计时器，**完全保留原页面所有功能**。

## 🎯 核心特点

- ✅ **保留原页面所有功能** - 不修改原页面逻辑
- ✅ **多人数据共享** - 所有用户看到统一的最新数据
- ✅ **文件存储** - 使用JSON文件存储数据，无需数据库
- ✅ **离线支持** - 网络断开时自动降级到离线模式
- ✅ **实时同步** - 每30秒自动同步服务器数据

## 📁 项目结构

```
api-server/
├── server.js          # API服务器（Express.js）
├── package.json       # 项目依赖配置
├── index.html         # 多人共享版页面
├── boss-data.json     # 数据存储文件（自动生成）
└── README.md          # 说明文档
```

## 🚀 快速启动

### 本地运行
```bash
cd api-server
npm install
npm start
```
访问：`http://localhost:3001`

### PM2部署（推荐生产）
```bash
npm install -g pm2
pm2 start server.js --name "boss-timer"
pm2 startup
pm2 save
```

## 🔧 API接口

- `GET /api/bosses` - 获取Boss数据
- `POST /api/bosses/{id}/kill` - 记录击杀时间
- `POST /api/bosses/reset` - 重置所有数据

## 📊 数据格式

数据存储在`boss-data.json`文件中，包含Boss信息、击杀时间等。

---

**享受多人协作的Boss计时体验！** 🎯