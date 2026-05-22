import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL
  || 'http://localhost:3002'

export function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason)
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message)
      setConnected(false)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  return {
    socket: socketRef.current,
    connected
  }
}
