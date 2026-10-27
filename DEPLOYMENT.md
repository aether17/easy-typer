# VPS 静态部署

本分支在本地构建；VPS 只运行 Nginx，提供 `docs/` 中的 HTML、JS、CSS、练习文本。
VPS 不需要 Node、Yarn、开发服务器或数据库。跟打设置、成绩和进度仍保存在浏览器本地。

## 本地构建与验证

使用 Yarn Classic 1.22.22（仓库保留 `yarn.lock`），Node 22/24：

```bash
yarn install --frozen-lockfile --ignore-engines --ignore-scripts
yarn build
yarn test:unit --runInBand
# 首次没有测试浏览器时安装；仅发生在本地。
yarn playwright install chromium
yarn test:browser
```

旧版 Vue CLI 的部分依赖只声明支持到 Node 17，因此安装时需要 `--ignore-engines`。
网页构建不需要 Electron 二进制，使用 `--ignore-scripts` 跳过其下载。
原生 `node-sass` 已替换为 Dart Sass；构建脚本在 Node 17+ 上为 Webpack 4 单独启用 OpenSSL 兼容选项。

`yarn build` 自动把仓库 `scripts/kata/` 中的 129 份练习文本转换为静态文件。
`.env` 默认开启自建模式：选文、前500字快捷入口、随机文章、每日一文均使用本站素材。
每日一文按日期从内置文章中选取；实时新闻、历史上的今天等依赖原作者后端的入口在自建模式中隐藏。
自定义文本和 TXT 阅读跟打保持可用。构建不加载第三方统计脚本或外部字体。

成绩默认不自动复制；旧设置首次加载时也会关闭自动复制，之后手动更改开关会保留。
移动端显示最近三次的编号、速度、击键、码长、准确率；键盘上方空间较小时只露出一条，其余可在表内滑动查看。
跟打时原文字号为 28–34px（常见手机约 30px），成绩区域参与布局，不悬浮遮挡原文。

## 发布到 txsh

完成上述构建和验证后，在仓库根目录运行：

```bash
bash scripts/deploy-vps.sh txsh /home/aether/deploy/typer
```

脚本通过 SSH/SCP 上传静态产物，校验 SHA-256，将站点放入独立的 release 目录，再切换 `site/current`。
历史 release 保留以便回滚。VPS 上的文件结构：

```text
/home/aether/deploy/typer/
  compose.yaml
  nginx.conf
  current-release.txt
  current-artifact.sha256
  site/
    current -> releases/<release>
    releases/<release>/
```

只发布 `127.0.0.1:18089`，不占用 VPS 的 80/443 端口。
本机检查到 Nginx Proxy Manager 使用 Docker `host` 网络，因此可以直接访问这个回环地址。

## Nginx Proxy Manager 配置

创建 Proxy Host：

| 字段 | 值 |
| --- | --- |
| Domain Names | `typer.mashiro.cafe` |
| Scheme | `http` |
| Forward Hostname / IP | `127.0.0.1` |
| Forward Port | `18089` |
| Cache Assets | 关闭 |
| Websockets Support | 不需要 |

域名 DNS 指向 VPS；在 SSL 页申请或选择该域名证书，启用 Force SSL。
Advanced 无需添加配置。HTTPS 可使浏览器剪贴板和离线缓存功能正常使用。

如果以后把 NPM 改为 bridge 网络，容器里的 `127.0.0.1` 将不再指向宿主机；
届时应将两个容器接入同一 Docker 网络，改为代理服务名 `typer` 的端口 `80`。

## 检查与更新

```bash
ssh txsh 'cd /home/aether/deploy/typer && docker compose ps'
ssh txsh 'curl -fI http://127.0.0.1:18089/'
ssh txsh 'curl -fI http://127.0.0.1:18089/kata'
ssh txsh 'curl -f http://127.0.0.1:18089/practice-texts/44.json'
```

以后修改源码，再本地构建、验证、运行发布脚本即可。
若浏览器提示已下载新版本，需要关闭这个站点的所有标签页，再重新打开，以更新原项目的 service worker 缓存。

## 回滚

在 VPS 上将 `<上一个release>` 替换成 `site/releases/` 中实际存在的目录名：

```bash
cd /home/aether/deploy/typer
ln -s releases/<上一个release> site/current.rollback
mv -Tf site/current.rollback site/current
curl -fI http://127.0.0.1:18089/
```

发布与回滚不迁移浏览器数据；换域名或浏览器会使用不同的本地数据。
浏览器回归测试模拟可视区域缩小及平移，不等于安卓真机软键盘验收。
