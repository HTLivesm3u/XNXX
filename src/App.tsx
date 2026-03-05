/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import shaka from 'shaka-player';
import 'mux.js';
import { Play, Tv, Search, Info, Settings, ChevronRight, Volume2, Shield, AlertCircle } from 'lucide-react';
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

const VideoPlayer = ({ channel }: { channel: Channel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<shaka.Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      setError('Browser not supported for this player');
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

        // Configure DRM if needed
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
            bufferingGoal: 15,
            rebufferingGoal: 2,
          }
        });

        // Add request filters for headers if needed
        player.getNetworkingEngine()?.registerRequestFilter((type, request) => {
          if (channel.headers) {
            Object.entries(channel.headers).forEach(([key, value]) => {
              request.headers[key] = value;
            });
          }
        });

        await player.load(channel.url);
        videoRef.current?.play();
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
    <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        autoPlay
        playsInline
      />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-white font-medium mb-2">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!channel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
          <Tv className="w-16 h-16 text-zinc-700 mb-4" />
          <p className="text-zinc-500 font-medium">Select a channel to start watching</p>
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

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('/api/channels');
        const data = await response.json();
        setChannels(data);
        if (data.length > 0) {
          // Don't auto-select to avoid multiple autoplay issues
          // setSelectedChannel(data[0]);
        }
      } catch (error) {
        console.error('Error fetching channels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  const groups = ['All', ...Array.from(new Set(channels.map(c => c.group)))];

  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === 'All' || channel.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                PREMIUM LIVE
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Adult Entertainment</p>
            </div>
          </div>

          <div className="flex-1 max-w-md relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/50 border border-white/5 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-zinc-600"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white">
              <Settings className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Live Now</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-6">
            <VideoPlayer channel={selectedChannel!} />
            
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {selectedChannel?.name || 'Select a Channel'}
                  </h2>
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs font-medium uppercase tracking-wider">
                      {selectedChannel?.group || 'General'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Volume2 className="w-3 h-3" /> Stereo
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Info className="w-3 h-3" /> 1080p HD
                    </span>
                  </div>
                </div>
                <button className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all shadow-xl shadow-white/5">
                  Add to Favorites
                </button>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Experience high-quality premium streaming with zero buffering. Our advanced player supports both DASH and HLS formats with secure DRM protection.
              </p>
            </div>
          </div>

          {/* Sidebar / Channel List */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl flex flex-col h-[calc(100vh-200px)] overflow-hidden backdrop-blur-sm">
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Tv className="w-4 h-4 text-indigo-500" />
                    Channels
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    {filteredChannels.length} Available
                  </span>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {groups.map(group => (
                    <button
                      key={group}
                      onClick={() => setSelectedGroup(group)}
                      className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                        selectedGroup === group 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-16 bg-zinc-800/50 animate-pulse rounded-xl" />
                  ))
                ) : filteredChannels.length > 0 ? (
                  filteredChannels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannel(channel)}
                      className={`w-full group flex items-center gap-4 p-3 rounded-xl transition-all ${
                        selectedChannel?.id === channel.id
                          ? 'bg-indigo-600/20 border border-indigo-500/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="relative w-12 h-12 flex-shrink-0 bg-zinc-800 rounded-lg overflow-hidden border border-white/10">
                        {channel.logo ? (
                          <img 
                            src={channel.logo} 
                            alt={channel.name} 
                            className="w-full h-full object-contain p-1"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Tv className="w-5 h-5 text-zinc-600" />
                          </div>
                        )}
                        {selectedChannel?.id === channel.id && (
                          <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 text-left min-w-0">
                        <h4 className={`font-bold text-sm truncate ${
                          selectedChannel?.id === channel.id ? 'text-indigo-400' : 'text-zinc-200'
                        }`}>
                          {channel.name}
                        </h4>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate">
                          {channel.group}
                        </p>
                      </div>

                      <ChevronRight className={`w-4 h-4 transition-transform ${
                        selectedChannel?.id === channel.id ? 'text-indigo-400 translate-x-1' : 'text-zinc-700 group-hover:text-zinc-500'
                      }`} />
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                    <Search className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm font-medium">No channels found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
