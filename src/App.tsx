/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import shaka from 'shaka-player';
import 'mux.js';
import { 
  Play, Tv, Search, Info, Settings, ChevronRight, 
  Volume2, Shield, AlertCircle, Home, LayoutGrid, 
  Heart, User, Maximize2, RefreshCcw, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Channel {
  id: number;
  name: string;
  logo: string;
  group: string;
  url: string;
  clearKey?: Record<string, string>;
  widevineUrl?: string;
  headers?: Record<string, string>;
}

const VideoPlayer = ({ channel, onFullScreen }: { channel: Channel, onFullScreen: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<shaka.Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      setError('Browser not supported');
      return;
    }

    const shakaPlayer = new shaka.Player();
    setPlayer(shakaPlayer);

    return () => {
      shakaPlayer.destroy();
    };
  }, []);

  useEffect(() => {
    if (!player || !videoRef.current || !channel) return;

    const loadStream = async () => {
      setLoading(true);
      setError(null);
      try {
        await player.attach(videoRef.current!);

        const drmConfig: any = {};
        if (channel.clearKey) {
          drmConfig.clearKeys = channel.clearKey;
        }
        if (channel.widevineUrl) {
          drmConfig.servers = { 'com.widevine.alpha': channel.widevineUrl };
        }

        player.configure({
          drm: drmConfig,
          streaming: {
            bufferingGoal: 10,
            rebufferingGoal: 2,
          }
        });

        player.getNetworkingEngine()?.registerRequestFilter((type, request) => {
          if (channel.headers) {
            Object.entries(channel.headers).forEach(([key, value]) => {
              request.headers[key] = value;
            });
          }
        });

        await player.load(channel.url);
        videoRef.current?.play().catch(() => {
          // Autoplay might be blocked, show a play button or just wait
        });
      } catch (e: any) {
        console.error('Error loading stream:', e);
        setError(`Failed to load stream: ${e.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadStream();
  }, [player, channel]);

  return (
    <div ref={containerRef} className="relative w-full aspect-video bg-black overflow-hidden shadow-2xl border-b border-white/5 md:rounded-2xl md:border md:border-white/10">
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        muted={isMuted}
        onClick={() => setIsMuted(!isMuted)}
      />
      
      {/* Mobile Controls Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMuted(!isMuted)} className="p-2 bg-white/10 rounded-full backdrop-blur-md">
            <Volume2 className={`w-5 h-5 ${isMuted ? 'text-red-400' : 'text-white'}`} />
          </button>
        </div>
        <button onClick={onFullScreen} className="p-2 bg-white/10 rounded-full backdrop-blur-md">
          <Maximize2 className="w-5 h-5 text-white" />
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <p className="text-white text-sm font-medium mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-full text-sm font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {!channel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
          <Tv className="w-12 h-12 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">Select a channel to start</p>
        </div>
      )}

      {isMuted && !loading && !error && channel && (
        <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
          <Volume2 className="w-3 h-3 text-red-400" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Tap for sound</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'home' | 'channels' | 'favs' | 'profile'>('home');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/channels');
      const data = await response.json();
      setChannels(data);
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const groups = ['All', ...Array.from(new Set(channels.map(c => c.group)))];

  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === 'All' || channel.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleFullScreen = () => {
    const video = document.querySelector('video');
    if (video?.requestFullscreen) {
      video.requestFullscreen();
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-indigo-500/30 pb-20 md:pb-0">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/5 px-4 py-3 md:px-8 md:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-black tracking-tight text-white leading-none">
                PREMIUM LIVE
              </h1>
              <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] text-indigo-500 font-bold mt-0.5">Mobile Edition</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchChannels}
              className={`p-2 hover:bg-white/5 rounded-full transition-all ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-zinc-400'}`}
            >
              <RefreshCcw className="w-5 h-5" />
            </button>
            <button className="p-2 bg-white/5 rounded-full text-zinc-400">
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto md:px-6 md:py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-0 md:gap-8">
          
          {/* Sticky Player Container */}
          <div className="lg:col-span-8 sticky top-[57px] md:top-24 z-40 bg-black md:static">
            <VideoPlayer channel={selectedChannel!} onFullScreen={handleFullScreen} />
            
            <div className="p-4 md:p-6 bg-zinc-900/40 md:rounded-2xl md:mt-6 border-b border-white/5 md:border md:border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg md:text-2xl font-bold text-white truncate">
                    {selectedChannel?.name || 'Select a Channel'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">
                      {selectedChannel?.group || 'Live'}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                      <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                      Online
                    </span>
                  </div>
                </div>
                <button className="flex-shrink-0 w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors">
                  <Heart className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content Sections */}
          <div className="lg:col-span-4 p-4 md:p-0 space-y-6">
            {/* Search & Categories (Only if on Channels tab or Desktop) */}
            {(activeTab === 'channels' || window.innerWidth > 768) && (
              <div className="space-y-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search 100+ channels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 text-sm"
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {groups.map(group => (
                    <button
                      key={group}
                      onClick={() => setSelectedGroup(group)}
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        selectedGroup === group 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                          : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Channel List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Recommended
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 bg-zinc-900/50 animate-pulse rounded-2xl border border-white/5" />
                  ))
                ) : filteredChannels.length > 0 ? (
                  filteredChannels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full group flex items-center gap-4 p-3 rounded-2xl transition-all border ${
                        selectedChannel?.id === channel.id
                          ? 'bg-indigo-600/10 border-indigo-500/30'
                          : 'bg-zinc-900/30 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="relative w-14 h-14 flex-shrink-0 bg-zinc-950 rounded-xl overflow-hidden border border-white/5">
                        {channel.logo ? (
                          <img 
                            src={channel.logo} 
                            alt={channel.name} 
                            className="w-full h-full object-contain p-2"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Tv className="w-6 h-6 text-zinc-800" />
                          </div>
                        )}
                        {selectedChannel?.id === channel.id && (
                          <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center backdrop-blur-[2px]">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 text-left min-w-0">
                        <h4 className={`font-bold text-sm truncate ${
                          selectedChannel?.id === channel.id ? 'text-indigo-400' : 'text-zinc-100'
                        }`}>
                          {channel.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider truncate">
                            {channel.group}
                          </span>
                          <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                          <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider">HD Live</span>
                        </div>
                      </div>

                      <ChevronRight className={`w-5 h-5 transition-transform ${
                        selectedChannel?.id === channel.id ? 'text-indigo-400 translate-x-1' : 'text-zinc-800 group-hover:text-zinc-600'
                      }`} />
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
                    <Search className="w-12 h-12 mb-3 opacity-10" />
                    <p className="text-sm font-bold uppercase tracking-widest">No Results</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-black/80 backdrop-blur-2xl border-t border-white/5 px-6 py-3 md:hidden">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-indigo-500' : 'text-zinc-500'}`}
          >
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('channels')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'channels' ? 'text-indigo-500' : 'text-zinc-500'}`}
          >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Explore</span>
          </button>
          <button 
            onClick={() => setActiveTab('favs')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'favs' ? 'text-indigo-500' : 'text-zinc-500'}`}
          >
            <Heart className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Favs</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-indigo-500' : 'text-zinc-500'}`}
          >
            <User className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Me</span>
          </button>
        </div>
      </nav>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
