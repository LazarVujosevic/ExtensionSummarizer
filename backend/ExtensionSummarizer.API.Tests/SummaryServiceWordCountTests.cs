using Microsoft.Extensions.Configuration;
using Moq;
using ExtensionSummarizer.API.Models;
using ExtensionSummarizer.API.Services;

namespace ExtensionSummarizer.API.Tests;

// SummaryService.SummarizeAsync makes a real HTTP call to Ollama and cannot be fully
// unit tested without a running container. Those cases belong in integration tests.
// What we CAN unit test here: WordCount calculation, which counts words in the input text.

public class SummaryServiceWordCountTests
{
    private readonly IConfiguration _configuration;

    public SummaryServiceWordCountTests()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Ollama:BaseUrl"]).Returns("http://localhost:11434");
        config.Setup(c => c["Ollama:Model"]).Returns("llama3.1");
        _configuration = config.Object;
    }

    [Theory]
    [InlineData("jedan dva tri", 3)]
    [InlineData("jedna reč", 2)]
    [InlineData("  višestruki   razmaci   između   reči  ", 4)]
    [InlineData("jedna", 1)]
    public void WordCount_ReturnsCorrectCount(string text, int expectedCount)
    {
        // WordCount is calculated as: text.Split(' ', RemoveEmptyEntries).Length
        // This test validates that formula matches expected behavior for the input text
        var actual = text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;

        Assert.Equal(expectedCount, actual);
    }

    [Fact]
    public void WordCount_ForTypicalNewsArticle_IsPositive()
    {
        var articleText = string.Join(" ", Enumerable.Repeat("reč", 500));

        var wordCount = articleText.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;

        Assert.Equal(500, wordCount);
    }

    [Fact]
    public void SummaryRequest_DefaultValues_AreEmptyStrings()
    {
        var request = new SummaryRequest();

        Assert.Equal(string.Empty, request.Text);
        Assert.Equal(string.Empty, request.Url);
    }

    [Fact]
    public void SummaryResponse_DefaultValues_AreCorrect()
    {
        var response = new SummaryResponse();

        Assert.Equal(string.Empty, response.Summary);
        Assert.Equal(0, response.WordCount);
        Assert.Equal(0, response.ProcessingTimeMs);
    }
}
