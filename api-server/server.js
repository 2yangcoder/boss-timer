const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'boss-data.json');

// 初始化数据文件
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = [
      { id: 1, category: "海底", name: "四一", interval: 6, delay: 0, lastKillTime: null, accuracy: null },
      { id: 2, category: "海底", name: "五一", interval: 6, delay: 0, lastKillTime: null, accuracy: null },
      { id: 3, category: "海底", name: "龙王", interval: 6, delay: 0, lastKillTime: null, accuracy: null },
      { id: 4, category: "海底", name: "海魔", interval: 8, delay: 2, lastKillTime: null, accuracy: null },
      { id: 5, category: "海底", name: "船长", interval: 8, delay: 0, lastKillTime: null, accuracy: null },
      { id: 6, category: "业火", name: "神驹", interval: 6, delay: 0, lastKillTime: null, accuracy: null },
      { id: 7, category: "业火", name: "魔君", interval: 6, delay: 0, lastKillTime: null, accuracy: null },
      { id: 8, category: "业火", name: "囚笼", interval: 8, delay: 0, lastKillTime: null, accuracy: null },
      { id: 9, category: "其他", name: "祖玛", interval: 3, delay: 2, lastKillTime: null, accuracy: null },
      { id: 10, category: "其他", name: "老牛", interval: 4, delay: 0, lastKillTime: null, accuracy: null },
      { id: 11, category: "其他", name: "魔王", interval: 6, delay: 120, lastKillTime: null, accuracy: null },
      { id: 12, category: "其他", name: "毒龙", interval: 24, delay: 0, lastKillTime: null, accuracy: null }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log('数据文件已初始化');
  }
}

// 读取数据
function readData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取数据文件失败:', error);
    return [];
  }
}

// 写入数据
function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('写入数据文件失败:', error);
    return false;
  }
}

// API路由

// 获取所有Boss数据
app.get('/api/bosses', (req, res) => {
  const bosses = readData();
  res.json(bosses);
});

// 更新Boss击杀时间
app.post('/api/bosses/:id/kill', (req, res) => {
  const bossId = parseInt(req.params.id);
  const { time, accuracy = 'accurate' } = req.body;
  
  const bosses = readData();
  const bossIndex = bosses.findIndex(b => b.id === bossId);
  
  if (bossIndex === -1) {
    return res.status(404).json({ error: 'Boss not found' });
  }
  
  // 使用传入的时间或当前时间
  const killTime = time ? new Date(time) : new Date();
  
  bosses[bossIndex].lastKillTime = killTime.toISOString();
  bosses[bossIndex].accuracy = accuracy;
  
  if (writeData(bosses)) {
    res.json({ success: true, boss: bosses[bossIndex] });
  } else {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// 重置所有Boss数据
app.post('/api/bosses/reset', (req, res) => {
  const bosses = readData();
  
  bosses.forEach(boss => {
    boss.lastKillTime = null;
    boss.accuracy = null;
  });
  
  if (writeData(bosses)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to reset data' });
  }
});

// 提供原页面（不修改原文件）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../1.html'));
});

// 启动服务器
app.listen(PORT, () => {
  initDataFile();
  console.log(`Boss计时器API服务器运行在 http://localhost:${PORT}`);
  console.log('数据文件:', DATA_FILE);
});