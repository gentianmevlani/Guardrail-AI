# Advanced MDC Generator

A comprehensive codebase documentation system that generates Markdown Context (MDC) files by analyzing codebase structure, patterns, and relationships.

## Features

- **AST-based Analysis**: Uses TypeScript compiler API for accurate code parsing
- **Pattern Detection**: Identifies common architectural patterns (Repository, Service, Factory, etc.)
- **Relationship Mapping**: Analyzes component dependencies and relationships
- **Importance Scoring**: Ranks components by importance based on usage and complexity
- **Code Examples**: Extracts relevant code snippets for documentation
- **Multiple Categories**: Organizes components into architecture, security, data-flow, etc.

## Usage

```bash
# Generate MDC files for current project
npm run generate-mdc

# Generate for specific directory
npm run generate-mdc /path/to/project

# Output will be in .specs/ directory by default
```

## Output

The generator creates:
- Individual `.mdc` files for each category
- `specifications.json` index file
- Source-anchored documentation with line numbers

## Categories

- **Architecture**: Core system architecture and structural components
- **Security**: Authentication, authorization, and security mechanisms
- **Data Flow**: Data processing and flow components
- **Design System**: UI components and design tokens
- **Integration**: API integrations and external services
- **Algorithm**: Core algorithms and processing logic
- **Utility**: Helper functions and utilities

## Configuration

Options can be passed to customize generation:
- `outputDir`: Output directory (default: `.specs`)
- `includeExamples`: Include code examples (default: true)
- `minImportanceScore`: Minimum importance threshold (default: 70)
- `useASTParsing`: Use TypeScript AST parsing (default: true)
- `categories`: Specific categories to generate

## Generated Format

Each MDC file includes:
- Frontmatter with metadata
- Component list with importance scores
- Detected patterns
- Relationship mappings
- Code examples
- Source verification information
