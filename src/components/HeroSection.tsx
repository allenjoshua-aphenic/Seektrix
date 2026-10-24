import React, { useState } from 'react';
import { Shield, User, MapPin, Mail, ArrowRight, Server, Sparkles, FileText, CheckCircle2, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { useNameSuggest } from '../hooks/useNameSuggest';

// Indian States and Cities Map
const STATE_CITIES_MAP: Record<string, string[]> = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati', 'Kurnool'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tezpur'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Arrah'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Rajnandgaon'],
  'Delhi': ['New Delhi', 'Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Davangere'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Alappuzha'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Navi Mumbai'],
  'Manipur': ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur'],
  'Meghalaya': ['Shillong', 'Tura', 'Jowai', 'Nongpoh'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai', 'Saiha'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Alwar'],
  'Sikkim': ['Gangtok', 'Namchi', 'Geyzing', 'Mangan'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore', 'Erode'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar', 'Ramagundam'],
  'Tripura': ['Agartala', 'Dharmanagar', 'Udaipur', 'Ambassa'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Haldwani', 'Roorkee', 'Nainital', 'Rishikesh'],
  'West Bengal': ['Kolkata', 'Howrah', 'Darjeeling', 'Asansol', 'Siliguri', 'Durgapur', 'Kharagpur']
};

interface HeroSectionProps {
  onLaunchSearch: (fullName: string, city: string, email: string, state: string) => void;
  isAuthenticated: boolean;
}

export default function HeroSection({ onLaunchSearch, isAuthenticated }: HeroSectionProps) {
  const [fullName, setFullName] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Live preview against the real registry: debounced 350 ms, previous
  // request cancelled on every new keystroke (AbortController), stale
  // responses discarded by sequence number.
  const suggest = useNameSuggest(fullName, selectedState);

  // Rules: full name OR email is enough. State and city are optional — a state
  // turns this into an advanced search narrowed to records registered there.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = fullName.trim();
    const mail = email.trim();
    if (!name && !mail) {
      setErrorMsg('Enter your full name or your email address to search. State and city are optional.');
      return;
    }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      setErrorMsg('That email address does not look right.');
      return;
    }
    setErrorMsg('');
    onLaunchSearch(name, selectedCity, mail, selectedState);
  };

  const FloatingDocument = ({ 
    title, 
    value, 
    delay, 
    x, 
    y, 
    glowColor = 'border-white/50' 
  }: { 
    title: string; 
    value: string; 
    delay: number; 
    x: string; 
    y: string; 
    glowColor?: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ 
        opacity: [0.9, 1, 0.9],
        y: [0, -12, 0]
      }}
      transition={{
        delay,
        duration: 5.5,
        repeat: Infinity,
        ease: 'easeInOut'
      }}
      style={{ top: y, left: x }}
      className={`absolute z-10 glass-panel max-w-[170px] p-3 rounded-xl border border-white/60 flex flex-col space-y-1.5 shadow-[0_15px_35px_rgba(0,0,0,0.09),inset_0_1.5px_1px_rgba(255,255,255,0.7)] text-[#171717] hover:scale-105 transition-transform duration-300 ${glowColor}`}
    >
      <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
        <span className="text-[9px] font-mono tracking-widest text-[#646464] uppercase font-bold">{title}</span>
        <div className="w-1.5 h-1.5 rounded-full bg-cofounder-blue animate-pulse" />
      </div>
      <div className="flex items-center space-x-1.5">
        <FileText className="w-3.5 h-3.5 shrink-0 opacity-80 text-cofounder-blue" />
        <span className="text-[10px] font-sans text-dark-charcoal truncate font-semibold leading-none">{value}</span>
      </div>
      <div className="flex items-center justify-between text-[8px] text-cofounder-blue font-bold tracking-tight pt-1">
        <span>VERIFIED INDEX</span>
        <span className="text-emerald-600 font-mono">SECURE</span>
      </div>
    </motion.div>
  );

  return (
    <section className="relative w-full overflow-hidden bg-transparent pt-2 pb-14 lg:pt-6 lg:pb-20 text-[#171717]">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          
          {/* Left Side: Text and Search Panel */}
          <div className="col-span-1 lg:col-span-7 flex flex-col space-y-6 lg:max-w-2xl">
            
            {/* Tagline / Indicator */}
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-[#10b981]/10 border border-[#10b981]/30 rounded-full text-[11px] font-extrabold uppercase tracking-widest text-emerald-800 w-fit font-mono shadow-xs">
              <span className="status-dot shrink-0" />
              <span>Secure India-Union Registry Database Active Connection</span>
            </div>

            <h1 className="serif-display text-5xl sm:text-6xl lg:text-[72px] font-black leading-[1.15] tracking-tight text-[#171717] mb-2">
              <span className="block">
                Recover <span className="bg-gradient-to-r from-cofounder-blue to-action-azure bg-clip-text text-transparent not-italic font-extrabold">unclaimed</span>
              </span>
              <span className="block">financial assets.</span>
            </h1>

            <p className="text-lg sm:text-xl text-[#333333] max-w-xl leading-relaxed font-semibold font-sans">
              Advanced fuzzy search systems scanning millions of public financial database disclosures to locate, verify, and reclaim your lost shareholder assets.
            </p>

            {/* Input Form */}
            <div className="glass-panel-light p-6 sm:p-10 rounded-2xl col-span-1 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.12),0_10px_30px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.95)] border-white/80 relative text-[#171717]" id="search-form-container">
              <form onSubmit={handleSubmit} className="space-y-5">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Your Full Name */}
                  <div className="relative">
                    <label className="block text-xs font-mono tracking-widest text-[#171717] uppercase font-extrabold mb-2">
                      Your Full Name <span className="normal-case tracking-normal font-semibold text-[#646464]">· or email below</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-medium-gray col-span-1">
                        <User className="w-4.5 h-4.5 text-[#171717]/60" />
                      </div>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ramesh Chandra Sen"
                        className="w-full bg-white/60 backdrop-blur-md border border-white/95 rounded-xl py-4 pl-11 pr-4 text-base font-bold text-[#171717] placeholder-[#646464]/50 focus:bg-white/90 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all font-sans shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)]"
                        id="hero-input-fullname"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="relative">
                    <label className="block text-xs font-mono tracking-widest text-[#171717] uppercase font-extrabold mb-2">
                      Email Address <span className="normal-case tracking-normal font-semibold text-[#646464]">· optional</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-medium-gray">
                        <Mail className="w-4.5 h-4.5 text-[#171717]/60" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. ramesh@outlook.com"
                        className="w-full bg-white/60 backdrop-blur-md border border-white/95 rounded-xl py-4 pl-11 pr-4 text-base font-bold text-[#171717] placeholder-[#646464]/50 focus:bg-white/90 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all font-sans shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)]"
                        id="hero-input-email"
                      />
                    </div>
                  </div>

                  {/* Select State */}
                  <div className="relative">
                    <label className="block text-xs font-mono tracking-widest text-[#171717] uppercase font-extrabold mb-2">
                      State <span className="normal-case tracking-normal font-semibold text-[#646464]">· optional, narrows results</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-medium-gray">
                        <MapPin className="w-4.5 h-4.5 text-[#171717]/60" />
                      </div>
                      <select
                        value={selectedState}
                        onChange={(e) => {
                          setSelectedState(e.target.value);
                          setSelectedCity('');
                        }}
                        className="w-full bg-white/60 backdrop-blur-md border border-white/95 rounded-xl py-4 pl-11 pr-10 text-base font-bold text-[#171717] focus:bg-white/90 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all font-sans shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)] cursor-pointer appearance-none"
                        id="hero-select-state"
                      >
                        <option value="" disabled>Select State</option>
                        {Object.keys(STATE_CITIES_MAP).map((stateName) => (
                          <option key={stateName} value={stateName} className="text-[#171717] font-semibold bg-white">
                            {stateName}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-medium-gray">
                        <ChevronDown className="w-4.5 h-4.5 text-[#171717]/60" />
                      </div>
                    </div>
                  </div>

                  {/* Select City */}
                  <div className="relative">
                    <label className="block text-xs font-mono tracking-widest text-[#171717] uppercase font-extrabold mb-2">
                      City <span className="normal-case tracking-normal font-semibold text-[#646464]">· optional</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-medium-gray">
                        <MapPin className="w-4.5 h-4.5 text-[#171717]/60" />
                      </div>
                      <select
                        disabled={!selectedState}
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="w-full bg-white/60 backdrop-blur-md border border-white/95 rounded-xl py-4 pl-11 pr-10 text-base font-bold text-[#171717] focus:bg-white/90 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all font-sans shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)] cursor-pointer appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                        id="hero-select-city"
                      >
                        <option value="" disabled>
                          {selectedState ? 'Select City' : 'Select State first'}
                        </option>
                        {selectedState && STATE_CITIES_MAP[selectedState]?.map((cityName) => (
                          <option key={cityName} value={cityName} className="text-[#171717] font-semibold bg-white">
                            {cityName}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-medium-gray">
                        <ChevronDown className="w-4.5 h-4.5 text-[#171717]/60" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Field rules, stated plainly */}
                <p className="text-[11px] text-[#646464] font-sans leading-relaxed" id="hero-field-rules">
                  <span className="font-bold text-[#171717]">Your name or your email is enough to search.</span>{' '}
                  State and city are optional: choose a state for an advanced search narrowed to records registered there, or leave it blank to search all of India.
                  {!fullName.trim() && email.trim() && (
                    <span className="block mt-1 text-cofounder-blue font-semibold">No name typed — we will read the name from your email address and search for that.</span>
                  )}
                </p>

                {/* Live preview: only a count, only when there is something to count */}
                {suggest.status === 'ready' && suggest.total > 0 && (
                  <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-cofounder-blue/25 bg-cofounder-blue/5 backdrop-blur-md px-4 py-2.5 text-xs font-sans"
                    id="hero-live-preview"
                    aria-live="polite"
                  >
                    <span className="font-bold text-[#171717]">
                      <span className="text-cofounder-blue">{suggest.total >= 50 ? '50+' : suggest.total}</span>
                      {` potential match${suggest.total === 1 ? '' : 'es'} for "${suggest.query}"`}
                      {selectedState ? ` in ${selectedState}` : ' across India'}
                    </span>
                    <span className="text-[11px] font-semibold text-[#646464] shrink-0">Press Search to see them</span>
                  </div>
                )}

                {errorMsg && (
                  <p className="text-xs text-red-500 font-mono font-bold" id="form-error-msg">{errorMsg}</p>
                )}

                {/* Submit button */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 pt-3">
                  <div className="flex items-center space-x-2 text-xs text-[#333333] font-bold">
                    <Shield className="w-4.5 h-4.5 text-cofounder-blue shrink-0" />
                    <span className="font-sans">AES-256 / ISO military-grade specifications.</span>
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-4.5 rounded-xl bg-gradient-to-r from-cofounder-blue via-[#1785be] to-action-azure backdrop-blur-md hover:scale-[1.02] active:scale-95 text-white text-sm font-extrabold tracking-widest uppercase shadow-[0_12px_30px_rgba(0,129,192,0.25),inset_0_1.5px_1px_rgba(255,255,255,0.4)] flex items-center justify-center space-x-2.5 cursor-pointer transition-all border border-white/30"
                    id="hero-start-search-btn"
                  >
                    <span>Search Public Registries</span>
                    <ArrowRight className="w-4.5 h-4.5" />
                  </button>
                </div>

              </form>
            </div>

            {/* Trust Indicators */}
            <div className="border-t border-steel-gray/20 pt-6 space-y-3">
              <p className="text-[10px] font-mono tracking-widest text-[#646464] uppercase font-bold">
                Institutional compliance parameters
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Secure & Confidential', icon: Shield },
                  { label: 'AI-Powered Core', icon: Server },
                  { label: 'Detailed Reports', icon: FileText },
                  { label: 'Nationwide Disclosure', icon: CheckCircle2 }
                ].map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <item.icon className="w-3.5 h-3.5 text-cofounder-blue shrink-0" />
                    <span className="text-xs font-sans text-[#646464] font-light">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Side: Cinematic Image and Floating Document Node Flow */}
          <div className="col-span-1 lg:col-span-5 relative h-[360px] sm:h-[450px] lg:h-[500px] rounded-2xl ai-pipeline-visual glass-panel-light overflow-hidden flex items-center justify-center lg:mt-0 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.1),0_10px_30px_rgba(0,0,0,0.05),inset_0_1px_2px_rgba(255,255,255,0.9)] border-white/75">
            
            {/* Glowing lines representing network pathways */}
            <svg className="absolute inset-0 w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grid-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0081c0" stopOpacity="0.25" />
                  <stop offset="50%" stopColor="#41a1cf" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#fefffc" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M-100,500 L800,200 M200,-50 L600,450 M80,220 C220,100 450,450 630,300 M10,400 C200,320 400,220 700,50" stroke="url(#grid-grad)" strokeWidth="1.5" fill="none" />
              <circle cx="340" cy="180" r="1.5" fill="#0081c0" />
              <circle cx="490" cy="220" r="2" fill="#0081c0" />
              <circle cx="120" cy="280" r="1.5" fill="#0081c0" />
              {/* Pulsing light dots */}
              <motion.circle 
                cx="340" cy="180" r="3" 
                fill="#0081c0"
                initial={{ cx: 340, cy: 180, opacity: 0 }}
                animate={{ cx: [340, 630], cy: [180, 300], opacity: [0, 1, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.circle 
                cx="80" cy="220" r="2.5" 
                fill="#41a1cf"
                initial={{ cx: 80, cy: 220, opacity: 0 }}
                animate={{ cx: [80, 340], cy: [220, 180], opacity: [0, 0.8, 0] }}
                transition={{ duration: 3.2, delay: 1, repeat: Infinity, ease: 'easeInOut' }}
              />
            </svg>

            {/* Abstract Tower & Digital Buildings silhouette backdrop */}
            <div className="absolute inset-0 flex items-end justify-center pointer-events-none opacity-[0.06] z-0">
              <div className="w-12 h-64 bg-steel-gray mx-1 border border-steel-gray bg-gradient-to-t from-steel-gray to-white rounded-t" />
              <div className="w-16 h-80 bg-steel-gray mx-1 border border-steel-gray bg-gradient-to-t from-steel-gray to-white rounded-t relative">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cofounder-blue animate-ping" />
              </div>
              <div className="w-20 h-96 bg-steel-gray mx-1 border border-steel-gray bg-gradient-to-t from-steel-gray to-white rounded-t" />
              <div className="w-14 h-72 bg-steel-gray mx-1 border border-steel-gray bg-gradient-to-t from-steel-gray to-white rounded-t" />
              <div className="w-16 h-84 bg-steel-gray mx-1 border border-steel-gray bg-gradient-to-t from-steel-gray to-white rounded-t" />
            </div>

            {/* Glowing Center Core */}
            <div className="absolute w-[180px] h-[180px] rounded-full bg-cofounder-blue/5 blur-[50px] animate-pulse z-0 pointer-events-none" />

            {/* Floating Documents replicating Hero Visual */}
            <FloatingDocument 
              title="Shares" 
              value="Reliance Industries" 
              delay={0} 
              x="10%" 
              y="18%" 
              glowColor="border-cofounder-blue/30 text-[#171717]" 
            />
            <FloatingDocument 
              title="Bonds" 
              value="NHAI Tax-Free Bonds" 
              delay={1.5} 
              x="62%" 
              y="15%" 
              glowColor="border-steel-gray/80 text-[#171717]"
            />
            <FloatingDocument 
              title="Mutual Funds" 
              value="HDFC Equity Fund" 
              delay={0.8} 
              x="45%" 
              y="52%" 
              glowColor="border-[#10b981]/25 text-[#171717]" 
            />
            <FloatingDocument 
              title="EPF / PPF" 
              value="MH-BAN-0082490 Ledger" 
              delay={2.4} 
              x="15%" 
              y="68%" 
              glowColor="border-cofounder-blue/20 text-[#171717]" 
            />
            <FloatingDocument 
              title="Insurance Pool" 
              value="LIC Senior Unclaimed" 
              delay={1.1} 
              x="5%" 
              y="44%" 
              glowColor="border-steel-gray/80 text-[#171717]"
            />

            {/* Tech Core status block - Stripe-like overlay */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="absolute bottom-6 left-6 right-6 p-4.5 rounded-xl glass-sub-floating text-xs font-mono z-20 flex items-center justify-between shadow-[0_15px_35px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] border-white/80"
            >
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shrink-0" />
                <span className="text-[#646464] text-[10px] uppercase font-bold">STATE:</span>
                <span className="text-emerald-700 font-bold tracking-tight">ACTIVE // SECURE CHANNEL</span>
              </div>
              <span className="text-cofounder-blue text-[10px] font-semibold uppercase">National Registry Link</span>
            </motion.div>

          </div>

        </div>
      </div>
    </section>
  );
}
