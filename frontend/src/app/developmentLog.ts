export type DevelopmentLogEntryType = 'feature' | 'improvement' | 'release'

export interface DevelopmentLogEntry {
  period: string
  dateTime: string
  type: DevelopmentLogEntryType
  title: string
  summary: string
  highlights: readonly string[]
}

export const developmentLogEntries: readonly DevelopmentLogEntry[] = [
  {
    period: '2026.08.28',
    dateTime: '2026-08-28',
    type: 'feature',
    title: '文本规范化与中文出版规范模式',
    summary:
      '文本清理工具组加入面向普通文本的规范化模块，并提供基于 CY/T 154—2017 的安全自动化子集。',
    highlights: [
      '按需统一空白、全角字母数字、中英数字间距与常见标点间距',
      '保护 URL、邮箱、路径、日期和版本号等技术片段',
      '中文出版规范模式只处理纯文本中能够可靠判断的规则',
    ],
  },
  {
    period: '2026.08.03–27',
    dateTime: '2026-08-27',
    type: 'feature',
    title: '文本清理工具组',
    summary:
      '围绕复制与再利用文本的实际场景，形成统一入口下的 PDF 与 Markdown 清理模块。',
    highlights: [
      '恢复 PDF 复制文本中的段落、标题、列表与异常换行',
      '清理常见 Markdown 标记，同时保护代码、链接与必要结构',
      '增加复制残留字符处理、结果统计和更可靠的边界行为',
    ],
  },
  {
    period: '2026.08.26',
    dateTime: '2026-08-26',
    type: 'improvement',
    title: '工业终端界面升级',
    summary:
      '工具箱更新为克制的信息系统界面，让模块分类、运行状态和日常入口更清晰。',
    highlights: [
      '新增 Light / Dark 显示模式并记住用户选择',
      '首页按真实产品类别组织工具，并提供最近使用入口',
      '统一桌面与移动端布局、键盘焦点和页面层级',
    ],
  },
  {
    period: '2026.08.24',
    dateTime: '2026-08-24',
    type: 'feature',
    title: '汇率比较',
    summary:
      '新增市场参考汇率与五家中国商业银行公开报价的统一比较页面。',
    highlights: [
      '并列展示现汇、现钞买入与卖出报价及发布时间',
      '支持中国银行、工商银行、建设银行、农业银行和招商银行',
      '单一来源异常时保留其他可用结果，并通过缓存改善重复查询体验',
    ],
  },
  {
    period: '2026.07.29–31',
    dateTime: '2026-07-31',
    type: 'release',
    title: 'Personal Toolbox 起步与文本对比',
    summary:
      '项目从 Vue 工具箱基础与首个文本对比模块开始，建立可持续扩展的浏览器工具入口。',
    highlights: [
      '识别两段文本中的新增、删除与修改内容',
      '改善长文本、段落拆分合并和字符级差异的对齐结果',
      '加入编辑与结果模式切换、差异筛选、交换和清空操作',
    ],
  },
]
