const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const limitChecker = require("../middlewares/limitChecker.middleware");
const {
  workspace,
  tableCreation,
  addColumn,
  addData,
} = require("../controllers/crud.controller");
const registerValidation = require("../middlewares/validators/register.validator");

router.post("/createWorkspace", auth, limitChecker, workspace);
router.post("/createTable", auth, limitChecker, tableCreation);
router.post("/addColumns", auth, limitChecker, addColumn);
router.post("/insertData", auth, limitChecker, addData);

module.exports = router;
