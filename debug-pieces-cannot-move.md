# Debug: pieces-cannot-move

**Status**: [OPEN]
**Date**: 2026-06-25
**Symptom**: 用户报告"棋子无法移动"（pieces cannot be moved）

## Hypotheses (3-5 falsifiable)

1. **H1**: `onPointerDown` 早期 return 路径错误 —— 第二次点击目标格时，`code === 0 || sideOf !== turn` 为 true 直接 return，但 `drag` 仍是上次的（来自第一次选子），导致 `onPointerUp` 仍用旧 `from` 配合新 `target` 去校验 legalMoves 时失败（虽然这种情况一般也能工作，但可疑）。
2. **H2**: `XQGame.select` 的「点击合法目标」分支未执行 —— `onPointerDown` 在第二次点击时先调用了 `XQGame.select`？或者 `legalMoves.some` 的引用因 `setLegalMoves` 后未生效而不匹配。
3. **H3**: 脚本加载顺序问题 —— `index.html` 中用 `defer`，但 `main.js` 通过 `DOMContentLoaded` 触发初始化，若 defer 顺序与全局依赖不一致，可能出现 `XQGame/XQBoard/XQRules` 之一未定义。
4. **H4**: 渲染层 / 状态层 BoardState 引用分离 —— `XQRules.applyMove` 返回新数组，但 `XQBoard.setBoard` 设置的是引用；若某条路径漏调 setBoard，渲染层看到的还是旧 BoardState。
5. **H5**: 事件绑定在 SVG 上，但 `renderPieces` 调用 `removeChild` + `appendChild` 重建 `data-layer="pieces"` 和 `data-layer="marks"`，可能丢失或破坏事件冒泡（虽然事件是绑在 SVG 上的，应该不影响）。

## Instrumentation Plan

- 在 `onPointerDown` / `onPointerUp` / `XQGame.select` / `XQGame.makeMove` 入口与关键分支上报 NDJSON 日志。
- 通过 Debug Server 在 `:8123` 接收，自动化浏览器（curl）拉取页面触发点击模拟不可行；改用 Playwright/无头浏览器不可得 → 改用「在 page 中插入诊断代码 + 手动触发合成事件」的方式收集。
- 由于环境内无浏览器自动化工具，采用「静态 + 路径追溯 + 单元化检查」的强化版：直接对 `XQRules.generatePieceMoves` 在初始盘面跑一次，确认 legalMoves 不为空。

## Plan
1. 静态追踪「点击 → move」全链路
2. 注入轻量 instrumentation（不破坏业务）
3. 复现 + 抓日志
4. 修复
5. 验证
