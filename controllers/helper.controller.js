const { fetchDashboardMetrics, getUserWorkspaces, getWorkspaceSchema } = require('../models/helper.model');

/**
 * Controller to fetch a combined utilization report for the user overview panels
 */
const getDashboardOverview = async (req, res) => {
  const { id: userId } = req.user; // Context set dynamically by your authentication middleware

  try {
    const metrics = await fetchDashboardMetrics(userId);

    return res.status(200).json({
      status: true,
      message: "Dashboard summary stats compiled successfully.",
      data: {
        storageUsedGB: metrics.totalStorageGB,
        workspacesCreated: metrics.workspaceCount,
        apiKeysGenerated: metrics.apiKeyCount,
        requestsThisMonth: metrics.monthlyRequests // Currently using hardcoded fallback value
      }
    });

  } catch (error) {
    console.error("[Dashboard Summary Generation Error]:", error);
    return res.status(500).json({
      status: false,
      message: "An internal server error occurred while calculating your platform metrics."
    });
  }
};

/**
 * Controller to look up and output a user's active workspaces
 */
const listWorkspaces = async (req, res) => {
  const { id: userId } = req.user; // Context provided by your authentication middleware

  try {
    const workspaces = await getUserWorkspaces(userId);

    return res.status(200).json({
      status: true,
      message: "User workspaces retrieved successfully.",
      count: workspaces.length,
      data: workspaces
    });

  } catch (error) {
    console.error("[List Workspaces Error]:", error);
    return res.status(500).json({
      status: false,
      message: "An internal server error occurred while fetching workspaces."
    });
  }
};


/**
 * Controller to extract and return a full schema inventory for a targeted workspace
 */
const getWorkspaceTablesOverview = async (req, res) => {
  const { workspaceId } = req.body;

  if (!workspaceId) {
    return res.status(400).json({
      status: false,
      message: "Missing parameter. 'workspaceId' is mandatory inside the request payload."
    });
  }

  try {
    const tableInventory = await getWorkspaceSchema(workspaceId);

    return res.status(200).json({
      status: true,
      message: "Workspace table schemas mapped successfully.",
      count: tableInventory.length,
      data: tableInventory
    });

  } catch (error) {
    console.error("[Workspace Schema Generation Error]:", error);
    return res.status(500).json({
      status: false,
      message: "An internal server error occurred while retrieving table schema maps."
    });
  }
};

module.exports = { getDashboardOverview, listWorkspaces, getWorkspaceTablesOverview };