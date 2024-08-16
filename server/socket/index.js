const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const getUserDetailsFromToken = require('../helpers/getUserDetailsFromToken');
const UserModel = require('../models/UserModel');
const { ConversationModel, MessageModel } = require('../models/ConversationModel');
const getConversation = require('../helpers/getConversation');
const cors = require('cors');

const app = express();

// Set up CORS
const isDevelopment = process.env.NODE_ENV !== 'production';
const allowedOrigin = isDevelopment ? '*' : new URL(process.env.FRONTEND_URL).origin;

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

/*** Socket connection */
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Ensure both websocket and polling are enabled
});

// Online user
const onlineUser = new Set();

io.on('connection', async (socket) => {
  try {
    const token = socket.handshake.auth.token;

    // Get current user details
    const user = await getUserDetailsFromToken(token);

    if (!user) {
      socket.disconnect();
      return;
    }

    // Create a room
    socket.join(user?._id.toString());
    onlineUser.add(user?._id?.toString());

    io.emit('onlineUser', Array.from(onlineUser));

    socket.on('message-page', async (userId) => {
      try {
        const userDetails = await UserModel.findById(userId).select("-password");

        const payload = {
          _id: userDetails?._id,
          name: userDetails?.name,
          email: userDetails?.email,
          profile_pic: userDetails?.profile_pic,
          online: onlineUser.has(userId),
        };
        socket.emit('message-user', payload);

        // Get previous messages
        const getConversationMessage = await ConversationModel.findOne({
          "$or": [
            { sender: user?._id, receiver: userId },
            { sender: userId, receiver: user?._id },
          ],
        }).populate('messages').sort({ updatedAt: -1 });

        socket.emit('message', getConversationMessage?.messages || []);
      } catch (error) {
        console.error('Error in message-page event:', error);
      }
    });

    // Handle new message
    socket.on('new message', async (data) => {
      try {
        let conversation = await ConversationModel.findOne({
          "$or": [
            { sender: data?.sender, receiver: data?.receiver },
            { sender: data?.receiver, receiver: data?.sender },
          ],
        });

        if (!conversation) {
          const createConversation = new ConversationModel({
            sender: data?.sender,
            receiver: data?.receiver,
          });
          conversation = await createConversation.save();
        }

        const message = new MessageModel({
          text: data.text,
          imageUrl: data.imageUrl,
          videoUrl: data.videoUrl,
          msgByUserId: data?.msgByUserId,
        });
        const saveMessage = await message.save();

        await ConversationModel.updateOne({ _id: conversation?._id }, {
          "$push": { messages: saveMessage?._id },
        });

        const getConversationMessage = await ConversationModel.findOne({
          "$or": [
            { sender: data?.sender, receiver: data?.receiver },
            { sender: data?.receiver, receiver: data?.sender },
          ],
        }).populate('messages').sort({ updatedAt: -1 });

        io.to(data?.sender).emit('message', getConversationMessage?.messages || []);
        io.to(data?.receiver).emit('message', getConversationMessage?.messages || []);

        const conversationSender = await getConversation(data?.sender);
        const conversationReceiver = await getConversation(data?.receiver);

        io.to(data?.sender).emit('conversation', conversationSender);
        io.to(data?.receiver).emit('conversation', conversationReceiver);
      } catch (error) {
        console.error('Error in new message event:', error);
      }
    });

    // Handle sidebar updates
    socket.on('sidebar', async (currentUserId) => {
      try {
        const conversation = await getConversation(currentUserId);
        socket.emit('conversation', conversation);
      } catch (error) {
        console.error('Error in sidebar event:', error);
      }
    });

    // Handle seen message status
    socket.on('seen', async (msgByUserId) => {
      try {
        let conversation = await ConversationModel.findOne({
          "$or": [
            { sender: user?._id, receiver: msgByUserId },
            { sender: msgByUserId, receiver: user?._id },
          ],
        });

        const conversationMessageId = conversation?.messages || [];

        await MessageModel.updateMany(
          { _id: { "$in": conversationMessageId }, msgByUserId: msgByUserId },
          { "$set": { seen: true } }
        );

        const conversationSender = await getConversation(user?._id?.toString());
        const conversationReceiver = await getConversation(msgByUserId);

        io.to(user?._id?.toString()).emit('conversation', conversationSender);
        io.to(msgByUserId).emit('conversation', conversationReceiver);
      } catch (error) {
        console.error('Error in seen event:', error);
      }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
      onlineUser.delete(user?._id?.toString());
      console.log('User disconnected: ', socket.id);
    });
  } catch (error) {
    console.error('Error in socket connection:', error);
  }
});

module.exports = {
  app,
  server,
};
