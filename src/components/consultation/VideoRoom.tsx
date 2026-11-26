"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Settings,
  MessageSquare,
  FileText,
  User,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Clock,
  Send,
  X,
  RefreshCw,
  Camera,
  Activity,
  CheckCircle2
} from "lucide-react";

interface VideoRoomProps {
  roomId: string;
  initialRole?: "doctor" | "patient";
  initialUserName?: string;
  initialUserId?: string;
}

export const VideoRoom: React.FC<VideoRoomProps> = ({
  roomId,
  initialRole = "patient",
  initialUserName,
  initialUserId
}) => {
  const router = useRouter();

  // Role can be switched in UI for testing/demo
  const [userRole, setUserRole] = useState<"doctor" | "patient">(initialRole);
  const [userName, setUserName] = useState(
    initialUserName || (initialRole === "doctor" ? "Dr. Arvind Swaminathan" : "Keerthana")
  );
  const [userId, setUserId] = useState(initialUserId || (initialRole === "doctor" ? "doc-1" : "pt-101"));

  // Room & Consultation session metadata
  const [sessionData, setSessionData] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Media Stream state
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Controls
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);

  // Devices
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");

  // Connection & Waiting State
  const [peerConnected, setPeerConnected] = useState(false);
  const [waitingStatus, setWaitingStatus] = useState<string>("Connecting to clinical room...");
  const [consultationDuration, setConsultationDuration] = useState<number>(0);

  // Chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");

  // Doctor Clinical Notes state
  const [diagnosis, setDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [prescription, setPrescription] = useState("");
  const [isEnding, setIsEnding] = useState(false);
  const [consultationEnded, setConsultationEnded] = useState(false);

  // WebRTC Peer Connection Ref
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize Consultation Session & Register Participant
  const initializeSession = useCallback(async () => {
    setIsInitializing(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/consultations/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          user_name: userName,
          user_role: userRole
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Unable to enter consultation room. Verify access window.");
        setIsInitializing(false);
        return;
      }

      setSessionData(data);

      if (userRole === "patient") {
        setWaitingStatus("Waiting for your physician to connect...");
      } else {
        setWaitingStatus("Waiting for patient to enter the consultation room...");
      }
    } catch (err: any) {
      setErrorMessage("Network connection failure. Please retry entering.");
    } finally {
      setIsInitializing(false);
    }
  }, [roomId, userId, userName, userRole]);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // 2. Acquire Real Camera and Microphone Media
  const startLocalMedia = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Enumerate available devices for settings
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
      setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
    } catch (err: any) {
      console.warn("Camera/Mic permission warning:", err);
      // Fallback to audio only if video unavailable
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioOnly);
        setVideoEnabled(false);
      } catch (audioErr) {
        setErrorMessage("Microphone or Camera access was denied. Please allow permissions in your browser bar.");
      }
    }
  }, [selectedAudioId, selectedVideoId]);

  useEffect(() => {
    if (!isInitializing && !errorMessage) {
      startLocalMedia();
    }
  }, [isInitializing, errorMessage, startLocalMedia]);

  // 3. WebRTC Signaling & Peer Connection Management
  useEffect(() => {
    if (!localStream || !sessionData) return;

    const pc = new RTCPeerConnection({
      iceServers: sessionData.ice_servers || [{ urls: "stun:stun.l.google.com:19302" }]
    });
    peerConnectionRef.current = pc;

    // Attach local tracks
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Remote track listener
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        setPeerConnected(true);
        setWaitingStatus("Consultation in progress");
      }
    };

    // Candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        fetch(`/api/consultations/${roomId}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender_role: userRole,
            target_role: userRole === "doctor" ? "patient" : "doctor",
            signal_type: "ice-candidate",
            signal_data: event.candidate
          })
        }).catch(() => {});
      }
    };

    // If role is doctor, initiate SDP Offer
    if (userRole === "doctor") {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          return fetch(`/api/consultations/${roomId}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sender_role: "doctor",
              target_role: "patient",
              signal_type: "offer",
              signal_data: pc.localDescription
            })
          });
        })
        .catch(console.error);
    }

    // Polling for incoming signals
    const pollSignals = async () => {
      try {
        const res = await fetch(`/api/consultations/${roomId}/signal?role=${userRole}`);
        if (res.ok) {
          const signals = await res.json();
          for (const sig of signals) {
            if (sig.signal_type === "offer" && userRole === "patient") {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.signal_data));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await fetch(`/api/consultations/${roomId}/signal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sender_role: "patient",
                  target_role: "doctor",
                  signal_type: "answer",
                  signal_data: pc.localDescription
                })
              });
              setPeerConnected(true);
              setWaitingStatus("Consultation in progress");
            } else if (sig.signal_type === "answer" && userRole === "doctor") {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.signal_data));
              setPeerConnected(true);
              setWaitingStatus("Consultation in progress");
            } else if (sig.signal_type === "ice-candidate") {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(sig.signal_data));
              } catch (e) {}
            }
          }
        }
      } catch (err) {}
    };

    pollingIntervalRef.current = setInterval(pollSignals, 1500);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pc.close();
    };
  }, [localStream, sessionData, roomId, userRole]);

  // Consultation duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (peerConnected && !consultationEnded) {
      timer = setInterval(() => {
        setConsultationDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [peerConnected, consultationEnded]);

  // Chat polling
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/consultations/${roomId}/messages`);
        if (res.ok) {
          const msgs = await res.json();
          setChatMessages(msgs);
        }
      } catch (e) {}
    };

    fetchChat();
    const interval = setInterval(fetchChat, 2500);
    return () => clearInterval(interval);
  }, [roomId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const text = chatInput.trim();
    setChatInput("");

    try {
      const res = await fetch(`/api/consultations/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: userId,
          sender_name: userName,
          sender_role: userRole,
          message: text
        })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setChatMessages((prev) => [...prev, newMsg]);
      }
    } catch (e) {}
  };

  // Toggle Microphone
  const handleToggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicEnabled(audioTrack.enabled);
    }
  };

  // Toggle Camera
  const handleToggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoEnabled(videoTrack.enabled);
    }
  };

  // Full Screen
  const handleToggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

  // End Consultation
  const handleEndCall = async () => {
    setIsEnding(true);
    try {
      await fetch(`/api/consultations/${roomId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis,
          clinical_notes: clinicalNotes,
          prescription
        })
      });
      setConsultationEnded(true);

      // Stop tracks
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    } catch (err) {
      console.error("End call failed", err);
    } finally {
      setIsEnding(false);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Switch role helper for demonstration/testing
  const switchRole = (newRole: "doctor" | "patient") => {
    if (userRole === newRole) return;
    setUserRole(newRole);
    setUserName(newRole === "doctor" ? (sessionData?.doctor_name || "Dr. Arvind Swaminathan") : (sessionData?.patient_name || "Keerthana"));
    setUserId(newRole === "doctor" ? (sessionData?.doctor_id || "doc-1") : (sessionData?.patient_id || "usr-pat-101"));
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#111827] text-white flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-[#258FE5] animate-spin" />
        <h3 className="text-lg font-serif">Connecting to Authenticated Consultation Sanctuary...</h3>
        <p className="text-xs text-gray-400">Verifying appointment permissions & initializing peer channel.</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-[#111827] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-900/60 border border-rose-600 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-rose-300" />
        </div>
        <h3 className="text-2xl font-serif text-rose-200">Consultation Room Access Restricted</h3>
        <p className="text-xs text-gray-300 max-w-md mx-auto">{errorMessage}</p>
        <div className="pt-2 flex gap-3">
          <Button variant="outline" size="md" onClick={() => router.push(userRole === "doctor" ? "/doctor/dashboard" : "/patient/dashboard")}>
            Return to Dashboard
          </Button>
          <Button variant="primary" size="md" onClick={initializeSession}>
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  if (consultationEnded) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] py-16 px-4 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-[#EAF5FC] text-[#163B63] border border-[#DCE6EF] flex items-center justify-center shadow-xs">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-3xl font-serif text-[#163B63]">Consultation Completed</h2>
          <p className="text-xs text-[#64748B]">
            Total Consultation Duration: <strong className="text-[#163B63]">{formatTimer(consultationDuration)}</strong>
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-[#DCE6EF] shadow-subtle max-w-md w-full text-left space-y-2 text-xs">
          <div><strong className="text-[#163B63]">Appointment:</strong> {sessionData?.appointment_reference || sessionData?.appointment_id}</div>
          <div><strong className="text-[#163B63]">Physician:</strong> {sessionData?.doctor_name}</div>
          <div><strong className="text-[#163B63]">Patient:</strong> {sessionData?.patient_name}</div>
          {diagnosis && <div><strong className="text-[#163B63]">Documented Diagnosis:</strong> {diagnosis}</div>}
          {prescription && <div><strong className="text-[#163B63]">Issued Rx:</strong> {prescription}</div>}
        </div>
        <div className="pt-2">
          <Link href={userRole === "doctor" ? "/doctor/dashboard" : "/patient/dashboard"}>
            <Button variant="primary" size="md">
              Return to Sanctuary Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-[#0A0D14] text-white flex flex-col overflow-hidden select-none">
      {/* Top Bar: Room Info & Role Switcher for Test */}
      <header className="h-16 px-4 sm:px-6 bg-[#111827]/90 backdrop-blur border-b border-gray-800 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0E2742] border border-[#258FE5] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-[#20B8AD]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-serif font-normal text-white">
                {sessionData?.doctor_name} • {sessionData?.patient_name}
              </h2>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#0E2742] text-[#20B8AD] border border-emerald-800">
                Encrypted WebRTC
              </span>
            </div>
            <span className="text-[11px] text-gray-400 flex items-center gap-1.5 font-light">
              <Clock className="w-3 h-3 text-[#258FE5]" />
              {peerConnected ? `In Session: ${formatTimer(consultationDuration)}` : waitingStatus}
            </span>
          </div>
        </div>

        {/* Multi-role testing switcher & controls */}
        <div className="flex items-center gap-2.5">
          {/* Quick switcher for dual testing */}
          <div className="hidden sm:flex items-center gap-1 bg-[#1F2937] p-1 rounded-xl text-[11px]">
            <button
              onClick={() => switchRole("patient")}
              className={`px-2.5 py-1 rounded-lg transition-all ${userRole === "patient" ? "bg-[#258FE5] text-white font-bold" : "text-gray-400 hover:text-white"}`}
            >
              Patient View
            </button>
            <button
              onClick={() => switchRole("doctor")}
              className={`px-2.5 py-1 rounded-lg transition-all ${userRole === "doctor" ? "bg-[#258FE5] text-white font-bold" : "text-gray-400 hover:text-white"}`}
            >
              Doctor View
            </button>
          </div>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-xl transition-all ${showChat ? "bg-[#258FE5] text-white" : "bg-[#1F2937] text-gray-300 hover:text-white"}`}
            title="Toggle Clinical Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {userRole === "doctor" && (
            <button
              onClick={() => setShowNotesDrawer(!showNotesDrawer)}
              className={`p-2 rounded-xl transition-all ${showNotesDrawer ? "bg-[#258FE5] text-white" : "bg-[#1F2937] text-gray-300 hover:text-white"}`}
              title="Clinical Notes & Rx"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleToggleFullScreen}
            className="p-2 rounded-xl bg-[#1F2937] text-gray-300 hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Video View Area */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Remote Video (Main Frame) */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${peerConnected ? "block" : "hidden"}`}
          />

          {/* Waiting Room state when other participant hasn't connected */}
          {!peerConnected && (
            <div className="text-center p-8 space-y-4 max-w-md animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center mx-auto relative">
                <Loader2 className="w-8 h-8 text-[#258FE5] animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-serif text-white">
                  {userRole === "patient" ? "Waiting for Doctor to Join" : "Waiting for Patient"}
                </h3>
                <p className="text-xs text-gray-400 font-light leading-relaxed">
                  {userRole === "patient"
                    ? `Dr. ${sessionData?.doctor_name || "Arvind Swaminathan"} has been notified and will enter shortly.`
                    : `Patient ${sessionData?.patient_name || "Keerthana"} is scheduled for this consultation slot.`}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 text-[11px] text-gray-400 flex items-center justify-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#20B8AD] animate-pulse" />
                <span>WebRTC Session Ready • STUN Audio/Video Pipe Open</span>
              </div>
            </div>
          )}

          {/* Local User Preview (Picture in Picture) */}
          <div className="absolute bottom-6 right-6 w-36 h-28 sm:w-56 sm:h-40 rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700 bg-gray-900 z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${videoEnabled ? "block" : "hidden"}`}
            />
            {!videoEnabled && (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 space-y-1 bg-gray-800">
                <VideoOff className="w-6 h-6" />
                <span className="text-[10px]">Camera Paused</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-white font-medium flex items-center gap-1">
              <span>{userRole === "doctor" ? "You (Doctor)" : "You (Patient)"}</span>
              {!micEnabled && <MicOff className="w-3 h-3 text-red-400" />}
            </div>
          </div>
        </div>

        {/* Side Panel: In-call Chat */}
        {showChat && (
          <aside className="w-80 border-l border-gray-800 bg-[#111827] flex flex-col shrink-0 z-20 animate-fade-in">
            <div className="p-3.5 border-b border-gray-800 flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#258FE5]" /> Consultation Messaging
              </span>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg) => {
                  const isMine = msg.sender_role === userRole;
                  return (
                    <div
                      key={msg.id}
                      className={`p-2.5 rounded-2xl max-w-[85%] space-y-0.5 ${
                        isMine
                          ? "ml-auto bg-[#258FE5] text-white rounded-br-none"
                          : "bg-gray-800 text-gray-100 rounded-bl-none"
                      }`}
                    >
                      <div className="text-[10px] font-semibold opacity-75">{msg.sender_name}</div>
                      <div>{msg.message}</div>
                      <div className="text-[9px] opacity-60 text-right">{msg.created_at}</div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-gray-500 text-xs">
                  No messages yet. Send a note to the participant.
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type a clinical message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-xs text-white focus:outline-none focus:border-[#258FE5]"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-[#258FE5] text-white hover:bg-[#258FE5] shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </aside>
        )}

        {/* Doctor Clinical Notes Drawer */}
        {showNotesDrawer && userRole === "doctor" && (
          <aside className="w-80 border-l border-gray-800 bg-[#111827] flex flex-col shrink-0 z-20 animate-fade-in p-4 space-y-4 overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <span className="font-bold text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#20B8AD]" /> Clinical Notes & Prescription
              </span>
              <button onClick={() => setShowNotesDrawer(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-gray-300">Diagnosis</label>
              <input
                type="text"
                placeholder="e.g. Mild Acute Bronchitis, Essential Hypertension"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-gray-300">Clinical Observations & Advice</label>
              <textarea
                rows={3}
                placeholder="Document examination findings, dietary recommendations, lifestyle guidance..."
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-gray-300">Prescription Summary (Rx)</label>
              <textarea
                rows={3}
                placeholder="e.g. Tab Amoxicillin 500mg (1-0-1 for 5 days), Tab Paracetamol 650mg SOS"
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none"
              />
            </div>

            <p className="text-[11px] text-gray-400">
              Notes recorded here are automatically linked to the patient&apos;s digital health vault upon concluding the consultation.
            </p>
          </aside>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <footer className="h-20 bg-[#111827] border-t border-gray-800 flex items-center justify-center gap-4 px-6 shrink-0 z-20">
        {/* Mic Toggle */}
        <button
          onClick={handleToggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            micEnabled ? "bg-gray-800 text-white hover:bg-gray-700" : "bg-red-600 text-white shadow-lg"
          }`}
          title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
        >
          {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Video Toggle */}
        <button
          onClick={handleToggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            videoEnabled ? "bg-gray-800 text-white hover:bg-gray-700" : "bg-red-600 text-white shadow-lg"
          }`}
          title={videoEnabled ? "Stop Camera" : "Start Camera"}
        >
          {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* End Call Button */}
        <button
          onClick={handleEndCall}
          disabled={isEnding}
          className="px-6 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span>{isEnding ? "Ending..." : "End Consultation"}</span>
        </button>
      </footer>
    </div>
  );
};
