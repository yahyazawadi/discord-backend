/**
 * seedMembers.js
 * Run: node --experimental-vm-modules scripts/seedMembers.js
 * Creates 5 fake users and injects them into the first server found in the DB.
 * One fake user is promoted to admin so you can test admin vs member flows.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ---- Inline lightweight models (avoids circular import issues in standalone scripts) ----

const channelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['text', 'voice'], default: 'text' },
  description: { type: String, default: '' },
  isAnnouncement: { type: Boolean, default: false },
  subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  channels: [channelSchema]
});

const serverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  members: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, nickname: String }],
  isPrivate: { type: Boolean, default: false },
  bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  inviteCode: { type: String, unique: true, sparse: true },
  inviteUses: { type: Number, default: 0 },
  inviteMaxUses: Number,
  inviteExpiresAt: Date,
  categories: [categorySchema]
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true },
  displayName: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String },
  systemStatus: { type: String, enum: ['online', 'offline'], default: 'offline' },
  userStatusPreference: { type: String, enum: ['auto', 'online', 'idle', 'dnd', 'offline'], default: 'auto' },
  birthdate: { type: Date, required: true },
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId }],
  isVerified: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: false }
}, { timestamps: true });

// ---- Fake members data ----
const fakeUsers = [
  { username: 'nightwolf',  displayName: 'Night Wolf',  email: 'nightwolf@seed.dev',  role: 'admin'  },
  { username: 'pixelstorm', displayName: 'Pixel Storm', email: 'pixelstorm@seed.dev', role: 'member' },
  { username: 'solarclaw',  displayName: 'Solar Claw',  email: 'solarclaw@seed.dev',  role: 'member' },
  { username: 'echo_void',  displayName: 'Echo Void',   email: 'echovoid@seed.dev',   role: 'member' },
  { username: 'ironblaze',  displayName: 'Iron Blaze',  email: 'ironblaze@seed.dev',  role: 'member' },
];

const SEED_PASSWORD = 'Seed@1234';

async function run() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.\n');

    // Use registered models or register fresh ones
    const User   = mongoose.models.User   || mongoose.model('User', userSchema);
    const Server = mongoose.models.Server || mongoose.model('Server', serverSchema);

    // Find the first real (non-system) server
    const server = await Server.findOne({}).sort({ createdAt: 1 });
    if (!server) {
      console.error('❌ No servers found. Create a server via the UI first, then re-run this script.');
      process.exit(1);
    }
    console.log(`🎯 Target server: "${server.name}" (${server._id})`);
    console.log(`👑 Owner ID: ${server.owner}\n`);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(SEED_PASSWORD, salt);

    for (const fake of fakeUsers) {
      // Upsert user (create if missing, skip if exists)
      let user = await User.findOne({ username: fake.username });
      if (!user) {
        user = await User.create({
          username: fake.username,
          displayName: fake.displayName,
          email: fake.email,
          password: hashedPassword,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${fake.username}`,
          birthdate: new Date('2000-01-01'),
          isVerified: true,
        });
        console.log(`  ➕ Created user: @${user.username} (${user._id})`);
      } else {
        console.log(`  ♻️  Existing user: @${user.username} (${user._id})`);
      }

      // Add to server members if not already there
      const alreadyMember = server.members.some(m => m.user.toString() === user._id.toString());
      if (!alreadyMember) {
        server.members.push({ user: user._id });
        console.log(`  ✅ Added @${user.username} to server members`);
      } else {
        console.log(`  ⏭️  @${user.username} is already a member`);
      }

      // Promote admin
      if (fake.role === 'admin') {
        const alreadyAdmin = server.admins.some(a => a.toString() === user._id.toString());
        if (!alreadyAdmin) {
          server.admins.push(user._id);
          console.log(`  🛡️  Promoted @${user.username} to ADMIN`);
        }
      }

      console.log('');
    }

    await server.save();

    console.log('─────────────────────────────────────────');
    console.log(`✅ Seed complete! Server now has ${server.members.length} members.`);
    console.log(`🛡️  Admins: ${server.admins.length}`);
    console.log(`\n🔑 All fake users share password: ${SEED_PASSWORD}`);
    console.log('─────────────────────────────────────────');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

run();
