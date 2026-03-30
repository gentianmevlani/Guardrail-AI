/**
 * Response Style Service
 * 
 * Provides different response styles/tones for AI agent responses
 * Allows customization of how the agent communicates with users
 */

export type ResponseStyle = 
  | 'blunt' 
  | 'excited' 
  | 'strict' 
  | 'friendly' 
  | 'professional' 
  | 'casual' 
  | 'technical' 
  | 'encouraging'
  | 'concise'
  | 'detailed';

export interface StyleConfig {
  style: ResponseStyle;
  useEmojis?: boolean;
  maxLength?: number;
  includeExamples?: boolean;
}

export interface StyledResponse {
  formatted: string;
  style: ResponseStyle;
  metadata: {
    originalLength: number;
    formattedLength: number;
    sections: string[];
  };
}

class ResponseStyleService {
  private styleTemplates: Record<ResponseStyle, {
    intro: (query: string) => string;
    sectionHeader: (title: string) => string;
    recommendation: (msg: string, type: string) => string;
    suggestion: (msg: string) => string;
    conclusion: () => string;
    error: (msg: string) => string;
    emoji?: string;
  }> = {
    blunt: {
      intro: (query) => `Here's what you need to know about "${query}":`,
      sectionHeader: (title) => `## ${title}`,
      recommendation: (msg, type) => `- ${msg}`,
      suggestion: (msg) => `- ${msg}`,
      conclusion: () => `That's it.`,
      error: (msg) => `Error: ${msg}`,
    },
    excited: {
      intro: (query) => `🎉 Awesome! Let's dive into "${query}"! 🚀`,
      sectionHeader: (title) => `## ✨ ${title} ✨`,
      recommendation: (msg, type) => `🎯 ${msg}`,
      suggestion: (msg) => `💡 ${msg}`,
      conclusion: () => `🎊 You've got this! Happy coding! 🎊`,
      error: (msg) => `⚠️ Oops! ${msg}`,
      emoji: '🎉',
    },
    strict: {
      intro: (query) => `Analysis of: "${query}"\n\nFollow these guidelines precisely:`,
      sectionHeader: (title) => `## ${title.toUpperCase()}`,
      recommendation: (msg, type) => {
        const prefix = type === 'warning' ? '⚠️ REQUIRED:' : '✓ MANDATORY:';
        return `${prefix} ${msg}`;
      },
      suggestion: (msg) => `→ ${msg}`,
      conclusion: () => `Ensure compliance with all recommendations above.`,
      error: (msg) => `ERROR: ${msg}`,
    },
    friendly: {
      intro: (query) => `Hey! 👋 Let me help you with "${query}"!`,
      sectionHeader: (title) => `## ${title}`,
      recommendation: (msg, type) => `💬 ${msg}`,
      suggestion: (msg) => `🤔 You might want to consider: ${msg}`,
      conclusion: () => `Hope that helps! Feel free to ask if you need anything else! 😊`,
      error: (msg) => `Hmm, something went wrong: ${msg} 😅`,
      emoji: '😊',
    },
    professional: {
      intro: (query) => `Analysis regarding: "${query}"\n\nExecutive Summary:`,
      sectionHeader: (title) => `## ${title}`,
      recommendation: (msg, type) => {
        const priority = type === 'warning' ? '[HIGH PRIORITY]' : '[RECOMMENDED]';
        return `${priority} ${msg}`;
      },
      suggestion: (msg) => `• ${msg}`,
      conclusion: () => `Please review the recommendations and proceed accordingly.`,
      error: (msg) => `Error encountered: ${msg}`,
    },
    casual: {
      intro: (query) => `So you're asking about "${query}"? Cool, here's what I found:`,
      sectionHeader: (title) => `## ${title}`,
      recommendation: (msg, type) => `→ ${msg}`,
      suggestion: (msg) => `Maybe try: ${msg}`,
      conclusion: () => `That should do it! Let me know if you need anything else.`,
      error: (msg) => `Whoops: ${msg}`,
    },
    technical: {
      intro: (query) => `Technical analysis: "${query}"\n\nSpecifications:`,
      sectionHeader: (title) => `## ${title}`,
      recommendation: (msg, type) => `[${type.toUpperCase()}] ${msg}`,
      suggestion: (msg) => `[SUGGESTION] ${msg}`,
      conclusion: () => `End of technical analysis.`,
      error: (msg) => `[ERROR] ${msg}`,
    },
    encouraging: {
      intro: (query) => `Great question about "${query}"! 🌟 Let's explore this together:`,
      sectionHeader: (title) => `## ${title} 🌱`,
      recommendation: (msg, type) => `✨ ${msg}`,
      suggestion: (msg) => `💪 You could try: ${msg}`,
      conclusion: () => `Keep up the great work! You're making progress! 🎯`,
      error: (msg) => `Don't worry, we can fix this: ${msg} 💪`,
      emoji: '🌟',
    },
    concise: {
      intro: (query) => `"${query}":`,
      sectionHeader: (title) => `## ${title}`,
      recommendation: (msg, type) => `• ${msg}`,
      suggestion: (msg) => `• ${msg}`,
      conclusion: () => ``,
      error: (msg) => `Error: ${msg}`,
    },
    detailed: {
      intro: (query) => `Comprehensive analysis of: "${query}"\n\nThis response contains detailed information, examples, and context to help you fully understand the topic.\n\n---\n\n`,
      sectionHeader: (title) => `## ${title}\n\n`,
      recommendation: (msg, type) => {
        const detail = type === 'warning' 
          ? `⚠️ **Important Notice**: ${msg}\n\nThis requires immediate attention.` 
          : `📋 **Recommendation**: ${msg}\n\nThis aligns with best practices and project conventions.`;
        return detail;
      },
      suggestion: (msg) => `💡 **Suggestion**: ${msg}\n\nThis could improve your implementation.`,
      conclusion: () => `\n---\n\n**Summary**: This analysis provides comprehensive context. Review each section carefully and apply the recommendations as appropriate.`,
      error: (msg) => `❌ **Error Details**: ${msg}\n\nPlease review the error message above and take appropriate action.`,
    },
  };

  /**
   * Format a response with the specified style
   */
  formatResponse(
    content: {
      query: string;
      understanding?: {
        architecture?: string;
        patterns?: string[];
        conventions?: string[];
        currentFocus?: string[];
      };
      recommendations?: Array<{
        type: string;
        message: string;
        context?: string;
        files?: string[];
      }>;
      suggestions?: string[];
      context?: string;
      error?: string;
    },
    config: StyleConfig
  ): StyledResponse {
    const template = this.styleTemplates[config.style];
    const sections: string[] = [];
    let formatted = '';

    // Intro
    if (content.error) {
      formatted += template.error(content.error) + '\n\n';
    } else {
      formatted += template.intro(content.query) + '\n\n';
    }

    // Understanding section
    if (content.understanding) {
      const { architecture, patterns, conventions, currentFocus } = content.understanding;
      
      if (architecture) {
        sections.push('Understanding');
        formatted += template.sectionHeader('Understanding') + '\n';
        formatted += this.formatArchitecture(architecture, config.style) + '\n\n';
      }

      if (patterns && patterns.length > 0) {
        sections.push('Patterns');
        formatted += template.sectionHeader('Patterns') + '\n';
        formatted += patterns.map(p => `- ${p}`).join('\n') + '\n\n';
      }

      if (conventions && conventions.length > 0) {
        sections.push('Conventions');
        formatted += template.sectionHeader('Conventions') + '\n';
        formatted += conventions.map(c => `- ${c}`).join('\n') + '\n\n';
      }

      if (currentFocus && currentFocus.length > 0) {
        sections.push('Current Focus');
        formatted += template.sectionHeader('Current Focus') + '\n';
        formatted += currentFocus.map(f => `- ${f}`).join('\n') + '\n\n';
      }
    }

    // Recommendations
    if (content.recommendations && content.recommendations.length > 0) {
      sections.push('Recommendations');
      formatted += template.sectionHeader('Recommendations') + '\n';
      
      content.recommendations.forEach(rec => {
        formatted += template.recommendation(rec.message, rec.type) + '\n';
        if (rec.context && config.style !== 'concise') {
          formatted += `  ${rec.context}\n`;
        }
        if (rec.files && rec.files.length > 0 && config.includeExamples) {
          formatted += `  Files: ${rec.files.slice(0, 3).join(', ')}\n`;
        }
      });
      formatted += '\n';
    }

    // Suggestions
    if (content.suggestions && content.suggestions.length > 0) {
      sections.push('Suggestions');
      formatted += template.sectionHeader('Suggestions') + '\n';
      content.suggestions.forEach(sug => {
        formatted += template.suggestion(sug) + '\n';
      });
      formatted += '\n';
    }

    // Full context
    if (content.context && config.style === 'detailed') {
      sections.push('Full Context');
      formatted += template.sectionHeader('Full Context') + '\n';
      formatted += content.context + '\n\n';
    }

    // Conclusion
    if (template.conclusion() && config.style !== 'concise') {
      formatted += template.conclusion() + '\n';
    }

    // Apply length limit if specified
    const originalLength = formatted.length;
    if (config.maxLength && formatted.length > config.maxLength) {
      formatted = formatted.substring(0, config.maxLength) + '...\n\n[Response truncated]';
    }

    // Remove emojis if not wanted
    if (!config.useEmojis) {
      formatted = this.removeEmojis(formatted);
    }

    return {
      formatted: formatted.trim(),
      style: config.style,
      metadata: {
        originalLength,
        formattedLength: formatted.length,
        sections,
      },
    };
  }

  /**
   * Format architecture information based on style
   */
  private formatArchitecture(architecture: string, style: ResponseStyle): string {
    switch (style) {
      case 'blunt':
        return architecture.split('\n').map(line => line.replace(/^- /, '')).join('\n');
      case 'technical':
        return architecture.split('\n').map(line => `  ${line}`).join('\n');
      case 'detailed':
        return architecture + '\n\nThis architecture overview provides insight into your project structure.';
      default:
        return architecture;
    }
  }

  /**
   * Remove emojis from text
   */
  private removeEmojis(text: string): string {
    // Remove common emojis
    return text
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .trim();
  }

  /**
   * Get available styles
   */
  getAvailableStyles(): ResponseStyle[] {
    return Object.keys(this.styleTemplates) as ResponseStyle[];
  }

  /**
   * Get style description
   */
  getStyleDescription(style: ResponseStyle): string {
    const descriptions: Record<ResponseStyle, string> = {
      blunt: 'Direct, no-nonsense responses. Gets straight to the point.',
      excited: 'Enthusiastic and energetic. Uses emojis and positive language.',
      strict: 'Formal and authoritative. Emphasizes compliance and rules.',
      friendly: 'Warm and approachable. Conversational tone with helpful attitude.',
      professional: 'Business-like and formal. Suitable for corporate environments.',
      casual: 'Relaxed and informal. Like talking to a colleague.',
      technical: 'Technical and precise. Focuses on specifications and details.',
      encouraging: 'Supportive and motivating. Builds confidence.',
      concise: 'Minimal and brief. Only essential information.',
      detailed: 'Comprehensive and thorough. Includes extensive context.',
    };
    return descriptions[style];
  }

  /**
   * Format a simple message with style
   */
  formatMessage(message: string, style: ResponseStyle, useEmojis = true): string {
    const template = this.styleTemplates[style];
    let formatted = message;

    if (style === 'excited' && useEmojis) {
      formatted = `🎉 ${formatted} 🚀`;
    } else if (style === 'strict') {
      formatted = `[NOTICE] ${formatted}`;
    } else if (style === 'friendly' && useEmojis) {
      formatted = `👋 ${formatted} 😊`;
    } else if (style === 'encouraging' && useEmojis) {
      formatted = `💪 ${formatted} ✨`;
    }

    if (!useEmojis) {
      formatted = this.removeEmojis(formatted);
    }

    return formatted;
  }
}

export const responseStyleService = new ResponseStyleService();

