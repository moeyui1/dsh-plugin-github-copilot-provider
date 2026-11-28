# GitHub Copilot for DeepSeek Harness

English · [简体中文](./README.zh-CN.md)

Sign in to GitHub Copilot from DeepSeek Harness and choose a model available to your account.

## Quick install

With [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) installed, run:

```sh
dsh plugin --profile web add "git+https://github.com/moeyui1/dsh-plugin-github-copilot-provider.git#semver:*"
```

Start or restart `dsh web`, then refresh the page. Tested with dsh `0.2.2-rc.1` on Windows.

## Check for updates in dsh

In **Plugins → Experimental plugins**, enable **Custom plugin indexes**. Open **Discover** and add the index URL below. Refresh the index to see whether a newer release is available. In dsh 0.2.2-rc.1, Discover shows update status. To upgrade a Git installation, use the commands in the next section.

```text
https://raw.githubusercontent.com/moeyui1/dsh-plugin-github-copilot-provider/main/market-index.json
```

## Automatically update on startup

The install command above tracks stable release tags. If you previously installed from the default branch or pinned a tag such as `#v0.2.4`, run the install command once to switch.

To check for updates each time you launch dsh, put these two lines in your usual startup script or service launcher. The first updates this plugin in the web profile. The second starts dsh and loads the installed version.

```sh
dsh plugin --profile web update dsh-plugin-github-copilot-provider
dsh web
```

Starting with `dsh web` alone uses the installed version. If you prefer to update manually, run the first line when convenient and restart dsh.

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
