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