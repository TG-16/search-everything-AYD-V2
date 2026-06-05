const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const limitChecker = require("../middlewares/limitChecker.middleware");
const {
  getDashboardOverview,
  listWorkspaces,
  getWorkspaceTablesOverview,
} = require("../controllers/helper.controller");

router.post("/dashboard", auth, limitChecker, getDashboardOverview);
router.post("/workspaces", auth, limitChecker, listWorkspaces);
router.post("/tables", auth, limitChecker, getWorkspaceTablesOverview);

module.exports = router;
