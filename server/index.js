const express = require('express')
const cors = require('cors')
require('dotenv').config()
const connectDB = require('./config/connectDB')
const router = require('./routes/index')
const cookiesParser = require('cookie-parser')
const { app, server } = require('./socket/index')

// const app = express()
const allowedOrigins = [`${process.env.FRONTEND_URL}`];

app.use(cors({
    origin: function (origin, callback) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}))
app.use(express.json())
app.use(cookiesParser())

const PORT = process.env.PORT

app.get('/', (request, response) => {
    response.json({
        message: "Server running at " + PORT
    })
})

//api endpoints
app.use('/api', router)

connectDB().then(() => {
    server.listen(PORT, () => {
        console.log("server running at " + PORT)
    })
})
