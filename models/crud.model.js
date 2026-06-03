const db = require("../config/db");

const createWorkspace = async ({ userId, workspaceName }) => {
  const query = `
    INSERT INTO workspace (userId, name)
    VALUES ($1, $2)
    RETURNING *;
  `;

  const values = [userId, `${workspaceName}_${userId}`];
  const { rows } = await db.query(query, values);

  return rows[0];
};

const createTable = async ({ workerspaceId, tableName }) => {
  const query = `
    INSERT INTO tables (workerspace_id, table_name)
    VALUES ($1, $2)
    RETURNING *;
  `;

  const values = [workerspaceId, `${tableName}_${workerspaceId}`];
  const { rows } = await db.query(query, values);

  return rows[0];
};

module.exports = {
  createWorkspace,
  createTable,
};
