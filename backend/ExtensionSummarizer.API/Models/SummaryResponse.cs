namespace ExtensionSummarizer.API.Models;

public class SummaryResponse
{
    public string Summary { get; set; } = string.Empty;
    public int WordCount { get; set; }
    public int ProcessingTimeMs { get; set; }
}
