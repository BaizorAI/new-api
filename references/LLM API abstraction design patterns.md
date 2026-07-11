# LLM API Abstraction Design Patterns

This document outlines the recommended approach for building an abstraction layer over multiple LLM providers in the AI API gateway/proxy.

## Core Abstractions

An LLM API abstraction should provide a unified interface that hides provider-specific details from the rest of the application. The key abstractions to define are:

1. **Messages**: Define a common message type (system, user, assistant) that maps to each provider's specific format.
2. **Types**: A set of generic types that encompass all provider features (e.g., tool calls, image generation).
3. **Streaming**: A unified stream interface for real-time responses.

## Provider Adapter

The strategy pattern is the recommended approach for handling multiple providers:

- Create a `Provider` interface that defines the core operations (e.g., `Send`, `Stream`).
- Implement this interface for each provider (OpenAI, Anthropic, etc.).

This allows new providers to be added without modifying existing code. The adapter pattern is particularly effective here because it:
- Isolates provider-specific logic.
- Enables testing of the adapter in isolation.
- Simplifies adding new providers.

## Request/Response Normalization

A critical part of any LLM API abstraction is normalizing requests and responses across providers:

1. Define a standard request/response structure.
2. Convert provider-specific formats to/from this structure.
3. Ensure all internal code works with the standardized format.

This approach simplifies adding new providers because they only need to implement the conversion logic, not modify the entire pipeline.

## Error Handling and Retries

LLM APIs can fail for a variety of reasons (rate limits, timeouts, invalid requests). A robust abstraction should:

1. Define clear error types.
2. Implement retry logic with exponential backoff for transient errors.
3. Handle provider-specific errors appropriately.

## Configuration and Routing

The abstraction layer should be configurable at runtime:

- Use a configuration file or service to manage provider settings.
- Route requests based on the model name (e.g., "gpt-4" → OpenAI, "claude" → Anthropic).

This allows dynamic switching between providers without code changes.

## Extending with New Providers

Adding new providers should be as simple as:

1. Implementing the `Provider` interface.
2. Adding a route in the router.
3. (Optionally) Writing tests.

The abstraction should not require modifications to existing provider implementations or the core application logic.

## Performance Considerations

- Use connection pooling for HTTP clients.
- Cache frequently used data (e.g., model metadata).
- Process requests asynchronously where possible.

## Security and Auth

- Store credentials securely (e.g., secrets manager, encrypted config).
- Rotate keys automatically.
- Validate all inputs before sending to providers.

## Observability

- Log all requests/responses (with sensitive data masked).
- Trace requests through the system.
- Monitor provider-specific metrics (latency, error rates).

## Example Code Snippet

```go
type Provider interface {
    Send(ctx context.Context, req *Request) (*Response, error)
    Stream(ctx context.Context, req *Request) (<-chan *Chunk, error)
}

type Router struct {
    providers map[string]Provider
}

func (r *Router) Route(model string, req *Request) (*Response, error) {
    provider := r.providers[model]
    if provider == nil {
        return nil, fmt.Errorf("unknown model: %s", model)
    }
    return provider.Send(req.Context(), req)
}
```

## Common Pitfalls

- **Over-engineering**: Keep the abstraction simple. Don't try to support every possible feature.
- **Ignoring edge cases**: Handle all error conditions gracefully.
- **Poor performance**: Use connection pooling and caching where appropriate.
- **Security issues**: Always validate inputs and store credentials securely.

## Conclusion

A well-designed LLM API abstraction layer will make your application more flexible, maintainable, and easier to extend. By following the patterns outlined above, you can build a robust system that scales with your needs.

### Sources

[LLM API Abstraction Design Patterns](https://www.sohamkamani.com/blog/2025-10-16-abstractions/)
[Building an LLM API Proxy in Go](https://www.gorillamux.com/post/2024-05-12-llm-proxy/)