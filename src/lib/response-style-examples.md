# Response Style Service - Usage Examples

The Response Style Service allows AI agents to respond in different tones and styles, making interactions more personalized and context-appropriate.

## Available Styles

1. **blunt** - Direct, no-nonsense responses. Gets straight to the point.
2. **excited** - Enthusiastic and energetic. Uses emojis and positive language.
3. **strict** - Formal and authoritative. Emphasizes compliance and rules.
4. **friendly** - Warm and approachable. Conversational tone with helpful attitude.
5. **professional** - Business-like and formal. Suitable for corporate environments.
6. **casual** - Relaxed and informal. Like talking to a colleague.
7. **technical** - Technical and precise. Focuses on specifications and details.
8. **encouraging** - Supportive and motivating. Builds confidence.
9. **concise** - Minimal and brief. Only essential information.
10. **detailed** - Comprehensive and thorough. Includes extensive context.

## Usage Examples

### Basic Usage

```typescript
import { responseStyleService } from './response-style-service';
import { deepContextAgent } from './deep-context-agent';

// Get context with a specific style
const response = await deepContextAgent.getFormattedContext(
  'How do I add authentication?',
  './my-project',
  'excited', // Style
  {
    useEmojis: true,
    includeExamples: true,
  }
);
```

### Using with Deep Context Agent

```typescript
import { deepContextAgent } from './deep-context-agent';
import { responseStyleService, StyleConfig } from './response-style-service';

// Configure style
const styleConfig: StyleConfig = {
  style: 'strict',
  useEmojis: false,
  maxLength: 2000,
  includeExamples: true,
};

// Get styled response
const response = await deepContextAgent.getContext(
  'What patterns should I use?',
  './my-project',
  styleConfig
);

if (response.styled) {
  console.log(response.styled.formatted);
}
```

### Direct Service Usage

```typescript
import { responseStyleService } from './response-style-service';

// Format a response
const styled = responseStyleService.formatResponse(
  {
    query: 'How do I structure my API?',
    understanding: {
      architecture: 'This is a REST API using Express.js',
      patterns: ['MVC', 'Middleware'],
      conventions: ['Use camelCase for variables'],
    },
    recommendations: [
      {
        type: 'pattern',
        message: 'Use the existing MVC pattern',
        context: 'This matches your codebase structure',
      },
    ],
    suggestions: ['Consider adding error handling middleware'],
  },
  {
    style: 'friendly',
    useEmojis: true,
    includeExamples: true,
  }
);

console.log(styled.formatted);
```

### Format Simple Messages

```typescript
import { responseStyleService } from './response-style-service';

// Format a simple message
const message = responseStyleService.formatMessage(
  'Your code looks great!',
  'excited',
  true // useEmojis
);
// Output: "🎉 Your code looks great! 🚀"
```

### Get Available Styles

```typescript
import { responseStyleService } from './response-style-service';

// Get all available styles
const styles = responseStyleService.getAvailableStyles();
// ['blunt', 'excited', 'strict', 'friendly', ...]

// Get style description
const description = responseStyleService.getStyleDescription('blunt');
// "Direct, no-nonsense responses. Gets straight to the point."
```

## MCP Server Usage

When using the MCP server, you can specify the style in the tool call:

```json
{
  "name": "get_deep_context",
  "arguments": {
    "query": "How do I add authentication?",
    "style": "excited",
    "useEmojis": true,
    "includeExamples": true
  }
}
```

## Style Comparison Examples

### Same Query, Different Styles

**Query:** "How do I add a new API endpoint?"

**Blunt Style:**
```
Here's what you need to know about "How do I add a new API endpoint?":

## Understanding
This is a REST API using Express.js

## Recommendations
- Use the existing MVC pattern
```

**Excited Style:**
```
🎉 Awesome! Let's dive into "How do I add a new API endpoint?"! 🚀

## ✨ Understanding ✨
This is a REST API using Express.js

## ✨ Recommendations ✨
🎯 Use the existing MVC pattern

🎊 You've got this! Happy coding! 🎊
```

**Strict Style:**
```
Analysis of: "How do I add a new API endpoint?"

Follow these guidelines precisely:

## UNDERSTANDING
This is a REST API using Express.js

## RECOMMENDATIONS
✓ MANDATORY: Use the existing MVC pattern

Ensure compliance with all recommendations above.
```

**Friendly Style:**
```
Hey! 👋 Let me help you with "How do I add a new API endpoint?"!

## Understanding
This is a REST API using Express.js

## Recommendations
💬 Use the existing MVC pattern

Hope that helps! Feel free to ask if you need anything else! 😊
```

## Best Practices

1. **Choose style based on context:**
   - Use `professional` for corporate/enterprise projects
   - Use `friendly` for open-source or community projects
   - Use `strict` when compliance is critical
   - Use `excited` for motivational or learning contexts

2. **Emoji usage:**
   - Enable emojis for casual, friendly, or excited styles
   - Disable emojis for professional or strict contexts

3. **Length control:**
   - Use `concise` for quick answers
   - Use `detailed` for comprehensive explanations
   - Set `maxLength` to limit response size if needed

4. **Examples:**
   - Enable `includeExamples` when showing code patterns
   - Disable for brief overviews

