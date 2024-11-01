// components/VideoPlayer.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface VideoPlayerProps {
  stream: MediaStream;
  isLocal?: boolean;
  username?: string;
}

export const VideoPlayer = ({ stream, isLocal = false, username }: VideoPlayerProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const toggleAudio = () => {
    stream.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    stream.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsVideoOff(!isVideoOff);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video"
    >
      <video
        ref={el => {
          if (el) {
            el.srcObject = stream;
            el.muted = isLocal;
          }
        }}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${isVideoOff ? 'invisible' : 'visible'}`}
      />
      
      {isVideoOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-2xl text-white">{username?.[0]?.toUpperCase()}</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white font-medium">{username}</span>
          <div className="flex gap-2">
            <button
              onClick={toggleAudio}
              className="p-2 rounded-full hover:bg-gray-700/50 transition-colors"
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 text-red-500" />
              ) : (
                <Mic className="w-5 h-5 text-white" />
              )}
            </button>
            <button
              onClick={toggleVideo}
              className="p-2 rounded-full hover:bg-gray-700/50 transition-colors"
            >
              {isVideoOff ? (
                <VideoOff className="w-5 h-5 text-red-500" />
              ) : (
                <Video className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};