# Exchange Rate V1

> Architecture & Learning Notes。本文记录当前仓库中的真实实现，不是用户手册、营销说明或 API 自动生成文档。代码、测试、fixture 和 spike 的优先级高于本文；修改功能后应同步复核本文。

## 1. Purpose

Exchange Rate 工具把一个目标外币的市场中间价参考，与五家中国商业银行公开发布的现汇、现钞买入和卖出报价放在同一页面比较。V1 支持：

- 中国银行（BOC）
- 中国工商银行（ICBC）
- 中国建设银行（CCB）
- 中国农业银行（ABC）
- 招商银行（CMB）
- CurrencyBeacon 市场中间价参考

所有银行价格统一表达为“1 单位外币对应多少人民币”（CNY per 1 foreign currency）。市场参考与银行报价是两类不同数据：前者用于理解市场中间水平，后者是各银行自己的公开报价。

V1 不保证用户能在特定地区、分行或渠道按页面价格成交，也不执行交易。它没有历史行情、图表、提醒、预测、数据库或用户账户。

## 2. High-Level Architecture

应用级链路如下：

```text
Vue route /tools/exchange-rate
    |
    | GET /api/exchange-rates/{currency_code}
    v
FastAPI HTTP boundary
    |
    v
ExchangeRateService
    |-- five BankSnapshotCache instances
    |     |-- BOC client
    |     |-- ICBC client
    |     |-- CCB client
    |     |-- ABC client
    |     `-- CMB client
    |
    `-- CurrencyBeaconCache -> CurrencyBeacon client
    |
    v
ExchangeRateComparison -> JSON strings / ISO 8601 timestamps
    |
    v
Vue formatting and presentation
```

单家银行内部的完整链路是：

```text
Official upstream
    -> production client (HTTP/TLS/timeout)
    -> pure parser
    -> bank-specific frozen dataclass
    -> mapper
    -> BankExchangeRate
    -> per-bank full-snapshot cache
    -> ExchangeRateService currency selection and freshness
    -> FastAPI serialization
    -> Vue
```

`BankSnapshotCache` 包装 production client，并缓存 mapper 已经产生的完整 `BankExchangeRate` 列表。它不是 parser 内部缓存，也不是按币种缓存。

主要实现位置：

- `backend/app/exchange_rate/clients.py`
- `backend/app/exchange_rate/banks/`
- `backend/app/exchange_rate/mappers.py`
- `backend/app/exchange_rate/models.py`
- `backend/app/exchange_rate/bank_cache.py`
- `backend/app/exchange_rate/service.py`
- `backend/app/exchange_rate/api.py`
- `backend/app/main.py`
- `frontend/src/tools/exchange-rate/`

## 3. End-to-End Data Flow

以用户选择 AUD 为例：

1. Vue 的 `ExchangeRateView.vue` 调用 `fetchExchangeRates("AUD")`，只访问本项目 FastAPI。
2. FastAPI 将路径参数交给 `ExchangeRateService.get_comparison`。
3. Service 把代码转成大写，并根据 V1 目标币种列表校验。
4. Service 用 `ThreadPoolExecutor` 并发请求五个独立的 `BankSnapshotCache`。
5. 有效快照直接复用；cold start 时对应 production client 访问官方 upstream，parser 和 mapper 生成该银行完整多币种 snapshot。
6. Service 从每个完整 snapshot 中选择 `currency_code == "AUD"` 的记录，应用 7 天 freshness 规则。一家失败或缺少 AUD 只影响该家结果。
7. 五家银行聚合完成后，Service 向独立的 CurrencyBeacon provider 请求 AUD 市场参考；provider 失败也只使 market reference unavailable。
8. FastAPI 把 dataclass 转成响应结构，将 `Decimal` 转为 JSON string、`datetime` 转为带 offset 的 ISO 8601 string、enum 转为其字符串值。
9. Vue 显示市场参考、五家银行的四类价格、发布时间和状态。

Vue 不直连任何银行或 CurrencyBeacon。外部协议、TLS 兼容、API key、bank-specific 字段和金融转换均留在 backend。

## 4. Layer Responsibilities

### 4.1 Production Client

`clients.py` 负责真实网络获取：URL、HTTP method、headers、TLS context、timeout、有限重试和 HTTP status 检查均属于这一层。Client 收到 response 后调用对应纯 parser，再调用 mapper，返回完整 `list[BankExchangeRate]`。

网络与 parser 分离，使 fixture 可以离线重放，也避免解析测试依赖公网。Mapper 测试还明确禁止 mapper 打开 socket。

### 4.2 Parser

每个 `banks/*.py` parser 只理解一家银行的 HTML、JSON 或 XML。它负责：

- 验证响应结构与必需字段；
- 把空价格保留为 `None`；
- 解析银行自己的货币标识和时间；
- 执行已经确认的上游报价单位转换；
- 生成 bank-specific dataclass。

Parser 不访问网络，也不为了统一 API 猜测缺失价格或未确认字段语义。未知币种标识会尽量保留 bank-specific identifier，而不是伪造 ISO code。

### 4.3 Bank-Specific Model

`BocRate`、`IcbcRate`、`CcbRate`、`AbcRate`、`CmbRate` 都是 frozen dataclass。它们保留各银行已确认、但不一定适合统一产品模型的字段，例如 BOC 折算价、ICBC reference、CCB 数字币种代码、ABC benchmark 和 currency id。

这层让“上游实际上说了什么”和“产品愿意统一承诺什么”保持分离。若 parser 直接产生 `BankExchangeRate`，银行特有信息容易被过早丢弃或被错误解释成通用语义。

### 4.4 Mapper

Mapper 是 bank-specific representation 到 common product representation 的语义边界。它负责：

- 设置稳定的 bank code/name；
- 把 parser 的价格转入统一字段；
- 将银行本地时间变为 timezone-aware datetime；
- 把过渡 float 通过 `Decimal(str(value))` 放入领域模型；
- 执行已确认的特殊 derivation（目前只有 ABC `cash_sell = spot_sell`）；
- 有意识地不提升 bank-specific reference 字段。

### 4.5 Unified Domain Model

`BankExchangeRate` 表示一条银行、币种、发布时间下的统一报价。它是 frozen dataclass，避免共享 snapshot 中的记录被原地修改；freshness 通过 `dataclasses.replace` 返回新实例。模型强制 `published_at` timezone-aware。

### 4.6 ExchangeRateService

Service 负责跨来源集成：V1 币种校验、五家银行并发聚合、完整 snapshot 中的币种选择、freshness、partial failure、无价格状态处理和 CurrencyBeacon failure isolation。这些不是某一家 parser 的职责。

### 4.7 FastAPI

`backend/app/main.py` 创建唯一的 FastAPI application，配置 application-wide CORS、production dependencies，并 include exchange-rate router。`backend/app/exchange_rate/api.py` 只保留 feature route、Pydantic response schema、400 validation response 和 Decimal/datetime/enum serialization，不再是 ASGI application entrypoint。默认只允许 `http://localhost:5173`，可用 `FRONTEND_ORIGIN` 替换为另一个明确 origin。

本地推荐从 `backend/` 运行 `.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`。从仓库根目录工作时，等价命令为 `backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000`。旧的 `backend.app.exchange_rate.api:app` 已失效，不应通过在 feature module 中恢复顶级 app 来兼容。

### 4.8 Frontend

Frontend 负责币种选择、调用自己的 backend、loading/error、显示格式、状态文案和页面展示。它不承担 bank parser、price derivation、unsupported 推断、外部 API key 或 TLS 兼容。

## 5. Official Bank Data Sources

以下 URL 来自当前 production client 和 `backend/spikes/exchange_rate/`，不是凭记忆整理。

### BOC — 中国银行

- 官方入口与 production source：`https://www.boc.cn/sourcedb/whpj/`
- Method / format：GET，HTML。
- 发现方式：入口本身直接包含 `#priceTable` 官方报价表；`check_boc_response.py` 保存并检查页面响应。
- Client：`BocClient` 使用默认 TLS，15 秒 timeout，解析 `response.text`。

### ICBC — 中国工商银行

- 官方入口：`https://www.icbc.com.cn/ICBC/%E9%87%91%E8%9E%8D%E4%BF%A1%E6%81%AF/%E8%A1%8C%E6%83%85%E6%95%B0%E6%8D%AE/%E4%BA%BA%E6%B0%91%E5%B8%81%E5%8D%B3%E6%9C%9F%E5%A4%96%E6%B1%87%E7%89%8C%E4%BB%B7/`
- Production source：`https://papi.icbc.com.cn/exchanges/ns/getLatest`
- Method / format：POST 空 body，JSON。
- 发现方式：spike 检查官方页面与 `Portal_Resources/Common/config.js` 的 `papi.host`，再验证 internal JSON endpoint。
- Client：15 秒 timeout；使用 `OP_LEGACY_SERVER_CONNECT` TLS compatibility context。

### CCB — 中国建设银行

- 官方入口：`https://www2.ccb.com/chn/forex/exchange-quotations.shtml?tab=0`
- Production source：`https://www2.ccb.com/cn/home/news/jshckpj_new2.xml`
- Method / format：GET，XML，根节点 `ReferencePriceSettlements`。
- 发现方式：spike 检查官方页面和 `forex_price.js`，再单独验证 XML 与 `ReferencePriceSettlement` 结构。
- Client：30 秒 timeout；第一次 timeout 时立即再尝试一次；使用 legacy TLS compatibility context。

### ABC — 中国农业银行

- 官方入口：`https://ewealth.abchina.com.cn/ForeignExchange/ListPrice/`
- Production source：`https://ewealth.abchina.com.cn/app/data/api/DataService/ExchangeRateV2`
- Method / format：GET，JSON。
- 发现方式：spike 检查入口 HTML、`foreignCommon.js`、`foreignHomeJsh.js` 和页面 AJAX endpoint。
- Client：15 秒 timeout，发送页面 Referer 与 XHR headers；使用 legacy TLS compatibility context。

### CMB — 招商银行

- 官方入口：`https://fx.cmbchina.com/hq/`
- Production source：`https://fx.cmbchina.com/api/v1/fx/rate`
- Method / format：GET，JSON。
- 发现方式：spike 从行情页面和 `umi.js` bundle 定位并验证 JSON endpoint。
- Client：默认 TLS，15 秒 timeout，使用行情页 Referer 和 endpoint 所需的业务标识 header。文档不记录 cookie、token 或任何登录信息。

## 6. Upstream Data Mapping

### 6.1 BOC Mapping

| BOC table column | `BocRate` | `BankExchangeRate` / API |
| --- | --- | --- |
| 货币名称 | `currency_name` | `currency_name` |
| 中文名称静态映射 | `currency_code` | `currency_code` |
| 现汇买入价 | `spot_buy` | `spot_buy` |
| 现钞买入价 | `cash_buy` | `cash_buy` |
| 现汇卖出价 | `spot_sell` | `spot_sell` |
| 现钞卖出价 | `cash_sell` | `cash_sell` |
| 中行折算价 | `boc_conversion_rate` | intentionally excluded |
| 发布日期 + 发布时间 | `published_at` string | timezone-aware `published_at` |

BOC 没有在行中提供 ISO code，parser 用受控中文名映射。V1 曾因映射缺少韩国元、澳门元、林吉特、新台币而丢失 KRW/MOP/MYR/TWD；当前映射已覆盖 14 个 V1 目标币种。未识别名称保留 `currency_name`，code 为 `None`。

### 6.2 ICBC Mapping

| ICBC JSON field | `IcbcRate` | Unified API |
| --- | --- | --- |
| `currencyCHName` | `currency_name` | `currency_name` |
| `currencyENName` | `currency_code` | `currency_code` |
| `foreignBuy` | `spot_buy` | `spot_buy` |
| `foreignSell` | `spot_sell` | `spot_sell` |
| `cashBuy` | `cash_buy` | `cash_buy` |
| `cashSell` | `cash_sell` | `cash_sell` |
| `reference` | `reference_rate` | intentionally excluded |
| `publishDate` + `publishTime` | `published_at` string | timezone-aware `published_at` |
| `currencyType` | not retained | excluded upstream identifier |

`reference_rate` 是工商银行特有 reference，当前没有证据证明它与 BOC conversion 或 ABC benchmark 是同一金融概念，因此不进入统一 API。

### 6.3 CCB Mapping

| CCB XML field | `CcbRate` / parser role | Unified API |
| --- | --- | --- |
| `Ofrd_Ccy_CcyCd` + `Ofr_Ccy_CcyCd` | 判断币种数字代码与 direct/inverse | code/name from `CURRENCY_METADATA` |
| `BidRateOfCcy` | raw spot bid | direct `spot_buy`; inverse source for `spot_sell` |
| `OfrRateOfCcy` | raw spot offer | direct `spot_sell`; inverse source for `spot_buy` |
| `BidRateOfCash` | raw cash bid | direct `cash_buy`; inverse source for `cash_sell` |
| `OfrRateOfCash` | raw cash offer | direct `cash_sell`; inverse source for `cash_buy` |
| non-CNY numeric code | `currency_numeric_code` | intentionally excluded |
| `LstPr_Dt` + `LstPr_Tm` | `published_at` | timezone-aware `published_at` |
| `HBBnk_Bss_Buy_Prc`, `HBBnk_Bss_Sell_Prc`, `Mdl_ExRt_Prc`, `ExRt_StCd` | not retained | excluded; no proven unified semantics |

每条 pair 必须恰好一侧是 CNY numeric code `156`：

- Direct：foreign/CNY，直接使用 raw bid/offer。
- Inverse：CNY/foreign，需要 reciprocal，并交换 bid/offer：`spot_buy = 1 / raw_spot_offer`，`spot_sell = 1 / raw_spot_bid`；cash 同理。

交换是必要的，因为 reciprocal 会反转报价方向。空 inverse price 仍为 `None`，非正数不可取 reciprocal。

### 6.4 ABC Mapping

| ABC JSON field | `AbcRate` | Unified API |
| --- | --- | --- |
| `CurrName` | `currency_name`，并从末尾 `(ISO)` 提取 code | name/code |
| `CurrId` | `currency_id` | intentionally excluded |
| `BuyingPrice` | `spot_buy` | `spot_buy` |
| `SellPrice` | `spot_sell` | `spot_sell`，并由 mapper 派生 `cash_sell` |
| `CashBuyingPrice` | `cash_buy` | `cash_buy` |
| `BenchMarkPrice` | `abc_benchmark_rate` | intentionally excluded |
| `PublishTime` | aware timestamp string | `published_at`，保留 upstream offset |
| `Id` | not retained | excluded upstream record identifier |

ABC upstream 没有独立 `cash_sell`。Parser 不伪造该字段；mapper 按当前已确认规则设置 `cash_sell = spot_sell`，并把 `derived_fields` 设为 `{"cash_sell"}`。`derived_fields` 留在领域模型，不进入当前 API response。

### 6.5 CMB Mapping

| CMB JSON field | `CmbRate` | Unified API |
| --- | --- | --- |
| `ccyNbr` | `currency_name` | `currency_name` |
| `ccyNbrEng` | 从末尾 ISO code 提取 `currency_code` | `currency_code` |
| `rthBid` | `spot_buy` | `spot_buy` |
| `rthOfr` | `spot_sell` | `spot_sell` |
| `rtcBid` | `cash_buy` | `cash_buy` |
| `rtcOfr` | `cash_sell` | `cash_sell` |
| `ratDat` + `ratTim` | `published_at` | timezone-aware `published_at` |
| `rtbBid`, `ccyExc` | not retained | intentionally excluded |

`rtbBid` 和 `ccyExc` 没有被当前 parser 提升，因为其金融语义没有被证明等价于统一四价字段或通用 reference。

## 7. Quote Normalization

统一单位为 CNY per 1 foreign currency。

| Bank | Upstream unit / orientation | Current normalization |
| --- | --- | --- |
| BOC | CNY per 100 foreign | divide by 100 |
| ICBC | CNY per 100 foreign | divide by 100 |
| CCB | currency pair; direct may already be CNY per 1 foreign | direct unchanged; inverse reciprocal plus bid/offer swap |
| ABC | CNY per 100 foreign | divide by 100 |
| CMB | CNY per 100 foreign | divide by 100 |

这层处理必须从 parser tests 开始核查。若出现整齐的 `×100` 错误，优先检查 bank parser 的 quote unit；若只有 CCB 某些 pair 方向错误，检查 direct/inverse 判定和 reciprocal swap。

## 8. Spot / Cash and Buy / Sell Semantics

- `spot_buy`：银行买入外汇账户资金的价格。
- `spot_sell`：银行卖出外汇账户资金的价格。
- `cash_buy`：银行买入外币现钞的价格。
- `cash_sell`：银行卖出外币现钞的价格。

Buy/sell 始终是银行视角：用户向银行出售外币通常关注 bank buy；用户用人民币向银行购买外币通常关注 bank sell。这是字段解释，不是交易或投资建议。

即使某银行当前 spot 与 cash 数值相同，也必须保留四个独立字段。上游将来可以重新产生差异，而且字段代表不同业务渠道。除 ABC 已验证的 mapper 规则外，不能用 spot 自动补 cash 或反向补值。

## 9. Partial Quote Semantics

只要四个价格至少一个存在，该记录就可以是有效报价。典型情况包括 BOC MYR 只有 spot 报价、BOC TWD 只有 cash 报价。

缺失值沿链路保持：

```text
upstream empty -> parser None -> domain None -> API null -> frontend —
```

Service 的 freshness 首先检查四价是否至少一个非 `None`；全部缺失才设为 unavailable。Frontend 按 backend status 展示，不因为单个或多个 `null` 自行推断 unsupported。

## 10. Bank-Specific Fields vs Unified Fields

| Bank | Bank-specific / upstream field | Preserved in bank model? | Unified API? | Reason |
| --- | --- | --- | --- | --- |
| BOC | `boc_conversion_rate` | Yes | No | BOC-specific conversion field |
| ICBC | `reference_rate` | Yes | No | ICBC-specific reference field |
| ICBC | `currencyType` | No | No | upstream identifier; code comes from `currencyENName` |
| CCB | `currency_numeric_code` | Yes | No | upstream currency identifier |
| CCB | `Mdl_ExRt_Prc` and business/status fields | No | No | no proven common semantics |
| ABC | `abc_benchmark_rate` | Yes | No | ABC-specific benchmark |
| ABC | `currency_id` | Yes | No | upstream identifier |
| ABC | `Id` | No | No | record identifier not needed by product |
| CMB | `rtbBid`, `ccyExc` | No | No | financial meaning not confirmed for common contract |

这些不是“忘记加入 API”的字段。BOC conversion、ICBC reference、ABC benchmark 没有充分证据证明代表完全相同的金融概念，因此 V1 不创建虚假的 generic `reference_rate`。

## 11. Unified BankExchangeRate Model

`backend/app/exchange_rate/models.py` 的字段为：

| Field | Meaning |
| --- | --- |
| `bank_code` | 稳定银行代码 BOC/ICBC/CCB/ABC/CMB |
| `bank_name` | 展示名称 |
| `currency_code` | ISO code；mapper 前可能未知为 `None` |
| `currency_name` | 上游或受控 metadata 的币种名称 |
| `spot_buy`, `spot_sell` | 统一单位的现汇银行买/卖价 |
| `cash_buy`, `cash_sell` | 统一单位的现钞银行买/卖价 |
| `published_at` | 银行发布时间，必须 timezone-aware |
| `status` | `RateStatus` |
| `derived_fields` | 明确标记 mapper 派生字段；当前仅 ABC `cash_sell` |

Frozen dataclass 使缓存中的统一 record 不可变。Service 对 status 的 freshness 调整创建新实例，不污染完整 snapshot。

## 12. Decimal and Serialization

统一模型和 service/API 金融值使用 `Decimal`。FastAPI 的自定义 serializer 把 Decimal 输出为 JSON string，例如 `"spot_sell": "4.8400"`，而不是 JSON number。Frontend types 也要求 `string | null`，格式化器直接处理十进制字符串，避免 JavaScript binary floating-point 再次引入精度噪声。

当前银行管线并非全程 Decimal：

- BOC 在 `/100` 时先用 Decimal，但 `BocRate` 最终仍存 float。
- ICBC、CCB、ABC、CMB bank-specific price 当前是 float；CCB reciprocal 也是 float 运算。
- Mapper 用 `Decimal(str(value))` 进入 `BankExchangeRate`。
- CurrencyBeacon 使用 `json.loads(..., parse_float=Decimal, parse_int=Decimal)`，cross-rate 全程 Decimal。

因此 Decimal contract 在统一领域/API 边界成立，但 bank parser 仍有 transitional float。维护时不应声称整条银行管线已经完全 Decimal。

## 13. Market Reference Rate

CurrencyBeacon 是市场中间价参考，不是第六家银行，也不参与“最低价银行”排名。`MarketReferenceRate` 是独立 frozen dataclass，字段包括：

- `currency_code`
- `rate: Decimal | None`
- `source_code`, `source_name`, `source_url`
- `rate_type`（当前为 `mid_market`）
- `published_at: datetime | None`
- `retrieved_at: datetime`
- `status`

Published/retrieved timestamps 必须 timezone-aware。Provider 失败时仍返回同一来源身份，但 `rate` 和 `published_at` 为 `None`、status 为 unavailable。

## 14. CurrencyBeacon Conversion

Client 一次请求 `https://api.currencybeacon.com/v1/latest`，base 为 USD，symbols 包含 CNY 和除 USD 外的 13 个目标币种。假设 response 中：

```text
USD -> CNY    = cny_rate
USD -> target = target_rate
```

则：

```text
CNY per target = cny_rate / target_rate
```

USD 自身 denominator 为 1。Client 用 backend 环境变量 `CURRENCYBEACON_API_KEY` 作为 Bearer credential；真实 key 永远不写入文档、frontend 或 API response。

## 15. ExchangeRateService

Service 的关键行为：

- 将输入转大写并验证 14 个 V1 target currency；
- 保持 production client 顺序聚合五家银行；
- cold start 时并发请求五个 cache/client；
- 从每家完整 snapshot 选择目标币种；
- 根据发布时间和 7 天 policy 计算 available/stale/unavailable；
- 保留 partial quote；
- missing record、空 snapshot 或单家异常转为该家 unavailable；
- CurrencyBeacon 异常转为 unavailable market reference。

单个 provider 异常不应导致 endpoint 整体 500，也不会把内部异常文本暴露到 response。

## 16. Cache Architecture

### 16.1 Bank Snapshot Cache

缓存单位是每家银行的完整多币种 snapshot，而不是 AUD/USD/JPY 单币种。每个 `ExchangeRateService` 实例为每个 client 创建独立 `BankSnapshotCache`：

```text
BOC snapshot:  USD, AUD, JPY, ..., MYR
ICBC snapshot: USD, AUD, JPY, ..., MYR
...
```

缓存 lazy、in-memory，TTL 为 5 分钟。进程重启会丢失；不同 service 实例或 worker 不共享。

### 16.2 Why Full Snapshot?

五家 upstream 的一次 response 本身就包含多个币种。第一次 AUD 请求已经支付了完整 response 的网络与解析成本，因此 TTL 内切换 USD、JPY、EUR 应复用同一 snapshot，不应重复抓银行。

### 16.3 First-Load Concurrency

Cold start 时，Service 使用最多等于银行数的 `ThreadPoolExecutor` workers 并发调用五个 cache。每个没有 snapshot 的 cache 会同步等待自己的首次 client fetch；这样避免按 BOC → ICBC → CCB → ABC → CMB 串行累加网络延迟。并发调用同一 cold cache 时，`Condition` 使其共享一个刷新结果。

### 16.4 Stale-While-Revalidate

| State | Behaviour |
| --- | --- |
| snapshot age < 5 minutes | 立即返回当前 snapshot |
| expired + last-known-good | 立即返回旧 snapshot，并启动 daemon background refresh |
| refresh success | 在 condition lock 内原子替换整个 snapshot |
| refresh failure | 保留 last-known-good，记录异常 |
| no snapshot | 同步 fetch；失败由 service 降级该银行 unavailable |

旧 snapshot 是否触发 cache refresh，与其中 quote 的业务 freshness 是两个不同判断。

### 16.5 Refresh Throttling / Stampede Protection

`BankSnapshotCache` 使用 `threading.Condition`、`_refreshing`、`_refresh_generation` 和 `_last_refresh_attempt_at`：

- 多个请求同时发现同一家 expired，只允许一个 background refresh；其他请求立即拿旧 snapshot。
- 有 last-known-good 的 refresh 失败后，在一个 5 分钟窗口内不再次尝试，避免每个用户请求 hammer upstream。
- 各银行 flag 独立，一家刷新不阻塞另一家。
- 没有 snapshot 的 cold failure 不使用旧值；后续 cold 请求仍可重新尝试。

### 16.6 CurrencyBeacon Cache

CurrencyBeacon 使用单独的 `CurrencyBeaconCache`：lazy、in-memory、TTL 1 小时，以 lock 保护刷新。它不是银行 snapshot cache，也没有银行 cache 的 stale-while-revalidate 行为。到期请求会在 lock 内同步 fetch 完整 market rate dictionary。

## 17. Cache TTL vs Quote Freshness

- 5-minute cache TTL 回答：“backend 什么时候应重新抓银行？”
- 7-day quote freshness 回答：“银行自己发布的这条 quote 是否太旧？”

例如 snapshot 是 6 分钟前抓的，但其中 `published_at` 是今天：本次请求可以立即返回该 snapshot，并触发后台更新；quote 仍可标为 available。只有银行发布时间超过 7 天（严格大于 7 天）才是 stale，正好 7 天边界仍 available。

## 18. RateStatus

| Status | Service semantics | Frontend wording |
| --- | --- | --- |
| `available` | 至少有一个当前报价字段 | 当前有报价 |
| `stale` | 有报价，但银行发布时间超过 7 天 | 可能已过期 |
| `unavailable` | 没有报价、缺 record、获取失败等 | 暂无当前报价 |
| `unsupported` | backend 明确给出不支持 | 该银行暂不支持此币种 |

Available 只表示当前获得公开报价，不保证特定地区或渠道可办理。Missing record 不等于 unsupported；frontend 不自行推断。目前五个 mapper 默认产生 available，实际缺币种由 service 表达为 unavailable，虽然统一 contract 保留 unsupported 值。

## 19. Timezone Policy

BOC、ICBC、CCB、CMB parser 产生没有 offset 的中国本地时间 string；mapper 显式附加 `Asia/Shanghai`。ABC 的 `PublishTime` upstream 自带 offset，parser 验证并由 mapper 保留。

统一模型和 API 输出 timezone-aware ISO 8601，例如 `2026-08-24T13:45:13+08:00`。Frontend 使用 `Intl.DateTimeFormat` 固定按 `Asia/Shanghai` 显示为北京时间。Unavailable bank 的 API `published_at` 可以为 `null`。

## 20. Backend API Contract

Endpoint：

```text
GET /api/exchange-rates/{currency_code}
```

输入会转大写，因此 path code 大小写不敏感；不在 V1 列表内返回 HTTP 400。V1 targets：

```text
USD CAD EUR GBP CHF AUD NZD JPY KRW HKD MOP TWD SGD MYR
```

### 20.1 Example Request

```http
GET /api/exchange-rates/AUD
Accept: application/json
```

### 20.2 Example Response

以下仅为结构示例，不是实时价格：

```json
{
  "currency_code": "AUD",
  "market_reference": {
    "currency_code": "AUD",
    "rate": "4.8200",
    "source_code": "currencybeacon",
    "source_name": "CurrencyBeacon",
    "source_url": "https://currencybeacon.com/",
    "rate_type": "mid_market",
    "published_at": "2026-01-01T00:00:00+00:00",
    "retrieved_at": "2026-01-01T00:01:00+00:00",
    "status": "available"
  },
  "banks": [
    {
      "bank_code": "BOC",
      "bank_name": "中国银行",
      "currency_code": "AUD",
      "currency_name": "澳大利亚元",
      "spot_buy": "4.8000",
      "spot_sell": "4.8400",
      "cash_buy": "4.7900",
      "cash_sell": "4.8500",
      "published_at": "2026-01-01T08:00:00+08:00",
      "status": "available"
    }
  ]
}
```

API `BankQuoteResponse` 不包含 bank-specific reference 或 `derived_fields`。Market unavailable 时 `rate`/`published_at` 为 `null`；bank unavailable 时 name、四价和 timestamp 均可为 `null`，但 bank code/name 和请求的 currency code 仍存在。

### 20.3 Partial Failure Behaviour

- 单家银行网络、解析或 cold cache 失败：该家为 unavailable，其他银行继续返回。
- 某家 snapshot 中没有目标币种：该家 unavailable，不推断 unsupported。
- CurrencyBeacon 失败或 key 未配置：market reference unavailable，五家银行仍返回。
- 上述单一 provider failure 不把 endpoint 变为 500。

## 21. Frontend Boundary

Vue 只调用自己的 FastAPI。这样可以：

1. 不把 CurrencyBeacon key 暴露给浏览器；
2. 集中维护 bank-specific parser 和金融语义；
3. 由 backend 统一管理 cache；
4. 隔离上游 CORS、TLS、method 和 header 差异；
5. 在不重写 Vue 的情况下维护 upstream client；
6. 给 frontend 一个稳定、字符串 Decimal 的统一 contract。

Frontend 默认使用同源相对路径 `/api/exchange-rates/{code}`。Local Vite 只把 `/api` 代理到 `http://127.0.0.1:8000`；Vercel 将同一路径 rewrite 到 backend service。`VITE_API_BASE_URL` 仍可用于明确的开发或测试 override。

## 22. Frontend Presentation Rules

- `value >= 1`：固定 4 位小数。
- `value < 1`：固定 6 位小数。
- `null` 或无效十进制字符串：`—`。
- 格式化直接对 decimal string 做字符与 BigInt rounding，不先转 JS number。
- 买入/卖出按银行视角。
- Partial available row 保持“当前有报价”，只把缺失单元格显示为 `—`。
- 页面说明公开报价仅供比较；实际可办理币种及成交价格以银行渠道为准。

这些是 display-only 规则，不改变 backend Decimal 或金融字段。

## 23. Environment Variables

| Variable | Process | Purpose |
| --- | --- | --- |
| `CURRENCYBEACON_API_KEY` | backend | CurrencyBeacon Bearer credential；缺失时 market reference unavailable |
| `FRONTEND_ORIGIN` | backend | 覆盖 FastAPI 默认允许的单个开发 CORS origin |
| `VITE_API_BASE_URL` | frontend build/dev | 覆盖 frontend 默认 backend base URL |

不要把真实 key、个人路径或 secret 写入仓库。

## 24. Testing Strategy

### Fixtures

`backend/tests/exchange_rate/fixtures/` 保存五家官方 upstream response snapshot（HTML/JSON/XML），供 parser 和 client 离线回归。Fixture 不应整份复制进文档。

### Spikes

`backend/spikes/exchange_rate/` 记录如何从官方入口、页面脚本和配置定位 production source，以及 TLS/response structure 的最初验证。Spike 是调查工具，不是 runtime dependency。

### Focused tests

- parser：结构验证、字段映射、单位、空值、未知币种、CCB inverse；
- mapper/model：五家统一字段、timezone、Decimal transition、ABC derivation、排除特有字段；
- client：真实 method/URL contract、fixture integration、legacy TLS path；
- service：currency validation、freshness、partial failures、market isolation；
- cache：full snapshot、first-load concurrency、SWR、single-flight、throttling、last-known-good；
- API：schema/serialization、400、CORS、partial failure；
- frontend：API client、formatter、view status 和 partial display。

### Full regression

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests -v

cd ..\frontend
npm test
npm run lint
npm run type-check
npm run build
```

### Live smoke

Live smoke 验证官方 upstream 当前仍可访问、真实 FastAPI request 正常以及 frontend 能渲染实际 response。常规 unit tests 必须保持离线，不依赖公网可用性。

## 25. Where to Look When Something Breaks

| Symptom | First checks |
| --- | --- |
| 某家所有币种失败 | production client URL/method/TLS/timeout、官方 upstream、raw response structure |
| 只有一个币种缺失 | parser currency mapping/metadata、bank-specific code、mapper、snapshot 中实际 code |
| 所有数值整齐地 ×100 或 ÷100 | 该 bank parser quote unit normalization |
| CCB 某些币种 bid/offer 反向 | pair orientation、inverse reciprocal 与 bid/offer swap |
| Partial quote 整行 unavailable | 先看 backend JSON 四价和 status；检查 service `has_quote`，不要用 frontend 补值 |
| Frontend unavailable | 先直接检查 FastAPI JSON 和 backend logs，再区分 bank failure、missing record、market failure |
| AUD 第一次慢，之后切币种快 | cold-start/full-snapshot cache 的预期行为 |
| 5 分钟后仍秒开旧 snapshot | stale-while-revalidate 的预期行为；检查后台 refresh 是否随后完成 |
| 旧 snapshot 长时间不换 | 查 refresh exception、`_last_refresh_attempt_at` throttle 和上游健康度 |
| Decimal 变成 JS number | API `_serialize`、Pydantic response、frontend types/API client |
| 时间偏移 8 小时 | parser timestamp 是否 naive、mapper 是否用 `Asia/Shanghai`、frontend formatter timezone |

诊断顺序应沿数据流由上游向下：client/raw response → parser → bank model → mapper → snapshot → service → API JSON → Vue。

## 26. Known Limitations

- Bank 和 CurrencyBeacon cache 都是进程内内存状态；多 worker 不共享。
- Process restart 会 cold start。
- 银行网站、内部 endpoint、字段和 TLS 配置可能变化。
- 官方公开 quote 不保证特定地区、分行、渠道可办理或按该价成交。
- CurrencyBeacon key 未配置时 market reference unavailable。
- 银行 parser 仍有 float transitional representation；统一模型/API 才是 Decimal contract。
- 没有历史持久化、历史 chart、alerts、transaction execution。
- 没有账户、个人交易状态或数据库。

## 27. V1 Scope and Explicit Non-Goals

V1 唯一 market reference 是 CurrencyBeacon；银行固定为 BOC、ICBC、CCB、ABC、CMB。

当前明确不实现：

- Alipay FX
- Google FX
- historical chart/persistence
- alerts
- prediction
- database
- user account
- transaction execution

支付宝等来源不是 V1 TODO blocker。它们被有意排除，因为适合本个人项目的官方公共访问没有进入当前实现范围；本文不承诺未来一定实现。
