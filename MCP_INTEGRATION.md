# MCP 集成与真实验证

## 服务与调用边界

- 官方服务：`https://mcp.mcd.cn`，Streamable HTTP，Bearer Token。
- 官方工具说明：<https://github.com/M-China/mcd-mcp-server>。
- 详细字段说明：<https://open.mcd.cn/mcp/doc>，查阅日期 2026-10-16。
- 只允许 `query-nearby-stores`、`query-meals`、`list-nutrition-foods` 三个只读工具。客户端白名单在网络请求之前校验，任何下单、领券、抽奖等调用都会被拒绝。

## 实际链路

1. `initialize` 协商协议 → `notifications/initialized` → `tools/list`（支持游标分页）。仅使用当前服务真实公布的工具，并检查必填参数。
2. 城市地点搜索：`query-nearby-stores({searchType:2, beType:1, city, keyword})`。`beType:1` 仅表示为游戏查询到店菜单，并不创建就餐或消费记录。
3. 用户选择门店：`query-meals({storeCode, beCode?, orderType:1, beType:1})`。
4. `list-nutrition-foods({})` 获取营养。支持官方 TOON 表格，按餐品名精确匹配。营养失败时仍可使用真实菜单，明确提示并省略未知数值。
5. 从 `data.meals` 字典归一化出餐品编码与名称；按名称归纳游戏分类，排除套餐、权益卡、周边和不识别项。每组词对必须来自同一游戏分类。
6. 输出来源、门店名、获取时间与脱敏词库；本机运行摘要保存到被忽略的 `runtime/mcp-evidence.json`。浏览器直接调用本机接口时标注 `mcp-live`；文件导入时一律降为 `mcp-import`。

客户端同时处理 JSON 和 SSE 响应、会话头、30 秒超时和响应大小限制。除了协议 `isError`，还校验业务 `success` 和错误码。HTTP 成功不会自动认定为业务成功。

## 业务价值

门店与时段改变了可参与游戏的词库，而不是只为游戏附加一次领券操作。词对来自本次官方菜单；两项都匹配到营养时，热量接近程度参与难度排序。整局结束展示词对、来源和已知事实，避免自造餐品、价格、配料或营养结论。用户无需提交订单历史，也无需购买餐品。

## 凭证与数据

Token 只由本机 Node 进程持有，不送到浏览器，不进入源码或战报。启动脚本使用隐藏输入，环境变量仅对当前进程有效。可选 `.env.local` 仅供用户自行配置，已经加入 `.gitignore`；本次交付没有创建含真实 Token 的配置文件。

归一化菜单只保留餐品 ID、名称、项目分类、已匹配营养与来源。不会保留会员、电话、地址簿、券包、订单或付款信息。店铺搜索展示的地址是餐厅的公开地址。

## 验证事实

本次已真实执行三种只读工具，生成上海示例门店菜单包。可公开的调用摘要和菜单快照见 `examples/`，具体数量与测试结果见 `docs/VALIDATION.md`。没有执行任何写入账户或消费的工具。

2026-10-16 已在用户的 WorkBuddy 中完成官方连接器复测及词对防重复改进，具体调用时间、结果、转录错误修正和浏览器验证见根目录 workbuddy.md。本机首版结果与 WorkBuddy 接力记录分别保留，不互相冒充。
