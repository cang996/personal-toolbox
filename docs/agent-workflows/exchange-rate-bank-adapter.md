# Exchange Rate Bank Adapter Workflow

Follow the repository-wide rules in [AGENTS.md](../../AGENTS.md). This workflow applies only to adding or investigating an `exchange_rate` bank adapter. It supplements rather than repeats the repository rules.

Use this workflow autonomously when a task explicitly asks to complete a bank adapter according to it. Existing banks demonstrate that official upstreams may expose HTML, JavaScript-discovered JSON, JavaScript-discovered XML, direct quotations, or inverse quotations. They are evidence of variation, not templates for a new bank.

## Phase 0 — Inspect the repository

- Read `AGENTS.md` and inspect the current structure under:
  - `backend/app/exchange_rate/`
  - `backend/spikes/exchange_rate/`
  - `backend/tests/exchange_rate/`
- Review existing adapters, spikes, fixtures, and tests only to understand project conventions.
- Do not copy an existing bank's endpoint assumptions, fields, units, TLS behaviour, or conversion rules merely because its implementation looks similar.

## Phase 1 — Locate an official source

Find the target bank's official public page for personal foreign exchange, settlement and sale, currency conversion, or the closest equivalent target business.

- Production data must come from an official bank-controlled resource.
- Search may help locate the page, but a third-party rate site is not a production source.
- Record the official page URL, its stated purpose, and the evidence that it represents the target business.

Do not proceed on visual resemblance alone.

## Phase 2 — Create the minimum upstream spike

Determine which condition applies:

- **A:** Rate data is present directly in the HTML.
- **B:** The page loads rate data at runtime through JavaScript or an API.
- **C:** An iframe or another official resource supplies the data.
- **D:** The current URL is not the real data page.
- **E:** Access is restricted or blocked.

Create only the bank-specific spike needed for the next evidence step. Possible names include:

```text
check_<bank>_response.py
check_<bank>_js.py
check_<bank>_api.py
check_<bank>_xml.py
```

Do not create every possible probe in advance, and do not write the formal parser before locating the real upstream data.

## Phase 3 — Follow the evidence chain

If the initial HTML does not contain the records, trace the exact chain:

```text
official page
→ relevant DOM/container
→ script or iframe
→ AJAX/fetch/XHR logic
→ official endpoint
→ response fields
→ rendering logic
```

For the request directly responsible for the rates, establish from source evidence:

- URL or URL construction
- GET or POST
- query parameters
- request body
- relevant headers
- response type
- callback or JSONP behaviour
- fields consumed by the page

Keyword hits such as `api`, `ajax`, `price`, or `rate` are leads, not proof. If a required URL, function, or variable is defined in another official resource, inspect that precise resource rather than guessing its value.

## Phase 4 — Verify the upstream at runtime

After identifying a candidate data source, actually request it with a minimal bank-specific probe. Record:

- HTTP status
- Content-Type
- final URL
- encoding
- response byte size
- response structure
- record count when applicable

Static source analysis does not establish request success.

Save a complete successful or diagnostically useful raw response under:

```text
backend/spikes/exchange_rate/
```

Use a bank-specific `*_response.<extension>` filename and the actual format, such as `html`, `js`, `json`, or `xml`. Raw spike responses should remain Git-ignored.

## Phase 5 — Verify financial semantics

This phase is a mandatory gate before formal parser work. Establish, where present:

1. Currency identifier.
2. Currency name and code.
3. Bank buy price.
4. Bank sell price.
5. Spot or remittance buy/sell prices.
6. Cash buy/sell prices.
7. Publication date and time.
8. Quotation unit.
9. Quotation direction.
10. Legitimately missing or optional fields.
11. Reference, middle, or benchmark fields and their verified meanings.

Explicitly determine whether prices represent, for example:

```text
CNY / 1 foreign currency
CNY / 100 foreign currency
foreign currency → CNY
CNY → foreign currency
```

If inverse quotations exist, reliable official evidence must determine whether normalization requires a reciprocal, a bid/offer swap, a unit conversion, or some combination. Numeric plausibility alone is insufficient.

### Evidence hierarchy

Use evidence in this order:

1. Official bank runtime code together with the real upstream response.
2. Official bank pages or official documentation.
3. Actual runtime observation of the official request and response.
4. Mathematical consistency checks that do not invent semantics.
5. Inference.

Inference may guide the next investigation step, but cannot independently support production financial semantics. If a critical meaning remains inference-only, stop under the applicable STOP CONDITION.

## Network, TLS, and timeout handling

Resolve ordinary bank-specific issues such as encoding, HTML parsing, JSON/XML parsing, external JavaScript tracing, and bounded timeouts within the spike.

If an actual request fails with `UNSAFE_LEGACY_RENEGOTIATION_DISABLED`, a spike may try a request-local context using:

```python
ssl_context = ssl.create_default_context()
ssl_context.options |= ssl.OP_LEGACY_SERVER_CONNECT
```

Only use this when the runtime error was observed and the Python runtime exposes the option. Preserve certificate and hostname verification. Do not use:

```text
verify=False
ssl.CERT_NONE
check_hostname=False
system-wide OpenSSL downgrades
```

Do not copy legacy TLS handling to banks that have not demonstrated the problem. A timeout may receive a small, bounded retry with clear attempt reporting; never retry indefinitely or at high frequency.

## Phase 6 — Promote a real response to a fixture

After the source and critical financial semantics are confirmed, copy one real, successful official upstream response from the spike area into:

```text
backend/tests/exchange_rate/fixtures/
```

Requirements:

- Preserve the real upstream structure and values.
- Do not edit official data merely to simplify a test.
- Tests must use the tracked fixture, not the ignored raw response.
- The fixture must contain no secret or personal data.
- Parser tests must remain offline.

Record the fixture's source URL, capture method, and observed response format in the final report.

## Phase 7 — Implement the formal parser

Only after the previous gates succeed, create:

```text
backend/app/exchange_rate/banks/<bank>.py
```

The parser must:

- operate offline and make no HTTP requests
- contain no TLS, retry, cookie, token, or other network-client logic
- transform raw upstream data into a bank-specific structured rate type
- raise a clear `ValueError` for malformed structures or invalid prices
- represent legitimate missing values as `None` when semantically appropriate
- avoid silently discarding unknown currencies without a verified reason
- preserve the complete publication timestamp when available
- normalize prices to the project unit, `CNY / 1 foreign currency`, using only verified bank-specific semantics
- parse all valid currencies supplied by the official response where practical, rather than only current product targets

Product-level currency filtering belongs above the parser. Do not introduce a unified `BankExchangeRate` model as part of a bank adapter task.

## Current v1 target currencies

The current product targets are:

```text
USD CAD EUR GBP CHF AUD NZD JPY KRW HKD MOP TWD SGD MYR
```

This list is a product target, not a parser allowlist. A bank may legitimately omit some currencies. Where official data supports the distinction, report target currencies as:

- active
- missing
- stale or questionable

Do not classify a currency as active merely because a record exists.

## Phase 8 — Add focused offline tests

Create:

```text
backend/tests/exchange_rate/test_<bank>_parser.py
```

Design tests from the real fixture and verified semantics. Relevant coverage commonly includes:

- fixture parsing and record count
- several real currencies such as AUD, USD, and EUR when present
- bank buy and sell fields
- spot/remittance and cash differences when present
- publication timestamp
- verified unit normalization
- malformed responses and invalid structures
- invalid and legitimately missing price values
- unknown-currency behaviour
- direct/inverse quotation logic only when applicable

Do not target a ceremonial test count. Protect the behaviour that the upstream evidence established.

## Phase 9 — Validate and regress

Run focused tests while implementing. After the adapter is complete, run the full backend regression with the repository virtual environment:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests -v
```

If a test fails because of the new bank-specific work, inspect the evidence, fix the defect, and rerun. A first test failure is not by itself a reason to stop.

## Autonomous continuation

When a task explicitly says to autonomously complete a bank adapter using this workflow, continue through:

```text
inspect
→ locate official source
→ spike
→ trace evidence
→ run request
→ confirm semantics
→ capture raw response
→ create fixture
→ implement parser
→ test
→ inspect and fix
→ regress
→ report
```

Do not stop merely because one intermediate artifact has been completed, including finding a page, creating a probe, locating JavaScript, finding an endpoint, saving a response, writing a parser, or seeing an initial test failure. Continue while the next step is clear, authorized, technically and legally appropriate, and no STOP CONDITION applies.

## STOP CONDITIONS

Stop and report the evidence and exact blocker when any of these applies:

1. Login is required.
2. A CAPTCHA is required.
3. An explicit bot or WAF challenge blocks access.
4. A 403 or 429 persists after reasonable, low-frequency verification.
5. Authentication bypass is required.
6. Signature or token bypass is required.
7. Access-control circumvention is required.
8. A reliable official source cannot be found.
9. Critical financial semantics cannot be confirmed from reliable evidence.
10. A new third-party dependency is required but not authorized.
11. Public or shared backend architecture must change.
12. Existing bank adapter behaviour outside the target bank must change.
13. FastAPI, a database, or a common exchange-rate model is required to continue.
14. The source appears legally or technically inappropriate for automated access.

Do not bypass access controls. `STOPPED` is a valid workflow outcome that identifies a boundary requiring human direction; it is not a failed attempt to conceal or work around the blocker.

## Completion criteria

When no STOP CONDITION applies, complete the adapter through all applicable criteria:

- [ ] Official source confirmed.
- [ ] Runtime upstream request verified.
- [ ] Financial semantics confirmed.
- [ ] Raw response captured in the ignored spike area.
- [ ] Real response promoted to a tracked fixture.
- [ ] Offline bank-specific parser implemented.
- [ ] Focused tests passed.
- [ ] Full backend regression passed.
- [ ] Workspace left uncommitted for review unless the task explicitly requested a commit.

## Final report

Report in one consolidated handoff:

1. **Status:** `COMPLETED` or `STOPPED`.
2. Official resources investigated.
3. Final upstream data source.
4. Evidence chain, for example `HTML → JavaScript → API/XML`.
5. Actual runtime HTTP result.
6. Network, TLS, encoding, timeout, or retry issues.
7. Response format and record count.
8. Verified financial field mapping.
9. Quotation unit and direction.
10. Spot/remittance and cash differences.
11. Reference or benchmark fields retained as bank-specific.
12. V1 target currencies: supported, missing, stale, or questionable where knowable.
13. Files created, modified, moved, or deleted.
14. Fixture provenance.
15. Parser design and validation behaviour.
16. Tests added.
17. Full regression command and actual result.
18. Remaining uncertainties and risks.
19. `git diff --stat`.
20. `git status --short`.
21. Confirmation that no commit or push was performed unless explicitly requested.
