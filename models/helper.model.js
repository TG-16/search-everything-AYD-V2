const db = require('../config/db');

/**
 * Gathers dashboard telemetry data utilizing the exact workspace and tables registries
 */
const fetchDashboardMetrics = async (userId) => {
  const client = await db.connect();
  
  try {
    // 1. Count workspaces belonging to this user
    const workspaceQuery = `
      SELECT COUNT(*)::int as count FROM workspace WHERE user_id = $1;
    `;
    const { rows: workspaces } = await client.query(workspaceQuery, [userId]);
    const workspaceCount = workspaces[0].count;

    // 2. Count active API keys allocated under this user
    const apiKeyQuery = `
      SELECT COUNT(*)::int as count FROM api_keys WHERE user_id = $1;
    `;
    const { rows: keys } = await client.query(apiKeyQuery, [userId]);
    const apiKeyCount = keys[0].count;

    // 3. Dynamic Storage Calculation
    // Fixed: Uses 't.table_name' and joins on 'w.workspace_id'
    const storageQuery = `
      SELECT COALESCE(SUM(pg_total_relation_size(to_regclass('"' || t.table_name || '_' || t.workspace_id || '"'))), 0)::bigint as bytes
      FROM tables t
      INNER JOIN workspace w ON t.workspace_id = w.workspace_id
      WHERE w.user_id = $1;
    `;
    const { rows: storage } = await client.query(storageQuery, [userId]);
    const totalBytes = storage[0]?.bytes || 0;

    console.log(totalBytes);

   // Convert bytes to Gigabytes safely with 2 decimal precision
const totalStorageGB = parseFloat((Number(totalBytes) / (1024 * 1024 * 1024)).toFixed(2));

    // 4. Hardcoded placeholder for monthly requests (to be implemented later)
    const monthlyRequestsPlaceholder = 12450; 

    return {
      totalStorageGB,
      workspaceCount,
      apiKeyCount,
      monthlyRequests: monthlyRequestsPlaceholder
    };

  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Retrieves all workspaces owned by a specific user profile
 */
const getUserWorkspaces = async (userId) => {
  const sql = `
    SELECT workspace_id, workspace_name 
    FROM workspace 
    WHERE user_id = $1
    ORDER BY workspace_name ASC;
  `;

  const { rows } = await db.query(sql, [userId]);
  return rows;
};


/**Retrieves all registered tables and their structural column metadata for a workspace.
 * Bypasses string-matching bugs by using a case-insensitive join on the native pg_class ledger.
 **/
const getWorkspaceSchema = async (workspaceId) => {
  const sql = `
    SELECT 
      t.table_name,
      a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod) AS data_type
    FROM tables t
    INNER JOIN pg_class c 
      ON LOWER(c.relname) = LOWER(t.table_name || '_' || $1::text)
    INNER JOIN pg_namespace n 
      ON n.oid = c.relnamespace AND n.nspname = 'public'
    INNER JOIN pg_attribute a 
      ON a.attrelid = c.oid
    WHERE t.workspace_id = $1::uuid
      AND a.attnum > 0 
      AND NOT a.attisdropped
    ORDER BY t.table_name, a.attnum;
  `;

  const { rows } = await db.query(sql, [workspaceId]);

  // Transform flat database rows into a structured JSON tree
  const tablesMap = {};

  rows.forEach(row => {
    if (!tablesMap[row.table_name]) {
      tablesMap[row.table_name] = {
        tableName: row.table_name,
        schema: []
      };
    }
    
    tablesMap[row.table_name].schema.push({
      columnName: row.column_name,
      dataType: row.data_type
    });
  });

  return Object.values(tablesMap);
};


module.exports = { fetchDashboardMetrics, getUserWorkspaces, getWorkspaceSchema };