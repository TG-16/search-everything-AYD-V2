const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validate: isUUID } = require("uuid");
const { use } = require("../routes/auth.route");
const {
  createWorkspace,
  createTable,
  addColumns,
  insertData,
  searchVectorRegistry,
} = require("../models/crud.model");
const { pipeline } = require('@huggingface/transformers');

const workspace = async (req, res) => {
  // get the user id and wokspace name
  // create a workspace workspace name + userid as a name
  // return success with workspace id
  const userId = req.user.id;
  const { workspaceName } = req.body;

  try {
    const workspace = await createWorkspace({ userId, workspaceName });

    return res
      .status(200)
      .json({ status: true, message: { workspaceId: workspace.workspace_id } });
  } catch (error) {
    console.error("workspace creation error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error please try later",
    });
  }
};

const tableCreation = async (req, res) => {
  const { workspaceId, tableName } = req.body;

  try {
    // Basic validation
    if (!workspaceId || !tableName) {
      return res.status(400).json({
        status: false,
        message: "workspaceId and tableName are required",
      });
    }

    if (!isUUID(workspaceId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid workspaceId",
      });
    }

    // Table names cannot be parameterized, so strict regex validation is required
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({
        status: false,
        message: "Invalid table name. Only alphanumeric characters and underscores are allowed.",
      });
    }

    // Execute table creation and trigger attachment
    const table = await createTable({
      workspaceId,
      tableName,
    });

    return res.status(201).json({
      status: true,
      message: {
        tableId: table.table_id,
      },
    });
    
  } catch (error) {
    console.error("Table creation error:", error);

    // Handle foreign key violation (e.g., workspace_id doesn't exist in the workspaces table)
    if (error.code === "23503") {
      return res.status(404).json({
        status: false,
        message: "Workspace not found",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Internal server error. Please try again later.",
    });
  }
};
const addColumn = async (req, res) => {
  const { tableName, workspaceId, columns } = req.body;

  // 1. Authorization validation
  if (!isUUID(workspaceId)) {
    return res
      .status(400)
      .json({ status: false, message: "Invalid workspace" });
  }

  // Basic payload validation
  if (!tableName || !workspaceId || !Array.isArray(columns)) {
    return res
      .status(400)
      .json({ status: false, message: "Invalid payload layout" });
  }

  try {
    // 2. Format targeted table to: table_name_workspaceId
    const targetTable = `${tableName}_${workspaceId}`;

    // 3. Prepare columns array and process foreign key table prefixes
    const preparedColumns = columns.map((col) => {
      const clonedCol = { ...col };

      if (clonedCol.foreignKey) {
        clonedCol.foreignKey = {
          ...clonedCol.foreignKey,
          // Explicitly prefix the referenced table name to restrict it to this workspace
          referenceTable: `${clonedCol.foreignKey.referenceTable}_${workspaceId}`,
        };
      }
      return clonedCol;
    });

    // 4. Fire the dynamic engine
    await addColumns(targetTable, preparedColumns);

    return res.status(200).json({
      status: true,
      message: `Columns successfully added to ${tableName}`,
    });
  } catch (error) {
    console.error("DB Alteration Error:", error);
    return res.status(500).json({
      status: false,
      message: {
        message:
          "Database schema update failed. Verify table existence and layout parameters.",
        error,
      },
    });
  }
};



const addData = async (req, res) => {
  const { tableName, workspaceId, data } = req.body;

  // 1. Authorization validation
  if (!isUUID(workspaceId)) {
    return res
      .status(400)
      .json({ status: false, message: "Invalid workspace" });
  }

  // Basic payload validation
  if (!tableName || !workspaceId || !data) {
    return res.status(400).json({ status: false, message: "Missing required fields (tableName, workspaceId, data)" });
  }

  try {
    // 2. Standardize data into an array (handles both single row object and multiple rows array)
    const rowsToInsert = Array.isArray(data) ? data : [data];

    if (rowsToInsert.length === 0) {
      return res.status(400).json({ status: false, message: "No data provided for insertion" });
    }

    // 3. Format the targeted isolated table name
    const targetTable = `${tableName}_${workspaceId}`;

    // 4. Pass execution to the dynamic model engine
    const result = await insertData({targetTable, rowsToInsert});

    return res.status(201).json({ 
      status: true, 
      message: `Successfully inserted ${rowsToInsert.length} row(s) into ${tableName}`,
      insertedCount: rowsToInsert.length
    });

  } catch (error) {
    console.error("Data Insertion Error:", error);
    return res.status(500).json({ 
      status: false, 
      message: "Database insertion failed. Verify table structure, constraints, and column data types." 
    });
  }
};


//temporary checking code
let searchExtractor = null;

// Initialize the model once for search runtime processing
const getSearchExtractor = async () => {
  if (!searchExtractor) {
    searchExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return searchExtractor;
};

const vectorSearch = async (req, res) => {
  const { workspaceId, query, limit } = req.body;

  // 1. Basic Validations
  if (!workspaceId || !query) {
    return res.status(400).json({ status: false, message: "workspaceId and query string are required." });
  }

  try {
    // 2. Load extraction pipeline and vectorize the incoming plain text query
    const extractor = await getSearchExtractor();
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data);

    // 3. Query the isolated database shard
    const results = await searchVectorRegistry({
      workspaceId,
      queryVector,
      limit: parseInt(limit, 10) || 5
    });

    return res.status(200).json({
      status: true,
      results
    });

  } catch (error) {
    console.error("Vector search routing failure:", error);
    return res.status(500).json({ status: false, message: "Failed to process semantic vector search query." });
  }
};


module.exports = {
  workspace,
  tableCreation,
  addColumn,
  addData,
  vectorSearch,
};
