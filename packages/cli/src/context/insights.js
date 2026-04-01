/**
 * Chat History Insights Module
 * Tracks context generation sessions and usage patterns
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const GUARDRAIL_HOME = path.join(os.homedir(), ".guardrail");
const INSIGHTS_FILE = path.join(GUARDRAIL_HOME, "insights.json");

/**
 * Initialize insights file
 */
function initializeInsights() {
  if (!fs.existsSync(GUARDRAIL_HOME)) {
    fs.mkdirSync(GUARDRAIL_HOME, { recursive: true });
  }
  
  if (!fs.existsSync(INSIGHTS_FILE)) {
    fs.writeFileSync(INSIGHTS_FILE, JSON.stringify({
      sessions: [],
      queries: [],
      fileEdits: [],
      totalSessions: 0,
    }, null, 2));
  }
}

/**
 * Track chat/context usage insights
 */
function trackInsight(projectPath, action, data = {}) {
  initializeInsights();
  
  let insights;
  try {
    insights = JSON.parse(fs.readFileSync(INSIGHTS_FILE, "utf-8"));
  } catch {
    insights = { sessions: [], queries: [], fileEdits: [], totalSessions: 0 };
  }

  const entry = {
    timestamp: new Date().toISOString(),
    project: path.basename(projectPath),
    projectPath: projectPath,
    action,
    ...data,
  };

  switch (action) {
    case "context_generated":
      insights.sessions.push(entry);
      insights.totalSessions++;
      break;
    case "file_edit":
      insights.fileEdits.push(entry);
      break;
    case "query":
      insights.queries.push(entry);
      break;
  }

  // Keep last 500 entries per category
  insights.sessions = insights.sessions.slice(-500);
  insights.fileEdits = insights.fileEdits.slice(-500);
  insights.queries = insights.queries.slice(-500);

  fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(insights, null, 2));
  return insights;
}

/**
 * Get most active hours from sessions
 */
function getMostActiveHours(sessions) {
  const hours = {};
  for (const session of sessions) {
    const hour = new Date(session.timestamp).getHours();
    hours[hour] = (hours[hour] || 0) + 1;
  }
  return Object.entries(hours)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => `${hour}:00`);
}

/**
 * Get insights summary for dashboard
 */
function getInsightsSummary() {
  initializeInsights();
  
  try {
    const insights = JSON.parse(fs.readFileSync(INSIGHTS_FILE, "utf-8"));
    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    return {
      totalSessions: insights.totalSessions || 0,
      sessionsToday: insights.sessions?.filter(s => new Date(s.timestamp) > dayAgo).length || 0,
      sessionsThisWeek: insights.sessions?.filter(s => new Date(s.timestamp) > weekAgo).length || 0,
      totalFileEdits: insights.fileEdits?.length || 0,
      recentProjects: [...new Set(insights.sessions?.slice(-20).map(s => s.project))],
      mostActiveHours: getMostActiveHours(insights.sessions || []),
    };
  } catch {
    return null;
  }
}

/**
 * Get recent sessions
 */
function getRecentSessions(limit = 10) {
  initializeInsights();
  
  try {
    const insights = JSON.parse(fs.readFileSync(INSIGHTS_FILE, "utf-8"));
    return insights.sessions?.slice(-limit).reverse() || [];
  } catch {
    return [];
  }
}

/**
 * Get project activity
 */
function getProjectActivity(projectPath) {
  initializeInsights();
  
  try {
    const insights = JSON.parse(fs.readFileSync(INSIGHTS_FILE, "utf-8"));
    const projectName = path.basename(projectPath);
    
    const sessions = insights.sessions?.filter(s => s.project === projectName) || [];
    const fileEdits = insights.fileEdits?.filter(f => f.project === projectName) || [];
    
    return {
      totalSessions: sessions.length,
      lastSession: sessions[sessions.length - 1]?.timestamp || null,
      totalFileEdits: fileEdits.length,
    };
  } catch {
    return null;
  }
}

/**
 * Clear all insights
 */
function clearInsights() {
  const insights = {
    sessions: [],
    queries: [],
    fileEdits: [],
    totalSessions: 0,
  };
  fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(insights, null, 2));
}

module.exports = {
  INSIGHTS_FILE,
  initializeInsights,
  trackInsight,
  getInsightsSummary,
  getRecentSessions,
  getProjectActivity,
  getMostActiveHours,
  clearInsights,
};
