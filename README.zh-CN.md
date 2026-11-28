# DeepSeek Harness 的 GitHub Copilot 插件

[English](./README.md) · 简体中文

在 DeepSeek Harness 里登录 GitHub Copilot，直接选择自己账号可用的模型。

## 快速安装

安装好 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)后，运行：

```sh
dsh plugin --profile web add "git+https://github.com/moeyui1/dsh-plugin-github-copilot-provider.git#semver:*"
```

启动或重启 `dsh web`，刷新页面。已在 Windows 的 dsh `0.2.2-rc.1` 上验证。

## 在 dsh 中检查更新

在侧栏 **插件 → 实验性插件** 启用 **自定义插件索引**，然后在 **发现** 页添加下面的索引地址。刷新索引后，已安装旧版的用户会看到可用更新。

```text
https://raw.githubusercontent.com/moeyui1/dsh-plugin-github-copilot-provider/main/market-index.json
```

## 登录

1. 打开 **设置 → 模型**，找到 **github-copilot**。如果还没有这张卡片，点 **添加模型提供商**，选择并保存 GitHub Copilot。
2. 点 **登录 GitHub**。普通 github.com 账号可将企业域名留空。打开卡片给出的 GitHub 链接，输入设备验证码并确认授权。
3. 等同步图标消失，就可以在会话中选择 Copilot 模型。绿点表示本地已保存登录状态。

插件在启动或登录变更时更新模型列表。同步失败时使用默认目录；如果有账号缓存，会按缓存过滤。需要切换账号或退出本地登录时，打开卡片上的 **管理**。

## 卸载

```sh
dsh plugin --profile web remove dsh-plugin-github-copilot-provider
```

重启 `dsh web`。如果也想清除本地登录凭证，请在卸载前先从 provider 卡片退出登录。

[MIT 许可证](./LICENSE)
