require('dotenv').config();
const express = require('express');
const app = express();
const morgan = require("morgan");
const authRoutes = require('./routes/auth');


const port = process.env.PORT || 5000;


app.use(morgan("dev"));
app.use(express.json());

// load all api keys to the memory on sever starts

app.use('/api/auth', authRoutes);


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
