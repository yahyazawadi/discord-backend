# 🏆 Discord Clone Server: Master System Blueprint & Documentation

This master documentation is a comprehensive blueprint of your simplified Discord Clone server. It covers the database models, API endpoints, real-time protocols, anonymous features, and deployment setups compiled throughout this session.

---

## 🏗️ 1. Project Goal & Design Core
The target is a high-performance, lightweight, deployment-ready Express + Socket.io + PeerJS server. 
* **Single-Port Architecture**: We bind Express, Socket.io, and PeerJS (`/peerjs`) to the same listener on port `5000`. This allows the server to deploy flawlessly on services like Render and Railway without opening extra ports.
* **Premium UX Features**: Out-of-the-box support for text categories, real-time typing indicators, pinned/edited messages, and unique anonymous messaging/reactions, as well as simple WebRTC voice and video rooms.

---

## 🗃️ 2. The Simple Database Schema Blueprint

Four main models form the foundation of our data store in MongoDB, designed to optimize read performance and take advantage of NoSQL document embedding.

```mermaid
classDiagram
    class User {
        +ObjectId _id
        +String username
        +String email
        +String password
        +String avatar
        +String systemStatus
        +String userStatusPreference
        +Date birthdate
        +Date createdAt
        +ObjectId[] blockedUsers
    }
    class Server {
        +ObjectId _id
        +String name
        +String icon
        +ObjectId owner
        +ObjectId[] admins
        +ObjectId[] members
        +ObjectId[] bannedUsers
        +String inviteCode
        +Number inviteUses
        +Number inviteMaxUses
        +Date inviteExpiresAt
        +Category[] categories
    }
    class Conversation {
        +ObjectId _id
        +ObjectId[] participants
    }
    class Message {
        +ObjectId _id
        +ObjectId server
        +String channel
        +ObjectId conversation
        +ObjectId sender
        +String content
        +Boolean isPinned
        +Boolean isEdited
        +Date editedAt
        +Attachment[] attachments
        +Boolean isAnonymous
        +String anonymousSenderName
        +Reaction[] reactions
    }
    Server --> User : references
    Conversation --> User : references
    Message --> User : references
```

### 👤 User Model (`models/User.js`)
Handles authentication, password hashing, active presence status, age checks, and block list states:
* `username`: Cleaned unique string.
* `email`: Lowercased unique email string.
* `password`: Securely encrypted via `bcryptjs` (auto-hashes on insertion/changes).
* `avatar`: Custom initials avatar generated on signup (`https://api.dicebear.com/7.x/initials/svg?seed=username`).
* `systemStatus`: Socket-driven connection presence enum (`['online', 'offline']`, defaults to `'offline'`).
* `userStatusPreference`: User-specified override enum (`['auto', 'online', 'idle', 'dnd', 'offline']`, defaults to `'auto'`).
* `birthdate`: Date object representing user's birthdate (enables client-side and backend age validation).
* `createdAt`: Date timestamp indicating account creation (defaults to `Date.now`).
* `blockedUsers`: Array of ObjectIds referencing other `User` profiles (utilized by the DM block validation engine).

### 🛡️ Server Model (`models/Server.js`)
Groups channel categories, lists members, manages admins, and handles invite link keys:
* `name`: Display name.
* `icon`: Display avatar url.
* `owner`: References `User` (the creator/ultimate manager of the server).
* `admins`: Array of ObjectIds referencing `User` (Moderators/administrators with permissions to delete messages, kick, or ban members).
* `members`: Array of ObjectIds of all users in the server.
* `bannedUsers`: Array of ObjectIds of users blocked from entering (security constraint).
* `inviteCode`: Dynamic 8-digit unique string used to join.
* `inviteUses`: Number of times the current invite code has been used (default: `0`).
* `inviteMaxUses`: Maximum times the code can be consumed (optional, e.g. single-use).
* `inviteExpiresAt`: Timestamp when the active invite link expires (optional expiration).
* `categories`: Clumps of channels supporting custom drag order and renaming:
  * `name`: Category Group Name (e.g., `"GAMING CHANNELS"`).
  * `order`: Sorting hierarchy index.
  * `mutedUsers`: Array of ObjectIds referencing `User` (users who have muted this entire category).
  * `channels`: Sub-document array:
    * `name`: Lowercase, cleaned sub-channel path (e.g., `"general-chat"`).
    * `type`: Enum (`['text', 'voice']`). *(Note: 'voice' channels automatically support both audio and video screenshare streams via our PeerJS mesh).*
    * `description`: Topic description.
    * `isAnnouncement`: Boolean indicating a forced auto-subscribe announcement feed (defaults to `false`).
    * `createdAt`: Date timestamp indicating channel creation (defaults to `Date.now`).
    * `subscribers`: Array of ObjectIds referencing `User` (subscribers who follow this channel for custom notifications/real-time triggers).
    * `mutedUsers`: Array of ObjectIds referencing `User` (users who have specifically muted this individual channel).

### 💬 Conversation Model (`models/Conversation.js`)
Direct Message mapper tracking 1-on-1 private threads between exactly two users:
* `participants`: Array of exactly 2 User ObjectIds.

### 📩 Message Model (`models/Message.js`)
Houses chat logs for both servers and direct messages, including rich file metadata, reactions, pinning, and anonymity states:
* `server` / `channel`: References parent server and specific sub-channel path (optional).
* `conversation`: References direct message thread (optional).
* `sender`: References sending User.
* `content`: Text message string.
* `isPinned` / `isEdited`: Booleans indicating status.
* `editedAt`: Date timestamp of when the message was last modified (optional).
* `attachments`: Array of rich file attachment sub-documents:
  * `url`: String URL of file (uploads folder or CDN).
  * `fileType`: String MIME-type or category (e.g. `'image'`, `'video'`, `'pdf'`).
  * `fileName`: Original file name string.
  * `fileSize`: Number representing file size in bytes (allows rich user sizing feedback).
* `isAnonymous`: Boolean representing whether it was sent anonymously.
* `anonymousSenderName`: Randomly generated display name (e.g., `"Spunky Tiger"`) shown to users when `isAnonymous` is true.
* `reactions`: Sub-document array of emoji interactions:
  * `emoji`: Unicode reaction key (e.g., `💖`).
  * `users`: Array of User IDs (for public reactions).
  * `anonymousReactors`: Array of `{ userId, anonymousName }` objects (preserves user IDs under the hood to allow toggle actions while showing anonymous labels like `"Silly Dolphin"` to everyone else).

### 🔔 Notifications — Client-Side Only (No Database Model)
**Deliberately cut** to save development time and database write overhead. Notifications are handled entirely as client-side Zustand state:
* **Unread badges**: A Zustand store tracks which channel IDs have unread messages. The badge clears when the user clicks the channel.
* **Mentions**: The Socket.io `receive_message` event carries a `mentions` array. The client checks if the logged-in user's ID is in that array and triggers a highlight — no DB write required.
* **DM pings**: A new DM message fires a `dm_notification` socket event directly to the recipient's socket room. Zustand state is updated instantly.

---

## 🗄️ 2.1 MongoDB NoSQL Architectural Optimization Details (Zero-Join Engine)

Unlike traditional SQL relational models which store every relationship as a unique row in junction tables and require intensive `JOIN` queries, this platform relies entirely on **MongoDB's NoSQL document nesting and atomic operations** to deliver extremely lightweight, high-performance execution.

### 🧩 A. Denormalized Nested Arrays vs. SQL Junction Tables
* **Embedded Channels**: In a relational model, channels reside in their own tables with foreign keys linked back to the Server ID. Under MongoDB, **channels are nested arrays of sub-documents inside categories directly inside the `Server` parent document**. Retrieving a server dynamically retrieves its channels, muted states, and sorting hierarchy inside one single database read operation, executing at $O(1)$ efficiency.
* **Many-to-Many Direct Arrays**: User blocks (`blockedUsers`), server administrators (`admins`), and banned members (`bannedUsers`) are modeled directly as arrays of dynamic ObjectIDs within the respective parent documents. MongoDB performs writes on these arrays using high-speed atomic operators:
  * **`$push`**: Appends elements (e.g. blocking a user, joining a server) instantly.
  * **`$pull`**: Extracts elements (e.g. unblocking a user, leaving a server) instantly.
  This bypasses transaction lockouts and table index overheads typical of SQL engines.

### 🎭 B. Double-Tiered Presence Status Logic (System-Driven vs. Manual Preferences)
To avoid continuous, CPU-heavy database status-writing when users connect or disconnect, presence is tracked in two tiers:
1. **`systemStatus` (Dynamic Socket State)**: Controlled dynamically by Socket.io connectivity state. When a user connects, their socket updates this parameter to `"online"`. On disconnect, it auto-flops to `"offline"`.
2. **`userStatusPreference` (User Override)**: Keeps track of manual selections (`"auto"`, `"online"`, `"idle"`, `"dnd"`, `"offline"`).
* **UI Resolution**: The client interface determines status dynamically: if `userStatusPreference` is `"auto"`, it inherits `systemStatus` directly. Otherwise, it displays their manual preference. This maintains instant real-time synchronization with zero complex state logic.

### 📡 C. Standard REST & WebSocket Execution (MVP Scope)
To ensure reliable 2-day MVP delivery and maintain clean, readable code for the internship interview:
* **WebSockets**: Standard `socket.io` events handle real-time message broadcasting and typing indicators. No need for complex sliding window ACKs or Redis syncing for 20 users.
* **Database**: Standard Mongoose schemas (`User`, `Server`, `Message`) execute basic CRUD logic. We avoid bucket patterns or custom caches to demonstrate clean, standard RESTful principles.
* **Video/Voice**: `PeerJS` provides an out-of-the-box WebRTC Mesh network. (Note: Mesh networking requires clients to upload streams multiple times, which easily supports our 20-user MVP scale without requiring a heavy SFU server).

### 🌲 D. Trie (Prefix Tree) In-Memory Invite Cache Spec
Even within our MVP, we can inject a touch of "genius" to impress your interviewers. To check dynamic server invite links in constant time ($O(L)$) without executing slow database index queries on MongoDB, we implement a custom in-memory **Trie (Prefix Tree)** cache.

#### 1. The Dynamic Trie Classes Structure
```javascript
class TrieNode {
  constructor() {
    this.children = {};      // Maps characters to child TrieNodes
    this.isEndOfCode = false; // Marks exact end of a valid invite code
    this.serverId = null;     // Cached Server ObjectID pointer for O(L) routing
  }
}

class InviteTrie {
  constructor() {
    this.root = new TrieNode();
  }

  // Insert invite code in O(L) time where L is length of invite code
  insert(code, serverId) {
    let node = this.root;
    for (const char of code) {
      if (!node.children[char]) node.children[char] = new TrieNode();
      node = node.children[char];
    }
    node.isEndOfCode = true;
    node.serverId = serverId;
  }

  // Search invite code in O(L) time
  search(code) {
    let node = this.root;
    for (const char of code) {
      if (!node.children[char]) return null;
      node = node.children[char];
    }
    return node.isEndOfCode ? node.serverId : null;
  }
}

// Global instance instantiated at server boot
const inviteCache = new InviteTrie();
```
* **Why this is an interview winner**: Most junior engineers will just do `Server.findOne({ inviteCode: req.params.code })`. By adding a simple Trie wrapper, you demonstrate a deep understanding of algorithmic bounds, memory manipulation, and how to protect database connections from spam requests!
---

## 📡 3. HTTP REST API Endpoint Map

| Route | HTTP Method | Request Body / Params | Middleware | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`/api/auth/register`** | `POST` | `{ username, email, password }` | None | Sign up new user, generate initials avatar, issue JWT token. |
| **`/api/auth/login`** | `POST` | `{ email, password }` | None | Authenticate user, verify hashed credentials, issue JWT token. |
| **`/api/auth/me`** | `GET` | None | `protect` | Load authenticated user's profile context. |
| **`/api/auth/users`** | `GET` | None | `protect` | Fetch other registered users in the database to start a DM. |
| **`/api/users/block/:userId`** | `POST` | `userId` param | `protect` | Toggle blocking/unblocking a target user from sending direct messages. |
| **`/api/servers`** | `POST` | `{ name, icon, isPrivate }` | `protect` | Create server, assign owner, and auto-populate default channels. |
| **`/api/servers`** | `GET` | None | `protect` | Fetch all servers the authenticated user is a member of. |
| **`/api/servers/join/:inviteCode`** | `POST` | `inviteCode` param | `protect` | Instantly join a server using its unique invite code link (Bypasses private server locks). |
| **`/api/servers/:serverId/join-direct`**| `POST` | `serverId` param | `protect` | Direct attempt to join by ID. If `isPrivate: true`, returns error: `"Server is private and you cannot join!"`. |
| **`/api/servers/:serverId/leave`** | `POST` | `serverId` param | `protect` | Remove authenticated user from server member list. |
| **`/api/servers/:serverId/kick/:userId`** | `POST` | `serverId`, `userId` params | `protect` | Kick a user from the server (Only Server Admins / Owner). |
| **`/api/servers/:serverId/ban/:userId`** | `POST` | `serverId`, `userId` params | `protect` | Ban user and add to bannedUsers list (Only Server Admins / Owner). |
| **`/api/servers/:serverId/search`** | `GET` | `query` query parameter | `protect` | Full-text query messages search within the server's channels. |
| **`/api/servers/:serverId/channels`** | `POST` | `{ name, type, description }` | `protect` | Create text or voice sub-channel inside category (Only Server Owner). |
| **`/api/servers/:serverId/channels/:channelId/subscribe`** | `POST` | None | `protect` | Toggle subscribing/unsubscribing to a specific channel's real-time alerts. |
| **`/api/servers/:serverId/channels/:channelId/mute`** | `POST` | None | `protect` | Toggle muting/unmuting notifications for a specific channel. |
| **`/api/servers/:serverId/categories/:categoryId/mute`** | `POST` | None | `protect` | Toggle muting/unmuting notifications for an entire category clump. |
| **`/api/conversations`** | `POST` | `{ recipientId }` | `protect` | Find or create a 1-on-1 conversation thread. |
| **`/api/conversations`** | `GET` | None | `protect` | Fetch active DM conversations. |
| **`/api/messages/channel/:channelId`** | `GET` | `channelId` param | `protect` | Get last 100 chronological messages for a channel. |
| **`/api/messages/conversation/:conversationId`**| `GET` | `conversationId` param | `protect` | Get last 100 chronological messages in a private DM thread. |
| **`/api/messages/pin/:messageId`** | `PUT` | `messageId` param | `protect` | Toggle pinned state of a message (`isPinned` boolean). |
| **`/api/messages/edit/:messageId`** | `PUT` | `{ content }` | `protect` | Edit message content, marks `isEdited = true` (Owner only). |
| **`/api/messages/:messageId`** | `DELETE`| `messageId` param | `protect` | Delete message (Permitted only to Message Sender or Server Admins). |
| **`/api/messages/upload-url`** | `POST` | `{ fileName, fileType }` | `protect` | Generate a Cloudflare R2 pre-signed URL for direct client-side file uploads. |

---

## ⚡ 4. Real-Time WebSockets Engine (`index.js`)

Socket.io syncs actions across connections instantly.

```mermaid
sequenceDiagram
    participant UserA as Sender (Client)
    participant Server as Socket.io Server
    participant UserB as Receiver (Client)

    UserA->>Server: emit("send_message", { content, isAnonymous: true })
    Note over Server: Generates "Happy Panda" &<br/>saves message to MongoDB
    Server-->>UserA: emit("receive_message", msgObj)
    Server-->>UserB: emit("receive_message", msgObj)
    
    UserA->>Server: emit("typing", { username, targetId })
    Server-->>UserB: emit("user_typing", { username })
```

### Core Socket Events:
* **`user_online` / `disconnect`**: Automatically updates online/offline state in MongoDB and broadcasts `user_status_changed` to update visual avatar status rings.
* **`send_message` / `receive_message`**: Saves message in DB, populates sender details, and broadcasts to room. If message is sent in a channel, triggers `channel_notification` sockets directly to all of the channel's `subscribers` (excluding the sender).
* **`typing` / `stop_typing`**: Pushes name-keyed typing indicators to targeted chat rooms.
* **`add_reaction` / `remove_reaction`**: Manages emojis, updates public or anonymous reactor lists in MongoDB, and pushes `message_updated` payloads.
* **`edit_message` / `delete_message`**: Triggers instantaneous message feed updates or deletes on the screen without full room reloads.
* **`join_voice` / `leave_voice`**: Registers user Peer IDs in targeted rooms, broadcasting peer handshake keys so clients can establish direct WebRTC voice/video sessions.

---

## 🎭 5. Anonymous Name Generation Helper

To create random animal-adjective identities when users toggle anonymity, we use a simple utility helper:

```javascript
export const generateAnonymousName = () => {
  const adjectives = ['Happy', 'Sleepy', 'Silly', 'Spunky', 'Golden', 'Mysterious', 'Sneaky', 'Swift', 'Jolly', 'Gentle'];
  const animals = ['Panda', 'Dolphin', 'Koala', 'Cheetah', 'Koala', 'Fox', 'Tiger', 'Falcon', 'Otter', 'Badger'];
  
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnim = animals[Math.floor(Math.random() * animals.length)];
  
  return `${randomAdj} ${randomAnim}`;
};
```

---

## 🔔 6. Premium Notification & Mention Architecture

### 🔇 1. Notification State Lifecycle
Every channel has a granular notification state progression:
1. **Initial Join State (Subscribed to None)**: When a user joins a server, they are subscribed to **none** of the channels. They do not get unread count badges, sounds, or push notifications. They can view channels passively.
2. **Subscribed State (Unmuted by Default)**: When a user explicitly clicks **"Subscribe"** on a channel:
   * It becomes **unmuted by default**.
   * The user gets real-time sounds and desktop notifications.
   * A **small red circle badge** highlights the channel if there are missed messages since their `lastReadAt` timestamp.
3. **Muted State**: After subscribing, the user can choose to **"Mute"** the channel:
   * Suppresses general push alerts, unread message badges, and sound triggers.
   * Keeps their subscription connection intact so they can unmute it easily at any time.
   * **Direct Mentions Override Mute**: Even when in a muted state, if the user is specifically tag-mentioned (using `@username` or `@all`), they will **still** receive a real-time sound/alert and highlight notification!

### 📣 2. Mention Engine (`@all` & `@username`)
* **Mentions Bypass Silences**: When a message contains a mention, it instantly **overrides** all default-mute and unsubscribe locks:
  * **`@all`**: Mentions every member of the server. Every member (excluding the sender) gets an immediate highlight notification.
  * **`@username`** (e.g., `@alex`): Target-mentions that specific user, pushing a dedicated, direct alert to their tray.
* **Bypassing Rules**: Even if a channel is unsubscribed or manually muted, a direct mention triggers a persistent unread badge and push notify event.

### 🚫 3. Global DND (Do Not Disturb) Status Suppression
* **Ultimate Silence**: If a user sets their status to **`dnd` (Do Not Disturb)**, the WebSockets server **silences all sound and visual push notification alerts globally**, even for direct `@mentions` and private DMs!
* **Passive Indicator Only**: They will still receive the silent red unread circles in their sidebar list, but their device will not sound or popup while DND is active.

### 📢 4. Force-Subscribe Announcement Channels
* **Default Announcement Channels**: Server categories can contain channels marked with `isAnnouncement: true` (e.g., `#rules` or `#announcements`).
* **Auto-Opt-In on Join**: When a user joins a server, they are **automatically subscribed** to all announcement channels by default (unmuted). They can manually unsubscribe or mute them later if desired.

### ✨ 5. Mention Highlight Glow (Client-Side)
* **Visual Glow Card**: When the client-side UI renders a message containing a mention targeted at the authenticated user, it applies a rich thematic styling:
  * **Background**: A warm, translucent golden/amber gradient overlay.
  * **Left Accent Border**: A thick `3px` solid amber accent border (`#D4AF37`) running along the left margin of the message card.
  * **Visual Contrast**: Provides immediate visual separation of personal highlights when scanning the chat feed.

### 🎉 6. Dynamic Welcome Announcements
* **System Event trigger**: On successful execution of `POST /api/servers/join/:inviteCode`, the backend automatically generates a system welcome post in the server's default text channel:
  * **Sender**: A specialized mock-user `"System"` with `isSystem: true`.
  * **Content**: `"🎉 Welcome @username to the server! Say hello!"`
* **Real-time broadcast**: The welcome message is broadcast via Socket.io to all online server members.

### 🟢 7. Server Presence Counters
* **Real-time lookup**: When retrieving server context (`GET /api/servers/:serverId`), the database performs a live lookup across the server's `members` collection:
  * **onlineCount**: Returns count of members with `status` of `'online'`, `'idle'`, or `'dnd'`.
  * **totalMembers**: Returns count of all members in the server.
* **Payload**: Returned inline inside the main server object to minimize client-side overhead.

### ⏱️ 8. Channel Unread Badges (Client-Side Only)
* **No database model required.** Unread state is tracked entirely in Zustand.
* When a `receive_message` socket event fires for a channel the user is not currently viewing, Zustand increments that channel's unread count in memory.
* Opening a channel dispatches a Zustand action that resets its unread count to `0`. Zero DB writes.

### 🌐 9. Dynamic Browser Tab Title Indicator
* **Tab Focus State Sync**: When a user is in another tab (or your tab is unfocused), receiving direct mentions or direct messages dynamically alters the HTML Document Title (e.g., `(3) 🔴 Discord`) to alert them of missed messages without forcing desktop notification dialogs.
* **The Implementation**:
  ```javascript
  let missedMentions = 0;
  
  socket.on("receive_message", (message) => {
    if (!document.hasFocus() && isMentioned(message)) {
      missedMentions++;
      document.title = `(${missedMentions}) 🔴 Discord`;
    }
  });

  window.addEventListener("focus", () => {
    missedMentions = 0;
    document.title = "Discord"; // Restores pristine tab title upon window focus
  });
  ```

### 🔊 10. Premium Audio Alert Debouncer & Spam Safeguard
* **Anti-Spam Sound Guard**: If a user is spammed with rapid-fire `@all` mentions or private DMs, playing standard audio files back-to-back will trigger a deafening, overlapping audio blast.
* **The Implementation**: We debounce notification sounds, limiting audio alerts to a maximum of **once every 1.5 seconds**, while still incrementing unread counters visually:
  ```javascript
  let lastNotificationSoundTime = 0;

  const playSystemNotificationSound = () => {
    const now = Date.now();
    if (now - lastNotificationSoundTime < 1500) {
      console.log("Suppressing overlapping sound alert to prevent ear fatigue.");
      return; // Ignore sub-second audio triggers
    }
    
    lastNotificationSoundTime = now;
    const alertAudio = new Audio("/assets/sounds/discord_notify.mp3");
    alertAudio.volume = 0.45; // Premium, low-fatigue level
    alertAudio.play().catch(e => console.warn("Browser audio auto-play gesture block:", e));
  };
  ```

---

## 🖼️ 7. Unified Lightweight Media Engine: Emojis, Giphy & Auto-Conversions

To keep the platform exceptionally lightweight, performance-optimized, and free of expensive storage plans, we build a seamless, self-contained media and interactive chat engine that serves both servers and direct message feeds.

### 🎭 1. Client-Side Emojis & Giphy Integration
* **Zero-Storage footprint Giphy**: Instead of uploading GIFs, the client embeds an interactive Giphy picker that communicates directly with the Giphy API. The payload saved to MongoDB is just a lightweight Giphy URL string, consuming zero server space:
  ```javascript
  // Express Proxy endpoint (keeps Giphy API Key hidden from client)
  app.get("/api/gifs/search", async (req, res) => {
    const { query, limit = 20 } = req.query;
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=\${process.env.GIPHY_API_KEY}&q=\${encodeURIComponent(query)}&limit=\${limit}`
      );
      const data = await response.json();
      const gifUrls = data.data.map(gif => ({
        id: gif.id,
        preview: gif.images.fixed_width_small.url,
        url: gif.images.original.url
      }));
      res.json(gifUrls);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch GIFs from Giphy" });
    }
  });
  ```
* **Performance Emoji Keyboard**: Emojis are inserted into the chat area via an optimized, custom dropdown emoji panel. Emoji keys are stored as pure Unicode characters in the `content` field, requiring zero processing overhead.

### 🔄 2. Cloudflare R2 Direct Upload Pipeline (Zero Server CPU)
All file uploads bypass the Node.js server entirely using Cloudflare R2 pre-signed URLs:
* **Images**: Compressed to `.webp` on the client via the Canvas API (see below) before uploading directly to R2.
* **Videos & other files**: Uploaded directly to R2 **as-is** with no conversion. No FFmpeg, no server-side transcoding. The client requests a pre-signed URL from our backend (`POST /api/messages/upload-url`), then `PUT`s the file straight to Cloudflare — the backend never touches the binary data.

#### 📁 A. Client-Side Image-to-WebP Compressor (Canvas API)
Executed instantaneously inside the browser using standard canvas drawing APIs, this downscales heavy images and encodes them to highly-efficient `.webp` with near-zero latency:
```javascript
const compressImageToWebP = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Downscale massive prints to a max width of 1200px (retaining visual quality)
      canvas.width = Math.min(img.width, 1200);
      canvas.height = (canvas.width / img.width) * img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        const compressedFile = new File([blob], `img-${Date.now()}.webp`, {
          type: "image/webp"
        });
        resolve(compressedFile);
      }, "image/webp", 0.8); // 80% compression quality sweet-spot
    };
  });
};
```


---

## 🚀 8. Deployed Environment Configuration

### 📦 Render / Railway Environment Variables:
```env
PORT=10000
MONGODB_URI=mongodb+srv://discorduser:!0Zerox@discord.dtar4o9.mongodb.net/discord-clone
JWT_SECRET=super_secret_key_change_in_production
CLIENT_URL=https://your-discord-app.vercel.app
NODE_ENV=production
```

### 🔊 Connecting Your React Client:
```javascript
import { io } from "socket.io-client";
import { Peer } from "peerjs";

// WebSockets Connection
export const socket = io("https://your-backend.onrender.com");

// WebRTC PeerJS Connection (Targets same port, using secure SSL & STUN configuration)
export const peer = new Peer(undefined, {
  host: "your-backend.onrender.com",
  port: 443,
  path: "/peerjs",
  secure: true,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  }
});
```

---

## 🎙️ 9. WebRTC Voice/Video Mesh Architecture
Because we use WebRTC (via PeerJS), we avoid needing a complex central media server (SFU). Instead, clients connect directly to each other using a simple **Mesh Network**. 

### 🌐 The Peer-to-Peer Concept
1. **The Handshake (Signaling):** A user joins a Voice Channel and gets a unique `peerId`. They broadcast this ID to the room via our Node.js/Socket.io backend. This takes almost zero bandwidth.
2. **The Direct Connection (Media):** Every other user receives the ID and initiates a `peer.call(peerId, stream)`. A direct, encrypted tunnel opens between the users' laptops. The heavy video/audio traffic flows directly across the internet, completely bypassing our backend (saving server CPU and bandwidth).
*(This allows up to 4-10 people in a call easily with 0 backend hosting costs, making it actually faster than Google Meet's central server for small groups!)*

### 📡 STUN Servers (Public IP Discovery)
To connect Peer-to-Peer, computers need to know their public IP address (which is hidden behind home WiFi routers/NATs). 
* We use **Google's Free STUN Servers** (`stun:stun.l.google.com:19302`).
* A STUN server is simply an internet information desk: Your browser asks it "What is my public IP?", it echoes back the IP, and then your browser sends that IP to the other peers so they can connect directly.

### 💻 Screen, Tab, and System Audio Sharing
We rely on native browser APIs to handle complex media sharing without custom plugins:
* **Display Media API**: We call `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`. This triggers the browser's native screen picker.
* **System Audio**: Because we pass `audio: true`, the user can check "Share system/tab audio" in the browser popup, automatically streaming YouTube or local audio into the call.

### 🎛️ Client-Side Audio Filtering (Zero Backend Processing)
To ensure professional audio quality without server load, we use the browser's native audio processing engine when capturing the microphone:
```javascript
navigator.mediaDevices.getUserMedia({ 
  audio: { 
    echoCancellation: true,   // Stops the call from echoing
    noiseSuppression: true,   // Filters out background fans/keyboards
    autoGainControl: true     // Automatically adjusts volume if they whisper or yell
  } 
});
```

---

## 🛡️ 10. Robustness & Security (Enterprise Standards)
Even on a fast 2-day MVP timeline, demonstrating that you write "robust, defensive code" is what elevates you from a junior dev to an intern that companies desperately want to hire. We will enforce the following 4 pillars of robustness:

### 1. Global Error Handling Middleware
Instead of messy `try/catch` blocks sending inconsistent JSON responses across 30 different controllers, we use a single centralized Error Handler. It catches everything—from database timeouts to bad JWT tokens—and formats them into a strict standard response:
```javascript
// Example Standard Response Structure
{
  "success": false,
  "error": "Duplicate username detected.",
  "statusCode": 400
}
```

### 2. Graceful Shutdowns (Process Management)
When the hosting provider (like Render or Vercel) reboots the server or pushes an update, they send a `SIGTERM` signal. A brittle app just crashes mid-request. A robust app handles it:
* It stops accepting new HTTP traffic.
* It finishes processing active requests.
* It safely closes the MongoDB connection pool (`mongoose.connection.close()`).
* It exits safely with `process.exit(0)`.

### 3. XSS (Cross-Site Scripting) & Injection Protection
Users will try to paste malicious `<script>` tags into the chat input. 
* We will use a fast sanitizer (like `xss-clean` or simple RegExp stripping) on the backend before saving `content` to MongoDB. 
* We will sanitize MongoDB queries to prevent NoSQL injection attacks (e.g. someone putting `{"$gt": ""}` in the password field).

### 4. API Rate Limiting (DDoS Protection)
We will wrap the `auth` and `messages` routes in a lightweight `express-rate-limit` window. This prevents a malicious script from rapidly creating 10,000 servers in one second and crashing our free MongoDB Atlas cluster.

---

## ⏱️ 11. 5-Day MVP Scope & Tech Stack Constraints
To strictly finish the full-stack project in 5 days while remaining within the assessment's rules, the following stack and scope limitations are permanently enforced:

### Approved Tech Stack
1. **Frontend State**: **Zustand**. Zero-boilerplate global state. No Redux.
2. **Styling**: **Pure CSS (with CSS Modules)**. We will use CSS Modules (e.g. `Chat.module.css`) to prevent global style collisions, strictly adhering to the "Pure CSS" requirement without suffering layout nightmares.
3. **Storage**: **Cloudflare R2**. We will bypass the Node.js server and generate pre-signed URLs to upload avatars/attachments directly from the React client to Cloudflare R2.
4. **Search**: **MongoDB `$text` Indices**. We will implement a lightning-fast search using native MongoDB indexing (`$text`), avoiding complex regex matching.
5. **Auth / Email Validation**: **Nodemailer + Mailtrap/SendGrid**. We will generate secure OTPs/tokens, store them in MongoDB, and send real verification emails to ensure the auth flow is robust.

### Excluded "Fancy" Features (To Guarantee 5-Day Delivery)
To stay on schedule, we **MUST NOT** implement the following overly-complex features:
1. **Granular Role-Based Permissions**: We will only have "Owner/Admin" and "Member". Do not implement Discord-style customizable roles (where users can toggle 30 different permissions like "Can Manage Emojis").
2. **Message Threading (Replies)**: Do not build sub-threads. Threads act like miniature hidden channels and require complex database relational linking and UI nesting.
3. **Per-Message Read Receipts**: Do not track "Seen by X, Y, Z" for every message. In WebSockets, tracking individual read states for 20 users per message causes massive state bloat. Unread channel badges are sufficient.
4. **Rich Text Formatting (Markdown Parsers)**: Do not spend hours building a complex parser to render bold, italics, spoilers, and code blocks. Stick to standard text rendering for the MVP.
5. **Server-Side Video Recording**: Since we are using PeerJS (P2P Mesh), adding a recording feature would require routing streams through a centralized server, destroying our simple architecture. No call recording.

---

## 🧠 12. Architectural Rationale (The "Why")
During the technical interview, explaining *why* we chose this stack is just as important as the code itself. Here is the defense for our architectural decisions:

1. **Why Express/Node.js?**
   * **Reasoning**: It is non-blocking and single-threaded. This architecture is structurally perfect for long-lived WebSocket connections (Socket.io) because it can handle thousands of concurrent idle connections without spinning up heavy system threads for each one.
2. **Why MongoDB?**
   * **Reasoning**: A Discord clone requires deeply nested, hierarchical structures (e.g., A Server has many Categories, which have many Channels). MongoDB's document model allows us to model these relationships naturally. Additionally, its schema flexibility allows us to easily add features like "Reactions" or "Attachments" to a message later without expensive SQL migrations.
3. **Why WebRTC (PeerJS) instead of an SFU Media Server?**
   * **Reasoning**: We need to guarantee that we can deliver this within 5 days and host it for free. An SFU (centralized media server) requires massive backend bandwidth and complex infrastructure. By using a WebRTC Mesh Network, the heavy video traffic bypasses our backend entirely, reducing our server load to zero while still providing lightning-fast latency for small group calls.
4. **Why Cloudflare R2 instead of MongoDB GridFS or Local Disk?**
   * **Reasoning**: Storing images on the local Node.js disk destroys scalability (if we spin up a second backend server, it won't have the files). MongoDB GridFS is slow and expensive for binary data. Cloudflare R2 provides an S3-compatible API with zero egress fees, and generating "pre-signed URLs" allows clients to upload directly to the bucket, keeping our Node.js server entirely free of file-processing CPU spikes.
5. **Why Zustand over Redux?**
   * **Reasoning**: Redux is extremely verbose and requires heavy boilerplate (actions, reducers, dispatchers). For an MVP, speed is key. Zustand provides the exact same global state capabilities (crucial for keeping the active channel UI and chat WebSocket synchronized) but requires a fraction of the code, reducing bug surface area and development time.
