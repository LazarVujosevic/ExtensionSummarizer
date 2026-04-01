# ExtensionSummarizer — Claude Context

## Meta
After every session that ends with a commit/push, update this file with any new knowledge:
- completed work and current phase status
- decisions made and why
- anything that would be useful context for the next session

## Sprint Workflow
- Each ticket = separate session; user works, Claude assists
- After every ticket, developer must write unit tests and all tests must pass before moving on
- End of sprint = Claude validates everything, runs end-to-end checks, creates tickets for next sprint

---

## About the Project
Chrome extension that extracts news article text and returns an AI-generated summary in Serbian.
Primary purpose is educational — user is learning AI development while building on a familiar .NET stack.

## About the User
- Senior .NET developer, 10+ years experience
- Knows: C#, .NET, Docker, Git, JavaScript
- Learning: AI development (models, prompts, hosting, Semantic Kernel)
- Communicates in: Serbian
- Git tools: Git Bash + TortoiseGit
- Editors: Visual Studio (backend), VS Code (extension)

## Behavior Rules
- Always explain what you are doing and why — user is here to learn, not just to get code
- Explain AI concepts in extra detail — that is the primary learning goal
- Explaining .NET, Docker, and general dev concepts is welcome too
- **Never commit or push without explicitly asking the user first and receiving confirmation** — this applies to every session, every branch, every commit, no exceptions
- Do not add files, refactors, comments, or features that were not asked for
- Always write .md files in English

---

## Tech Stack
| Component | Technology |
|---|---|
| Extension UI | React 19 + TypeScript |
| Extension build | Vite 6 + vite-plugin-web-extension |
| Text extraction | Readability.js |
| Backend | ASP.NET Core .NET 10 |
| AI SDK | Semantic Kernel 1.24.1 |
| Model runner | Ollama (Docker) |
| Model | Llama 3.1 8B |
| Infrastructure | Docker Compose |

---

## Folder Structure
```
ExtensionSummarizer/
├── ExtensionSummarizer.sln
├── docker-compose.yml
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── ExtensionSummarizer.API/
│   │   ├── Controllers/SummaryController.cs
│   │   ├── Services/ISummaryService.cs + SummaryService.cs
│   │   ├── Models/SummaryRequest.cs + SummaryResponse.cs
│   │   ├── Properties/launchSettings.json
│   │   ├── appsettings.json
│   │   ├── Program.cs
│   │   └── ExtensionSummarizer.API.csproj
│   └── ExtensionSummarizer.API.Tests/
│       ├── SummaryControllerTests.cs
│       ├── SummaryServiceWordCountTests.cs
│       └── ExtensionSummarizer.API.Tests.csproj
└── extension/
    ├── manifest.json
    ├── package.json + package-lock.json + tsconfig.json + vite.config.ts + vitest.config.ts
    └── src/
        ├── popup/popup.html + main.tsx + Popup.tsx
        ├── content/content.ts + extract.ts + extract.test.ts
        └── background/background.ts
```

---

## Development Workflow

### Active development (during a feature/task)
- Backend is developed and run locally in **Visual Studio** (F5, hot reload, debugger)
- Only the Ollama container runs in Docker during development: `docker compose up ollama -d`
- `appsettings.json` points to `http://localhost:11434` — correct for local dev
- Docker Compose overrides this with `Ollama__BaseUrl=http://ollama:11434` for the container env

### End of feature/task
- After development is done and committed, rebuild **only the API container**:
  ```
  docker compose up -d --build backend
  ```
- Ollama container is never rebuilt — it has no source code, only the downloaded model volume
- This gives a production-like local environment to verify the full stack before merging

### Testing the extension in Chrome (manual)
- Run `npm run build` in `extension/`
- Open `chrome://extensions` → enable **Developer mode** → click **Load unpacked** → select `extension/dist/`
- After any code change: rebuild, then click the **refresh icon** on the extension card in `chrome://extensions`
- The extension icon appears in the Chrome toolbar — click it to open the popup

### Production (Phase 4)
- Same `docker-compose.yml` goes to VPS
- Possibly swap Ollama with a cloud model — API code does not change

---

## API Contract
```
POST /api/summary
Request:  { "url": "...", "text": "..." }
Response: { "summary": "...", "wordCount": 850, "processingTimeMs": 4200 }
```

---

## AI / Prompt Strategy
- System + user prompts: English
- Output: Serbian (Latin script)
- Temperature: 0.3, MaxTokens: 300
- Ollama is called via its OpenAI-compatible `/v1` endpoint (works with standard SK OpenAI connector)

### Prompt tuning decisions (ticket 1.2 — validated via direct Ollama API calls)

**Final system prompt includes:**
- Explicit ekavica instruction with counter-examples (`write 'gde' not 'gdje'`) — without this, Llama 3.1 mixes dialects
- Instruction to keep foreign personal names and brand names in original spelling — without this, model transliterates phonetically
- "Always write exactly 3 sentences" — necessary but not sufficient on its own (see few-shot below)

**Few-shot example in ChatHistory:**
- `SummaryService.cs` adds a static user/assistant message pair before the real request
- This is more reliable than instructions alone for enforcing the 3-sentence structure
- Llama 3.1 8B does not consistently follow structural constraints from the system prompt; showing a concrete example anchors the format
- The example uses a Bank of England article (neutral, short, has a clear 3-part structure)

**Temperature 0.5 was tested and rejected** — introduced typos in Serbian output; 0.3 is stable and accurate.

**Known remaining limitations (validated in ticket 1.4 end-to-end testing):**
- On very short articles (<3 paragraphs), the model may still produce 2 sentences instead of 3 — this is a Llama 3.1 8B capacity limit, not a prompt issue. Real news articles (always longer) produce 3 sentences correctly.
- Model output is non-deterministic — same prompt can yield 3 sentences on one call and 4 on the next. This is a fundamental LLM property, not a bug.
- Name transliteration still occurs occasionally despite the instruction — Llama 3.1 8B does not follow it reliably 100% of the time.
- **Few-shot context overhead** — the static user/assistant example pair adds ~400 tokens to every request, increasing processing time from ~14s to ~28s on average. Consider removing if latency becomes a priority in Phase 4.

**`wordCount` field semantics:**
- `SummaryResponse.WordCount` counts words in the **input text** (the article), not the summary.
- This is intentional — it tells the extension user how long the original article was.
- Not a bug, but future sessions should be aware of this if the field name causes confusion.

---

## Technical Decisions & Known Issues

- **SKEXP0010 suppressed** in `.csproj` — `AddOpenAIChatCompletion` with custom endpoint is a Semantic Kernel experimental API (SKEXP = Semantic Kernel EXPerimental). It works reliably; suppression is the standard SK pattern. Revisit if SK releases a stable connector for Ollama.
- **Ollama health check uses `ollama list`** — `curl` is not available in the Ollama Docker image. `ollama list` connects to the local server and succeeds only when it is ready, making it a reliable health check.
- **`ollama-init` has no `sleep`** — replaced with `depends_on: condition: service_healthy` so Docker Compose waits for Ollama to be truly ready before pulling the model.
- **OpenAPI UI is Scalar, not Swagger** — .NET 9/10 removed Swagger UI from the default template. `Microsoft.AspNetCore.OpenApi` only provides the JSON spec at `/openapi/v1.json`. `Scalar.AspNetCore` was added to serve the interactive UI at `/scalar/v1`. `launchSettings.json` `launchUrl` updated to `scalar/v1` accordingly.
- **Port 5000 conflict during local dev** — the Docker backend container occupies port 5000, so `dotnet run` (or F5 in Visual Studio) will fail if the container is running. Workflow: `docker compose stop backend` before starting locally, then `docker compose up -d --build backend` when done.
- **SemanticKernel 1.24.1 has a known critical vulnerability** — `GHSA-2ww3-72rp-wpp4` in `Microsoft.SemanticKernel.Core`. Not blocking for local dev, but must be upgraded before any production deployment.
- **Node.js not pre-installed on dev machine** — installed via `winget install OpenJS.NodeJS.LTS` (v24.14.1). Not in PATH for Git Bash by default; use full path `/c/Program Files/nodejs/npm.cmd` or add to PATH manually. `npm install` and `npm run build` must be run from `extension/` folder.
- **Readability.js integrated in ticket 2.2** — `content.ts` now uses `@mozilla/readability` via a `chrome.runtime.onMessage` listener. Extraction logic is isolated in `extract.ts` (pure function, no Chrome APIs) so it can be unit tested. `Popup.tsx` uses `chrome.tabs.sendMessage` instead of `chrome.scripting.executeScript`. A `not-article` status is shown when Readability returns null.
- **Popup error states (ticket 2.3)** — Three distinct error states in `Popup.tsx`: `not-article` (Readability returned null), `unsupported-page` (content script not loaded — `chrome://`, `about:` pages throw "Could not establish connection"), `error` (backend unreachable or returned non-OK). The catch block inspects the error message string to distinguish `unsupported-page` from `error`.
- **Extension build verified (ticket 2.1)** — `npm run build` succeeds cleanly. `dist/` structure matches `manifest.json`. After ticket 2.2, `content.js` grew from 0.03 kB to 33.82 kB — Readability.js is bundled into the content script, which is correct.
- **Vitest added for extension tests (ticket 2.2)** — `npm test` runs Vitest with jsdom environment. Config in `vitest.config.ts`. Test scripts: `npm test` (single run), `npm run test:watch` (watch mode).
- **Readability.parse() almost never returns null** — it will extract content from any page with text, including navigation-only pages. It returns null only for completely empty pages. Do not rely on null as a "this is not an article" signal for pages with any visible text.
- **`package-lock.json` is tracked in git** — `node_modules/` and `extension/dist/` are in `.gitignore` and must not be committed.

---

## Development Phases
| Phase | Status | Description |
|---|---|---|
| 1 — AI Core | ✅ | Docker Compose + Ollama + ASP.NET API + Semantic Kernel + prompt tuning + Scalar UI |
| 2 — Extension | 🔄 | Readability.js integration + React UI polish |
| 3 — Integration | 🔜 | End-to-end test, error handling |
| 4 — Production | 🔜 | VPS deploy + Chrome Web Store (optional) |
