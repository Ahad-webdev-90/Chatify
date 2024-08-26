// const express = require('express');
// const { Server } = require('socket.io');
// const http = require('http');
// const cors = require('cors');
// const getUserDetailsFromToken = require('../helpers/getUserDetailsFromToken');
// const UserModel = require('../models/UserModel');
// const { ConversationModel, MessageModel } = require('../models/ConversationModel');
// const getConversation = require('../helpers/getConversation');

// const app = express();

// // CORS configuration for Express
// app.use(cors({
//     origin: 'https://chatify-ahkg.vercel.app',
//     credentials: true
// }));

// /***socket connection */
// const server = http.createServer(app);
// const io = new Server(server, {
//     cors: {
//         origin: 'https://chatify-ahkg.vercel.app',
//         credentials: true
//     }
// });

// /***
//  * socket running at http://localhost:8080/
//  */

// //online user
// const onlineUser = new Set();

// io.on('connection', async (socket) => {

//     const token = socket.handshake.auth.token;

//     //current user details 
//     const user = await getUserDetailsFromToken(token);

//     //create a room
//     socket.join(user?._id.toString());
//     onlineUser.add(user?._id?.toString());

//     io.emit('onlineUser', Array.from(onlineUser));

//     socket.on('message-page', async (userId) => {
//         const userDetails = await UserModel.findById(userId).select("-password");

//         const payload = {
//             _id: userDetails?._id,
//             name: userDetails?.name,
//             email: userDetails?.email,
//             profile_pic: userDetails?.profile_pic,
//             online: onlineUser.has(userId)
//         };
//         socket.emit('message-user', payload);

//         //get previous message
//         const getConversationMessage = await ConversationModel.findOne({
//             "$or": [
//                 { sender: user?._id, receiver: userId },
//                 { sender: userId, receiver: user?._id }
//             ]
//         }).populate('messages').sort({ updatedAt: -1 });

//         socket.emit('message', getConversationMessage?.messages || []);
//     });

//     //new message
//     socket.on('new message', async (data) => {

//         //check conversation is available both user
//         let conversation = await ConversationModel.findOne({
//             "$or": [
//                 { sender: data?.sender, receiver: data?.receiver },
//                 { sender: data?.receiver, receiver: data?.sender }
//             ]
//         });

//         //if conversation is not available
//         if (!conversation) {
//             const createConversation = await ConversationModel({
//                 sender: data?.sender,
//                 receiver: data?.receiver
//             });
//             conversation = await createConversation.save();
//         }

//         const message = new MessageModel({
//             text: data.text,
//             imageUrl: data.imageUrl,
//             videoUrl: data.videoUrl,
//             msgByUserId: data?.msgByUserId,
//         });
//         const saveMessage = await message.save();

//         const updateConversation = await ConversationModel.updateOne({ _id: conversation?._id }, {
//             "$push": { messages: saveMessage?._id }
//         });

//         const getConversationMessage = await ConversationModel.findOne({
//             "$or": [
//                 { sender: data?.sender, receiver: data?.receiver },
//                 { sender: data?.receiver, receiver: data?.sender }
//             ]
//         }).populate('messages').sort({ updatedAt: -1 });

//         io.to(data?.sender).emit('message', getConversationMessage?.messages || []);
//         io.to(data?.receiver).emit('message', getConversationMessage?.messages || []);

//         //send conversation
//         const conversationSender = await getConversation(data?.sender);
//         const conversationReceiver = await getConversation(data?.receiver);

//         io.to(data?.sender).emit('conversation', conversationSender);
//         io.to(data?.receiver).emit('conversation', conversationReceiver);
//     });

//     //sidebar
//     socket.on('sidebar', async (currentUserId) => {
//         console.log("current user", currentUserId);
//         const conversation = await getConversation(currentUserId);

//         socket.emit('conversation', conversation);
//     });

//     socket.on('seen', async (msgByUserId) => {

//         let conversation = await ConversationModel.findOne({
//             "$or": [
//                 { sender: user?._id, receiver: msgByUserId },
//                 { sender: msgByUserId, receiver: user?._id }
//             ]
//         });

//         const conversationMessageId = conversation?.messages || [];

//         const updateMessages = await MessageModel.updateMany(
//             { _id: { "$in": conversationMessageId }, msgByUserId: msgByUserId },
//             { "$set": { seen: true } }
//         );

//         //send conversation
//         const conversationSender = await getConversation(user?._id?.toString());
//         const conversationReceiver = await getConversation(msgByUserId);

//         io.to(user?._id?.toString()).emit('conversation', conversationSender);
//         io.to(msgByUserId).emit('conversation', conversationReceiver);
//     });

//     //disconnect
//     socket.on('disconnect', () => {
//         onlineUser.delete(user?._id?.toString());
//         console.log('disconnect user ', socket.id);
//     });
// });

// module.exports = {
//     app,
//     server
// };




























const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const getUserDetailsFromToken = require('../helpers/getUserDetailsFromToken');
const UserModel = require('../models/UserModel');
const { ConversationModel, MessageModel } = require('../models/ConversationModel');
const getConversation = require('../helpers/getConversation');

const app = express();

// Create server and configure Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now (you can restrict this to specific domains later)
        methods: ["GET", "POST"],
        allowedHeaders: ["Authorization"],
        credentials: true
    }
});

// Track online users
const onlineUser = new Set();

io.on('connection', async (socket) => {
    console.log("User connected:", socket.id);

    const token = socket.handshake.auth.token;

    try {
        // Authenticate user
        const user = await getUserDetailsFromToken(token);
        if (!user) {
            socket.disconnect(); // Disconnect if user is not authenticated
            return;
        }

        // Join room and add to online users
        socket.join(user._id.toString());
        onlineUser.add(user._id.toString());

        io.emit('onlineUser', Array.from(onlineUser));

        socket.on('message-page', async (userId) => {
            try {
                const userDetails = await UserModel.findById(userId).select("-password");

                const payload = {
                    _id: userDetails?._id,
                    name: userDetails?.name,
                    email: userDetails?.email,
                    profile_pic: userDetails?.profile_pic.replace('http://', 'https://'), // Fix mixed content issue
                    online: onlineUser.has(userId)
                };
                socket.emit('message-user', payload);

                // Get previous messages
                const getConversationMessage = await ConversationModel.findOne({
                    "$or": [
                        { sender: user._id, receiver: userId },
                        { sender: userId, receiver: user._id }
                    ]
                }).populate('messages').sort({ updatedAt: -1 });

                socket.emit('message', getConversationMessage?.messages || []);
            } catch (err) {
                console.error('Error in message-page:', err);
                socket.emit('error', 'An error occurred while retrieving messages.');
            }
        });

        socket.on('new message', async (data) => {
            try {
                let conversation = await ConversationModel.findOne({
                    "$or": [
                        { sender: data.sender, receiver: data.receiver },
                        { sender: data.receiver, receiver: data.sender }
                    ]
                });

                if (!conversation) {
                    const createConversation = new ConversationModel({
                        sender: data.sender,
                        receiver: data.receiver
                    });
                    conversation = await createConversation.save();
                }

                const message = new MessageModel({
                    text: data.text,
                    imageUrl: data.imageUrl?.replace('http://', 'https://'), // Fix mixed content issue for images
                    videoUrl: data.videoUrl,
                    msgByUserId: data.msgByUserId,
                });
                const saveMessage = await message.save();

                await ConversationModel.updateOne({ _id: conversation._id }, {
                    "$push": { messages: saveMessage._id }
                });

                const getConversationMessage = await ConversationModel.findOne({
                    "$or": [
                        { sender: data.sender, receiver: data.receiver },
                        { sender: data.receiver, receiver: data.sender }
                    ]
                }).populate('messages').sort({ updatedAt: -1 });

                io.to(data.sender).emit('message', getConversationMessage?.messages || []);
                io.to(data.receiver).emit('message', getConversationMessage?.messages || []);

                // Send updated conversations
                const conversationSender = await getConversation(data.sender);
                const conversationReceiver = await getConversation(data.receiver);

                io.to(data.sender).emit('conversation', conversationSender);
                io.to(data.receiver).emit('conversation', conversationReceiver);
            } catch (err) {
                console.error('Error in new message:', err);
                socket.emit('error', 'An error occurred while sending the message.');
            }
        });

        socket.on('sidebar', async (currentUserId) => {
            try {
                const conversation = await getConversation(currentUserId);
                socket.emit('conversation', conversation);
            } catch (err) {
                console.error('Error in sidebar:', err);
                socket.emit('error', 'An error occurred while retrieving sidebar data.');
            }
        });

        socket.on('seen', async (msgByUserId) => {
            try {
                const conversation = await ConversationModel.findOne({
                    "$or": [
                        { sender: user._id, receiver: msgByUserId },
                        { sender: msgByUserId, receiver: user._id }
                    ]
                });

                const conversationMessageId = conversation?.messages || [];

                await MessageModel.updateMany(
                    { _id: { "$in": conversationMessageId }, msgByUserId: msgByUserId },
                    { "$set": { seen: true } }
                );

                // Send updated conversations
                const conversationSender = await getConversation(user._id.toString());
                const conversationReceiver = await getConversation(msgByUserId);

                io.to(user._id.toString()).emit('conversation', conversationSender);
                io.to(msgByUserId).emit('conversation', conversationReceiver);
            } catch (err) {
                console.error('Error in seen:', err);
                socket.emit('error', 'An error occurred while marking messages as seen.');
            }
        });

    } catch (err) {
        console.error('Connection error:', err);
    }

    // Handle disconnection
    socket.on('disconnect', () => {
        onlineUser.delete(user._id.toString());
        console.log('User disconnected:', socket.id);
    });
});

module.exports = {
    app,
    server
};


