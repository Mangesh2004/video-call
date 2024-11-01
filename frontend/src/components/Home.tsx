import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, TextField, Container, Box } from '@mui/material';

function Home() {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 7);
    navigate(`/room/${newRoomId}`, { state: { username } });
  };

  const joinRoom = () => {
    navigate(`/room/${roomId}`, { state: { username } });
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          label="Room ID (for joining)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <Button variant="contained" onClick={createRoom}>
          Create Room
        </Button>
        <Button variant="outlined" onClick={joinRoom} disabled={!roomId}>
          Join Room
        </Button>
      </Box>
    </Container>
  );
}

export default Home;