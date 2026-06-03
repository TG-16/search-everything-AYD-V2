const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Check for API Key (Typically used by external developer tools/scripts)
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    //i have to modify it when i create api key
    if (apiKey) {
      // TODO: Replace with your actual database lookup logic for API keys
      const workspace = await validateApiKeyInDb(apiKey); 
      
      if (!workspace) {
        return res.status(401).json({ status: false, message: "Invalid API Key" });
      }

      // Attach workspace/user info and auth type to the request object
      req.user = { id: workspace.userId, workspaceId: workspace.id, plan: workspace.plan };
      req.authType = 'api_key';
      
      return next(); // Successfully authenticated via API Key
    }

    // 2. Check for JWT Token (Typically used by web dashboard)
    const authHeader = req.headers['authorization'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      // Verify the JWT token
      jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
        if (err) {
          return res.status(401).json({ status: false, message: "Unauthorized: Invalid or expired token" });
        }

        // Fetch user or memory data if you need to enforce limits/plans
        // const userContext = await getUserWorkspaceContext(decoded.userId);

        req.user = { id: decoded.userId };
        req.authType = 'jwt';
        
        return next(); // Successfully authenticated via JWT
      });
      
      return; // Prevent falling through while jwt.verify runs asynchronously
    }

    // 3. Neither authentication method was provided
    return res.status(401).json({ 
      status: false, 
      message: "Access Denied: Missing JWT Token or API Key" 
    });

  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({ status: false, message: "Internal Server Error during authentication" });
  }
};

module.exports = authMiddleware;