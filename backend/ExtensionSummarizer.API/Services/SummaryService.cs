using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using ExtensionSummarizer.API.Models;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

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
        var apiKey = configuration["Gemini:ApiKey"] ?? throw new InvalidOperationException("Gemini:ApiKey is not configured.");
        var model = configuration["Gemini:Model"] ?? "gemini-2.0-flash";

        // Gemini exposes an OpenAI-compatible API at this endpoint
        var kernel = Kernel.CreateBuilder()
            .AddOpenAIChatCompletion(
                modelId: model,
                apiKey: apiKey,
                endpoint: new Uri("https://generativelanguage.googleapis.com/v1beta/openai/"))
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

    public async IAsyncEnumerable<string> SummarizeStreamAsync(
        SummaryRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var apiKey = configuration["Gemini:ApiKey"] ?? throw new InvalidOperationException("Gemini:ApiKey is not configured.");
        var model = configuration["Gemini:Model"] ?? "gemini-2.0-flash";

        var messages = new object[]
        {
            new { role = "system",    content = SystemPrompt },
            new { role = "user",      content = FewShotExampleInput },
            new { role = "assistant", content = FewShotExampleOutput },
            new { role = "user",      content = $"Summarize this news article:\n\n{request.Text}" }
        };

        var body = JsonSerializer.Serialize(new
        {
            model,
            messages,
            stream = true,
            temperature = 0.3,
            max_tokens = 300
        });

        using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };
        using var httpRequest = new HttpRequestMessage(
            HttpMethod.Post,
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        httpRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

        // ResponseHeadersRead returns as soon as the first header byte arrives,
        // allowing us to read the response body as a stream token by token.
        using var response = await client.SendAsync(
            httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        // ReadLineAsync returns null when the stream is closed — the async-safe
        // alternative to checking EndOfStream, which would block the thread.
        string? line;
        while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
        {
            if (string.IsNullOrWhiteSpace(line) || !line.StartsWith("data: ")) continue;

            var data = line["data: ".Length..];
            if (data == "[DONE]") yield break;

            JsonDocument doc;
            try { doc = JsonDocument.Parse(data); }
            catch { continue; }

            using (doc)
            {
                if (doc.RootElement.TryGetProperty("choices", out var choices) &&
                    choices.GetArrayLength() > 0 &&
                    choices[0].TryGetProperty("delta", out var delta) &&
                    delta.TryGetProperty("content", out var content))
                {
                    var text = content.GetString();
                    if (!string.IsNullOrEmpty(text))
                        yield return text;
                }
            }
        }
    }
}
