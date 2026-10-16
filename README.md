# 麦麦谁是卧底 🍔

**把今天的菜单，变成朋友之间的推理局。**

3～8 人，一部手机。大家拿到相似的餐品词，轮流描述、投票，找出拿了不同菜单的那位朋友。适合同事午休、朋友聚会和线下社团活动，无需购买餐品。

**[立即试玩 →](https://mcd-undercover.app.workbuddy.host/)**

> 在线版提供示例词库，也支持导入真实菜单包。真实菜单通过本机服务或麦当劳 MCP 客户端查询；在线页面不直接连接个人账户。

![游戏界面](https://raw.githubusercontent.com/kergee/mcd-undercover/main/docs/preview-desktop.png)

## 怎么玩

1. **秘密上桌**：设置昵称、人数和难度，把手机传给每个人，私密查看自己的餐品词。
2. **一句线索**：依次描述餐品，不能直接说出完整名称；可以记下本局金句。
3. **找出演技派**：逐人私密投票，只展示合计票数。最高票出局；平票加投一次，再平票则进入下一轮。
4. **揭晓与分享**：卧底阵营全部出局，队员获胜；卧底阵营人数达到或超过队员，则卧底阵营获胜。结束后可下载 PNG 战报。

支持两档难度、发言计时，以及 5 人起可选的白板模式。白板没有餐品词，与卧底同阵营。连续开局时，优先避开最近 3 组词对；候选不足会逐步放宽。

## 真实菜单如何变成游戏

通过麦当劳官方 MCP 查询门店和当前菜单，筛选可识别单品，生成同类餐品词对。名称相似度参与难度排序；两款餐品都精确匹配到官方热量数据时，热量接近程度也参与排序。

- 使用 `query-nearby-stores`、`query-meals`、`list-nutrition-foods` 三个只读工具。
- 结果页标注菜单来源与获取时间，展示已匹配的营养信息；缺失数据保留未知。
- 仅查询，不下单、不领券，也不读取历史订单。

集成流程与真实调用说明见 [MCP_INTEGRATION.md](https://github.com/kergee/mcd-undercover/blob/main/MCP_INTEGRATION.md)。

## 本机运行

需要 **Node.js 20.11+**，无第三方运行依赖，无需执行 `npm install`。

```powershell
git clone https://github.com/kergee/mcd-undercover.git
cd mcd-undercover
npm start
```

打开终端显示的本机地址，默认是 `http://127.0.0.1:4317`。Windows 也可双击 `启动游戏.cmd`。

连接真实菜单时，Windows 用户双击 `启动真实菜单.cmd`，在本机终端隐藏输入 Token，再从网页“菜单补给站”选择门店。已有菜单包 JSON 则直接导入。凭证不写入源码，也不传给游戏网页。

## 开发与文档

```powershell
npm test
npm run check
```

- [Skill 使用说明](https://github.com/kergee/mcd-undercover/blob/main/SKILL.md)
- [验证记录](https://github.com/kergee/mcd-undercover/blob/main/docs/VALIDATION.md)
- [开发记录](https://github.com/kergee/mcd-undercover/blob/main/workbuddy.md)
- [参赛声明](https://github.com/kergee/mcd-undercover/blob/main/CONTEST_DECLARATION.md)

当前为面对面同机游戏，暂不支持远程开房。对局只保存在当前页面内存中，刷新会清空；菜单为获取时快照，不保证之后仍在售。

代码采用 [MIT 许可](https://github.com/kergee/mcd-undercover/blob/main/LICENSE)。本项目为独立趣味作品，非麦当劳官方产品；品牌与接口数据的权利归各自权利人。
