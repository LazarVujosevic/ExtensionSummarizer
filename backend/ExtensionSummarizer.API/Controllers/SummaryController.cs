using Microsoft.AspNetCore.Mvc;
using ExtensionSummarizer.API.Models;
using ExtensionSummarizer.API.Services;

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
}
