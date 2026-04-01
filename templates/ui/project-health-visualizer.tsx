/**
 * Project Health Visualizer
 * 
 * Visual representation of project health for non-coders
 */

import React from 'react';
import { Heart, AlertCircle, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import './ProjectHealthVisualizer.css';

export interface ProjectHealthData {
  overall: number; // 0-100
  categories: {
    codeQuality: number;
    documentation: number;
    tests: number;
    security: number;
    performance: number;
  };
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    file?: string;
  }>;
}

export interface ProjectHealthVisualizerProps {
  health: ProjectHealthData;
}

export const ProjectHealthVisualizer: React.FC<ProjectHealthVisualizerProps> = ({ health }) => {
  const getHealthColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Critical';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-6 h-6" />;
    if (score >= 60) return <AlertCircle className="w-6 h-6" />;
    return <XCircle className="w-6 h-6" />;
  };

  return (
    <div className="project-health">
      <div className="health-header">
        <Heart className="w-6 h-6" />
        <div>
          <h2>Project Health</h2>
          <p>Overall status of your project</p>
        </div>
      </div>

      {/* Overall Score */}
      <div className="health-overall">
        <div className="health-score-circle" style={{ '--score': health.overall, '--color': getHealthColor(health.overall) } as any}>
          <div className="score-value">{health.overall}</div>
          <div className="score-label">/ 100</div>
        </div>
        <div className="health-status">
          <div className="status-label">{getHealthLabel(health.overall)}</div>
          <div className="status-icon" style={{ color: getHealthColor(health.overall) }}>
            {getHealthIcon(health.overall)}
          </div>
        </div>
      </div>

      {/* Category Scores */}
      <div className="health-categories">
        <h3>Category Breakdown</h3>
        <div className="categories-grid">
          {Object.entries(health.categories).map(([category, score]) => (
            <div key={category} className="category-item">
              <div className="category-header">
                <span className="category-name">{category.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="category-score" style={{ color: getHealthColor(score) }}>
                  {score}%
                </span>
              </div>
              <div className="category-bar">
                <div
                  className="category-fill"
                  style={{
                    width: `${score}%`,
                    backgroundColor: getHealthColor(score),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issues */}
      {health.issues.length > 0 && (
        <div className="health-issues">
          <h3>Issues Found</h3>
          <div className="issues-list">
            {health.issues.map((issue, index) => (
              <div key={index} className={`issue-item issue-${issue.type}`}>
                <div className="issue-icon">
                  {issue.type === 'error' && <XCircle className="w-5 h-5" />}
                  {issue.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                  {issue.type === 'info' && <CheckCircle className="w-5 h-5" />}
                </div>
                <div className="issue-content">
                  <div className="issue-message">{issue.message}</div>
                  {issue.file && (
                    <div className="issue-file">{issue.file}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="health-recommendations">
        <h3>
          <TrendingUp className="w-5 h-5" />
          Recommendations
        </h3>
        <ul>
          {health.overall < 80 && (
            <li>Run "guardrail polish" to improve code quality</li>
          )}
          {health.categories.documentation < 80 && (
            <li>Enable auto-documentation updates in settings</li>
          )}
          {health.categories.tests < 80 && (
            <li>Add more tests to increase coverage</li>
          )}
          {health.categories.security < 80 && (
            <li>Run security scan to find vulnerabilities</li>
          )}
        </ul>
      </div>
    </div>
  );
};

