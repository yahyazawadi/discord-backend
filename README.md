# 🎮 Discord Clone: Master Features Overview

Welcome to the Discord Clone system. This is a lightweight, high-performance, single-port Express + Socket.io + PeerJS server designed for instant, real-time voice, video, screen share, and interactive messaging.

---

## 🚀 Core Features Matrix

### 👤 1. Identity & Relationship Engine
* **JWT Secure Authentication & Two-Step Verification (OTP)**: User registration with age checks, dynamic OTP verification delivered via email (with console log fallbacks), secure password hashing using `bcryptjs`, and persistent sign-in using secure, HTTP-only session cookies.
* **Initials Avatars**: Generates customized visual SVG avatars automatically on registration via DiceBear seed strings.
* **Double-Tiered Presence Synchronization**: Real-time status tracking split into socket-driven `systemStatus` (`online`, `offline`) and manual `userStatusPreference` (`auto`, `online`, `idle`, `dnd`, `offline`) override states, synchronized instantly across visual status rings.
* **Age Validation**: Secure birthdate tracking (`birthdate` schema attribute) to validate age categories at registration on the client and backend.
* **DM Block Engine**: Block and unblock target users cleanly to suppress spam and direct messages.

### 🛡️ 2. Collaborative Server Structure
* **Dynamic Servers**: Group conversations, categories, and channels. Consumes unique 8-digit invite codes to bypass join restrictions.
* **In-Memory Trie Invite Cache**: Custom in-memory Prefix Tree (Trie) caching active invite codes. Permits instant $O(L)$ uniqueness verification upon new invite link generation or user validation, completely eliminating heavy database index queries.
* **Server Admins Role**: Designated moderators/administrators (`admins` array in Server) who can delete any message, edit channels, and kick or ban problematic members.
* **Flexible Categories Clumping**: Organizes channels into expandable category blocks that support custom sorting and category-level muting.
* **Granular Channel Types**: Support for standard text feeds and WebRTC voice/video channels.
* **Announcement Channels**: Special announcement feeds (`isAnnouncement: true`) that automatically subscribe new members upon joining.
* **Server Presence Counters**: Dynamically updates active `onlineCount` versus `totalMembers` during server context retrieval.
* **Dynamic System Welcome Post**: Emits an automated welcome announcement via a mock `"System"` user in the default text channel when new members join.

### 💬 3. Dual Chat (1-on-1 DMs)
* **Direct Private Rooms**: Dynamic 1-on-1 private messaging channels mapped exactly to dynamic conversation IDs (`Conversation` model).
* **Strict Socket-Level Privacy (Block Engine)**: Socket-level message filter that dynamically queries user Block Lists. If User A has blocked User B (or vice versa), the socket intercepts the transmission, cancels database writes, and returns a private validation alert instantly.
* **Isolated DM Typing Indicators**: Typing indicators routed exclusively to the conversation partner.
* **Individual DM Read Receipts & Counters**: Dynamic unread counter badges tracked individually per private direct chat room.

### 💬 4. Interactive Messages Feed
* **Full CRUD Operations**: Instant text delivery, message editing, and complete message deletion (for owners/moderators).
* **Pinned Messages**: Pin essential communications to the top of any text channel or DM feed.
* **Unified Typing Indicators**: Real-time socket broadcasting showing who is actively typing in a channel or private DM.
* **Full-Text Server Query Search**: High-performance database regex searches to scan and locate text messages across all channels.
* **Robust Offline Message Retry Queue**: Stores outbound chats in a local client queue if connections flicker, automatically flushing them upon recovery with zero lost messages.

### 🎭 5. High-UX Chat & Media Additions
* **Zero-Storage GIPHY Picker**: Search and share GIFs seamlessly. Only Giphy URL strings are saved in MongoDB, maintaining a completely free and zero-storage backend.
* **Performance Emoji Keyboard**: Native custom unicode emoji picker panel designed for zero bundle size impact.
* **Rich File Metadata Attachments**: Allows sharing files, images, or videos with embedded rich metadata properties including `fileName` and `fileSize` (in bytes) alongside standard URLs.
* **Anonymous Reactions Support**: Allows toggling an emoji reaction anonymously. Preserves user IDs internally for toggle actions, but displays dynamic adjective-animal names (e.g. `"Silly Dolphin"`) in the client UI.
* **Instant Client-Side WebP Compressor**: Downscales massive JPEGs/PNGs to WebP (`80%` quality, `max-width: 1200px`) using the browser's native **Canvas API** before upload, saving 95% bandwidth.
* **Dynamic WebAssembly WebM Transcoder**: Dynamically loads `ffmpeg.wasm` on-demand to transcode heavy video files (MP4/MOV/AVI) to compressed `.webm` format inside a separate CPU web worker thread.
* **Zero-CPU Server Upload**: Replaces heavy binary transcoders on the server with a simple, lightning-fast static file receiver endpoint, protecting host processor limits.

### 🔔 6. Precision Notification Lifecycle
* **Subscribed State Alerts**: Users follow channels to receive sound alerts, browser tab indicators, and unread counts.
* **Mention Bypass System**: Tagging `@username` or `@all` overrides muted or unsubscribed locks to trigger visual highlight glows.
* **Global Do Not Disturb (DND)**: Suppresses all audio and desktop notification popups globally when active.
* **Interactive tab Titles**: Updates browser title dynamically (e.g. `(3) 🔴 Discord`) to alert away-users without annoying desktop permission prompts.
* **Notification Audio Debouncer**: Restricts visual alert sounds to **once every 1.5 seconds** to prevent ears fatigue during chat spam.
* **Unread Counters Read Receipts**: Custom tracking of `lastReadAt` timestamps per channel to display dynamic red badge counters.

### 🎙️ 7. WebRTC Voice & Video Channels (PeerJS Core)
* **Express-Hosted WebRTC Broker**: Embeds PeerJS server directly into the Express pipeline on port `5000`, bypassing complex multi-port firewall issues.
* **Anti-Ghosting Session safeguards**: Automatic PeerJS disconnect hook cleanup to prevent ghost users from lingering in voice channels on network loss.
* **Multi-Tab ID Conflict Auto-Recovery**: Detects duplicate browser tabs, appending dynamic timestamp suffixes to ensure secondary sessions connect successfully.
* **Aspect Ratio Containment**: Clean CSS constraints to prevent code-sharing distortion on wide, ultra-wide, or mobile viewports.
* **Dual-Peer Streaming Separation**: Run camera feeds, voice calls, and high-fidelity screen shares on distinct peer channels so toggling video never drops audio calls.
* **Opus Audio FEC & DTX**: Optimizes speech SDP packets with Forward Error Correction and Discontinuous Transmission to save up to 50% of call bandwidth.
* **Dynamic Video Quality Degradation**: Monitors client network telemetry and auto-throttles video bitrates (downscaling to 720p/480p) to maintain a smooth 30 FPS slideshow-free environment.
* **Enterprise corporate Firewall Bypass**: Fully integrated fallback TURN server relays to allow calls to connect securely behind restricted office, university, or VPN networks.
* **Pre-Flight Diagnostics Green Room**: Interactive setup overlay allowing users to test cameras, microphone inputs (via AudioContext visualization), and choose hardware sources before entering calls.
* **Laser Screen Annotation Draw Engine**: Captures normalized coordinates relative to shared video streams and overlays real-time canvas drawings (laser pointers) across all active callers during reviews.
* **Speaking Indicators Glowing Ring**: Web Audio API frequency analysis captures active speaker decibels instantly, adding a beautiful glowing ring around speaking participants with zero network latency.
* **Anti-Feedback session broker**: Automatically mutes or terminates secondary sessions if a user joins the same voice channel from multiple devices close by.
