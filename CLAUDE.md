# ExtensionSummarizer — Claude Context

## Meta
After every session that ends with a commit/push, update this file with any new knowledge:
- completed work and current phase status
- decisions made and why
- anything that would be useful context for the next session

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
- Do NOT explain .NET, Docker, Git, or general dev concepts — user knows these
- DO explain AI concepts in detail — that is the learning goal
- Never commit or push without explicit user instruction
- Do not add files, refactors, comments, or features that were not asked for

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

---

## Development Phases
| Phase | Status | Description |
|---|---|---|
| 1 — AI Core | ✅ | Docker Compose + Ollama + ASP.NET API + Semantic Kernel |
| 2 — Extension | 🔜 | Readability.js integration + React UI polish |
| 3 — Integration | 🔜 | End-to-end test, error handling |
| 4 — Production | 🔜 | VPS deploy + Chrome Web Store (optional) |
