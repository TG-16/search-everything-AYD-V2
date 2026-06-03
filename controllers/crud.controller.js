const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { use } = require("../routes/auth.route");
const { createWorkspace, createTable } = require("../models/crud.model");

const workspace = async (req, res) => {
  // get the user id and wokspace name
  // create a workspace workspace name + userid as a name
  // return success with workspace id
  const userId = req.user.id;
  const { workspaceName } = req.body;

  try {

    const workspace = await createWorkspace({userId, workspaceName});

    return res.status(200).json({status: true, message: {workspaceId: workspace.id}});

  } catch (error) {
    console.error("workspace creation error:", error);
    return res.status(500).json({ status: false, message: "Internal Server Error please try later" });
  }
};


const tableCreation = async (req, res) => {
    // get workerspaceId and table name
    // create a table with tablename + workerspaceId as a name
    // return table id

    const { workspaceId, tableName } = req.body;

    try {

        const table = await createTable({workspaceId, tableName});

        return res.status(200).json({status: true, message: {tableId: table.id}});

    } catch (error) {
    console.error("table creation error:", error);
    return res.status(500).json({ status: false, message: "Invalid workerspace id or Internal Server Error please try later" });
  }
}

module.exports = {
  workspace,
  tableCreation,
};
