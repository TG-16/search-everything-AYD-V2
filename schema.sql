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



CREATE TABLE workspace (
    workspace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_name VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,

    CONSTRAINT fk_workspace_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

Notes
user_id references the id column in the users table.
ON DELETE CASCADE means if a user is deleted, all their workspaces are deleted automatically.