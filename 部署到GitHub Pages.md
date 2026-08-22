# 股票交易工作站 · GitHub Pages 部署指南

部署后手机、电脑浏览器都能访问，不用一直开自己的电脑。

---

## 准备工作（只做一次）

### 1. 注册 GitHub 账号
去 https://github.com/signup 注册，免费的。用户名随便起，后面你的访问地址里会带这个名字。

### 2. 安装 Git
去 https://git-scm.com/download/win 下载安装包，安装时**全部点下一步**就行，不用改任何选项。
装完重启一下 PowerShell 或电脑。

### 3. 新建 GitHub 仓库
1. 打开 https://github.com/new
2. Repository name 填：`stock-trading-workstation`
3. 选 **Public**（公开仓库才能免费开 Pages）
4. 不要勾 "Add a README file"
5. 点 **Create repository**
6. 建好后把页面上的仓库地址复制下来，格式像这样：
   `https://github.com/你的用户名/stock-trading-workstation.git`

---

## 一键部署

1. 打开 `stock-trading-workstation` 文件夹
2. 在文件夹空白处 **按住 Shift + 右键** → 选「在此处打开 PowerShell 窗口」
3. 输入下面的命令并回车：
   ```
   .\deploy.ps1
   ```
4. 第一次跑会问你 GitHub 仓库地址，把刚才复制的地址粘贴进去回车
5. 等它推完，会提示你下一步

> 如果提示「无法加载文件，因为在此系统上禁止运行脚本」，先执行这一句：
> ```
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> 输入 Y 确认，然后再跑 `.\deploy.ps1`。

---

## 开启 GitHub Pages

1. 打开你的 GitHub 仓库页面
2. 点顶部的 **Settings**（设置）
3. 左边菜单找到 **Pages**
4. **Build and deployment** 下面：
   - Source 选 `Deploy from a branch`
   - Branch 选 `main` / `root`（就是根目录）
   - 点 **Save**
5. 等 1-2 分钟，页面顶部会出现绿色的 `Your site is live at https://...`

---

## 访问地址

部署好之后，你的工作台地址是：

```
https://你的用户名.github.io/stock-trading-workstation/stock-trading-workstation.html
```

**手机上怎么用：**
1. 手机浏览器打开上面的地址
2. 点浏览器菜单 → 添加到主屏幕 / 收藏
3. 以后点桌面图标直接进，跟 APP 差不多

**电脑上怎么用：**
- 直接打开网址，跟本地打开效果一模一样，数据都是实时从接口拉的

---

## 以后更新代码

改了代码之后（比如加了自选股、改了参数），重新部署一次就行：

```
.\deploy.ps1
```

脚本会自动提交并推送，GitHub Pages 大概 1 分钟后自动更新。

---

## 常见问题

**Q：部署上去之后，行情数据还能用吗？**
A：完全可以。行情接口（腾讯、东方财富）都是公开的、支持浏览器直接访问，不管你是本地打开还是 Pages 上打开，效果一样。

**Q：别人能看到我的持仓数据吗？**
A：能。因为仓库是公开的，持仓数字写在代码里，别人看源码就能看到。如果介意，可以：
  - 把仓库改成 Private，但 Pages 需要 GitHub Pro 才能用私有仓库（付费）
  - 或者持仓用大概数字，不要精确到分

**Q：手机上刷新快不快？**
A：和电脑上一样，A 股每秒刷新。手机浏览器后台可能会休眠，切回来会自动补一次刷新。

**Q：iOS Safari 打开有问题吗？**
A：Safari 14 以上都没问题。如果行情加载不出来，检查一下是不是开了「阻止跨网站跟踪」（设置 → Safari → 隐私与安全性里关掉就行）。

**Q：可以自定义域名吗？**
A：可以。Pages 设置里有 Custom domain 选项，买个域名填上再配 DNS 解析就行。
