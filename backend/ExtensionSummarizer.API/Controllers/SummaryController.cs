using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http.Features;
using ExtensionSummarizer.API.Models;
using ExtensionSummarizer.API.Services;
using System.Text.Json;
using System.Diagnostics;

namespace ExtensionSummarizer.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SummaryController(ISummaryService summaryService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<SummaryResponse>> Summarize([FromBody] SummaryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest("Text is required.");

        var result = await summaryService.SummarizeAsync(request);
        return Ok(result);
    }

    [HttpPost("stream")]
    public async Task SummarizeStream([FromBody] SummaryRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            Response.StatusCode = 400;
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        // Kestrel buffers the response body by default — disable it so each
        // FlushAsync actually sends data to the client immediately.
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        var wordCount = request.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        var stopwatch = Stopwatch.StartNew();

        try
        {
            // Send an SSE comment first. This flushes the response headers to the
            // client immediately, so the browser knows the connection is open.
            await Response.WriteAsync(": connected\n\n", cancellationToken);
            await Response.BodyWriter.FlushAsync(cancellationToken);

            await foreach (var token in summaryService.SummarizeStreamAsync(request, cancellationToken))
            {
                var tokenEvent = JsonSerializer.Serialize(new { type = "token", content = token });
                await Response.WriteAsync($"data: {tokenEvent}\n\n", cancellationToken);
                await Response.BodyWriter.FlushAsync(cancellationToken);
            }

            stopwatch.Stop();
            var doneEvent = JsonSerializer.Serialize(new { type = "done", wordCount, processingTimeMs = (int)stopwatch.ElapsedMilliseconds });
            await Response.WriteAsync($"data: {doneEvent}\n\n", cancellationToken);
            await Response.BodyWriter.FlushAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // Client disconnected before the stream completed — expected, not an error.
        }
    }
}
