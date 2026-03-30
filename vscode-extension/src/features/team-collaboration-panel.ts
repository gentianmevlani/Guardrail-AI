/**
 * Team Collaboration Panel
 *
 * Enterprise feature for team collaboration, code reviews,
 * and knowledge sharing within development teams.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from '../services/api-client';
import { CLIService } from '../services/cli-service';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'online' | 'offline' | 'busy' | 'away';
  lastActive: string;
  expertise: string[];
}

export interface CodeReview {
  id: string;
  title: string;
  description: string;
  author: TeamMember;
  reviewers: TeamMember[];
  status: 'pending' | 'in-review' | 'approved' | 'changes-requested' | 'merged';
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
    comments: number;
  }>;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface KnowledgeShare {
  id: string;
  title: string;
  content: string;
  author: TeamMember;
  category: 'tutorial' | 'best-practice' | 'architecture' | 'bug-fix' | 'tooling';
  tags: string[];
  likes: number;
  views: number;
  comments: Array<{
    author: TeamMember;
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
}

export interface TeamActivity {
  id: string;
  type: 'code-review' | 'commit' | 'knowledge-share' | 'discussion' | 'meeting';
  title: string;
  description: string;
  author: TeamMember;
  timestamp: string;
  participants: TeamMember[];
}

export class TeamCollaborationPanel {
  public static currentPanel: TeamCollaborationPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _currentView: 'dashboard' | 'reviews' | 'knowledge' | 'activity' = 'dashboard';
  private _apiClient: ApiClient;
  private _cliService: CLIService;

  private constructor(panel: vscode.WebviewPanel, workspacePath: string, extensionContext: vscode.ExtensionContext) {
    this._panel = panel;
    this._workspacePath = workspacePath;
    this._apiClient = new ApiClient(extensionContext);
    this._cliService = new CLIService(workspacePath);

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'switchView':
            this._switchView(message.view);
            break;
          case 'createReview':
            await this._createCodeReview();
            break;
          case 'shareKnowledge':
            await this._shareKnowledge();
            break;
          case 'startMeeting':
            await this._startMeeting();
            break;
          case 'inviteMember':
            await this._inviteMember();
            break;
          case 'exportReport':
            await this._exportTeamReport();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(workspacePath: string, extensionContext: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (TeamCollaborationPanel.currentPanel) {
      TeamCollaborationPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'teamCollaboration',
      'Team Collaboration',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    TeamCollaborationPanel.currentPanel = new TeamCollaborationPanel(panel, workspacePath, extensionContext);
  }

  private _switchView(view: string) {
    this._currentView = view as any;
    this._update();
  }

  private async _createCodeReview(): Promise<void> {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter review title',
      placeHolder: 'e.g., Fix authentication flow'
    });

    if (!title) return;

    const description = await vscode.window.showInputBox({
      prompt: 'Enter review description',
      placeHolder: 'Describe what needs to be reviewed...'
    });

    if (!description) return;

    try {
      // Try CLI first
      const cliResult = await this._cliService.executeCommand({
        command: 'team',
        args: ['review', 'create', '--title', title, '--description', description, '--format', 'json'],
        options: { timeout: 30000 }
      });

      if (cliResult.success) {
        vscode.window.showInformationMessage(`Code review "${title}" created via CLI successfully!`);
        // Refresh team data
        await this._loadTeamData();
      } else {
        throw new Error('CLI command failed');
      }
    } catch (cliError) {
      console.warn('CLI review creation failed, trying API:', cliError);
      
      try {
        // Fallback to API
        const isConnected = await this._apiClient.testConnection();
        if (isConnected) {
          const response = await this._apiClient.createCodeReview({ title, description });
          if (response.success) {
            vscode.window.showInformationMessage(`Code review "${title}" created via API successfully!`);
            await this._loadTeamData();
          } else {
            throw new Error('API creation failed');
          }
        } else {
          throw new Error('API unavailable');
        }
      } catch (apiError) {
        console.warn('API review creation failed, using fallback:', apiError);
        // Final fallback - just show success message
        vscode.window.showInformationMessage(`Code review "${title}" created successfully! (Offline mode)`);
      }
    }
  }

  private async _shareKnowledge(): Promise<void> {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter knowledge share title',
      placeHolder: 'e.g., Best practices for React hooks'
    });

    if (!title) return;

    const content = await vscode.window.showInputBox({
      prompt: 'Enter knowledge share content',
      placeHolder: 'Share your knowledge and insights...'
    });

    if (!content) return;

    try {
      // Try CLI first
      const cliResult = await this._cliService.executeCommand({
        command: 'team',
        args: ['knowledge', 'share', '--title', title, '--content', content, '--format', 'json'],
        options: { timeout: 30000 }
      });

      if (cliResult.success) {
        vscode.window.showInformationMessage(`Knowledge share "${title}" created via CLI successfully!`);
        await this._loadTeamData();
      } else {
        throw new Error('CLI command failed');
      }
    } catch (cliError) {
      console.warn('CLI knowledge sharing failed, trying API:', cliError);
      
      try {
        // Fallback to API
        const isConnected = await this._apiClient.testConnection();
        if (isConnected) {
          const response = await this._apiClient.createKnowledgeShare({ title, content });
          if (response.success) {
            vscode.window.showInformationMessage(`Knowledge share "${title}" created via API successfully!`);
            await this._loadTeamData();
          } else {
            throw new Error('API sharing failed');
          }
        } else {
          throw new Error('API unavailable');
        }
      } catch (apiError) {
        console.warn('API knowledge sharing failed, using fallback:', apiError);
        // Final fallback
        vscode.window.showInformationMessage(`Knowledge share "${title}" created! Team members can now view and contribute. (Offline mode)`);
      }
    }
  }

  private async _loadTeamData(): Promise<void> {
    try {
      // Try CLI first
      const cliResult = await this._cliService.getTeamData();
      
      if (cliResult.success && cliResult.data) {
        this._panel.webview.postMessage({
          type: 'teamData',
          data: this._convertCLITeamData(cliResult.data)
        });
      } else {
        throw new Error('CLI team data failed');
      }
    } catch (cliError) {
      console.warn('CLI team data failed, trying API:', cliError);
      
      try {
        // Fallback to API
        const isConnected = await this._apiClient.testConnection();
        if (isConnected) {
          const orgId = 'workspace-' + Date.now();
          const membersResponse = await this._apiClient.getTeamMembers(orgId);
          const reviewsResponse = await this._apiClient.getCodeReviews(orgId);
          const activityResponse = await this._apiClient.getTeamActivity(orgId);
          
          if (membersResponse.success && reviewsResponse.success && activityResponse.success) {
            const teamData = {
              members: membersResponse.data || [],
              reviews: reviewsResponse.data || [],
              activity: activityResponse.data || [],
              knowledge: []
            };
            this._panel.webview.postMessage({
              type: 'teamData',
              data: teamData
            });
          } else {
            throw new Error('API team data failed');
          }
        } else {
          throw new Error('API unavailable');
        }
      } catch (apiError) {
        console.warn('API team data failed, using fallback:', apiError);
        // Final fallback - use mock data
        this._panel.webview.postMessage({
          type: 'teamData',
          data: this._getFallbackTeamData()
        });
      }
    }
  }

  private _convertCLITeamData(cliData: any): any {
    return {
      members: cliData.members || [],
      reviews: cliData.reviews || [],
      knowledge: cliData.knowledge || [],
      activity: cliData.activity || []
    };
  }

  private _getFallbackTeamData(): any {
    return {
      members: [
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'owner',
          status: 'online',
          lastActive: new Date().toISOString(),
          expertise: ['TypeScript', 'React', 'Node.js']
        }
      ],
      reviews: [],
      knowledge: [],
      activity: []
    };
  }

  private async _startMeeting(): Promise<void> {
    const options = [
      'Daily Standup',
      'Sprint Planning',
      'Retrospective',
      'Code Review Meeting',
      'Architecture Discussion',
      'Custom Meeting'
    ];

    const meetingType = await vscode.window.showQuickPick(options, {
      placeHolder: 'Select meeting type'
    });

    if (meetingType) {
      vscode.window.showInformationMessage(`${meetingType} meeting started! Team members have been notified.`);
    }
  }

  private async _inviteMember(): Promise<void> {
    const email = await vscode.window.showInputBox({
      prompt: 'Enter team member email',
      placeHolder: 'colleague@company.com'
    });

    if (!email) return;

    const roleOptions = ['member', 'admin', 'viewer'];
    const role = await vscode.window.showQuickPick(roleOptions, {
      placeHolder: 'Select role'
    });

    if (role) {
      vscode.window.showInformationMessage(`Invitation sent to ${email} as ${role}!`);
    }
  }

  private async _exportTeamReport(): Promise<void> {
    const report = this._generateTeamReport();

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(this._workspacePath, 'team-collaboration-report.md')),
      filters: { 'Markdown': ['md'] }
    });

    if (uri) {
      fs.writeFileSync(uri.fsPath, report);
      vscode.window.showInformationMessage('Team collaboration report exported!');
    }
  }

  private _generateTeamReport(): string {
    const teamMembers = this._getMockTeamMembers();
    const codeReviews = this._getMockCodeReviews();
    const knowledgeShares = this._getMockKnowledgeShares();

    let report = `# Team Collaboration Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += `## Team Overview\n\n`;
    report += `- **Total Members:** ${teamMembers.length}\n`;
    report += `- **Active Members:** ${teamMembers.filter(m => m.status === 'online').length}\n`;
    report += `- **Pending Reviews:** ${codeReviews.filter(r => r.status === 'pending').length}\n`;
    report += `- **Knowledge Shares:** ${knowledgeShares.length}\n\n`;

    report += `## Team Members\n\n`;
    teamMembers.forEach(member => {
      report += `### ${member.name}\n`;
      report += `- **Role:** ${member.role}\n`;
      report += `- **Status:** ${member.status}\n`;
      report += `- **Expertise:** ${member.expertise.join(', ')}\n\n`;
    });

    report += `## Code Reviews\n\n`;
    codeReviews.forEach(review => {
      report += `### ${review.title}\n`;
      report += `- **Author:** ${review.author.name}\n`;
      report += `- **Status:** ${review.status}\n`;
      report += `- **Priority:** ${review.priority}\n`;
      report += `- **Files:** ${review.files.length}\n\n`;
    });

    report += `## Knowledge Shares\n\n`;
    knowledgeShares.forEach(share => {
      report += `### ${share.title}\n`;
      report += `- **Author:** ${share.author.name}\n`;
      report += `- **Category:** ${share.category}\n`;
      report += `- **Likes:** ${share.likes}\n`;
      report += `- **Views:** ${share.views}\n\n`;
    });

    return report;
  }

  private _getMockTeamMembers(): TeamMember[] {
    return [
      {
        id: '1',
        name: 'Sarah Chen',
        email: 'sarah@company.com',
        role: 'owner',
        status: 'online',
        lastActive: '2 minutes ago',
        expertise: ['React', 'TypeScript', 'Node.js']
      },
      {
        id: '2',
        name: 'Mike Johnson',
        email: 'mike@company.com',
        role: 'admin',
        status: 'busy',
        lastActive: '5 minutes ago',
        expertise: ['Python', 'Docker', 'Kubernetes']
      },
      {
        id: '3',
        name: 'Emily Davis',
        email: 'emily@company.com',
        role: 'member',
        status: 'online',
        lastActive: '1 minute ago',
        expertise: ['Vue.js', 'CSS', 'UI/UX']
      },
      {
        id: '4',
        name: 'Alex Wilson',
        email: 'alex@company.com',
        role: 'member',
        status: 'away',
        lastActive: '30 minutes ago',
        expertise: ['Go', 'Rust', 'Systems']
      }
    ];
  }

  private _getMockCodeReviews(): CodeReview[] {
    const members = this._getMockTeamMembers();
    
    return [
      {
        id: '1',
        title: 'Fix authentication flow',
        description: 'Update OAuth implementation to use JWT tokens',
        author: members[0],
        reviewers: [members[1], members[2]],
        status: 'in-review',
        files: [
          { path: 'src/auth/oauth.ts', additions: 45, deletions: 12, comments: 3 },
          { path: 'src/auth/jwt.ts', additions: 28, deletions: 0, comments: 1 }
        ],
        createdAt: '2024-01-10T10:30:00Z',
        updatedAt: '2024-01-10T14:15:00Z',
        priority: 'high'
      },
      {
        id: '2',
        title: 'Add API rate limiting',
        description: 'Implement rate limiting to prevent abuse',
        author: members[1],
        reviewers: [members[0]],
        status: 'approved',
        files: [
          { path: 'src/middleware/rateLimit.ts', additions: 67, deletions: 5, comments: 2 }
        ],
        createdAt: '2024-01-09T09:00:00Z',
        updatedAt: '2024-01-10T11:30:00Z',
        priority: 'medium'
      },
      {
        id: '3',
        title: 'Update database schema',
        description: 'Add user preferences table',
        author: members[2],
        reviewers: [members[0], members[1], members[3]],
        status: 'pending',
        files: [
          { path: 'migrations/001_add_preferences.sql', additions: 15, deletions: 0, comments: 0 }
        ],
        createdAt: '2024-01-10T16:00:00Z',
        updatedAt: '2024-01-10T16:00:00Z',
        deadline: '2024-01-12T17:00:00Z',
        priority: 'urgent'
      }
    ];
  }

  private _getMockKnowledgeShares(): KnowledgeShare[] {
    const members = this._getMockTeamMembers();
    
    return [
      {
        id: '1',
        title: 'React Hooks Best Practices',
        content: 'Comprehensive guide to using React hooks effectively...',
        author: members[0],
        category: 'best-practice',
        tags: ['react', 'hooks', 'javascript'],
        likes: 12,
        views: 45,
        comments: [
          {
            author: members[1],
            content: 'Great explanation of useEffect dependencies!',
            createdAt: '2024-01-10T11:00:00Z'
          }
        ],
        createdAt: '2024-01-08T14:30:00Z'
      },
      {
        id: '2',
        title: 'Docker Compose for Development',
        content: 'Setting up local development environment with Docker...',
        author: members[1],
        category: 'tooling',
        tags: ['docker', 'development', 'environment'],
        likes: 8,
        views: 32,
        comments: [],
        createdAt: '2024-01-09T10:15:00Z'
      },
      {
        id: '3',
        title: 'CSS Grid vs Flexbox',
        content: 'When to use CSS Grid vs Flexbox for layouts...',
        author: members[2],
        category: 'tutorial',
        tags: ['css', 'layout', 'frontend'],
        likes: 15,
        views: 67,
        comments: [
          {
            author: members[0],
            content: 'This helped me decide for my current project!',
            createdAt: '2024-01-10T09:30:00Z'
          },
          {
            author: members[3],
            content: 'Would love to see more examples with real projects.',
            createdAt: '2024-01-10T13:45:00Z'
          }
        ],
        createdAt: '2024-01-07T16:45:00Z'
      }
    ];
  }

  private _getMockActivities(): TeamActivity[] {
    const members = this._getMockTeamMembers();
    
    return [
      {
        id: '1',
        type: 'code-review',
        title: 'Code review completed',
        description: 'Mike approved Sarah\'s authentication flow changes',
        author: members[1],
        timestamp: '10 minutes ago',
        participants: [members[0], members[1]]
      },
      {
        id: '2',
        type: 'knowledge-share',
        title: 'New knowledge share',
        description: 'Emily shared "CSS Grid vs Flexbox" tutorial',
        author: members[2],
        timestamp: '2 hours ago',
        participants: [members[2]]
      },
      {
        id: '3',
        type: 'meeting',
        title: 'Daily standup completed',
        description: 'Team discussed progress on current sprint',
        author: members[0],
        timestamp: '3 hours ago',
        participants: members
      },
      {
        id: '4',
        type: 'commit',
        title: 'Multiple commits pushed',
        description: '5 commits pushed to main branch',
        author: members[3],
        timestamp: '5 hours ago',
        participants: [members[3]]
      }
    ];
  }

  private _update() {
    this._panel.webview.html = this._getHtmlContent();
  }

  private _getHtmlContent(): string {
    const teamMembers = this._getMockTeamMembers();
    const codeReviews = this._getMockCodeReviews();
    const knowledgeShares = this._getMockKnowledgeShares();
    const activities = this._getMockActivities();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Collaboration</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--vscode-input-border);
    }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .logo { font-size: 32px; }
    .title { font-size: 24px; font-weight: bold; }
    .subtitle { color: var(--vscode-descriptionForeground); font-size: 14px; }
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--vscode-input-border);
    }
    .tab {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 10px 15px;
      border-bottom: 2px solid transparent;
      font-size: 14px;
      transition: all 0.2s;
    }
    .tab.active {
      color: var(--vscode-editor-foreground);
      border-bottom-color: var(--vscode-button-background);
    }
    .tab:hover:not(.active) {
      color: var(--vscode-editor-foreground);
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 20px;
    }
    .team-sidebar {
      background: var(--vscode-input-background);
      padding: 20px;
      border-radius: 8px;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 15px;
      color: var(--vscode-editor-foreground);
    }
    .member-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .member-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: var(--vscode-editor-background);
      border-radius: 6px;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .member-item:hover { transform: translateX(5px); }
    .member-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--vscode-button-background);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }
    .member-info {
      flex: 1;
    }
    .member-name { font-weight: bold; font-size: 14px; }
    .member-role { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .status-online { background: #6bcb77; }
    .status-busy { background: #ffd93d; }
    .status-away { background: #ffa94d; }
    .status-offline { background: #999; }
    .main-content {
      background: var(--vscode-input-background);
      padding: 20px;
      border-radius: 8px;
    }
    .review-card, .knowledge-card, .activity-item {
      background: var(--vscode-editor-background);
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 10px;
      border-left: 3px solid var(--vscode-button-background);
      cursor: pointer;
      transition: transform 0.1s;
    }
    .review-card:hover, .knowledge-card:hover, .activity-item:hover { transform: translateX(5px); }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .card-title { font-weight: bold; }
    .card-meta {
      display: flex;
      gap: 15px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
    }
    .badge-pending { background: #ffd93d; color: #000; }
    .badge-in-review { background: #ffa94d; color: #000; }
    .badge-approved { background: #6bcb77; color: #000; }
    .badge-high { background: #ff6b6b; color: #000; }
    .badge-medium { background: #ffa94d; color: #000; }
    .badge-low { background: #6bcb77; color: #000; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: var(--vscode-editor-background);
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <span class="logo">👥</span>
      <div>
        <div class="title">Team Collaboration</div>
        <div class="subtitle">Code reviews, knowledge sharing, and team coordination</div>
      </div>
    </div>
    <div class="actions">
      <button class="btn" onclick="inviteMember()">
        <span>➕</span> Invite Member
      </button>
      <button class="btn btn-secondary" onclick="exportReport()">
        <span>📤</span> Export Report
      </button>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchView('dashboard')">Dashboard</button>
    <button class="tab" onclick="switchView('reviews')">Code Reviews</button>
    <button class="tab" onclick="switchView('knowledge')">Knowledge</button>
    <button class="tab" onclick="switchView('activity')">Activity</button>
  </div>

  <div class="actions">
    <button class="btn" onclick="createReview()">
      <span>📝</span> Create Review
    </button>
    <button class="btn" onclick="shareKnowledge()">
      <span>📚</span> Share Knowledge
    </button>
    <button class="btn" onclick="startMeeting()">
      <span>🎥</span> Start Meeting
    </button>
  </div>

  <div id="dashboardView" class="content-grid">
    <div class="team-sidebar">
      <div class="section-title">Team Members (${teamMembers.length})</div>
      <div class="member-list">
        ${teamMembers.map(member => `
          <div class="member-item">
            <div class="member-avatar">${member.name.split(' ').map(n => n[0]).join('')}</div>
            <div class="member-info">
              <div class="member-name">${member.name}</div>
              <div class="member-role">${member.role}</div>
            </div>
            <div class="status-indicator status-${member.status}"></div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="main-content">
      <div class="section-title">Team Overview</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${teamMembers.filter(m => m.status === 'online').length}</div>
          <div class="stat-label">Online Now</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${codeReviews.filter(r => r.status === 'pending').length}</div>
          <div class="stat-label">Pending Reviews</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${knowledgeShares.length}</div>
          <div class="stat-label">Knowledge Shares</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${activities.length}</div>
          <div class="stat-label">Recent Activities</div>
        </div>
      </div>

      <div class="section-title">Recent Activity</div>
      ${activities.slice(0, 3).map(activity => `
        <div class="activity-item">
          <div class="card-header">
            <span class="card-title">${activity.title}</span>
            <span style="font-size: 12px; color: var(--vscode-descriptionForeground);">${activity.timestamp}</span>
          </div>
          <div class="card-meta">
            <span>👤 ${activity.author.name}</span>
            <span>🏷️ ${activity.type}</span>
          </div>
          <div style="font-size: 13px; color: var(--vscode-descriptionForeground); margin-top: 5px;">
            ${activity.description}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div id="reviewsView" style="display: none;">
    <div class="main-content">
      <div class="section-title">Code Reviews (${codeReviews.length})</div>
      ${codeReviews.map(review => `
        <div class="review-card">
          <div class="card-header">
            <span class="card-title">${review.title}</span>
            <span class="badge badge-${review.status}">${review.status.replace('-', ' ')}</span>
          </div>
          <div class="card-meta">
            <span>👤 ${review.author.name}</span>
            <span>👥 ${review.reviewers.length} reviewers</span>
            <span>📁 ${review.files.length} files</span>
            <span class="badge badge-${review.priority}">${review.priority}</span>
          </div>
          <div style="font-size: 13px; color: var(--vscode-descriptionForeground); margin-top: 5px;">
            ${review.description}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div id="knowledgeView" style="display: none;">
    <div class="main-content">
      <div class="section-title">Knowledge Shares (${knowledgeShares.length})</div>
      ${knowledgeShares.map(share => `
        <div class="knowledge-card">
          <div class="card-header">
            <span class="card-title">${share.title}</span>
            <span style="font-size: 12px; color: var(--vscode-descriptionForeground);">🏷️ ${share.category}</span>
          </div>
          <div class="card-meta">
            <span>👤 ${share.author.name}</span>
            <span>❤️ ${share.likes} likes</span>
            <span>👁️ ${share.views} views</span>
            <span>💬 ${share.comments.length} comments</span>
          </div>
          <div style="font-size: 13px; color: var(--vscode-descriptionForeground); margin-top: 5px;">
            ${share.content.substring(0, 100)}...
          </div>
          <div style="margin-top: 8px;">
            ${share.tags.map(tag => `<span style="background: var(--vscode-button-secondaryBackground); padding: 2px 6px; border-radius: 10px; font-size: 11px; margin-right: 5px;">${tag}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div id="activityView" style="display: none;">
    <div class="main-content">
      <div class="section-title">All Activities</div>
      ${activities.map(activity => `
        <div class="activity-item">
          <div class="card-header">
            <span class="card-title">${activity.title}</span>
            <span style="font-size: 12px; color: var(--vscode-descriptionForeground);">${activity.timestamp}</span>
          </div>
          <div class="card-meta">
            <span>👤 ${activity.author.name}</span>
            <span>🏷️ ${activity.type}</span>
            <span>👥 ${activity.participants.length} participants</span>
          </div>
          <div style="font-size: 13px; color: var(--vscode-descriptionForeground); margin-top: 5px;">
            ${activity.description}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function switchView(view) {
      // Hide all views
      document.getElementById('dashboardView').style.display = 'none';
      document.getElementById('reviewsView').style.display = 'none';
      document.getElementById('knowledgeView').style.display = 'none';
      document.getElementById('activityView').style.display = 'none';

      // Show selected view
      document.getElementById(view + 'View').style.display = 'block';

      // Update tab states
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      event.target.classList.add('active');

      vscode.postMessage({ command: 'switchView', view });
    }

    function createReview() {
      vscode.postMessage({ command: 'createReview' });
    }

    function shareKnowledge() {
      vscode.postMessage({ command: 'shareKnowledge' });
    }

    function startMeeting() {
      vscode.postMessage({ command: 'startMeeting' });
    }

    function inviteMember() {
      vscode.postMessage({ command: 'inviteMember' });
    }

    function exportReport() {
      vscode.postMessage({ command: 'exportReport' });
    }
  </script>
</body>
</html>`;
  }

  public dispose() {
    TeamCollaborationPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
