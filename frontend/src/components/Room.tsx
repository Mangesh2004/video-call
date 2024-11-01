// Room.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoPlayer } from './VideoPlayer';
import { 
  Copy, Check, Share, ScreenShareOff, Phone, 
  MessageCircle, X, Menu,  
} from 'lucide-react';

interface Message {
  sender: string;
  message: string;
  timestamp: string;
}



export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { username } = location.state as { username: string } || {};

  const [peers, setPeers] = useState<Map<string, MediaStream>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket>();
  const localStreamRef = useRef<MediaStream>();
  const screenStreamRef = useRef<MediaStream>();
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ... Previous WebRTC and socket logic ...

  const handleEndCall = () => {
    // Stop all media tracks
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    
    // Close all peer connections
    peerConnectionsRef.current.forEach(connection => connection.close());
    
    // Disconnect socket
    socketRef.current?.disconnect();
    
    // Navigate to home
    navigate('/');
  };   

  useEffect(() => {
    const socket = io('http://localhost:3000');
    socketRef.current = socket;

    // Get local stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        socket.emit('join-room', { roomId, username });
      });

    // Handle new user connection
    socket.on('user-connected', async ({ username, socketId }) => {
      console.log('User connected:', username);
      const peerConnection = createPeerConnection(socketId);
      
      // Add local tracks to peer connection
      localStreamRef.current?.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current as MediaStream);
      });

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', { to: socketId, offer });
    });

    // Handle receiving offer
    socket.on('offer', async ({ from, offer }) => {
      const peerConnection = createPeerConnection(from);
      await peerConnection.setRemoteDescription(offer);
      
      // Add local tracks
      localStreamRef.current?.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current as MediaStream);
      });

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', { to: from, answer });
    });

    // Handle receiving answer
    socket.on('answer', async ({ from, answer }) => {
      const peerConnection = peerConnectionsRef.current.get(from);
      await peerConnection?.setRemoteDescription(answer);
    });

    // Handle ICE candidates
    socket.on('ice-candidate', async ({ from, candidate }) => {
      const peerConnection = peerConnectionsRef.current.get(from);
      await peerConnection?.addIceCandidate(candidate);
    });

    // Handle user disconnect
    socket.on('user-disconnected', (socketId) => {
      const peerConnection = peerConnectionsRef.current.get(socketId);
      if (peerConnection) {
        peerConnection.close();
        peerConnectionsRef.current.delete(socketId);
      }
      setPeers(prev => {
        const newPeers = new Map(prev);
        newPeers.delete(socketId);
        return newPeers;
      });
    });
    socket.on('receive-message', (message: Message) => {
        setMessages(prev => [...prev, message]);
        // Auto scroll to bottom
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      });

    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      peerConnectionsRef.current.forEach(connection => connection.close());
      socket.disconnect();
    };
  }, [roomId, username]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    socketRef.current?.emit('send-message', {
      roomId,
      message: newMessage,
      sender: username,
    });
    setNewMessage('');
  };

  const createPeerConnection = (socketId:string) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnectionsRef.current.set(socketId, peerConnection);

    peerConnection.ontrack = ({ streams: [stream] }) => {
      setPeers(prev => new Map(prev).set(socketId, stream));
    };

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('ice-candidate', { to: socketId, candidate });
      }
    };

    return peerConnection;
  };


  const copyRoomId = async () => {
    if (!roomId) return;
    await navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        screenStreamRef.current = screenStream;
        
        // Replace video track for all peer connections
        peerConnectionsRef.current.forEach((peerConnection) => {
          const videoTrack = screenStream.getVideoTracks()[0];
          const senders = peerConnection.getSenders();
          const videoSender = senders.find(sender => 
            sender.track?.kind === 'video'
          );
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          }
        });

        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Handle screen share stop
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenSharing();
        };

        setIsScreenSharing(true);
      } else {
        stopScreenSharing();
      }
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = undefined;

      // Restore original video track
      if (localStreamRef.current) {
        // Replace video track for all peer connections
        peerConnectionsRef.current.forEach((peerConnection) => {
          const videoTrack = localStreamRef.current?.getVideoTracks()[0];
          const senders = peerConnection.getSenders();
          const videoSender = senders.find(sender => 
            sender.track?.kind === 'video'
          );
          if (videoSender && videoTrack) {
            videoSender.replaceTrack(videoTrack);
          }
        });

        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }
    }
    setIsScreenSharing(false);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Mobile Menu Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800/80 backdrop-blur-sm rounded-full"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Menu className="w-6 h-6 text-white" />
      </motion.button>

      {/* Header Controls */}
      <AnimatePresence>
        {(isMobileMenuOpen) && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className={`fixed top-0 left-0 right-0 bg-gray-800/80 backdrop-blur-sm shadow-lg z-40
              ${isMobileMenuOpen ? 'h-auto' : 'h-16'}`}
          >
            <div className="container mx-auto p-4">
              <div className={`flex ${isMobileMenuOpen ? 'flex-col space-y-4' : 'flex-row'} items-center justify-between`}>
                <div className="flex items-center space-x-4">
                  <motion.span 
                    className="text-white font-medium px-4 py-2 bg-gray-700/50 rounded-lg"
                    whileHover={{ scale: 1.05 }}
                  >
                    Room: {roomId}
                  </motion.span>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={copyRoomId}
                    className="p-2 hover:bg-gray-700/50 rounded-full transition-all"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </motion.button>
                </div>

                <div className="flex items-center space-x-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleScreenShare}
                    className="p-3 hover:bg-gray-700/50 rounded-full transition-all"
                  >
                    {isScreenSharing ? (
                      <ScreenShareOff className="w-5 h-5 text-red-500" />
                    ) : (
                      <Share className="w-5 h-5 text-white" />
                    )}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="p-3 hover:bg-gray-700/50 rounded-full transition-all"
                  >
                    <MessageCircle className="w-5 h-5 text-white" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleEndCall}
                    className="p-3 bg-red-600/90 hover:bg-red-700 rounded-full transition-all"
                  >
                    <Phone className="w-5 h-5 text-white transform rotate-135" />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="container mx-auto pt-20 px-4 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full"
          >
            {localStreamRef.current && (
              <VideoPlayer
                stream={localStreamRef.current}
                isLocal={true}
                username={username}
              />
            )}
          </motion.div>

          {Array.from(peers.entries()).map(([socketId, stream]) => (
            <motion.div
              key={socketId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full"
            >
              <VideoPlayer
                stream={stream}
                username={username}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Chat Sidebar */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed right-0 top-0 h-full w-full md:w-80 bg-gray-800/90 backdrop-blur-sm shadow-lg"
          >
            <div className="flex flex-col h-full p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white text-lg font-semibold">Group Chat</h2>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 hover:bg-gray-700/50 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </motion.button>
              </div>

              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
              >
                {messages.map((msg, index) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={index}
                    className={`p-3 rounded-lg max-w-[80%] ${
                      msg.sender === username
                        ? 'ml-auto bg-blue-600/80 backdrop-blur-sm'
                        : 'bg-gray-700/80 backdrop-blur-sm'
                    }`}
                  >
                    <div className="text-sm text-gray-300 font-medium">{msg.sender}</div>
                    <div className="text-white mt-1">{msg.message}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </motion.div>
                ))}
              </div>

              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700/50 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="bg-blue-600/90 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
                >
                  Send
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      
    </div>
  );
}