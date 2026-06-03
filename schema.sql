-- Create the database
CREATE DATABASE "AYD_v2";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'local',
    is_under_limit BOOLEAN NOT NULL DEFAULT TRUE
);
###########################################
###########################################
CREATE TABLE workspace (
    workspace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_name VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    CONSTRAINT fk_workspace_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
ALTER TABLE tables
ADD CONSTRAINT unique_table_per_workspace
UNIQUE (workspace_id, table_name);

or


CREATE TABLE tables (
    table_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(255) NOT NULL,
    workspace_id UUID NOT NULL,

    FOREIGN KEY (workspace_id)
        REFERENCES workspace(workspace_id)
        ON DELETE CASCADE,

    UNIQUE (workspace_id, table_name)
);

Notes user_id references the id column in the users table.ON DELETE CASCADE means if a user is deleted,
all their workspaces are deleted automatically.
###########################################
###########################################
CREATE TABLE tables (
    table_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(255) NOT NULL,
    workspace_id UUID NOT NULL,
    CONSTRAINT fk_tables_workspace FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE
);
Notes ON DELETE CASCADE → if a workspace is deleted,
all related records in tables are automatically deleted.
###########################################
###########################################