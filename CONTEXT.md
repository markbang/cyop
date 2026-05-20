# CONTEXT.md — Cyop Domain Glossary

## 核心实体

- **Dataset（数据集）**：一组需要打标的图片素材集合。每个 Dataset 属于一个 Requirement。
- **Media Asset（素材）**：单张图片，上传到 S3 对象存储后生成一条记录，属于某个 Dataset。
- **Caption（打标结果）**：对一张图片的 AI 文本描述。包含 AI 生成稿（ai_caption）、人工修改稿（manual_caption）和最终稿（final_caption）。每条 Caption 关联一个 Prompt Template 和 Media Asset。
- **Requirement（需求）**：业务需求单，定义一批图片的打标目标、验收标准和状态流转。看板按需求状态分列拖拽。
- **Prompt Template（提示词模板）**：可复用的 AI prompt 配置，包含 system prompt、user prompt 模板和模型参数。
- **Model（模型）**：已注册的 AI 视觉模型配置，含 provider、model_id、API key 环境变量名。可设为默认模型。

## Caption 状态机

```
pending → queued → processing → completed → approved
                ↘   failed  → rejected
                              → pending (重试归队)
```

- **pending**：等待被调度函数推入队列
- **queued**：已推入 QStash，等待 worker 消费
- **processing**：worker 正在调用 AI API
- **completed**：AI 打标完成，等待审核
- **approved**：人工审核通过，final_caption 确认
- **rejected**：打标失败或人工驳回，需查看 rejection_reason

## 任务调度概念

- **调度函数（Dispatch）**：Vercel Cron 每分钟触发，扫描 pending 状态的 Caption 行，逐条推入 QStash，状态更新为 queued。
- **Worker 函数**：QStash 逐条 HTTP 回调，处理单张图片的 AI 打标。保留现有内联重试逻辑，内联耗尽的失败抛给 QStash 自动重试（最多 3 次），全部耗尽进入 DLQ。
- **DLQ（死信队列）**：QStash 重试全部失败后的终态。Worker 函数检测到 DLQ 标记后直接写 rejected。
- **Rate Limit**：QStash 队列级别控速，匹配 AI API 的 RPM 限额。
- **上传自动入队开关**：每个 Dataset 可选的布尔标记，开启后 finalizeUpload 自动创建 Caption 行并设为 pending；关闭则需手动触发 triggerCaptioning。
