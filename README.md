# 先做一步试试

一个很小的行动拆解原型：用户输入复杂目标后，应用会把它拆成几步更容易开始的动作。每完成一步点击一次，界面会推进到下一步，并记录完成状态。

## 使用方式

直接打开 `index.html` 即可体验。默认使用本地演示拆解。

如需连接 DeepSeek：

1. 点击左上角设置。
2. 填入自己的 DeepSeek API Key。
3. 选择 `deepseek-chat` 或 `deepseek-reasoner`。
4. 再输入目标并生成步骤。

当前版本是纯静态页面，API Key 只保存在使用者自己的浏览器本地，并由使用者的浏览器直接请求 DeepSeek。

## GitHub Pages 发布

这个项目不需要后端，适合直接发布到 GitHub Pages。

1. 将这些文件推送到 GitHub 仓库。
2. 打开仓库 `Settings -> Pages`。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main` 或 `master`，目录选择 `/root`。
5. 保存后等待 GitHub Pages 生成分享链接。

## 内测提醒

建议朋友使用单独创建的低额度测试 Key。Key 不会发送给项目作者，但纯前端页面无法抵御使用者设备、浏览器扩展或页面被篡改等环境风险。
