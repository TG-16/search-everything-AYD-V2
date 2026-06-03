const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validate: isUUID } = require("uuid");
const { use } = require("../routes/auth.route");
const {
  createWorkspace,
  createTable,
  addColumns,
} = require("../models/crud.model");

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

    // Table names cannot be parameterized, so validate them.
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({
        status: false,
        message: "Invalid table name",
      });
    }

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
    console.error("table creation error:", error);

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
      message:
        "Database schema update failed. Verify table existence and layout parameters.",
    });
  }
};

module.exports = {
  workspace,
  tableCreation,
  addColumn,
};
