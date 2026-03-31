# ExtensionSummarizer — Claude Context

## Meta
After every session that ends with a commit/push, update this file with any new knowledge:
- completed work and current phase status
- decisions made and why
- anything that would be useful context for the next session

## Sprint Workflow
- Each ticket = separate session; user works, Claude assists
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
- Never commit or push without explicit user instruction
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
│   └── ExtensionSummarizer.API/
│       ├── Controllers/SummaryController.cs
│       ├── Services/ISummaryService.cs + SummaryService.cs
│       ├── Models/SummaryRequest.cs + SummaryResponse.cs
│       ├── Properties/launchSettings.json
│       ├── appsettings.json
│       ├── Program.cs
│       └── ExtensionSummarizer.API.csproj
└── extension/
    ├── manifest.json
    ├── package.json + tsconfig.json + vite.config.ts
    └── src/
        ├── popup/popup.html + main.tsx + Popup.tsx
        ├── content/content.ts
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

### Known model quality issues (observed in testing, to be addressed in Phase 3)
- Llama 3.1 mixes ekavica and ijekavica in the same response — system prompt needs explicit dialect instruction, e.g. `Use Serbian ekavica dialect only (never ijekavica)`
- Without a strict prompt, model may ignore the 3-sentence constraint — few-shot examples planned
- Model transliterates foreign names phonetically (e.g. "Džeims Okafor") — consider instructing it to keep names in original form

---

## Technical Decisions & Known Issues

- **SKEXP0010 suppressed** in `.csproj` — `AddOpenAIChatCompletion` with custom endpoint is a Semantic Kernel experimental API (SKEXP = Semantic Kernel EXPerimental). It works reliably; suppression is the standard SK pattern. Revisit if SK releases a stable connector for Ollama.
- **Ollama health check uses `ollama list`** — `curl` is not available in the Ollama Docker image. `ollama list` connects to the local server and succeeds only when it is ready, making it a reliable health check.
- **`ollama-init` has no `sleep`** — replaced with `depends_on: condition: service_healthy` so Docker Compose waits for Ollama to be truly ready before pulling the model.

---

## Development Phases
| Phase | Status | Description |
|---|---|---|
| 1 — AI Core | ✅ | Docker Compose + Ollama + ASP.NET API + Semantic Kernel |
| 2 — Extension | 🔜 | Readability.js integration + React UI polish |
| 3 — Integration | 🔜 | End-to-end test, error handling |
| 4 — Production | 🔜 | VPS deploy + Chrome Web Store (optional) |
