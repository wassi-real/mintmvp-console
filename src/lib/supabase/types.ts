export type Database = {
	public: {
		Tables: {
			organizations: {
				Row: {
					id: string;
					name: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			users: {
				Row: {
					id: string;
					email: string;
					full_name: string;
					role: 'owner' | 'developer' | 'client';
					organization_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					email: string;
					full_name: string;
					role: 'owner' | 'developer' | 'client';
					organization_id: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					email?: string;
					full_name?: string;
					role?: 'owner' | 'developer' | 'client';
					organization_id?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			projects: {
				Row: {
					id: string;
					organization_id: string;
					name: string;
					repo_url: string | null;
					staging_url: string | null;
					production_url: string | null;
					status: 'active' | 'maintenance' | 'paused';
					created_at: string;
				};
				Insert: {
					id?: string;
					organization_id: string;
					name: string;
					repo_url?: string | null;
					staging_url?: string | null;
					production_url?: string | null;
					status?: 'active' | 'maintenance' | 'paused';
					created_at?: string;
				};
				Update: {
					id?: string;
					organization_id?: string;
					name?: string;
					repo_url?: string | null;
					staging_url?: string | null;
					production_url?: string | null;
					status?: 'active' | 'maintenance' | 'paused';
					created_at?: string;
				};
				Relationships: [];
			};
			specs: {
				Row: {
					id: string;
					project_id: string;
					title: string;
					summary: string | null;
					goal: string | null;
					acceptance_criteria: string | null;
					edge_cases: string | null;
					regression_risks: string | null;
					status: 'draft' | 'approved' | 'in_dev' | 'completed';
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					title: string;
					summary?: string | null;
					goal?: string | null;
					acceptance_criteria?: string | null;
					edge_cases?: string | null;
					regression_risks?: string | null;
					status?: 'draft' | 'approved' | 'in_dev' | 'completed';
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					title?: string;
					summary?: string | null;
					goal?: string | null;
					acceptance_criteria?: string | null;
					edge_cases?: string | null;
					regression_risks?: string | null;
					status?: 'draft' | 'approved' | 'in_dev' | 'completed';
					created_at?: string;
				};
				Relationships: [];
			};
		tasks: {
			Row: {
				id: string;
				project_id: string;
				spec_id: string | null;
				title: string;
				description: string | null;
				status: 'backlog' | 'in_progress' | 'review' | 'testing' | 'deployed';
				priority: 'low' | 'medium' | 'high';
				assignee: string | null;
				branch_name: string | null;
				created_at: string;
			};
			Insert: {
				id?: string;
				project_id: string;
				spec_id?: string | null;
				title: string;
				description?: string | null;
				status?: 'backlog' | 'in_progress' | 'review' | 'testing' | 'deployed';
				priority?: 'low' | 'medium' | 'high';
				assignee?: string | null;
				branch_name?: string | null;
				created_at?: string;
			};
			Update: {
				id?: string;
				project_id?: string;
				spec_id?: string | null;
				title?: string;
				description?: string | null;
				status?: 'backlog' | 'in_progress' | 'review' | 'testing' | 'deployed';
				priority?: 'low' | 'medium' | 'high';
				assignee?: string | null;
				branch_name?: string | null;
				created_at?: string;
			};
			Relationships: [];
		};
		tests: {
			Row: {
				id: string;
				project_id: string;
				name: string;
				type: 'unit' | 'integration' | 'e2e' | 'smoke' | 'manual';
				status: 'pass' | 'fail' | 'pending';
				last_run: string | null;
				notes: string | null;
				spec_id: string | null;
				task_id: string | null;
				source: 'manual' | 'github';
				linked_commit: string | null;
			};
			Insert: {
				id?: string;
				project_id: string;
				name: string;
				type: 'unit' | 'integration' | 'e2e' | 'smoke' | 'manual';
				status?: 'pass' | 'fail' | 'pending';
				last_run?: string | null;
				notes?: string | null;
				spec_id?: string | null;
				task_id?: string | null;
				source?: 'manual' | 'github';
				linked_commit?: string | null;
			};
			Update: {
				id?: string;
				project_id?: string;
				name?: string;
				type?: 'unit' | 'integration' | 'e2e' | 'smoke' | 'manual';
				status?: 'pass' | 'fail' | 'pending';
				last_run?: string | null;
				notes?: string | null;
				spec_id?: string | null;
				task_id?: string | null;
				source?: 'manual' | 'github';
				linked_commit?: string | null;
			};
			Relationships: [];
		};
			code_commits: {
				Row: {
					id: string;
					project_id: string;
					branch_name: string;
					commit_message: string;
					developer_name: string;
					status: 'draft' | 'in_review' | 'merged';
					task_id: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					branch_name: string;
					commit_message: string;
					developer_name?: string;
					status?: 'draft' | 'in_review' | 'merged';
					task_id?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					branch_name?: string;
					commit_message?: string;
					developer_name?: string;
					status?: 'draft' | 'in_review' | 'merged';
					task_id?: string | null;
					created_at?: string;
				};
				Relationships: [];
			};
			repo_branches: {
				Row: {
					id: string;
					project_id: string;
					name: string;
					last_activity_at: string;
					status: 'stable' | 'testing' | 'broken';
				};
				Insert: {
					id?: string;
					project_id: string;
					name: string;
					last_activity_at?: string;
					status?: 'stable' | 'testing' | 'broken';
				};
				Update: {
					id?: string;
					project_id?: string;
					name?: string;
					last_activity_at?: string;
					status?: 'stable' | 'testing' | 'broken';
				};
				Relationships: [];
			};
			project_environments: {
				Row: {
					id: string;
					project_id: string;
					kind: 'development' | 'staging' | 'production';
					url: string;
					current_version: string;
					last_deploy_at: string | null;
					status: 'healthy' | 'broken' | 'unknown';
				};
				Insert: {
					id?: string;
					project_id: string;
					kind: 'development' | 'staging' | 'production';
					url?: string;
					current_version?: string;
					last_deploy_at?: string | null;
					status?: 'healthy' | 'broken' | 'unknown';
				};
				Update: {
					id?: string;
					project_id?: string;
					kind?: 'development' | 'staging' | 'production';
					url?: string;
					current_version?: string;
					last_deploy_at?: string | null;
					status?: 'healthy' | 'broken' | 'unknown';
				};
				Relationships: [];
			};
			project_health: {
				Row: {
					id: string;
					project_id: string;
					uptime_status: 'up' | 'down' | 'degraded' | 'unknown';
					last_check_at: string | null;
					error_count: number;
					warning_count: number;
				};
				Insert: {
					id?: string;
					project_id: string;
					uptime_status?: 'up' | 'down' | 'degraded' | 'unknown';
					last_check_at?: string | null;
					error_count?: number;
					warning_count?: number;
				};
				Update: {
					id?: string;
					project_id?: string;
					uptime_status?: 'up' | 'down' | 'degraded' | 'unknown';
					last_check_at?: string | null;
					error_count?: number;
					warning_count?: number;
				};
				Relationships: [];
			};
			project_monitoring_public: {
				Row: {
					id: string;
					project_id: string;
					token: string;
					is_enabled: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					token: string;
					is_enabled?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					token?: string;
					is_enabled?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			deployment_observations: {
				Row: {
					id: string;
					project_id: string;
					gh_deploy_id: number;
					environment: string;
					commit_sha: string;
					ref: string | null;
					state: string;
					description: string | null;
					observed_at: string;
					source: string;
					github_status_detail: string | null;
					environment_url: string | null;
					log_url: string | null;
					target_url: string | null;
					creator_login: string | null;
				};
				Insert: {
					id?: string;
					project_id: string;
					gh_deploy_id: number;
					environment?: string;
					commit_sha?: string;
					ref?: string | null;
					state: string;
					description?: string | null;
					observed_at?: string;
					source?: string;
					github_status_detail?: string | null;
					environment_url?: string | null;
					log_url?: string | null;
					target_url?: string | null;
					creator_login?: string | null;
				};
				Update: {
					id?: string;
					project_id?: string;
					gh_deploy_id?: number;
					environment?: string;
					commit_sha?: string;
					ref?: string | null;
					state?: string;
					description?: string | null;
					observed_at?: string;
					source?: string;
					github_status_detail?: string | null;
					environment_url?: string | null;
					log_url?: string | null;
					target_url?: string | null;
					creator_login?: string | null;
				};
				Relationships: [];
			};
			project_integrations_railway: {
				Row: {
					id: string;
					project_id: string;
					api_token: string;
					railway_project_id: string;
					railway_environment_id: string;
					railway_service_id: string;
					enabled: boolean;
					last_poll_at: string | null;
					last_poll_error: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					api_token?: string;
					railway_project_id?: string;
					railway_environment_id?: string;
					railway_service_id?: string;
					enabled?: boolean;
					last_poll_at?: string | null;
					last_poll_error?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					api_token?: string;
					railway_project_id?: string;
					railway_environment_id?: string;
					railway_service_id?: string;
					enabled?: boolean;
					last_poll_at?: string | null;
					last_poll_error?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			deploy_log_entries: {
				Row: {
					id: string;
					project_id: string;
					railway_deployment_id: string;
					log_kind: string;
					logged_at: string;
					message: string;
					severity: string | null;
					attributes: Record<string, unknown>;
					dedupe_key: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					railway_deployment_id: string;
					log_kind?: string;
					logged_at: string;
					message: string;
					severity?: string | null;
					attributes?: Record<string, unknown>;
					dedupe_key: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					railway_deployment_id?: string;
					log_kind?: string;
					logged_at?: string;
					message?: string;
					severity?: string | null;
					attributes?: Record<string, unknown>;
					dedupe_key?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			deploy_log_events: {
				Row: {
					id: string;
					project_id: string;
					railway_deployment_id: string | null;
					kind: string;
					severity: string;
					title: string;
					detail: string | null;
					occurred_at: string;
					source_entry_id: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					railway_deployment_id?: string | null;
					kind: string;
					severity?: string;
					title: string;
					detail?: string | null;
					occurred_at: string;
					source_entry_id?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					railway_deployment_id?: string | null;
					kind?: string;
					severity?: string;
					title?: string;
					detail?: string | null;
					occurred_at?: string;
					source_entry_id?: string | null;
					created_at?: string;
				};
				Relationships: [];
			};
			monitoring_check_runs: {
				Row: {
					id: string;
					target_id: string;
					checked_at: string;
					ok: boolean;
					http_status: number | null;
					duration_ms: number;
					error_message: string | null;
				};
				Insert: {
					id?: string;
					target_id: string;
					checked_at?: string;
					ok?: boolean;
					http_status?: number | null;
					duration_ms?: number;
					error_message?: string | null;
				};
				Update: {
					id?: string;
					target_id?: string;
					checked_at?: string;
					ok?: boolean;
					http_status?: number | null;
					duration_ms?: number;
					error_message?: string | null;
				};
				Relationships: [];
			};
			monitoring_targets: {
				Row: {
					id: string;
					project_id: string;
					name: string;
					url: string;
					enabled: boolean;
					sort_order: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					name: string;
					url: string;
					enabled?: boolean;
					sort_order?: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					name?: string;
					url?: string;
					enabled?: boolean;
					sort_order?: number;
					created_at?: string;
				};
				Relationships: [];
			};
			milestones: {
			Row: {
				id: string;
				project_id: string;
				title: string;
				description: string;
				amount: number;
				status: 'planned' | 'active' | 'ready_for_payment' | 'paid' | 'overdue';
				due_date: string | null;
				paid_date: string | null;
				notes: string;
				task_id: string | null;
				priority: 'p1_critical' | 'p2_high' | 'p3_normal' | 'p4_low';
				estimate: string;
				phase:
					| 'discovery'
					| 'planning'
					| 'execution'
					| 'internal_testing'
					| 'client_review'
					| 'approved'
					| 'released'
					| 'blocked'
					| 'closed';
				spec_id: string | null;
				owner_user_id: string | null;
				entry_gate: string;
				exit_gate: string;
				test_gate_required_tests: string;
				test_gate_pass_threshold: string;
				test_gate_environment: string;
				dependencies: string;
				risks_blockers: string;
				deliverables: string;
				approval_owner_user_id: string | null;
				attach_bill: boolean;
				bill_amount: number | null;
				bill_status: 'draft' | 'sent' | 'paid' | 'overdue' | null;
				created_at: string;
			};
			Insert: {
				id?: string;
				project_id: string;
				title: string;
				description?: string;
				amount?: number;
				status?: 'planned' | 'active' | 'ready_for_payment' | 'paid' | 'overdue';
				due_date?: string | null;
				paid_date?: string | null;
				notes?: string;
				task_id?: string | null;
				priority?: 'p1_critical' | 'p2_high' | 'p3_normal' | 'p4_low';
				estimate?: string;
				phase?:
					| 'discovery'
					| 'planning'
					| 'execution'
					| 'internal_testing'
					| 'client_review'
					| 'approved'
					| 'released'
					| 'blocked'
					| 'closed';
				spec_id?: string | null;
				owner_user_id?: string | null;
				entry_gate?: string;
				exit_gate?: string;
				test_gate_required_tests?: string;
				test_gate_pass_threshold?: string;
				test_gate_environment?: string;
				dependencies?: string;
				risks_blockers?: string;
				deliverables?: string;
				approval_owner_user_id?: string | null;
				attach_bill?: boolean;
				bill_amount?: number | null;
				bill_status?: 'draft' | 'sent' | 'paid' | 'overdue' | null;
				created_at?: string;
			};
			Update: {
				id?: string;
				project_id?: string;
				title?: string;
				description?: string;
				amount?: number;
				status?: 'planned' | 'active' | 'ready_for_payment' | 'paid' | 'overdue';
				due_date?: string | null;
				paid_date?: string | null;
				notes?: string;
				task_id?: string | null;
				priority?: 'p1_critical' | 'p2_high' | 'p3_normal' | 'p4_low';
				estimate?: string;
				phase?:
					| 'discovery'
					| 'planning'
					| 'execution'
					| 'internal_testing'
					| 'client_review'
					| 'approved'
					| 'released'
					| 'blocked'
					| 'closed';
				spec_id?: string | null;
				owner_user_id?: string | null;
				entry_gate?: string;
				exit_gate?: string;
				test_gate_required_tests?: string;
				test_gate_pass_threshold?: string;
				test_gate_environment?: string;
				dependencies?: string;
				risks_blockers?: string;
				deliverables?: string;
				approval_owner_user_id?: string | null;
				attach_bill?: boolean;
				bill_amount?: number | null;
				bill_status?: 'draft' | 'sent' | 'paid' | 'overdue' | null;
				created_at?: string;
			};
			Relationships: [];
		};
			milestone_slices: {
				Row: {
					id: string;
					milestone_id: string;
					title: string;
					notes: string;
					owner_user_id: string | null;
					estimate: string;
					depends_on: string | null;
					status: 'pending' | 'in_progress' | 'done' | 'blocked';
					phase:
						| 'discovery'
						| 'planning'
						| 'execution'
						| 'internal_testing'
						| 'client_review'
						| 'approved'
						| 'released'
						| 'blocked'
						| 'closed';
					sort_order: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					milestone_id: string;
					title: string;
					notes?: string;
					owner_user_id?: string | null;
					estimate?: string;
					depends_on?: string | null;
					status?: 'pending' | 'in_progress' | 'done' | 'blocked';
					phase?:
						| 'discovery'
						| 'planning'
						| 'execution'
						| 'internal_testing'
						| 'client_review'
						| 'approved'
						| 'released'
						| 'blocked'
						| 'closed';
					sort_order?: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					milestone_id?: string;
					title?: string;
					notes?: string;
					owner_user_id?: string | null;
					estimate?: string;
					depends_on?: string | null;
					status?: 'pending' | 'in_progress' | 'done' | 'blocked';
					phase?:
						| 'discovery'
						| 'planning'
						| 'execution'
						| 'internal_testing'
						| 'client_review'
						| 'approved'
						| 'released'
						| 'blocked'
						| 'closed';
					sort_order?: number;
					created_at?: string;
				};
				Relationships: [];
			};
			milestone_task_links: {
				Row: {
					milestone_id: string;
					task_id: string;
				};
				Insert: {
					milestone_id: string;
					task_id: string;
				};
				Update: {
					milestone_id?: string;
					task_id?: string;
				};
				Relationships: [];
			};
			payments: {
				Row: {
					id: string;
					project_id: string;
					milestone_id: string | null;
					amount: number;
					payment_method: '' | 'wise' | 'bank_transfer' | 'paypal' | 'stripe' | 'cash' | 'other';
					paid_at: string;
					notes: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					milestone_id?: string | null;
					amount: number;
					payment_method?: '' | 'wise' | 'bank_transfer' | 'paypal' | 'stripe' | 'cash' | 'other';
					paid_at?: string;
					notes?: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					milestone_id?: string | null;
					amount?: number;
					payment_method?: '' | 'wise' | 'bank_transfer' | 'paypal' | 'stripe' | 'cash' | 'other';
					paid_at?: string;
					notes?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			expenses: {
				Row: {
					id: string;
					project_id: string;
					title: string;
					amount: number;
					category: '' | 'developer' | 'hosting' | 'domain' | 'api_credits' | 'design' | 'marketing' | 'other';
					spent_at: string;
					notes: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					title: string;
					amount?: number;
					category?: '' | 'developer' | 'hosting' | 'domain' | 'api_credits' | 'design' | 'marketing' | 'other';
					spent_at?: string;
					notes?: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					title?: string;
					amount?: number;
					category?: '' | 'developer' | 'hosting' | 'domain' | 'api_credits' | 'design' | 'marketing' | 'other';
					spent_at?: string;
					notes?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			project_integrations_github: {
				Row: {
					id: string;
					project_id: string;
					installation_id: number;
					repo_owner: string;
					repo_name: string;
					access_token: string;
					token_expires_at: string | null;
					last_sync_at: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					installation_id: number;
					repo_owner: string;
					repo_name: string;
					access_token?: string;
					token_expires_at?: string | null;
					last_sync_at?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					installation_id?: number;
					repo_owner?: string;
					repo_name?: string;
					access_token?: string;
					token_expires_at?: string | null;
					last_sync_at?: string | null;
					created_at?: string;
				};
				Relationships: [];
			};
			github_branches: {
				Row: {
					id: string;
					project_id: string;
					name: string;
					last_commit_sha: string;
					last_commit_message: string;
					updated_at: string;
					status: 'active' | 'stale';
				};
				Insert: {
					id?: string;
					project_id: string;
					name: string;
					last_commit_sha?: string;
					last_commit_message?: string;
					updated_at?: string;
					status?: 'active' | 'stale';
				};
				Update: {
					id?: string;
					project_id?: string;
					name?: string;
					last_commit_sha?: string;
					last_commit_message?: string;
					updated_at?: string;
					status?: 'active' | 'stale';
				};
				Relationships: [];
			};
			github_pull_requests: {
				Row: {
					id: string;
					project_id: string;
					gh_number: number;
					title: string;
					branch: string;
					status: 'open' | 'merged' | 'closed';
					author: string;
					created_at: string;
					merged_at: string | null;
				};
				Insert: {
					id?: string;
					project_id: string;
					gh_number: number;
					title: string;
					branch?: string;
					status?: 'open' | 'merged' | 'closed';
					author?: string;
					created_at?: string;
					merged_at?: string | null;
				};
				Update: {
					id?: string;
					project_id?: string;
					gh_number?: number;
					title?: string;
					branch?: string;
					status?: 'open' | 'merged' | 'closed';
					author?: string;
					created_at?: string;
					merged_at?: string | null;
				};
				Relationships: [];
			};
			github_commits: {
				Row: {
					id: string;
					project_id: string;
					sha: string;
					branch: string;
					message: string;
					author: string;
					committed_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					sha: string;
					branch?: string;
					message?: string;
					author?: string;
					committed_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					sha?: string;
					branch?: string;
					message?: string;
					author?: string;
					committed_at?: string;
				};
				Relationships: [];
			};
			github_ci_runs: {
				Row: {
					id: string;
					project_id: string;
					gh_run_id: number;
					workflow_name: string;
					branch: string;
					commit_sha: string;
					status: 'pending' | 'in_progress' | 'success' | 'failure' | 'cancelled';
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					gh_run_id: number;
					workflow_name?: string;
					branch?: string;
					commit_sha?: string;
					status?: 'pending' | 'in_progress' | 'success' | 'failure' | 'cancelled';
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					gh_run_id?: number;
					workflow_name?: string;
					branch?: string;
					commit_sha?: string;
					status?: 'pending' | 'in_progress' | 'success' | 'failure' | 'cancelled';
					created_at?: string;
				};
				Relationships: [];
			};
			github_deployments: {
				Row: {
					id: string;
					project_id: string;
					gh_deploy_id: number;
					environment: string;
					commit_sha: string;
					ref: string | null;
					status: 'pending' | 'success' | 'failure' | 'inactive';
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					gh_deploy_id: number;
					environment?: string;
					commit_sha?: string;
					ref?: string | null;
					status?: 'pending' | 'success' | 'failure' | 'inactive';
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					gh_deploy_id?: number;
					environment?: string;
					commit_sha?: string;
					ref?: string | null;
					status?: 'pending' | 'success' | 'failure' | 'inactive';
					created_at?: string;
				};
				Relationships: [];
			};
			github_webhook_events: {
				Row: {
					id: string;
					delivery_id: string;
					event_type: string;
					payload: Record<string, unknown>;
					processed_at: string;
				};
				Insert: {
					id?: string;
					delivery_id: string;
					event_type: string;
					payload?: Record<string, unknown>;
					processed_at?: string;
				};
				Update: {
					id?: string;
					delivery_id?: string;
					event_type?: string;
					payload?: Record<string, unknown>;
					processed_at?: string;
				};
				Relationships: [];
			};
			deployments: {
				Row: {
					id: string;
					project_id: string;
					environment: 'staging' | 'production';
					version: string;
					status: 'success' | 'failed' | 'pending';
					notes: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					project_id: string;
					environment: 'staging' | 'production';
					version: string;
					status?: 'success' | 'failed' | 'pending';
					notes?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					project_id?: string;
					environment?: 'staging' | 'production';
					version?: string;
					status?: 'success' | 'failed' | 'pending';
					notes?: string | null;
					created_at?: string;
				};
				Relationships: [];
			};
			incidents: {
				Row: {
					id: string;
					project_id: string;
					title: string;
					severity: 'low' | 'medium' | 'high' | 'critical';
					status: 'open' | 'investigating' | 'resolved';
					description: string | null;
					created_at: string;
					resolved_at: string | null;
				};
				Insert: {
					id?: string;
					project_id: string;
					title: string;
					severity: 'low' | 'medium' | 'high' | 'critical';
					status?: 'open' | 'investigating' | 'resolved';
					description?: string | null;
					created_at?: string;
					resolved_at?: string | null;
				};
				Update: {
					id?: string;
					project_id?: string;
					title?: string;
					severity?: 'low' | 'medium' | 'high' | 'critical';
					status?: 'open' | 'investigating' | 'resolved';
					description?: string | null;
					created_at?: string;
					resolved_at?: string | null;
				};
				Relationships: [];
			};
			reports: {
			Row: {
				id: string;
				project_id: string;
				title: string;
				content: string;
				created_by: string;
				created_at: string;
				updated_at: string;
			};
			Insert: {
				id?: string;
				project_id: string;
				title: string;
				content?: string;
				created_by?: string;
				created_at?: string;
				updated_at?: string;
			};
			Update: {
				id?: string;
				project_id?: string;
				title?: string;
				content?: string;
				created_by?: string;
				created_at?: string;
				updated_at?: string;
			};
			Relationships: [];
		};
		api_keys: {
			Row: {
				id: string;
				project_id: string;
				name: string;
				key_hash: string;
				key_prefix: string;
				created_by: string;
				created_at: string;
				last_used_at: string | null;
			};
			Insert: {
				id?: string;
				project_id: string;
				name: string;
				key_hash: string;
				key_prefix: string;
				created_by?: string;
				created_at?: string;
				last_used_at?: string | null;
			};
			Update: {
				id?: string;
				project_id?: string;
				name?: string;
				key_hash?: string;
				key_prefix?: string;
				created_by?: string;
				created_at?: string;
				last_used_at?: string | null;
			};
			Relationships: [];
		};
		activity_log: {
			Row: {
				id: string;
				project_id: string;
				action: string;
				actor: string;
				metadata: Record<string, unknown> | null;
				created_at: string;
			};
			Insert: {
				id?: string;
				project_id: string;
				action: string;
				actor: string;
				metadata?: Record<string, unknown> | null;
				created_at?: string;
			};
			Update: {
				id?: string;
				project_id?: string;
				action?: string;
				actor?: string;
				metadata?: Record<string, unknown> | null;
				created_at?: string;
			};
			Relationships: [];
		};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

export type Tables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Update'];
