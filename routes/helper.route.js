const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const limitChecker = require("../middlewares/limitChecker.middleware");
const {
  getDashboardOverview,
  listWorkspaces,
  getWorkspaceTablesOverview,
  showProfile,
  listApiKeys,
} = require("../controllers/helper.controller");

router.post("/dashboard", auth, getDashboardOverview);
router.post("/workspaces", auth, listWorkspaces);
router.post("/tables", auth, getWorkspaceTablesOverview);
router.get("/showProfile", auth, showProfile);
router.get("/getApiKeys", auth, listApiKeys);

module.exports = router;
