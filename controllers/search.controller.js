// File: controllers/search.controller.js

const SearchService = require('../models/search.model');

const globalSearch = async (req, res) => {
  const { query, workspaceId, filters, limit } = req.body;

  // 1. Initial Validation
  if (!workspaceId || !query) {
    return res.status(400).json({
      status: false,
      message: "Required parameters missing: 'workspaceId' and 'query' string are mandatory inputs."
    });
  }

  try {
    // 2. Pass control parameters to the Search Service Layer
    const searchResults = await SearchService.executeHybridSearch({
      workspaceId,
      rawQuery: query,
      filters: filters || {},
      limit: parseInt(limit, 10) || 10
    });

    // 3. Return a standardized response
    return res.status(200).json({
      status: true,
      resultsCount: searchResults.length,
      data: searchResults
    });

  } catch (error) {
    console.error("[Global Search Controller Error]:", error);
    return res.status(500).json({
      status: false,
      message: "An internal error occurred while processing the search request."
    });
  }
};

module.exports = { globalSearch };