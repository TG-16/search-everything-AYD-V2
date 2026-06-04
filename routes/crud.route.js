const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const limitChecker = require("../middlewares/limitChecker.middleware");
const {
  workspace,
  tableCreation,
  addColumn,
  addData,
  readData,
  editSingleData,
  editBatchData,
} = require("../controllers/crud.controller");
const registerValidation = require("../middlewares/validators/register.validator");


const largeJsonParser = express.json({ limit: '5mb' });

router.post("/createWorkspace", auth, limitChecker, workspace);
router.post("/createTable", auth, limitChecker, tableCreation);
router.post("/addColumns", auth, limitChecker, addColumn);
router.post("/insertData", largeJsonParser, auth, limitChecker, addData);
router.post("/readData", auth, limitChecker, readData);

router.post("/editSingleData", auth, limitChecker, editSingleData);
router.post("/editBatchData", auth, limitChecker, editBatchData);




module.exports = router;
