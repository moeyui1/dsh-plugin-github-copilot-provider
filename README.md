# dsh-plugin-provider-login

在 DeepSeek Harness 的 **设置 → 模型 → github-copilot** 卡片中登录 GitHub Copilot。登录后，dsh 的模型选择器会按账号目录更新，包含宿主静态目录发布后新增的兼容模型。插件使用 dsh 的凭证存储和 pi-ai 的 OAuth 流程。使用者需要具备 Copilot 访问权限的 GitHub 账号。

## 兼容性

已在 Windows、Node.js 24、`@deepseek-ai/dsh@0.2.2-rc.1` 和宿主自带的 pi-ai 1.5.2 上验证。插件依赖 web profile 的 provider 卡片插槽、授权服务、凭证服务和模型设置服务。新模型的协议注册依赖该版 pi-ai 的目录结构，升级宿主后请检查模型选择器。

## 从源码安装

先安装上述版本的 dsh，运行一次 `dsh web` 初始化 web profile。下载源码并解压，或克隆仓库。进入含有本项目 `package.json` 的目录，执行对应平台的命令。

**PowerShell**

```powershell
dsh plugin --profile web add (Get-Location).Path
```

**Bash / zsh**

```sh
dsh plugin --profile web add "$PWD"
```

本地安装可能会创建指向源码目录的链接，请保留该目录。若命令提示包已作为普通依赖安装，继续完成下面的插件注册。

打开 dsh **设置 → 打开配置文件**，或编辑 web profile 的 `cordis.patch.yml`（默认位于 `~/.dsh/profiles/web/`）。将仓库根目录 [cordis.patch.yml](./cordis.patch.yml) 的两个条目合并进去。

```yaml
- id: llm-pi-ai
  inject: [copilotCatalog]
- insert:
    - id: provider-login-catalog
      name: dsh-plugin-provider-login/catalog
    - id: provider-login
      name: dsh-plugin-provider-login
```

若已有同名 `llm-pi-ai` 条目，将 `copilotCatalog` 加进现有的 `inject` 列表，保留原条目的 `config`。每个插件 ID 只添加一次。保存后重启 `dsh web`，刷新浏览器。

## 登录与使用

1. 打开 **设置 → 模型**。已有 `github-copilot` 卡片时直接使用；首次使用时从“添加模型提供商”选择并保存 GitHub Copilot。
2. 点击 **登录 GitHub**。普通 github.com 账号在 Enterprise 域名处留空。打开卡片给出的 GitHub 页面，输入设备验证码并确认授权。
3. 绿点表示 dsh 已保存本地 OAuth 登录。模型同步时卡片显示旋转图标。等图标消失后，在原生模型选择器里选择模型。
4. 如果之前给此 provider 配置过 API Key，在 **管理** 中点击 **使用 OAuth 登录** 解除凭证来源覆盖。重新登录、取消授权流程、移除本地登录也可在卡片中完成。

pi-ai 会按需续换短期 token。使用 OAuth 时，pi-ai 采用 Copilot 账号返回的 API 地址。自定义兼容 endpoint 可使用单独的 provider 配置。

## 可用模型如何确定

插件在初始化和登录状态变化时同步。它读取 Copilot 的 `/models`，检查选择器标记、账号策略、工具调用能力和支持的请求协议。Individual 账号在所有选择器标记都关闭时，会采用策略明确启用的候选模型。插件识别 Responses、Chat Completions 和 Anthropic Messages，按模型注册协议与上下文限制。

在已登录的 OAuth 路由中，原生编辑器的“获取可用模型”和加载编辑器时的候选列表均按最近一次同步结果过滤。此功能对接 dsh 0.2.2-rc.1 的模型发现注册表，升级 dsh 后请同时验证该按钮与会话模型选择器。

成功同步后，插件会更新 web profile 的 `github-copilot.models`。仍在可用目录中的模型会保留手工设置，不在目录中的旧条目及其覆盖参数会从此列表中移除。需要长期保留的手工路由可配置为独立 provider。

请求失败时采用宿主内置模型，并在 OAuth 凭证含有账号模型缓存时取两者交集。缺少账号缓存时只能使用宿主默认列表。如果结果为空，当前版本的 dsh 会把空数组解释为启用全部内置模型，插件因此保留上一次配置，并在卡片上提示目录为空。

**出现 `400 model_not_supported` 时**，先确认会话使用的是 `github-copilot`，并重新选择当前列表里的模型。已保存会话可能仍引用旧 ID。GitHub 的目录和推理端可能在不同时间更新，目录只能提前排除已知不可用的模型。插件不会为探测权限逐个发起付费推理请求。

## 本地数据与卸载

- OAuth 凭证由 dsh 凭证服务保存。浏览器取得状态、授权链接和设备验证码，凭证内容留在宿主进程。
- 动态模型的描述文件保存在 `$DSH_HOME/plugins/provider-login/models/`，包含模型 ID、能力与协议数据，供下次启动恢复目录。
- 如需移除本地凭证，先在 **管理 → 退出登录** 中确认移除。要撤销 GitHub 一侧的授权，请在 GitHub 账号设置中操作。

卸载前，可在原生编辑器移除依赖动态目录的模型。然后从 web profile 删除上文的两个插件注册条目和 `copilotCatalog` 注入项，运行以下命令并重启 dsh。请保留同一配置文件中自己的其他设置。

```sh
dsh plugin --profile web remove dsh-plugin-provider-login
```

## 开发与验证

源码直接由 Node.js 与 dsh 的浏览器模块加载器执行，无需构建。使用 Node.js 24 执行 `npm test` 运行离线测试，使用 `npm pack --dry-run` 检查安装包内容。集成验证可在测试用 web profile 中完成登录，查看模型选择器，重启后验证模型仍可解析。提交问题时可附宿主版本、模型 ID 和错误码，请从日志中移除 token、设备验证码与带登录参数的 URL。

代码分为宿主 RPC 入口（`src/index.js`）、OAuth 交互（`controller.js`）、账号目录过滤（`availability.js`）、同步及协议注册（`sync.js` 和 `catalog.js`）以及卡片 UI（`client.js`）。

## 许可证

[MIT](./LICENSE)。本项目为社区插件。
