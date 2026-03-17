"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LayoutGrid, Plus, Settings, Table2 } from "lucide-react";
import { Priority, ProjectStatus, ProjectType, Role } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProjectKanban } from "./project-kanban";
import { ProjectTable } from "./project-table";
import { ProjectSearchFilterBar } from "./project-search-filter-bar";
import {
  applyProjectBoardFilters,
  ProjectFilterKey,
  ProjectGroupByKey,
} from "@/lib/project-board-filters";

interface Project {
  id: string;
  name: string;
  code: string;
  type: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  progress: number;
  deadline: Date | null;
  stageId: string | null;
  stage: { id: string; name: string; sortOrder: number } | null;
  manager: { id: string; name: string } | null;
  assignments: { user: { id: string; name: string; role: Role } }[];
  _count: { timeEntries: number };
}

interface Stage {
  id: string;
  name: string;
  sortOrder: number;
}

interface ProjectBoardViewProps {
  projects: Project[];
  stages: Stage[];
  canManageProjects: boolean;
  canEditKanban: boolean;
  canCreateStages?: boolean;
  canUpdateStages?: boolean;
  canDeleteStages?: boolean;
  canUpdateProjects?: boolean;
  canDeleteProjects?: boolean;
  createProjectHref?: string;
  showTlDetailsMenu?: boolean;
}

export function ProjectBoardView({
  projects,
  stages,
  canManageProjects,
  canEditKanban,
  canCreateStages = false,
  canUpdateStages = false,
  canDeleteStages = false,
  canUpdateProjects = false,
  canDeleteProjects = false,
  createProjectHref,
  showTlDetailsMenu = false,
}: ProjectBoardViewProps) {
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMenuOpen, setIsSearchMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ProjectFilterKey>("all");
  const [activeGroupBy, setActiveGroupBy] = useState<ProjectGroupByKey>("none");

  const filteredProjects = useMemo(() => {
    return applyProjectBoardFilters(projects, searchQuery, activeFilter, activeGroupBy);
  }, [projects, searchQuery, activeFilter, activeGroupBy]);

  return (
    <Tabs
      value={viewMode}
      onValueChange={(value) => setViewMode(value as "kanban" | "table")}
      className="flex h-full min-h-0 flex-1 flex-col gap-3"
    >
      <div className="sticky top-0 z-30 rounded-xl border bg-card/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/90 md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-h-10 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Projects</h1>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
              {createProjectHref ? (
                <Button asChild size="sm" className="h-9 rounded-lg px-3">
                  <Link href={createProjectHref}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ProjectSearchFilterBar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              isSearchMenuOpen={isSearchMenuOpen}
              onSearchMenuOpenChange={setIsSearchMenuOpen}
              activeFilter={activeFilter}
              onActiveFilterChange={setActiveFilter}
              activeGroupBy={activeGroupBy}
              onActiveGroupByChange={setActiveGroupBy}
              onReset={() => {
                setActiveFilter("all");
                setActiveGroupBy("none");
                setSearchQuery("");
              }}
            />
            <TabsList className="h-10 rounded-md border bg-background p-0">
              <TabsTrigger value="kanban" className="h-10 rounded-none border-r px-4 data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <LayoutGrid className="h-4 w-4" />
                <span className="sr-only">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="table" className="h-10 rounded-none px-4 data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <Table2 className="h-4 w-4" />
                <span className="sr-only">List</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
      </div>

      <TabsContent value="kanban" className="mt-0 h-full min-h-0 flex-1 overflow-hidden">
        <ProjectKanban
          projects={filteredProjects}
          stages={stages}
          canEdit={canEditKanban}
          canCreateStages={canCreateStages}
          canUpdateStages={canUpdateStages}
          canDeleteStages={canDeleteStages}
          canUpdateProjects={canUpdateProjects}
          canDeleteProjects={canDeleteProjects}
          showTlDetailsMenu={showTlDetailsMenu}
        />
      </TabsContent>
      <TabsContent value="table" className="mt-0 min-h-0 flex-1">
        <ProjectTable
          projects={filteredProjects}
          canManage={canManageProjects}
          canDelete={canDeleteProjects}
          showTlDetailsMenu={showTlDetailsMenu}
        />
      </TabsContent>
    </Tabs>
  );
}
