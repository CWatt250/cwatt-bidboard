-- ============================================================
-- Migration 010: Permissions System
-- Tables: roles, permissions, role_permissions,
--         user_role_assignments, user_permission_overrides
-- ============================================================

-- 1. Roles table
CREATE TABLE roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_system_role boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Permissions catalog
CREATE TABLE permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  module text NOT NULL,
  action text NOT NULL,
  key text UNIQUE NOT NULL,
  description text
);

-- 3. Role permissions (which permissions each role has)
CREATE TABLE role_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  allowed boolean DEFAULT true
);

-- 4. User role assignments (branch-scoped)
CREATE TABLE user_role_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 5. User permission overrides
CREATE TABLE user_permission_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id),
  permission_key text NOT NULL,
  allowed boolean NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- Seed: Roles
-- ============================================================

INSERT INTO roles (key, name, description, is_system_role) VALUES
  ('system_admin',    'System Admin',    'Full access across all branches and modules', true),
  ('branch_manager',  'Branch Manager',  'Manages a single branch — bids, reports, users', true),
  ('estimator',       'Estimator',       'Creates and manages own bids', true),
  ('viewer',          'Viewer',          'Read-only access to all modules', true);

-- ============================================================
-- Seed: Permission catalog
-- ============================================================

INSERT INTO permissions (module, action, key, description) VALUES
  -- Dashboard
  ('dashboard',      'view',        'dashboard.view',              'View the main dashboard'),
  -- My Workspace
  ('workspace',      'view',        'workspace.view',              'View My Workspace'),
  ('workspace',      'claim',       'workspace.claim',             'Claim unassigned bids'),
  ('workspace',      'move_status', 'workspace.move_status',       'Move bids between status columns'),
  ('workspace',      'reassign',    'workspace.reassign',          'Reassign bids to other estimators'),
  -- Bid Board
  ('bid_board',      'view',        'bid_board.view',              'View the Bid Board'),
  ('bid_board',      'create',      'bid_board.create',            'Create new bids'),
  ('bid_board',      'edit',        'bid_board.edit',              'Edit existing bids'),
  ('bid_board',      'delete',      'bid_board.delete',            'Delete bids'),
  ('bid_board',      'export',      'bid_board.export',            'Export bid data to CSV'),
  -- Project Detail
  ('project_detail', 'view',        'project_detail.view',         'View bid detail page'),
  ('project_detail', 'edit',        'project_detail.edit',         'Edit bid details'),
  -- Calendar
  ('calendar',       'view',        'calendar.view',               'View the calendar'),
  -- Users
  ('users',          'view',        'users.view',                  'View user list'),
  ('users',          'edit',        'users.edit',                  'Edit user profiles'),
  -- Branches
  ('branches',       'view',        'branches.view',               'View branch settings'),
  ('branches',       'edit',        'branches.edit',               'Edit branch settings'),
  -- Reports
  ('reports',        'view',        'reports.view',                'View reports'),
  ('reports',        'export',      'reports.export',              'Export report data'),
  -- Permissions
  ('permissions',    'view',        'permissions.view',            'View permission settings'),
  ('permissions',    'edit',        'permissions.edit',            'Edit permission settings'),
  -- System
  ('system',         'admin',       'system.admin',                'Full system administration');

-- ============================================================
-- Seed: Default role_permissions
-- ============================================================

-- Helper: get role id by key
-- System Admin — everything
INSERT INTO role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key, true
FROM roles r, permissions p
WHERE r.key = 'system_admin';

-- Branch Manager — everything except permissions.edit, system.admin, bid_board.delete
INSERT INTO role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key, true
FROM roles r, permissions p
WHERE r.key = 'branch_manager'
  AND p.key NOT IN ('permissions.edit', 'system.admin', 'bid_board.delete');

-- Estimator — workspace, bid_board (view/create/edit), project_detail, calendar, dashboard
INSERT INTO role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key, true
FROM roles r, permissions p
WHERE r.key = 'estimator'
  AND p.key IN (
    'dashboard.view',
    'workspace.view', 'workspace.claim', 'workspace.move_status',
    'bid_board.view', 'bid_board.create', 'bid_board.edit',
    'project_detail.view', 'project_detail.edit',
    'calendar.view'
  );

-- Viewer — view-only on every module
INSERT INTO role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key, true
FROM roles r, permissions p
WHERE r.key = 'viewer'
  AND p.action = 'view';

-- ============================================================
-- RLS: Only admins can read/write these tables
-- ============================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users (needed by permission resolver)
CREATE POLICY "Authenticated users can read roles"
  ON roles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read permissions"
  ON permissions FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read role_permissions"
  ON role_permissions FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read user_role_assignments"
  ON user_role_assignments FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read user_permission_overrides"
  ON user_permission_overrides FOR SELECT USING (auth.role() = 'authenticated');

-- Write access for admins only
CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can manage role_permissions"
  ON role_permissions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can manage user_role_assignments"
  ON user_role_assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can manage user_permission_overrides"
  ON user_permission_overrides FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
