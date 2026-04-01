using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using ExtensionSummarizer.API.Models;
using System.Diagnostics;

namespace ExtensionSummarizer.API.Services;

public class SummaryService(IConfiguration configuration) : ISummaryService
{
    private const string SystemPrompt = """
        You are a news summarization assistant.
        Always respond in Serbian language, using Latin script.
        Use Serbian ekavica dialect only (never ijekavica). Examples: write 'rečenica' not 'rječenica', 'deca' not 'djeca', 'gde' not 'gdje'.
        Always write exactly 3 sentences.
        Keep all foreign personal names and brand names in their original spelling — do not transliterate them.
        Return only the summary, no additional text or commentary.
        """;

    // Few-shot example: demonstrates the expected 3-sentence ekavica output format.
    // Showing the model a concrete input/output pair is more reliable than instructions alone
    // for enforcing structural constraints like sentence count.
    private const string FewShotExampleInput = """
        Summarize this news article:

        London, March 30, 2026 — The Bank of England raised interest rates by 0.25% today, bringing them to 5.5%.
        Governor Andrew Bailey said the decision was driven by persistent inflation.
        Markets reacted negatively, with the FTSE 100 falling 1.2% after the announcement.
        """;

    private const string FewShotExampleOutput =
        "Banka Engleske je danas podigla kamatne stope za 0,25 procentnih poena, na ukupno 5,5 procenata. " +
        "Guverner Andrew Bailey saopštio je da je odluka doneta zbog uporne inflacije. " +
        "Tržišta su negativno reagovala — indeks FTSE 100 pao je za 1,2 procenta nakon objave.";

    public async Task<SummaryResponse> SummarizeAsync(SummaryRequest request)
    {
        var ollamaUrl = configuration["Ollama:BaseUrl"] ?? "http://localhost:11434";
        var model = configuration["Ollama:Model"] ?? "llama3.1";

        // Ollama exposes an OpenAI-compatible API at /v1
        var kernel = Kernel.CreateBuilder()
            .AddOpenAIChatCompletion(
                modelId: model,
                apiKey: "ollama",
                endpoint: new Uri($"{ollamaUrl}/v1"))
            .Build();

        var chatService = kernel.GetRequiredService<IChatCompletionService>();

        var history = new ChatHistory();
        history.AddSystemMessage(SystemPrompt);
        history.AddUserMessage(FewShotExampleInput);
        history.AddAssistantMessage(FewShotExampleOutput);
        history.AddUserMessage($"Summarize this news article:\n\n{request.Text}");

        var settings = new OpenAIPromptExecutionSettings
        {
            Temperature = 0.3,
            MaxTokens = 300
        };

        var stopwatch = Stopwatch.StartNew();
        var result = await chatService.GetChatMessageContentAsync(history, settings);
        stopwatch.Stop();

        return new SummaryResponse
        {
            Summary = result.Content ?? string.Empty,
            WordCount = request.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length,
            ProcessingTimeMs = (int)stopwatch.ElapsedMilliseconds
        };
    }
}
