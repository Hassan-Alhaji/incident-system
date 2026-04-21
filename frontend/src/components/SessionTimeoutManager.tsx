import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const SessionTimeoutManager = () => {
 const { user, logout } = useAuth();
 const lastActive = useRef(Date.now());
 const [showingWarning, setShowingWarning] = useState(false);

 // TEMPORARILY DISABLED AS PER REQUEST
 useEffect(() => {
 return; 
 }, []);

 return null;
};

export default SessionTimeoutManager;
