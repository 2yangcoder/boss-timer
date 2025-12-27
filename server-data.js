// 服务器端数据管理模块
class ServerDataManager {
  constructor() {
    this.supabase = null;
    this.isConnected = false;
    this.localDataManager = null;
    this.syncInterval = null;
    
    this.init();
  }
  
  async init() {
    // 检查是否配置了 Supabase
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
      await this.initSupabase();
    } else {
      console.warn('未配置 Supabase，将使用本地存储模式');
      this.useLocalStorageOnly();
    }
  }
  
  async initSupabase() {
    try {
      // 动态加载 Supabase 客户端
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      
      this.supabase = createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.anonKey
      );
      
      // 测试连接
      const { data, error } = await this.supabase.from('boss_configs').select('count').single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      this.isConnected = true;
      console.log('Supabase 连接成功');
      
      // 初始化数据库表
      await this.initDatabaseTables();
      
      // 开启实时订阅
      if (window.CONFIG.enableRealtime) {
        this.setupRealtimeSubscription();
      }
      
    } catch (error) {
      console.error('Supabase 连接失败:', error);
      this.useLocalStorageOnly();
    }
  }
  
  useLocalStorageOnly() {
    this.isConnected = false;
    this.localDataManager = new LocalDataManager();
  }
  
  async initDatabaseTables() {
    // 这里应该由服务器端创建表，前端无法直接创建
    // 在实际部署时，需要在 Supabase 控制台手动创建以下表：
    /*
    CREATE TABLE boss_configs (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(50) NOT NULL,
      interval INTEGER NOT NULL,
      delay INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE kill_records (
      id SERIAL PRIMARY KEY,
      boss_id INTEGER REFERENCES boss_configs(id),
      kill_time TIMESTAMP NOT NULL,
      accuracy VARCHAR(20) DEFAULT 'accurate',
      recorded_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
    */
  }
  
  setupRealtimeSubscription() {
    if (!this.isConnected) return;
    
    // 订阅 BOSS 配置变更
    this.supabase
      .channel('boss-configs')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'boss_configs' }, 
        (payload) => {
          console.log('BOSS配置变更:', payload);
          this.handleDataChange('boss_configs', payload);
        }
      )
      .subscribe();
    
    // 订阅击杀记录变更
    this.supabase
      .channel('kill-records')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'kill_records' }, 
        (payload) => {
          console.log('击杀记录变更:', payload);
          this.handleDataChange('kill_records', payload);
        }
      )
      .subscribe();
  }
  
  handleDataChange(table, payload) {
    // 通知应用数据已更新
    if (window.onServerDataChange) {
      window.onServerDataChange(table, payload);
    }
  }
  
  // BOSS 配置管理
  async getBossConfigs() {
    if (this.isConnected) {
      const { data, error } = await this.supabase
        .from('boss_configs')
        .select('*')
        .order('id');
      
      if (error) {
        console.error('获取BOSS配置失败:', error);
        return [];
      }
      
      return data.map(boss => ({
        id: boss.id,
        category: boss.category,
        name: boss.name,
        interval: boss.interval,
        delay: boss.delay,
        lastKillTime: null, // 这个需要从击杀记录计算
        accuracy: null
      }));
    } else {
      return this.localDataManager.getBossConfigs();
    }
  }
  
  async saveBossConfigs(bosses) {
    if (this.isConnected) {
      // 批量更新BOSS配置
      const { error } = await this.supabase
        .from('boss_configs')
        .upsert(bosses.map(boss => ({
          id: boss.id,
          name: boss.name,
          category: boss.category,
          interval: boss.interval,
          delay: boss.delay
        })));
      
      if (error) {
        console.error('保存BOSS配置失败:', error);
        return false;
      }
      return true;
    } else {
      return this.localDataManager.saveBossConfigs(bosses);
    }
  }
  
  // 击杀记录管理
  async addKillRecord(bossId, killTime, accuracy, recordedBy = 'anonymous') {
    if (this.isConnected) {
      const { error } = await this.supabase
        .from('kill_records')
        .insert({
          boss_id: bossId,
          kill_time: killTime,
          accuracy: accuracy,
          recorded_by: recordedBy
        });
      
      if (error) {
        console.error('添加击杀记录失败:', error);
        return false;
      }
      return true;
    } else {
      return this.localDataManager.addKillRecord(bossId, killTime, accuracy);
    }
  }
  
  async getKillRecords(bossId = null) {
    if (this.isConnected) {
      let query = this.supabase
        .from('kill_records')
        .select(`
          *,
          boss_configs!inner(name, category)
        `)
        .order('kill_time', { ascending: false })
        .limit(1000);
      
      if (bossId) {
        query = query.eq('boss_id', bossId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('获取击杀记录失败:', error);
        return [];
      }
      
      return data.map(record => ({
        id: record.id,
        bossId: record.boss_id,
        killTime: record.kill_time,
        accuracy: record.accuracy,
        recordedBy: record.recorded_by,
        timestamp: record.created_at
      }));
    } else {
      return bossId ? 
        this.localDataManager.getKillRecordsByBoss(bossId) : 
        this.localDataManager.getKillRecords();
    }
  }
  
  // 获取BOSS的最后击杀时间
  async getLastKillTime(bossId) {
    const records = await this.getKillRecords(bossId);
    return records.length > 0 ? records[0].killTime : null;
  }
  
  // 数据同步
  async syncData() {
    if (!this.isConnected) return;
    
    try {
      // 从服务器获取最新数据
      const serverBosses = await this.getBossConfigs();
      const serverRecords = await this.getKillRecords();
      
      // 更新本地数据
      if (window.updateLocalData) {
        window.updateLocalData(serverBosses, serverRecords);
      }
      
    } catch (error) {
      console.error('数据同步失败:', error);
    }
  }
  
  // 开始自动同步
  startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      this.syncData();
    }, window.CONFIG.syncInterval);
  }
  
  // 停止自动同步
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

// 本地数据管理器（降级方案）
class LocalDataManager {
  constructor() {
    this.storageKeys = {
      BOSS_CONFIGS: 'boss_timer_boss_configs',
      KILL_RECORDS: 'boss_timer_kill_records'
    };
  }
  
  getBossConfigs() {
    try {
      const data = localStorage.getItem(this.storageKeys.BOSS_CONFIGS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }
  
  saveBossConfigs(bosses) {
    try {
      localStorage.setItem(this.storageKeys.BOSS_CONFIGS, JSON.stringify(bosses));
      return true;
    } catch (e) {
      return false;
    }
  }
  
  addKillRecord(bossId, killTime, accuracy) {
    const records = this.getKillRecords();
    const newRecord = {
      id: Date.now(),
      bossId: bossId,
      killTime: killTime,
      accuracy: accuracy,
      timestamp: new Date().toISOString()
    };
    records.push(newRecord);
    
    if (records.length > 1000) {
      records.splice(0, records.length - 1000);
    }
    
    return this.saveKillRecords(records);
  }
  
  getKillRecords() {
    try {
      const data = localStorage.getItem(this.storageKeys.KILL_RECORDS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }
  
  getKillRecordsByBoss(bossId) {
    const records = this.getKillRecords();
    return records.filter(record => record.bossId === bossId)
                 .sort((a, b) => new Date(b.killTime) - new Date(a.killTime));
  }
  
  saveKillRecords(records) {
    try {
      localStorage.setItem(this.storageKeys.KILL_RECORDS, JSON.stringify(records));
      return true;
    } catch (e) {
      return false;
    }
  }
}

// 创建全局实例
window.ServerDataManager = new ServerDataManager();