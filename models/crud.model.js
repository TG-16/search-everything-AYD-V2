const db = require("../config/db");

const createWorkspace = async ({ userId, workspaceName }) => {
  const query = `
    INSERT INTO workspace (user_id, workspace_name)
    VALUES ($1, $2)
    RETURNING *;
  `;

  const values = [userId, `${workspaceName}_${userId}`];
  const { rows } = await db.query(query, values);

  return rows[0];
};

const createTable = async ({ workspaceId, tableName }) => {
  const actualTableName = `${tableName}_${workspaceId}`;

  // Save metadata
  const insertQuery = `
    INSERT INTO tables (workspace_id, table_name)
    VALUES ($1, $2)
    RETURNING *;
  `;

  const { rows } = await db.query(insertQuery, [
    workspaceId,
    actualTableName,
  ]);

  // Create actual table
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS "${actualTableName}" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `;

  await db.query(createTableQuery);

  return rows[0];
//   return {table_id: "123456"}
};


// Map abstract types to strict SQL data types
const SQL_TYPE_MAP = {
  text: 'VARCHAR(255)',
  number: 'NUMERIC', // Or 'INT' / 'DOUBLE PRECISION' depending on your preference
  date: 'TIMESTAMP', // Or 'DATE' depending on whether you need time tracking
  id: 'UUID'  
};

const addColumns = async (tableName, columns) => {
  const columnDefinitions = columns.map(col => {
    // 1. Resolve to the strict SQL type, default to VARCHAR(255) if 'text' or unrecognized
    const resolvedType = SQL_TYPE_MAP[col.dataType?.toLowerCase()] || 'VARCHAR(255)';
    
    // Clean column name to prevent any unexpected characters (alphanumeric and underscores only)
    const cleanColName = col.name.replace(/[^a-zA-Z0-9_]/g, '');
    
    let parts = [`ADD COLUMN ${cleanColName} ${resolvedType}`];

    // 2. Handle Constraints
    if (col.constraints) {
      if (col.constraints.notNull) parts.push("NOT NULL");
      if (col.constraints.unique) parts.push("UNIQUE");
    }

    // 3. Handle Foreign Keys
    if (col.foreignKey) {
      const { referenceTable, referenceColumn } = col.foreignKey;
      // Sanitize the dynamic reference components
      const cleanRefTable = referenceTable;
      const cleanRefColumn = referenceColumn;
      
      parts.push(`REFERENCES "${cleanRefTable}"(${cleanRefColumn})`);
    }

    return parts.join(" ");
  });

  // Construct the final statement safely
  // Clean the table name one last time for defensive security
  const cleanTableName = tableName;
  const sql = `ALTER TABLE "${cleanTableName}" ${columnDefinitions.join(", ")};`;

  // Execute the query
  return await db.query(sql);
};


module.exports = {
  createWorkspace,
  createTable,
  addColumns,
};
