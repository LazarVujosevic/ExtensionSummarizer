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
        Summarize the article in exactly 3 clear and concise sentences.
        Focus on: who, what, when, where, why.
        Return only the summary, no additional text or commentary.
        """;

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
