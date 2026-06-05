const { fetchDashboardMetrics } = require('../models/helper.model');

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

module.exports = { getDashboardOverview };