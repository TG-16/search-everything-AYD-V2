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

module.exports = { fetchDashboardMetrics };