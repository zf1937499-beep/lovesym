# 恋爱银行 / 券系统

两个人在一个小圈子里的「内部货币」：打卡、写日记、传照片赚积分，积分用来给对方发券，
对方花掉券换一次行动（夸奖、道歉、跑腿、请客）。

## 1. 数据模型

| 表 | 作用 | 关键字段 |
|---|---|---|
| `love_accounts` | 账户与余额 | `couple_id` `user_id` `balance` `total_earned` `total_spent` |
| `coupons` | 券本身 | `issuer_id`（扣分方）`owner_id`（使用方）`type` `price` `status` `used_at` `use_note` |
| `coupon_transactions` | 只增流水 | `kind`（earn/issue/use/adjust）`amount` `event` `ref_key` |

三条约束撑住了业务：

1. `balance >= 0` —— 花不出去就发不了券；
2. `coupon_not_self` —— 不能给自己发券；
3. `coupon_tx_ref_uniq (account_id, ref_key)` —— 同一件事只发一次积分（幂等）。

## 2. 积分规则

| event | 触发 | 积分 | 每日上限 | 幂等键 |
|---|---|---|---|---|
| `checkin_day` | 当天勾选任意一个打卡任务 | +2 | 一次 | `checkin_day:日期` |
| `checkin_all` | 当天任务全部完成 | +5 | 一次 | `checkin_all:日期` |
| `diary` | 新建一篇日记（编辑不算） | +5 | 15 | `diary:日记id` |
| `photo` | 上传照片 | +1/张 | 10 | 无（靠上限） |
| `wish_done` | 愿望标记完成 | +3 | 6 | `wish:愿望id` |

规则集中在一处，加规则只需往 `POINTS`（前端 `assets/app.js`）里加一行，
或往 `award_points` 的 `values` 里加一行（后端）。

## 3. 券类型

| type | 名称 | 默认价 | 说明 |
|---|---|---|---|
| `praise` | 夸夸券 | 10 | 兑换一句超长的彩虹屁 |
| `sorry` | 道歉券 | 15 | 一次无条件道歉，不许记账 |
| `wish` | 愿望券 | 30 | 提一个愿望，对方尽量满足 |
| `chore` | 家务券 | 20 | 一次家务代劳 |
| `treat` | 请客券 | 25 | 一餐请客，随便点 |
| `custom` | 自定义 | 自定 | 自己起名、自己定价 |

## 4. 资金流向

```
打卡/日记/照片 ──+积分──▶ 我的账户
                             │
                        发行券 -price
                             ▼
                     对方券包（active）
                             │
                         使用券（0 积分）
                             ▼
                        status=used，记录 used_at + use_note
```

发行扣的是**发行人**的分，使用**不扣分**——这样积分有出口，又不会让收券人觉得被收费。

## 5. 验收用例

前置：瀚瀚登录（`who = 'me'`），余额 30，今天没有任何打卡。

| # | 场景 | 操作 | 预期 |
|---|---|---|---|
| A1 | 打卡首次加分 | 勾选「一起吃饭」 | 余额 30→32，流水出现 `每日打卡 +2`，提示「打卡成功 +2 积分」 |
| A2 | 同日不重复加分 | 再取消、再勾选一次 | 余额仍为 32，无新流水（`ref_key` 命中） |
| A3 | 全部完成额外奖励 | 把 6 个任务全部勾上 | 追加 `+5`，余额 37，提示「全部完成 +7 积分」 |
| A4 | 日记每日封顶 | 连发 4 篇日记 | 前 3 篇各 +5，第 4 篇 +0 并提示「今天的这项积分已经拿满了」 |
| A5 | 照片按张计分 | 一次上传 12 张 | 只加 10 分（每日上限），后 2 张不加 |
| B1 | 余额不足不能发行 | 余额 5，发行愿望券（30 分） | 弹窗提示「积分不够」，账户与券包都不变 |
| B2 | 发行成功 | 余额 40，发行请客券 25 分 | 余额 15，`total_spent +25`，对方券包多 1 张 `active` 券，我的流水 `-25` |
| B3 | 发行校验 | 券名留空 | 提示「给券起个名字吧」，不生成券 |
| C1 | 只能用自己的券 | 伊梦试图使用发给瀚瀚的券 | 失败，提示「这张券不是给你的哦」 |
| C2 | 不能重复使用 | 同一张券点两次使用 | 第二次失败，`status` 仍为 `used`，`used_at` 不变 |
| C3 | 使用记录 | 使用夸夸券，备注「今晚的碗归你了」 | `status=used`、`used_at` 有值、`use_note` 保存，卡片显示时间与备注 |
| D1 | 删除要确认 | 点删除券 | 先弹确认框；取消则不变，确认才移除，且积分不退回 |
| E1 | 首页展示 | 打开首页 | 「我的券包」显示可用券与余额，「TA 的券包」显示对方可用张数 |
| E2 | 券包分栏 | 券包页切「TA 的券包」 | 只显示发放给对方的券，不含自己收到的 |
| F1 | 账户隔离（RLS） | 用另一对情侣的账号查询 | `select * from coupons` 返回 0 行（`couple_id` 不匹配） |
| F2 | 不能直改余额 | 客户端直接 `update love_accounts set balance = 9999` | 被拒绝（列权限只给了 `nickname`） |
| F3 | 不能直插券 | 客户端直接 `insert into coupons` | 被拒绝，只能走 `issue_coupon` RPC |
| G1 | 导出包含银行 | 设置页导出 JSON | `data.bank.accounts / coupons / tx` 都在 |

## 6. 前端实现对应关系

当前站点是纯静态的，所以这套模型落在 `localStorage` 的 `hm.db.v2 → bank` 上，
字段名与上面的表一一对应，将来迁到 Supabase 只需要替换数据层：

| 前端 | 后端 |
|---|---|
| `HM.bank.account(key)` | `select * from love_accounts where user_id = ...` |
| `HM.bank.award(event, {refKey})` | `rpc('award_points', ...)` |
| `HM.bank.issue({...})` | `rpc('issue_coupon', ...)` |
| `HM.bank.use(id, note)` | `rpc('use_coupon', ...)` |
| `HM.bank.couponsOf(key, status)` | `select * from my_coupons where owner_id = ...` |

SQL 全部在 `db/love_bank.sql`：建表 → 索引 → 发分/发行/使用三个函数 → RLS → 只读视图。

## 7. 已知取舍

- 券不能撤回退分：删除只删记录，积分不退。想做「撤回」需要再加一条 `refund` 流水和一个 `revoke_coupon()`。
- 用完的券不落「对方是否真的兑现」的确认环节——需求里明确不做审批流程。
- 前端没有并发概念；如果以后多端同时用，发出/使用必须都走 RPC，靠 `for update` 行锁保证余额正确。
