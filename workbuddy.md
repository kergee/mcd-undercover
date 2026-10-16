# WorkBuddy 开发记录

## 归属说明

本地首版（v0.1.0，含游戏本体、本机只读 MCP 接入、18 项测试与浏览器验收）由用户与 Codex 在其他工具中协作完成，**不计为 WorkBuddy 开发**。

以下内容才是在腾讯 WorkBuddy 中真实执行的工作（2026-10-16，北京时间）。

## 一、基线确认（WorkBuddy 内执行）

- 读取 README.md、SKILL.md、MCP_INTEGRATION.md、docs/VALIDATION.md、workbuddy.md、docs/WORKBUDDY_GUIDE.md，确认首版状态。
- 实际运行 `npm test`：18/18 通过；`npm run check`：通过。

## 二、真实 MCP 连接器复测（约 08:34）

- 用户按官方教程在 WorkBuddy 自定义连接器中手动配置 `mcd-mcp`（streamableHttp，`https://mcp.mcd.cn`，Bearer 凭证由用户本人填写）。本记录不含凭证；助手仅核验了配置元信息（条目存在、类型、已启用、含认证头），未读取或输出凭证内容。
- 工具 schema 核对：连接器公布的 `query-nearby-stores`、`query-meals`、`list-nutrition-foods` 参数规则与 MCP_INTEGRATION.md 描述一致。未调用任何下单、领券、订单或账户工具。
- 真实调用（脱敏，traceId 已截短）：
  - `query-nearby-stores({searchType:2, beType:1, city:"上海", keyword:"人民广场"})` → 08:34:29 成功，返回 5 家门店，traceId `6ff71c91…`；按用户指示选定「麦当劳上海黄浦华旭国际大厦餐厅」（storeCode 1450713）。
  - `query-meals({storeCode:"1450713", orderType:1, beType:1})` → 08:34:45 成功（早餐时段菜单快照），traceId `6ed664cb…`。
  - `list-nutrition-foods({})` → 08:34:45 成功，TOON 格式 160 条，traceId `a52aa6ba…`。
- 工具响应按原样保存为 `runtime/raw-menu.json`、`runtime/raw-nutrition.json`（仅响应 JSON，无凭证与账户字段；该目录已被 Git 忽略）。
- 执行 `node scripts/import-menu.mjs --menu runtime/raw-menu.json --nutrition runtime/raw-nutrition.json --store "麦当劳上海黄浦华旭国际大厦餐厅" --out runtime/menu-pack.json` 成功：35 个餐品、14 个营养精确匹配，来源标注 `mcp-import`。与首版数量一致属同店同时段的巧合，未为对齐旧结果修改数据。
- 失败与修正（如实记录）：首次转录营养 TOON 时漏掉「冰浓浓黑巧大杯」一行中的一列，项目脚本的列数校验报错「营养 TOON 的列数不匹配」将其拦下；对照原始响应补齐后通过。后续约定：原始工具响应直接保存为文件，避免手工转录。

## 三、功能改进：连续开局避免最近 3 组词对重复

需求（用户确认）：A/B 调换视为同一组；仅记录最近 3 次成功开局的词对，保存在当前页面会话内存（刷新清空；设置、预览与开局失败不计入）；优先抽取不在历史中的候选；全部被排除时从最旧记录起逐条放宽，重复历史记录不得提前解除限制；1～2 组候选也须正常开局；原本无候选时明确提示，不死循环、不换用演示数据；保留私密看牌、投票、胜负规则与来源标识。

改动文件：

- `dist/core.mjs`：新增 `pairKey(pair)`（两个餐品稳定编码排序拼接，顺序无关）与 `pickPair(pairs, recent, random)`（先排除全部历史；候选为空时按记录从最旧到最新逐条放宽——用数组切片保留重复记录，同一词对的两条记录都放宽后才解除限制；候选为空返回 `null` 由调用方提示）。
- `dist/app.mjs`：`state.recentPairs`（纯内存，随刷新清空）；`startGame` 改用 `pickPair`，仅在 `createGame` 成功后将本局 `pairKey` 记入并保留最近 3 条；「再开一局」同样走该逻辑。
- `tests/core.test.mjs`：新增 7 项行为测试（顺序无关标识、正常避重、历史滚动、候选不足放宽、重复历史记录不提前解除、切换分类/菜单、空候选返回 null）。

验证结果（全部在 WorkBuddy 会话中实际执行）：

- `npm test`：25/25 通过（18 项原有 + 7 项新增）；`npm run check`：通过。
- 浏览器实测（Playwright 控制真实浏览器，本机服务 http://127.0.0.1:4317）：
  - 用确定性随机源（覆写 `crypto.getRandomValues`）在「小食」分类（3 组候选）连续打完整 4 局，结果页词对依次为：薯条/麦乐鸡 → 薯条/玉米杯 → 薯条/苹果片 → 薯条/麦乐鸡。前三局无重复、第四局触发最旧记录放宽，与抽取策略一致；若无此功能，确定性随机会每局重复同一词对。
  - 经「菜单补给站」导入本次真实 `runtime/menu-pack.json`，来源标识正确显示「导入菜单」；切到「甜品」分类（仅 1 个餐品、无候选）开局，提示「这个分类暂时没有足够词对，请切换“混合上桌”或更换菜单」，无死循环、未改用演示数据；再切「饮品」分类可正常开局进入私密看牌。
  - 页面脚本错误收集为空（0 errors / 0 warnings）。

## 四、本次未做与限制

- 未发布 GitHub、未提交报名，待用户另行指示。
- 浏览器避重验证使用了确定性随机源以保证可复现；真实随机下的行为由 7 项单元测试覆盖（含 20 次随机抽样断言）。
- 未在实体手机上验证本次改动。
- 真实菜单为 2026-10-16 08:34 早餐时段快照，之后供给可能变化。

## 五、参赛提示（保留自首版）

专项奖励要求真实使用 WorkBuddy，且受活动排名和最终审核条件限制；仅有此文件不代表符合条件。发布与报名步骤见 `docs/WORKBUDDY_GUIDE.md`，须由用户确认后执行。凭证、账户隐私和会话头不得进入仓库。
