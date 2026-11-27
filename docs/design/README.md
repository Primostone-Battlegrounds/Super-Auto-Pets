# 设计版本

从 [manifest.json](manifest.json) 查询本产品当前生效设计、候选和历史状态。每个候选的完整规格、互动原型和验收条件位于 `revisions/<version>/`，固定来源位于 `references/`。历史资料以清单及固定提交为准。

清单的 `implementation` 绑定当前工作树产出的 GIL。Proposed 允许隔离构建，develop 交付要求该绑定为 Active。激活保留被审 Proposed 提交的祖先关系。

| 状态 | 允许用途 |
| --- | --- |
| Draft | 编辑和研究 |
| Proposed | 通过显式设计版本构建隔离候选，附独立评审 |
| Active | 当前实现依据和 develop 交付 |
| Superseded | 查询历史 |
| Rejected | 查询评审记录 |

独立评审以设计指纹和完整 Git SHA 绑定被审资产。激活时同时更新已有 Active 的状态并保持其资产和版本元数据冻结。PR 使用一行 `Design-Version: vX.Y.Z` 及各自的 `Work-Item: TASK-N`，Backlog 对应条目使用同一设计版本。原版来源版本、设计版本、产品版本、Git SHA 和 GIL SHA-256 分别记录。

```sh
node scripts/check-design.mjs
node scripts/check-design.mjs select v2.0.0
SAP_PR_BODY="$(cat /path/to/pr-body.md)" node scripts/check-design.mjs pr <base-sha>
node scripts/acceptance-gate.mjs <package>
```

产品发布范围及 Active 设计的当前适用关系见 [产品路线图](../PRODUCT.md)。
