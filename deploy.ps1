# ============================================================
#  股票交易工作站 · GitHub Pages 一键部署脚本
#  用法：右键 → 使用 PowerShell 运行，或在 PowerShell 里执行 .\deploy.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$RepoName = "stock-trading-workstation"
$Branch = "main"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  股票交易工作站 · GitHub Pages 部署" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1. 检查 Git ----
try {
    git --version | Out-Null
} catch {
    Write-Host "[错误] 未检测到 Git，请先安装：https://git-scm.com/download/win" -ForegroundColor Red
    Write-Host "安装时全部默认下一步即可，装完重启 PowerShell 再跑这个脚本。" -ForegroundColor Yellow
    Read-Host "按回车退出"
    exit 1
}
Write-Host "[1/5] Git 已安装  ✓" -ForegroundColor Green

# ---- 2. 检查仓库是否已初始化 ----
if (-not (Test-Path ".git")) {
    Write-Host "[2/5] 初始化 Git 仓库..." -ForegroundColor Yellow
    git init
    git branch -M $Branch
    git add .
    git commit -m "init: 股票交易工作站"
    Write-Host "      本地仓库初始化完成  ✓" -ForegroundColor Green
} else {
    Write-Host "[2/5] 本地仓库已存在  ✓" -ForegroundColor Green
    git add .
    git commit -m "update: $(Get-Date -Format 'yyyy-MM-dd HH:mm') 更新" 2>&1 | Out-Null
}

# ---- 3. 检查远程仓库 ----
$remotes = git remote -v
if ($remotes -match "origin") {
    Write-Host "[3/5] 远程仓库 origin 已配置  ✓" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[3/5] 请输入你的 GitHub 仓库地址" -ForegroundColor Yellow
    Write-Host "  格式示例：https://github.com/你的用户名/stock-trading-workstation.git"
    Write-Host "  （如果还没建仓库，先去 https://github.com/new 建一个，仓库名填 $RepoName，选 Public）"
    Write-Host ""
    $repoUrl = Read-Host "GitHub 仓库地址"
    if (-not $repoUrl) {
        Write-Host "未输入地址，退出。" -ForegroundColor Red
        exit 1
    }
    git remote add origin $repoUrl
    Write-Host "      远程仓库已添加  ✓" -ForegroundColor Green
}

# ---- 4. 推送 ----
Write-Host "[4/5] 推送到 GitHub..." -ForegroundColor Yellow
$pushResult = git push -u origin $Branch 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[错误] 推送失败，可能原因：" -ForegroundColor Red
    Write-Host "  1. 仓库地址不对"
    Write-Host "  2. GitHub 还没登录（第一次用会弹浏览器授权）"
    Write-Host "  3. 网络问题"
    Write-Host ""
    Write-Host "错误信息：" -ForegroundColor Red
    Write-Host $pushResult
    Read-Host "按回车退出"
    exit 1
}
Write-Host "      推送成功  ✓" -ForegroundColor Green

# ---- 5. 提示开启 Pages ----
$remoteUrl = git remote get-url origin
$pagesUrl = ""
if ($remoteUrl -match "github\.com[:/](.+?)/(.+?)(\.git)?$") {
    $user = $Matches[1]
    $repo = $Matches[2] -replace '\.git$', ''
    $pagesUrl = "https://$user.github.io/$repo/stock-trading-workstation.html"
}

Write-Host ""
Write-Host "[5/5] 部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "下一步：开启 GitHub Pages" -ForegroundColor Cyan
Write-Host "  1. 打开仓库：$remoteUrl"
Write-Host "  2. 点 Settings → Pages"
Write-Host "  3. Source 选 Deploy from a branch"
Write-Host "  4. Branch 选 main / root，点 Save"
Write-Host "  5. 等 1-2 分钟，访问下面的地址就能用了"
Write-Host ""
if ($pagesUrl) {
    Write-Host "  你的工作台地址：" -ForegroundColor Yellow
    Write-Host "  $pagesUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "  手机浏览器打开这个地址就能看，收藏到桌面更方便。" -ForegroundColor Green
}
Write-Host ""
Write-Host "以后更新：改完代码再跑一次 .\deploy.ps1 就行。" -ForegroundColor Gray
Write-Host ""
Read-Host "按回车退出"
