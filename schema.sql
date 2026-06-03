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






-- trigers for adding inserted data to the global registry dynamicly
CREATE OR REPLACE FUNCTION sync_dynamic_table_to_global_registry()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
    v_source_table TEXT;
    v_registry_table TEXT; -- Dynamically generated target table name
    v_searchable_text TEXT := '';
    v_row_json JSONB;
    v_source_row_id UUID;
    v_key TEXT;
    v_val TEXT;
    v_dynamic_query TEXT;
BEGIN
    -- Extract properties dynamically from TG_TABLE_NAME (Format: tableName_workspaceId)
    v_workspace_id := right(TG_TABLE_NAME, 36)::UUID;
    v_source_table := left(TG_TABLE_NAME, length(TG_TABLE_NAME) - 37);
    
    -- Target registry table name format
    v_registry_table := 'global_registry_' || v_workspace_id::text;

    -- Capture row data based on transaction operational state
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_row_json := to_jsonb(NEW);
    ELSE
        v_row_json := to_jsonb(OLD);
    END IF;

    v_source_row_id := (v_row_json->>'id')::UUID;

    -- ================================================
    -- CASE 1: DELETE OPERATION
    -- ================================================
    IF TG_OP = 'DELETE' THEN
        v_dynamic_query := format('
            DELETE FROM %I 
            WHERE source_table = $1 AND source_row_id = $2
        ', v_registry_table);
        
        EXECUTE v_dynamic_query USING v_source_table, v_source_row_id;
        RETURN OLD;
    END IF;

    -- ================================================
    -- DYNAMIC TEXT EXTRACTION
    -- ================================================
    FOR v_key, v_val IN SELECT * FROM jsonb_each_text(v_row_json) LOOP
        IF v_key <> 'id' AND v_val IS NOT NULL AND jsonb_typeof(v_row_json->v_key) = 'string' THEN
            v_searchable_text := v_searchable_text || v_val || ' ';
        END IF;
    END LOOP;
    
    v_searchable_text := trim(v_searchable_text);

    -- ================================================
    -- CASE 2: INSERT OPERATION
    -- ================================================
    IF TG_OP = 'INSERT' THEN
        v_dynamic_query := format('
            INSERT INTO %I (
                workspace_id, source_table, source_row_id, 
                searchable_text, searchable_tsv, metadata, embedding_status
            ) VALUES ($1, $2, $3, $4, to_tsvector(''english'', coalesce($4, '''')), $5, ''pending'')
        ', v_registry_table);
        
        EXECUTE v_dynamic_query USING v_workspace_id, v_source_table, v_source_row_id, v_searchable_text, v_row_json;
        RETURN NEW;

    -- ================================================
    -- CASE 3: UPDATE OPERATION
    -- ================================================
    ELSIF TG_OP = 'UPDATE' THEN
        v_dynamic_query := format('
            UPDATE %I
            SET 
                searchable_text = $1,
                searchable_tsv = to_tsvector(''english'', coalesce($1, '''')),
                metadata = $2,
                embedding = NULL,
                embedding_status = ''pending'',
                updated_at = NOW()
            WHERE source_table = $3 AND source_row_id = $4
        ', v_registry_table);
        
        EXECUTE v_dynamic_query USING v_searchable_text, v_row_json, v_source_table, v_source_row_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;