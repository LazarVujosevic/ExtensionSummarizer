# ExtensionSummarizer

Chrome ekstenzija koja izvlači tekst vesti sa bilo koje stranice, šalje ga ASP.NET Core backendu, koji poziva lokalno hostovan AI model (Ollama) i vraća summary na srpskom jeziku.

Projekat je primarno edukativnog karaktera — učenje AI developmenta na poznatom .NET stacku.

---

## Arhitektura

```
┌─────────────────────────────────────────────────────┐
│                  CHROME BROWSER                      │
│                                                      │
│  ┌─────────────┐         ┌──────────────────────┐   │
│  │  News Page  │ ──────► │  Chrome Extension    │   │
│  │ (bilo koji  │ tekst   │                      │   │
│  │   sajt)     │         │  - Readability.js    │   │
│  └─────────────┘         │    (izvlači tekst)   │   │
│                          │  - React Popup UI    │   │
│                          └──────────┬───────────┘   │
└─────────────────────────────────────┼───────────────┘
                                      │ HTTP POST /api/summary
                                      ▼
┌─────────────────────────────────────────────────────┐
│              ASP.NET CORE .NET 10 BACKEND            │
│                                                      │
│  SummaryController                                   │
│    └── SummaryService (Semantic Kernel)              │
│         - gradi prompt (engleski)                    │
│         - zove Ollamu                                │
│         - vraća summary (srpski)                     │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP POST /v1/chat/completions
                       ▼
┌─────────────────────────────────────────────────────┐
│              DOCKER ENVIRONMENT                      │
│                                                      │
│  Ollama Container                                    │
│    - Llama 3.1 8B                                   │
│    - Port 11434                                     │
└─────────────────────────────────────────────────────┘
```

### Flow

1. Korisnik otvori vest → klikne ikonicu ekstenzije
2. `Popup.tsx` poziva `chrome.scripting.executeScript` → izvlači tekst stranice
3. Šalje `POST /api/summary` sa tekstom i URL-om
4. `SummaryService` gradi prompt (engleski) i zove Ollamu preko Semantic Kernel
5. Ollama (Llama 3.1 8B) vraća summary na srpskom
6. React popup prikazuje rezultat

---

## Tech Stack

| Komponenta | Tehnologija |
|---|---|
| Extension UI | React 19 + TypeScript |
| Extension build | Vite 6 + vite-plugin-web-extension |
| Ekstrakcija teksta | Readability.js (Mozilla) |
| Backend | ASP.NET Core .NET 10 |
| AI SDK | Semantic Kernel 1.24.1 |
| Model runner | Ollama (Docker) |
| Model | Llama 3.1 8B |
| Infrastruktura | Docker Compose |

---

## Folder struktura

```
ExtensionSummarizer/
├── ExtensionSummarizer.sln
├── docker-compose.yml
├── .gitignore
│
├── backend/
│   ├── Dockerfile
│   └── ExtensionSummarizer.API/
│       ├── Controllers/SummaryController.cs
│       ├── Services/
│       │   ├── ISummaryService.cs
│       │   └── SummaryService.cs
│       ├── Models/
│       │   ├── SummaryRequest.cs
│       │   └── SummaryResponse.cs
│       ├── Properties/launchSettings.json
│       ├── appsettings.json
│       ├── appsettings.Development.json
│       ├── Program.cs
│       └── ExtensionSummarizer.API.csproj
│
└── extension/
    ├── manifest.json
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── popup/
        │   ├── popup.html
        │   ├── main.tsx
        │   └── Popup.tsx
        ├── content/
        │   └── content.ts
        └── background/
            └── background.ts
```

---

## API kontrakt

```
POST /api/summary

Request:
{
  "url": "https://...",
  "text": "tekst članka..."
}

Response:
{
  "summary": "Vest govori o...",
  "wordCount": 850,
  "processingTimeMs": 4200
}
```

---

## AI — kako funkcioniše

### Model
Llama 3.1 8B — open source model od Meta. 8 milijardi parametara, ~4GB, radi na CPU-u (sporije) ili GPU-u (brže). Za summarizaciju vesti — dovoljan kvalitet.

### Prompt strategija
Promptovi i system instrukcije su na **engleskom** — model ih preciznije razume. Output je na **srpskom** — eksplicitno navedeno u system promptu.

```
SYSTEM: You are a news summarization assistant.
        Always respond in Serbian language, using Latin script.
        Summarize the article in exactly 3 clear and concise sentences.
        Focus on: who, what, when, where, why.
        Return only the summary, no additional text or commentary.

USER: Summarize this news article: [tekst]
```

### Parametri
- `temperature: 0.3` — nizak, za konzistentan i pouzdan output (ne kreativan)
- `maxTokens: 300` — dovoljno za 3 rečenice

### Ollama i OpenAI-compatible endpoint
Semantic Kernel se konektuje na Ollamin `/v1` endpoint koji je kompatibilan sa OpenAI API formatom. Prednost: isti kod radi i za OpenAI i za Ollamu — samo se menja URL i API key.

---

## Pokretanje

### Preduslovi
- Docker Desktop
- .NET 10 SDK
- Node.js 20+

### 1. Pokreni Ollamu i backend
```bash
docker compose up
```

Prilikom prvog pokretanja `ollama-init` servis automatski pull-uje `llama3.1` model (~4GB). Čuva se u Docker volumenu — naredna pokretanja su trenutna.

### 2. Pokreni backend lokalno (razvoj)
```bash
cd backend/ExtensionSummarizer.API
dotnet restore
dotnet run
```

Backend je dostupan na `http://localhost:5000`. OpenAPI na `http://localhost:5000/openapi`.

### 3. Pokreni extension (razvoj)
```bash
cd extension
npm install
npm run build
```

Učitaj u Chrome:
- Otvori `chrome://extensions`
- Uključi **Developer mode**
- Klikni **Load unpacked** → izaberi `extension/dist` folder

### Gasenje
```bash
docker compose down
```

---

## Faze razvoja

| Faza | Status | Opis |
|---|---|---|
| **1 — AI Core** | ✅ | Docker Compose + Ollama + ASP.NET API + Semantic Kernel |
| **2 — Extension** | 🔜 | Readability.js integracija + polishing React UI |
| **3 — Spajanje** | 🔜 | End-to-end test, error handling |
| **4 — Produkcija** | 🔜 | VPS deploy + Chrome Web Store *(opciono)* |

---

## Workflow

| Zadatak | Alat |
|---|---|
| Backend razvoj | Visual Studio 2022+ |
| Extension razvoj | VS Code |
| Git | Git Bash + TortoiseGit |
| Docker | Docker Desktop |
