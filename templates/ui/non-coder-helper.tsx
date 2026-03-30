/**
 * Non-Coder Helper
 * 
 * Visual helpers for non-coders to communicate with AI agent
 */

import React, { useState } from 'react';
import { HelpCircle, Lightbulb, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react';
import './NonCoderHelper.css';

export interface NonCoderHelperProps {
  onSuggestionSelect: (suggestion: string) => void;
}

export const NonCoderHelper: React.FC<NonCoderHelperProps> = ({ onSuggestionSelect }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    {
      id: 'health',
      title: 'Project Health',
      icon: '💚',
      suggestions: [
        'Check if my project is healthy',
        'Show me what needs fixing',
        'Is my code ready to deploy?',
        'What errors do I have?',
      ],
    },
    {
      id: 'documentation',
      title: 'Documentation',
      icon: '📚',
      suggestions: [
        'Update my README',
        'Create a quick start guide',
        'Document my API endpoints',
        'Generate documentation',
      ],
    },
    {
      id: 'files',
      title: 'Files & Organization',
      icon: '📁',
      suggestions: [
        'Find duplicate files',
        'Clean up unused files',
        'Organize my project structure',
        'Check for unnecessary files',
      ],
    },
    {
      id: 'api',
      title: 'API & Endpoints',
      icon: '🔌',
      suggestions: [
        'Show all my API endpoints',
        'Validate my API paths',
        'Generate API client',
        'Check if frontend matches backend',
      ],
    },
    {
      id: 'components',
      title: 'Components',
      icon: '🧩',
      suggestions: [
        'Show unused components',
        'Find component dependencies',
        'Check component usage',
        'List all components',
      ],
    },
    {
      id: 'quality',
      title: 'Code Quality',
      icon: '✨',
      suggestions: [
        'Polish my code',
        'Find code smells',
        'Improve code quality',
        'Check for best practices',
      ],
    },
  ];

  return (
    <div className="non-coder-helper">
      <div className="helper-header">
        <HelpCircle className="w-6 h-6" />
        <div>
          <h2>AI Agent Helper</h2>
          <p>Not sure what to ask? Pick a category and we'll help you communicate with your AI agent</p>
        </div>
      </div>

      <div className="helper-categories">
        {categories.map(category => (
          <div
            key={category.id}
            className={`helper-category ${selectedCategory === category.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(
              selectedCategory === category.id ? null : category.id
            )}
          >
            <div className="category-icon">{category.icon}</div>
            <div className="category-title">{category.title}</div>
          </div>
        ))}
      </div>

      {selectedCategory && (
        <div className="helper-suggestions">
          <h3>Suggested Questions</h3>
          <div className="suggestions-list">
            {categories
              .find(c => c.id === selectedCategory)
              ?.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionSelect(suggestion)}
                  className="suggestion-button"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{suggestion}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="helper-tips">
        <h3>
          <Lightbulb className="w-5 h-5" />
          Pro Tips
        </h3>
        <ul>
          <li>💡 Be specific about what you want (e.g., "update README" not just "update docs")</li>
          <li>💡 Ask about your project health regularly</li>
          <li>💡 Use the visual dashboard to see project status</li>
          <li>💡 Let guardrail auto-update documentation to save time</li>
        </ul>
      </div>
    </div>
  );
};

