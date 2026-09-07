# WELLBIORA 生产数据库每日备份脚本（Windows 任务计划程序调用）
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File D:\www\wellbiora\repo\server\scripts\backup.ps1
# 说明：
#   - 密码不写在脚本和命令行参数里，走 --defaults-extra-file（见同目录 backup-my.example.cnf）
#   - 备份产物：D:\www\wellbiora\backups\backup-yyyyMMdd-HHmmss.zip（含 .sql）
#   - 运行日志：D:\www\wellbiora\backups\backup.log（每次追加一行）
param(
  [string]$DefaultsFile = "D:\www\wellbiora\secure\my-backup.cnf",
  [string]$BackupDir    = "D:\www\wellbiora\backups",
  [int]$KeepDays        = 30
)

$ErrorActionPreference = 'Stop'
$mysqldump = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$sqlFile   = Join-Path $BackupDir "backup-$timestamp.sql"
$zipFile   = Join-Path $BackupDir "backup-$timestamp.zip"
$logFile   = Join-Path $BackupDir "backup.log"

function Write-Log([string]$msg) {
  Add-Content -Path $logFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" -Encoding utf8
}

try {
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  if (-not (Test-Path $mysqldump))    { throw "mysqldump 不存在：$mysqldump" }
  if (-not (Test-Path $DefaultsFile)) { throw "认证文件不存在：$DefaultsFile（参照 backup-my.example.cnf 创建）" }

  # 导出（--single-transaction 不锁表；--routines 含存储过程/函数）
  & $mysqldump --defaults-extra-file="$DefaultsFile" --single-transaction --routines wellbiora_shop > $sqlFile
  if ($LASTEXITCODE -ne 0) { throw "mysqldump 退出码 $LASTEXITCODE" }
  if ((Get-Item $sqlFile).Length -lt 1KB) { throw "导出文件异常小，疑似失败：$sqlFile" }

  # 压缩后删除原始 sql
  Compress-Archive -Path $sqlFile -DestinationPath $zipFile
  Remove-Item $sqlFile

  # 清理超龄备份
  $cutoff = (Get-Date).AddDays(-$KeepDays)
  Get-ChildItem $BackupDir -Filter "backup-*.zip" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object { Remove-Item $_.FullName; Write-Log "已清理超龄备份 $($_.Name)" }

  Write-Log "备份成功 $((Get-Item $zipFile).Name) $([math]::Round((Get-Item $zipFile).Length / 1KB, 1))KB"
} catch {
  Write-Log "备份失败：$($_.Exception.Message)"
  exit 1
}
