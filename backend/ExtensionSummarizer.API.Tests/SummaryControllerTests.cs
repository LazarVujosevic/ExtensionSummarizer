using Microsoft.AspNetCore.Mvc;
using Moq;
using ExtensionSummarizer.API.Controllers;
using ExtensionSummarizer.API.Models;
using ExtensionSummarizer.API.Services;

namespace ExtensionSummarizer.API.Tests;

public class SummaryControllerTests
{
    private readonly Mock<ISummaryService> _serviceMock;
    private readonly SummaryController _controller;

    public SummaryControllerTests()
    {
        _serviceMock = new Mock<ISummaryService>();
        _controller = new SummaryController(_serviceMock.Object);
    }

    // -------------------------------------------------------------------------
    // Input validation — BadRequest cases
    // -------------------------------------------------------------------------

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t")]
    [InlineData("\n")]
    public async Task Summarize_WhenTextIsNullOrWhitespace_ReturnsBadRequest(string text)
    {
        var request = new SummaryRequest { Text = text };

        var result = await _controller.Summarize(request);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t")]
    [InlineData("\n")]
    public async Task Summarize_WhenTextIsInvalid_DoesNotCallService(string text)
    {
        var request = new SummaryRequest { Text = text };

        await _controller.Summarize(request);

        _serviceMock.Verify(s => s.SummarizeAsync(It.IsAny<SummaryRequest>()), Times.Never);
    }

    // -------------------------------------------------------------------------
    // Happy path — valid request
    // -------------------------------------------------------------------------

    [Fact]
    public async Task Summarize_WhenTextIsValid_ReturnsOk()
    {
        _serviceMock
            .Setup(s => s.SummarizeAsync(It.IsAny<SummaryRequest>()))
            .ReturnsAsync(new SummaryResponse { Summary = "Test summary." });

        var result = await _controller.Summarize(new SummaryRequest { Text = "Valid article text." });

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task Summarize_WhenTextIsValid_CallsServiceExactlyOnce()
    {
        _serviceMock
            .Setup(s => s.SummarizeAsync(It.IsAny<SummaryRequest>()))
            .ReturnsAsync(new SummaryResponse());

        await _controller.Summarize(new SummaryRequest { Text = "Article text." });

        _serviceMock.Verify(s => s.SummarizeAsync(It.IsAny<SummaryRequest>()), Times.Once);
    }

    [Fact]
    public async Task Summarize_WhenTextIsValid_ReturnsExactServiceResponse()
    {
        var expected = new SummaryResponse
        {
            Summary = "Ovo je primer summary-ja na srpskom.",
            WordCount = 320,
            ProcessingTimeMs = 4800
        };

        _serviceMock
            .Setup(s => s.SummarizeAsync(It.IsAny<SummaryRequest>()))
            .ReturnsAsync(expected);

        var result = await _controller.Summarize(new SummaryRequest { Text = "Some article text." });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<SummaryResponse>(ok.Value);
        Assert.Equal(expected.Summary, response.Summary);
        Assert.Equal(expected.WordCount, response.WordCount);
        Assert.Equal(expected.ProcessingTimeMs, response.ProcessingTimeMs);
    }

    [Fact]
    public async Task Summarize_PassesFullRequestToService()
    {
        var request = new SummaryRequest
        {
            Url = "https://www.rts.rs/vest/123",
            Text = "Tekst vesti sa RTS-a."
        };

        _serviceMock
            .Setup(s => s.SummarizeAsync(It.IsAny<SummaryRequest>()))
            .ReturnsAsync(new SummaryResponse());

        await _controller.Summarize(request);

        _serviceMock.Verify(s => s.SummarizeAsync(
            It.Is<SummaryRequest>(r =>
                r.Url == request.Url &&
                r.Text == request.Text)),
            Times.Once);
    }

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------

    [Fact]
    public async Task Summarize_WhenTextIsSingleWord_ReturnsOk()
    {
        _serviceMock
            .Setup(s => s.SummarizeAsync(It.IsAny<SummaryRequest>()))
            .ReturnsAsync(new SummaryResponse { Summary = "Summary.", WordCount = 1 });

        var result = await _controller.Summarize(new SummaryRequest { Text = "Vest" });

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task Summarize_WhenUrlIsEmpty_StillCallsService()
    {
        _serviceMock
            .Setup(s => s.SummarizeAsync(It.IsAny<SummaryRequest>()))
            .ReturnsAsync(new SummaryResponse());

        await _controller.Summarize(new SummaryRequest { Text = "Article text.", Url = "" });

        _serviceMock.Verify(s => s.SummarizeAsync(It.IsAny<SummaryRequest>()), Times.Once);
    }
}
