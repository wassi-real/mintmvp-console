# MintConsole — Rebuild PRD

**Product:** MintConsole by MintMVP  
**Domain:** console.mintmvp.com  
**Stack:** SvelteKit · TypeScript · Supabase · Tailwind CSS  
**Purpose:** Rebuild the existing MintMVP Console into a modern, simple, AI-powered, open-source project management and engineering operations platform.

## 1. Product Requirements

Build a unified project workspace for managing software projects, tasks, development, delivery, incidents, finances and AI-assisted operations.

The platform must be:
- Extremely easy to use, including for non-technical and older users.
- Modern, professional and fast.
- Open-source and self-hostable.
- Ready for Cloud SaaS and enterprise expansion.
- Built around the existing MintConsole data, not a fresh database.

## 2. Core Features

### Workspace & Projects
- Workspace management
- Project creation and project overview
- Project status, priority and progress
- Project health tracking
- Project switcher
- Project settings and members

### Project Dashboard
- Active tasks
- Completed tasks
- Test status
- Open incidents
- Documented specifications
- Delivery progress
- Project health
- Development, staging and production environments
- GitHub activity
- Recent activity
- Quick navigation

### Project Management
- Tasks and subtasks
- Milestones
- Pipeline
- Kanban board
- List/table views
- Task assignment
- Priority, status, deadline and labels
- Comments and activity
- Task dependencies
- Search and filtering

### Engineering & Delivery
- GitHub integration
- Repository information
- Commits, branches and merges
- Tests and test reports
- CI/CD status
- Deployment logs
- Environments (development, staging, production)
- Monitoring
- Incidents
- Specs and technical documentation

### Operations
- Reports
- Activity history
- Project finance and payments
- API management
- Integrations
- Workspace settings
- Notifications

### AI Agents
- AI project assistant
- Project-aware chat
- AI task creation and breakdown
- Milestone planning
- Progress analysis
- Blocker detection
- Report generation
- Technical specification generation
- Agent execution history and logs
- Multiple AI providers
- BYOK (OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, custom endpoints)
- Ollama/local AI support
- Agents must respect user permissions and require approval for sensitive actions.

## 3. UI/UX Requirements

### Design direction
- Pure black/dark monochrome theme.
- No gradients.
- No glassmorphism.
- No excessive rounded cards.
- No AI-generated SaaS template appearance.
- No unnecessary decorative elements.
- Modern, professional, boxy interface inspired by Fedora GNOME and Ubuntu desktop design.
- Larger typography, buttons and controls.
- High contrast and readable labels.
- Simple navigation and predictable layouts.
- Minimal icons; icons must be clear and consistent.
- Support dark and light themes, with black/dark as the primary theme.

### Usability
- Simple sidebar with clearly grouped navigation.
- Use plain English labels.
- Important actions must be obvious.
- Avoid hiding critical features behind complicated menus.
- Use confirmation dialogs for destructive actions.
- Provide empty states, loading states and clear error messages.
- Support keyboard navigation.
- Responsive layout.
- Make the UI accessible for inexperienced computer users.

## 4. AI Agent System

AI agents should be treated as workspace assistants capable of performing authorized actions.

Agents must be able to:
- Analyze projects.
- Create and organize tasks.
- Generate milestones and plans.
- Review progress.
- Identify blockers.
- Generate reports and documentation.
- Work with project context.
- Use approved integrations and tools.

Include agent configuration for:
- Name and instructions
- Provider and model
- Tools and permissions
- Project access
- Execution limits
- Approval requirements

All agent actions must be logged and reviewable. AI must never bypass normal authorization.

## 5. Database & Existing Data — CRITICAL

The current MintConsole already uses an existing Supabase database containing project and operational data.

**Do not replace the database or create a disconnected new schema.**

Before development:

1. Inspect all existing Supabase tables, relationships, RLS policies, functions, triggers, storage and migration files.
2. Document the current schema.
3. Map every existing feature and data structure to the redesigned application.
4. Reuse existing tables and data wherever possible.
5. Make additive and backward-compatible migrations.
6. Never delete, truncate, reset or overwrite production data.
7. Never run destructive migrations without explicit approval.
8. Preserve existing users, projects, tasks, reports, finance records, activity and integrations.
9. Test the rebuild against a safe development/staging environment.
10. Verify that existing records remain accessible after migration.

The existing database is the source of truth until a migration plan is reviewed and approved.

## 6. SaaS & Self-hosting

Prepare the architecture for two deployment modes:

### Cloud
- Hosted by MintMVP
- Workspace isolation
- Subscription billing
- Managed database and storage
- Backups
- Automated updates
- $5/month starting plan concept

### Self-hosted
- Docker-based deployment
- User-owned database and storage
- Environment-based configuration
- BYOK AI
- Ollama support
- Documentation for installation, upgrades and backups

Both modes should share the same core application and feature set.

## 7. Enterprise Readiness

Architect for:
- Organization and workspace permissions
- Role-based access control
- Audit logs
- API keys
- Webhooks
- SSO-ready architecture
- Data isolation
- Backup and restore
- Security controls
- Custom integrations

Enterprise features can be implemented in later phases, but the architecture must not prevent them.

## 8. Development Steps

### Step 1 — Audit
Inspect the existing application, Supabase database, migration history, features, integrations and data. Produce a feature and schema map.

### Step 2 — Foundation
Rebuild the application shell, navigation, authentication, workspace/project structure, design system and database integration.

### Step 3 — Core Project Management
Implement dashboard, tasks, milestones, pipeline, reports, specs, activity and project settings.

### Step 4 — Engineering Console
Implement GitHub, tests, CI/CD, environments, deploy logs, monitoring and incidents.

### Step 5 — Operations
Implement finance, API management, integrations, notifications and search.

### Step 6 — AI
Implement AI provider system, BYOK, Ollama, contextual assistant, agents, tool execution, permissions and execution logs.

### Step 7 — Self-hosting
Implement Docker deployment, environment configuration, installation documentation, backups, upgrades and restore procedures.

### Step 8 — Cloud & Enterprise
Prepare billing, tenant provisioning, cloud administration, SSO, audit controls, enterprise permissions and security hardening.

## 9. Engineering Rules

- Use modular architecture, not a giant monolithic component.
- Reuse components and design tokens.
- Keep database logic separated from UI.
- Validate all inputs server-side.
- Enforce permissions server-side.
- Never expose Supabase service-role keys in the frontend.
- Use proper error handling and loading states.
- No mock functionality in production.
- No fake integrations or misleading status indicators.
- Test critical features and data migrations.
- Do not sacrifice functionality just to make the dashboard visually minimal.


## **10. Cloud Usage Limits & Enterprise Upgrade**

### **MintConsole Cloud — $5/month**

The $5/month plan provides **full access to all platform features without feature locking**. Users can access the entire MintConsole platform, but cloud-hosted server resources and usage-intensive operations are limited.

**Included:**

- Unlimited projects, tasks, milestones and team members (subject to fair-use protections).
- Access to all platform features and modules.
- 100 AI requests per billing cycle.
- Limited report generation.
- Limited AI-generated content, document and resource creation.
- Limited server-intensive operations.
- Full project management, integrations and workspace functionality.

### **Usage Limits**

Limits apply to resource-intensive operations rather than locking entire features.

Examples:

- AI requests and agent execution.
- AI-generated reports.
- AI document/specification generation.
- Resource-intensive automation.
- Server-side processing and generation workloads.

Users should be able to view their usage, remaining quotas and reset dates from a dedicated **Usage & Plan** page.

When a limit is reached:

- The user can continue using all unrestricted platform features.
- The affected operation displays a clear usage-limit message.
- Existing data and previously generated content remain accessible.
- Users can upgrade to Enterprise for increased or customized limits.

### **Enterprise — Custom Pricing**

Enterprise customers can purchase higher or customized resource allocations, including:

- Increased or custom AI request limits.
- Higher report-generation limits.
- Higher document and resource creation limits.
- Increased server operation quotas.
- Custom usage allocations.
- Priority support.
- Enterprise deployment options.
- Custom infrastructure and resource agreements where applicable.

Enterprise upgrades and additional resource allocations are managed directly by MintMVP.

**Important implementation rule:** Usage limits must be enforced server-side, tracked per workspace and billing period, configurable by MintMVP administrators, and designed so limits can be changed without modifying application code.

## Final Goal

Rebuild MintConsole into a clean, modern and highly usable AI-powered project management and engineering platform while preserving the existing MintMVP data and functionality.

The application should feel like a serious professional desktop workspace — simple enough for beginners, powerful enough for software teams, and extensible enough for SaaS and enterprise use.

**Prioritize simplicity, usability, stability and real functionality over visual gimmicks.**