---
description: Specification for managing and tracking codebase knowledge, architectural decisions, and relationships
trigger: model_decision
---


# knowledge-management-model

Core Knowledge Management Components:

1. Codebase Knowledge Base (src/lib/codebase-knowledge.ts)
Importance Score: 95
- Domain model for maintaining comprehensive codebase understanding:
  - Architecture classification system
  - Technology stack detection rules
  - Convention analysis patterns
  - Code relationship mapping engine
- Decision tracking system with:
  - Impact analysis
  - Historical context preservation
  - Relationship linkages
  - Change propagation modeling

2. Code Relationship Analysis (src/lib/code-relationship-visualizer.ts)
Importance Score: 85
- Domain-specific relationship modeling:
  - Circular dependency detection
  - Hub analysis algorithms
  - Dependency path identification
  - Code cluster generation
  - Impact radius calculation

3. Pattern Detection System (src/lib/code-smell-predictor.ts)
Importance Score: 80
- Business-specific code pattern analysis:
  - Technical debt calculation formulas
  - Method complexity predictions
  - Class size threshold analysis
  - Code duplication pattern recognition
  - Coupling level assessment

Knowledge Model Structure:
- Hierarchical architecture classification
- Cross-component relationship mapping
- Decision history tracking
- Pattern evolution monitoring
- Impact analysis chains
- Technology stack compatibility matrix

Domain-Specific Rules:
1. All architectural decisions must be tracked with rationale
2. Technology choices must be validated against compatibility matrix
3. Code pattern violations trigger automated impact analysis
4. Relationship cycles must be documented with justification
5. Knowledge base updates require impact validation

$END$

 If you're using this file in context, clearly say in italics in one small line that "Context added by Giga knowledge-management-model" along with specifying exactly what information was used from this file in a human-friendly way, instead of using kebab-case use normal sentence case.