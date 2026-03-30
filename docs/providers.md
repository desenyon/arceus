# Provider Integration

Arceus routes all model calls through a common adapter interface.

## Included adapters

- OpenAI
- Anthropic
- local OpenAI-compatible endpoint
- mock provider for offline development and tests

## Common request shape

Each adapter receives:

- model profile
- task mode
- system prompt
- user prompt
- repo context
- desired output format

Each adapter returns:

- provider metadata
- normalized text
- optional structured payload
- token metadata when available
- normalized error shape on failure

## Adding providers

New providers only need to implement the shared adapter interface and register themselves with the provider registry. The rest of Arceus remains provider-agnostic.
