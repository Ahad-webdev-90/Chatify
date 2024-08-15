const mongoose = require('mongoose')

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI)

        const connection = mongoose.connection

        connection.on('connected', () => {
            console.log('connect to DB');
        })

        connection.on('error', (error) => {
            console.log('Something went wrong', error);
        })
    } catch (error) {
        console.log("Something Went Wrong", error);
    }
}

module.exports = connectDB