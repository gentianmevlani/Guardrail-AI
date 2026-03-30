/**
 * HTTP-oriented project operations: pagination, scan path resolution, stats.
 * Core persistence remains in project-service.
 */

import { z } from "zod";
import {
  CreateProjectRequestSchema,
  ProjectScanBodySchema,
  ProjectStatsQuerySchema,
  QueryProjectsSchema,
  UpdateProjectRequestSchema,
} from "../routes/projects.schema";
import { projectService } from "./project-service";

export type QueryProjectsInput = z.infer<typeof QueryProjectsSchema>;
export type CreateProjectBody = z.infer<typeof CreateProjectRequestSchema>;
export type UpdateProjectBody = z.infer<typeof UpdateProjectRequestSchema>;
export type ProjectScanBody = z.infer<typeof ProjectScanBodySchema>;
export type ProjectStatsQuery = z.infer<typeof ProjectStatsQuerySchema>;

export async function createProjectForUser(
  userId: string,
  body: CreateProjectBody,
) {
  return projectService.createProject({
    name: body.name,
    description: body.description,
    path: body.path,
    repositoryUrl: body.repositoryUrl || undefined,
    userId,
  });
}

export async function listProjectsPaginated(
  userId: string,
  query: QueryProjectsInput,
) {
  const { page, limit, includeStats } = query;
  const projects = await projectService.getUserProjects(userId, includeStats);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedProjects = projects.slice(startIndex, endIndex);

  return {
    projects: paginatedProjects,
    pagination: {
      page,
      limit,
      total: projects.length,
      pages: Math.ceil(projects.length / limit),
    },
  };
}

export async function getProjectForUser(projectId: string, userId: string) {
  return projectService.getProject(projectId, userId);
}

export async function updateProjectForUser(
  projectId: string,
  userId: string,
  body: UpdateProjectBody,
) {
  return projectService.updateProject(projectId, userId, body);
}

export async function deleteProjectForUser(projectId: string, userId: string) {
  await projectService.deleteProject(projectId, userId);
}

export async function scanProjectForUser(
  projectId: string,
  userId: string,
  body: ProjectScanBody,
) {
  const project = await projectService.getProject(projectId, userId);
  const scanPath = body.path || project.path;

  if (!scanPath) {
    const err = new Error("Project path is required for scanning");
    (err as Error & { code?: string }).code = "MISSING_SCAN_PATH";
    throw err;
  }

  const stats = await projectService.scanProject(projectId, scanPath);
  return { stats, message: "Project scanned successfully" as const };
}

export async function getProjectStatsForUser(
  projectId: string,
  userId: string,
  query: ProjectStatsQuery,
) {
  const days = parseInt(query.days, 10);
  return projectService.getProjectStats(
    projectId,
    userId,
    Number.isNaN(days) ? 30 : days,
  );
}
