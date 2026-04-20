using ExtensionSummarizer.API.Models;

namespace ExtensionSummarizer.API.Services;

public interface ISummaryService
{
    Task<SummaryResponse> SummarizeAsync(SummaryRequest request);
    IAsyncEnumerable<string> SummarizeStreamAsync(SummaryRequest request, CancellationToken cancellationToken = default);
}
