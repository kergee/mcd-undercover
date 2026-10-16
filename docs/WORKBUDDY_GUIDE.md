# WorkBuddy 接力开发与报名指南

当前进度（2026-10-16）：前三步已完成，真实MCP复测与防重复改进记录见根目录workbuddy.md。继续本项目时直接从第四步发布开始，不必重复开发步骤。当前代码在项目目录中，早先0.1.0压缩包不包含后续接力改动。

## 先确认奖励

官方规则要求进入排行榜、真实使用腾讯 WorkBuddy 并提交 `workbuddy.md`，前100名每人可获3000积分。这是额外 WorkBuddy 积分，不是 GitHub Star 加分，也不保证获奖资格。

- 活动规则：<https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md>
- 官方接入教程：<https://github.com/M-China/mcd-developer-innovation-challenge#workbuddy-开发指南>
- 报名截止：2026-10-25 23:59，北京时间。

## 第一步：打开已有项目

在 WorkBuddy 中选择“打开文件夹”或对应项目入口，选中本项目整个目录，确保它可以读取根目录 `SKILL.md`、`package.json`、`MCP_INTEGRATION.md`。界面名称如有变化，以当前客户端为准。

先复制这段话：

> 这是我已完成首版的“麦麦谁是卧底”参赛项目。请先读取 README.md、SKILL.md、MCP_INTEGRATION.md、docs/VALIDATION.md 和 workbuddy.md，确认当前状态；先运行 npm test 和 npm run check。首版是在其他工具中完成的，请如实标注，不要将之前的开发计为 WorkBuddy 开发。接下来我要在 WorkBuddy 中完成真实 MCP 复测和一项实际改进，请记录真实对话与结果。先不要发布或提交报名，也不要读取、打印或提交真实 Token。

## 第二步：在 WorkBuddy 配置麦当劳连接器

按官方教程进入“专家·技能·连接器”→“连接器”→“自定义连接器”→“配置 MCP”，配置：服务地址 `https://mcp.mcd.cn`，Streamable HTTP，Authorization Bearer 凭证。实际 Token 只填写在 WorkBuddy 的连接器凭据设置，不发到对话、不写入仓库。

根目录 `mcp-config.example.json` 仅使用 `${MCD_MCP_TOKEN}` 占位符。是否自动展开由客户端决定；不要把示例占位符直接当作可用凭证。启用连接器后，让它实际读取工具列表。

复制：

> 请用已启用的麦当劳官方 MCP 连接器真实复测本项目，先核对工具 schema。只允许 query-nearby-stores、query-meals、list-nutrition-foods，不读取订单、不领券、不下单。我选择使用上海人民广场作为示例位置。先查门店，让我选择一家，再查该门店菜单及营养。将脱敏工具响应保存在 runtime/，按项目脚本生成 menu-pack.json，并指导我在游戏里导入。记录真实调用的时间、工具名、餐品数、营养匹配数和限制；失败就记录失败，不用演示数据顶替。不要打印 Token 或请求认证头。

## 第三步：让 WorkBuddy 真正完成一项改进

建议做“连续开局避免最近3组词对重复”，这是对当前版本的实际增强。先让它确认数据量不足时的处理规则，然后实现并验证；无需大改游戏。

复制：

> 请在这个项目中实现“连续开局避免最近3组词对重复”：把 A/B 调换视为同一组；最近记录只在当前浏览器会话内保存；菜单或分类变化时不能排空候选；候选不足时按从最旧到最新逐步放宽历史限制，不死循环。保留已有私密看牌、投票与来源标识。请添加必要的行为测试，运行现有测试，并实际试玩至少一局。完成后把你本次真实执行的需求、修改、测试、MCP调用与限制写入 workbuddy.md；不要伪造之前的对话或浏览器验证。

这是一项后续增强，当前首版未声称已经实现。也可以选用户提出的其他实际改进，关键是确实开发并保留证据。

## 第四步：检查并公开 GitHub 仓库

由用户确认 GitHub 账号与仓库名称，再由 WorkBuddy 帮助创建或选择公开仓库。不要擅自公开其他文件、账号资料或凭证。

必要文件已经准备：

- README.md（介绍、安装、示例、目标用户）
- CONTEST_DECLARATION.md（官方原文，不能修改）
- MCP_INTEGRATION.md（真实工具与业务价值）
- mcp-config.example.json（只有环境变量占位符）
- 源码、SKILL.md、测试
- workbuddy.md（必须在实际开发后更新为真实记录）

发布前跑 `npm test` 和 `npm run check`。检查 Git 待提交清单：不能出现 `.env.local`、runtime、Token、认证头、账户或聊天导出中的隐私。确认 README 截图路径有效，别人 clone 后无需 Token 也能试玩，并能按说明接真实 MCP。

## 第五步：报名

等 GitHub 仓库公开可访问、WorkBuddy实际开发和文档更新都完成后，再使用活动指定 Issue 模板报名。以下是正文草稿，先替换项目地址：

```text
【参赛申请】
项目名称：麦麦谁是卧底 · 午休推理俱乐部
项目地址：https://github.com/你的账号/mcd-undercover
项目简介：把真实门店菜单变成3～8人的同机谁是卧底游戏：私密看牌、轮流描述、匿名投票、平票加投与战报分享。基于麦当劳官方MCP查询门店、当前菜单与营养数据，动态生成同类餐品词对，未知信息不编造；无需消费、不读取历史订单、不自动下单。提供可运行Skill、本地网页、真实调用证据与测试，并在WorkBuddy完成实际联调与功能改进，记录见workbuddy.md。
```

最后一句仅在 WorkBuddy 工作**确实完成之后**才能使用。项目地址使用纯 URL；项目名称、地址、简介各自与内容放在同一行。提交后查看主办方返回结果；报名成功与最终资格审核仍有区别。
