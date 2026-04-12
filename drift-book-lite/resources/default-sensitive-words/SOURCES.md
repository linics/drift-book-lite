# 默认敏感词快照说明

- 上游仓库：`konsheng/Sensitive-lexicon`
- 上游地址：https://github.com/konsheng/Sensitive-lexicon
- 许可证：MIT License
- 快照日期：2026-04-10
- 选用范围：广告、色情、涉枪涉爆、非法网址、暴恐、补充、贪腐
- 本目录文件是基于以下上游分类整理后的项目内置快照，用于部署时离线导入：
  - `Vocabulary/广告类型.txt`
  - `Vocabulary/色情词库.txt`
  - `Vocabulary/涉枪涉爆.txt`
  - `Vocabulary/非法网址.txt`
  - `Vocabulary/暴恐词库.txt`
  - `Vocabulary/补充词库.txt`
  - `Vocabulary/贪腐词库.txt`

说明：

- 这里保留的是适合本项目默认启用的中度扩容快照，不包含政治类、GFW 补充、零时-Tencent、网易前端过滤敏感词库等高误判或过大的杂合词库。
- 词条导入时会执行 `NFKC + trim + lowercase` 归一化并按归一化结果去重。
- 如果后续继续扩展到政治类或近全量词库，建议先单独评估误判风险与匹配性能。
