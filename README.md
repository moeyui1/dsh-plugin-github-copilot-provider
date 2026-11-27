# GitHub Copilot for DeepSeek Harness

English · [简体中文](./README.zh-CN.md)

Sign in to GitHub Copilot from DeepSeek Harness and choose a model available to your account.

## Quick install

With [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) installed and Git configured to read this private repository, run:

```sh
dsh plugin --profile web add git+https://github.com/moeyui1/dsh-plugin-github-copilot-provider.git
```

Start or restart `dsh web`, then refresh the page. Tested with dsh `0.2.2-rc.1` on Windows.

## Sign in

1. Open **Settings → Models** and select **github-copilot**. If it is missing, add and save it under **Add model provider**.
2. Click **Sign in to GitHub**. For a personal github.com account, leave the enterprise domain blank. Open the GitHub link, enter the device code, and approve the request.
3. When the spinner disappears, choose a Copilot model in your conversation. A green dot indicates that your sign-in is saved.

The model list updates when the plugin starts or your sign-in changes. If the account list is unavailable, the plugin falls back to the default catalog, filtered by cached account access when available. Open **Manage** on the provider card to switch accounts or sign out locally.

## Uninstall

```sh
dsh plugin --profile web remove dsh-plugin-github-copilot-provider
```

Restart `dsh web`. To remove your saved sign-in too, sign out from the provider card before uninstalling.

[MIT License](./LICENSE)
