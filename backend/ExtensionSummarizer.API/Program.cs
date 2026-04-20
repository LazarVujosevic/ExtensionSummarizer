using ExtensionSummarizer.API.Services;
using Scalar.AspNetCore;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddHttpClient();
builder.Services.AddScoped<ISummaryService, SummaryService>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseCors();
app.UseAuthorization();
app.MapControllers();

// Fire-and-forget warm-up: loads the model into Ollama's memory at startup
// so the first real request does not pay the cold-start penalty (~30s).
app.Lifetime.ApplicationStarted.Register(() =>
{
    _ = Task.Run(async () =>
    {
        try
        {
            var ollamaUrl = app.Configuration["Ollama:BaseUrl"] ?? "http://localhost:11434";
            var model = app.Configuration["Ollama:Model"] ?? "llama3.1";
            var body = JsonSerializer.Serialize(new
            {
                model,
                messages = new[] { new { role = "user", content = "hi" } },
                max_tokens = 1
            });
            using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(3) };
            await client.PostAsync(
                $"{ollamaUrl}/v1/chat/completions",
                new StringContent(body, Encoding.UTF8, "application/json"));
        }
        catch { /* warm-up is best-effort — never block startup */ }
    });
});

app.Run();
