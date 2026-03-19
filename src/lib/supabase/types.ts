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
					created_at?: string;
				};
			};
			tests: {
				Row: {
					id: string;
					project_id: string;
					name: string;
					type: 'unit' | 'integration' | 'smoke' | 'manual';
					status: 'pass' | 'fail' | 'pending';
					last_run: string | null;
					notes: string | null;
				};
				Insert: {
					id?: string;
					project_id: string;
					name: string;
					type: 'unit' | 'integration' | 'smoke' | 'manual';
					status?: 'pass' | 'fail' | 'pending';
					last_run?: string | null;
					notes?: string | null;
				};
				Update: {
					id?: string;
					project_id?: string;
					name?: string;
					type?: 'unit' | 'integration' | 'smoke' | 'manual';
					status?: 'pass' | 'fail' | 'pending';
					last_run?: string | null;
					notes?: string | null;
				};
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
