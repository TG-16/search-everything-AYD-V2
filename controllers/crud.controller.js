const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { use } = require("../routes/auth.route");
const { createWorkspace } = require("../models/crud.model");

const workspace = (req, res) => {
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

module.exports = {
  workspace,
};
