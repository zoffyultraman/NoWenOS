export type Locale = "en" | "zh";

const translations: Record<string, Record<Locale, string>> = {
  // Sidebar
  "nav.dashboard": { en: "Dashboard", zh: "仪表盘" },
  "nav.system": { en: "System Info", zh: "系统信息" },
  "nav.storage": { en: "Storage", zh: "存储" },
  "nav.shares": { en: "Shares", zh: "共享" },
  "nav.files": { en: "Files", zh: "文件" },
  "nav.docker": { en: "Docker", zh: "Docker" },
  "nav.users": { en: "Users", zh: "用户" },
  "nav.logs": { en: "Logs", zh: "日志" },
  "nav.alerts": { en: "Alerts", zh: "告警" },
  "nav.settings": { en: "Settings", zh: "设置" },

  // Header
  "header.console": { en: "Management Console", zh: "管理控制台" },
  "header.logout": { en: "Logout", zh: "退出登录" },

  // Dashboard
  "dashboard.title": { en: "Dashboard", zh: "仪表盘" },
  "dashboard.subtitle": { en: "Overview of your NoWenOS system.", zh: "NoWenOS 系统概览" },
  "dashboard.system": { en: "System", zh: "系统" },
  "dashboard.apiStatus": { en: "API Status", zh: "API 状态" },
  "dashboard.connected": { en: "Connected", zh: "已连接" },
  "dashboard.error": { en: "Error", zh: "错误" },
  "dashboard.uptime": { en: "Uptime", zh: "运行时间" },
  "dashboard.cpu": { en: "CPU", zh: "CPU" },
  "dashboard.cores": { en: "cores", zh: "核心" },
  "dashboard.memory": { en: "Memory", zh: "内存" },
  "dashboard.disk": { en: "Disk", zh: "磁盘" },
  "dashboard.network": { en: "Network", zh: "网络" },
  "dashboard.totalRx": { en: "Total Received", zh: "总接收" },
  "dashboard.totalTx": { en: "Total Transmitted", zh: "总发送" },
  "dashboard.interfaces": { en: "Interfaces", zh: "网络接口" },
  "dashboard.topProcesses": { en: "Top Processes", zh: "进程列表" },
  "dashboard.loading": { en: "Loading...", zh: "加载中..." },
  "dashboard.loadingProcesses": { en: "Loading processes...", zh: "加载进程..." },
  "dashboard.failedProcesses": { en: "Failed to load processes.", zh: "加载进程失败" },
  "dashboard.noProcesses": { en: "No process data available.", zh: "无进程数据" },
  "dashboard.failedSystem": { en: "Failed to load system info from backend.", zh: "从后端加载系统信息失败" },

  // Storage
  "storage.title": { en: "Storage", zh: "存储" },
  "storage.subtitle": { en: "Disk and partition information (read-only).", zh: "磁盘和分区信息（只读）" },
  "storage.loading": { en: "Loading disk info...", zh: "加载磁盘信息..." },
  "storage.failed": { en: "Failed to load disk information.", zh: "加载磁盘信息失败" },
  "storage.noDisks": { en: "No disks detected.", zh: "未检测到磁盘" },

  // Files
  "files.title": { en: "Files", zh: "文件" },
  "files.up": { en: "Up", zh: "上级" },
  "files.newFolder": { en: "New Folder", zh: "新建文件夹" },
  "files.upload": { en: "Upload", zh: "上传" },
  "files.loading": { en: "Loading files...", zh: "加载文件..." },
  "files.failed": { en: "Failed to load directory.", zh: "加载目录失败" },
  "files.empty": { en: "Empty directory.", zh: "空目录" },
  "files.name": { en: "Name", zh: "名称" },
  "files.size": { en: "Size", zh: "大小" },
  "files.modified": { en: "Modified", zh: "修改时间" },
  "files.actions": { en: "Actions", zh: "操作" },
  "files.create": { en: "Create", zh: "创建" },

  // Docker
  "docker.title": { en: "Docker", zh: "Docker" },
  "docker.subtitle": { en: "Manage containers, images, and Compose projects", zh: "管理容器、镜像和 Compose 项目" },
  "docker.containers": { en: "Containers", zh: "容器" },
  "docker.images": { en: "Images", zh: "镜像" },
  "docker.compose": { en: "Compose", zh: "Compose" },
  "docker.running": { en: "running", zh: "运行中" },
  "docker.total": { en: "total", zh: "总计" },
  "docker.noContainers": { en: "No containers found.", zh: "未找到容器" },
  "docker.noImages": { en: "No images found.", zh: "未找到镜像" },
  "docker.noCompose": { en: "No Docker Compose projects found.", zh: "未找到 Compose 项目" },
  "docker.pull": { en: "Pull", zh: "拉取" },
  "docker.pulling": { en: "Pulling...", zh: "拉取中..." },

  // Users
  "users.title": { en: "Users", zh: "用户" },
  "users.subtitle": { en: "Manage system users.", zh: "管理系统用户" },
  "users.addUser": { en: "Add User", zh: "添加用户" },
  "users.createUser": { en: "Create User", zh: "创建用户" },
  "users.creating": { en: "Creating...", zh: "创建中..." },
  "users.cancel": { en: "Cancel", zh: "取消" },
  "users.changePassword": { en: "Change Password", zh: "修改密码" },
  "users.loading": { en: "Loading...", zh: "加载中..." },
  "users.noUsers": { en: "No users found.", zh: "未找到用户" },
  "users.failed": { en: "Failed to load users.", zh: "加载用户失败" },

  // Shares
  "shares.title": { en: "Shares", zh: "共享目录" },
  "shares.subtitle": { en: "Manage network file shares (Samba).", zh: "管理网络文件共享（Samba）" },
  "shares.addShare": { en: "Add Share", zh: "添加共享" },
  "shares.newShare": { en: "New Share", zh: "新建共享" },
  "shares.editShare": { en: "Edit Share", zh: "编辑共享" },
  "shares.loading": { en: "Loading shares...", zh: "加载共享..." },
  "shares.noShares": { en: "No shares configured.", zh: "未配置共享" },

  // Logs
  "logs.title": { en: "Logs", zh: "日志" },
  "logs.subtitle": { en: "View system logs.", zh: "查看系统日志" },

  // Alerts
  "alerts.title": { en: "Alerts", zh: "告警" },
  "alerts.subtitle": { en: "System monitoring rules and alert history.", zh: "系统监控规则和告警历史" },
  "alerts.addRule": { en: "Add Rule", zh: "添加规则" },
  "alerts.rules": { en: "Alert Rules", zh: "告警规则" },
  "alerts.noRules": { en: "No alert rules configured. Add one to start monitoring.", zh: "未配置告警规则，添加一个开始监控" },
  "alerts.history": { en: "Alert History", zh: "告警历史" },
  "alerts.markRead": { en: "Mark Read", zh: "标记已读" },
  "alerts.clear": { en: "Clear", zh: "清空" },
  "alerts.noEvents": { en: "No alerts triggered yet.", zh: "暂无告警" },

  // Settings
  "settings.title": { en: "Settings", zh: "设置" },
  "settings.subtitle": { en: "Configure your NoWenOS system.", zh: "配置 NoWenOS 系统" },
  "settings.systemSettings": { en: "System Settings", zh: "系统设置" },
  "settings.general": { en: "General system configuration", zh: "通用系统配置" },
  "settings.hostname": { en: "Hostname", zh: "主机名" },
  "settings.httpPort": { en: "HTTP Port", zh: "HTTP 端口" },
  "settings.logLevel": { en: "Log Level", zh: "日志级别" },
  "settings.maxUpload": { en: "Max Upload (MB)", zh: "最大上传 (MB)" },
  "settings.autoUpdate": { en: "Enable automatic updates", zh: "启用自动更新" },
  "settings.save": { en: "Save Settings", zh: "保存设置" },
  "settings.saving": { en: "Saving...", zh: "保存中..." },
  "settings.loading": { en: "Loading settings...", zh: "加载设置..." },
  "settings.failed": { en: "Failed to load settings.", zh: "加载设置失败" },

  // Login
  "login.title": { en: "NoWenOS", zh: "NoWenOS" },
  "login.subtitle": { en: "Sign in to your NAS", zh: "登录 NAS 管理系统" },
  "login.username": { en: "Username", zh: "用户名" },
  "login.password": { en: "Password", zh: "密码" },
  "login.signIn": { en: "Sign In", zh: "登录" },
  "login.signingIn": { en: "Signing in...", zh: "登录中..." },
  "login.failed": { en: "Login failed", zh: "登录失败" },

  // Common
  "common.name": { en: "Name", zh: "名称" },
  "common.status": { en: "Status", zh: "状态" },
  "common.enabled": { en: "Enabled", zh: "已启用" },
  "common.disabled": { en: "Disabled", zh: "已禁用" },
  "common.delete": { en: "Delete", zh: "删除" },
  "common.edit": { en: "Edit", zh: "编辑" },
  "common.save": { en: "Save", zh: "保存" },
  "common.cancel": { en: "Cancel", zh: "取消" },
  "common.close": { en: "Close", zh: "关闭" },
  "common.confirm": { en: "Confirm", zh: "确认" },
  "common.search": { en: "Search", zh: "搜索" },
};

export function t(key: string, locale: Locale): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en ?? key;
}
