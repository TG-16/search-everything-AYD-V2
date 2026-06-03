require('dotenv').config();
const cors = require("cors");
const express = require('express');
const app = express();
const morgan = require("morgan");
const authRoutes = require('./routes/auth.route');
const crudRoutes = require('./routes/crud.route');
const startEmbeddingWorker = require("./utils/embadingWorker");


const port = process.env.PORT || 5000;


app.use(cors()); // Allow requests from localhost:3000 securely must be changed in production
app.use(morgan("dev"));
app.use(express.json());

// load all api keys to the memory on sever starts

app.use('/api/auth', authRoutes);
app.use('/api/crud', crudRoutes);

startEmbeddingWorker();

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
