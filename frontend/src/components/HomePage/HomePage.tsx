import { useState, useRef, useEffect } from 'react';
import './HomePage.css';

const KATARA_AVATAR =
  'https://api.builder.io/api/v1/image/assets/TEMP/c28839c037b9be1e7d5f00340f0e75f99cd966c2?width=200';

type StatusType = 'online' | 'idle' | 'dnd' | 'offline' | 'streaming' | 'mobile';

interface DMUser {
  id: string;
  name: string;
  status: StatusType;
  color: string;
}

const DM_USERS: DMUser[] = [
  { id: '1', name: 'Nelly',  status: 'online',    color: '#9b59b6' },
  { id: '2', name: 'Peppe',  status: 'idle',      color: '#e67e22' },
  { id: '3', name: 'Phibi',  status: 'dnd',       color: '#3498db' },
  { id: '4', name: 'Cap',    status: 'offline',   color: '#795548' },
  { id: '5', name: 'Wumpus', status: 'streaming', color: '#1a252f' },
  { id: '6', name: 'Locke',  status: 'mobile',    color: '#c0392b' },
  { id: '7', name: 'Clyde',  status: 'online',    color: '#576574' },
];

const SERVERS = [
  { id: 's1', gradient: 'linear-gradient(135deg, #e056fd 0%, #686de0 100%)' },
  { id: 's2', gradient: 'linear-gradient(135deg, #f9ca24 0%, #f0932b 100%)' },
  { id: 's3', gradient: 'linear-gradient(135deg, #e056fd 0%, #686de0 100%)' },
];

const MESSAGES = [
  {
    id: '1',
    timestamp: 'Yesterday at 12:42 PM',
    text: 'this is an example of a message.\nthis is the second line.\nanother line.\nanother, lots to say!',
    date: '20 May 2026',
  },
  {
    id: '2',
    timestamp: 'Yesterday at 12:42 PM',
    text: 'this is an example of a message.\nthis is the second line.\nanother line.\nanother, lots to say!',
    date: '20 May 2026',
  },
  {
    id: '3',
    timestamp: 'Yesterday at 12:42 PM',
    text: 'this is an example of a message.\nthis is the second line.\nanother line.\nanother, lots to say!',
    date: '20 May 2026',
  },
  {
    id: '4',
    timestamp: 'Yesterday at 12:42 PM',
    text: 'this is an example of a message.\nthis is the second line.\nanother line.\nanother, lots to say!',
    date: '20 May 2026',
  },
];

/* =====================================================================
   Status Badge
   ===================================================================== */
function StatusBadge({ status }: { status: StatusType }) {
  if (status === 'online') {
    return <span className="status-online" />;
  }
  if (status === 'idle') {
    return (
      <svg className="status-badge" width="12" height="12" viewBox="0 0 10 10" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.99514 9.99976C7.75911 9.99976 9.99976 7.75911 9.99976 4.99514C9.99976 2.33546 7.92501 0.160359 5.30569 0C5.93743 0.671693 6.32449 1.57616 6.32449 2.57103C6.32449 4.64401 4.64401 6.32449 2.57103 6.32449C1.57616 6.32449 0.671693 5.93743 0 5.30569C0.16036 7.92502 2.33546 9.99976 4.99514 9.99976Z"
          fill="#FAA61A"
        />
      </svg>
    );
  }
  if (status === 'dnd') {
    return (
      <svg className="status-badge" width="12" height="12" viewBox="0 0 10 10" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.99993 0C2.23854 0 0 2.23854 0 4.99993C0 7.76131 2.23854 9.99985 4.99993 9.99985C7.76131 9.99985 9.99985 7.76131 9.99985 4.99993C9.99985 2.23854 7.76131 0 4.99993 0ZM2.5 4C1.94772 4 1.5 4.44772 1.5 5C1.5 5.55228 1.94772 6 2.5 6H7.5C8.05228 6 8.5 5.55228 8.5 5C8.5 4.44772 8.05229 4 7.5 4H2.5Z"
          fill="#ED4245"
        />
      </svg>
    );
  }
  if (status === 'offline') {
    return (
      <svg className="status-badge" width="12" height="12" viewBox="0 0 10 10" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5 0C2.23858 0 0 2.23858 0 5C0 7.76142 2.23858 10 5 10C7.76142 10 10 7.76142 10 5C10 2.23858 7.76142 0 5 0ZM5 2.5C3.61929 2.5 2.5 3.61929 2.5 5C2.5 6.38071 3.61929 7.5 5 7.5C6.38071 7.5 7.5 6.38071 7.5 5C7.5 3.61929 6.38071 2.5 5 2.5Z"
          fill="#747F8D"
        />
      </svg>
    );
  }
  if (status === 'streaming') {
    return (
      <svg className="status-badge" width="12" height="12" viewBox="0 0 10 10" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.99993 0C2.23854 0 0 2.23854 0 4.99993C0 7.76131 2.23854 9.99985 4.99993 9.99985C7.76131 9.99985 9.99985 7.76131 9.99985 4.99993C9.99985 2.23854 7.76131 0 4.99993 0ZM7.5 5L3.5 2.5V7.5L7.5 5Z"
          fill="#593695"
        />
      </svg>
    );
  }
  if (status === 'mobile') {
    return (
      <svg className="status-badge status-badge--mobile" width="10" height="14" viewBox="0 0 10 15" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M0 2C0 0.895416 0.895432 0 2 0H8C9.10457 0 10 0.895416 10 2V13C10 14.1046 9.10457 15 8 15H2C0.895432 15 0 14.1046 0 13V2ZM1.5 3C1.5 2.44772 1.94772 2 2.5 2H7.5C8.05229 2 8.5 2.44772 8.5 3V9C8.5 9.55228 8.05229 10 7.5 10H2.5C1.94772 10 1.5 9.55228 1.5 9V3ZM4.5 11.5C3.67157 11.5 3 11.6716 3 12.5C3 13.3284 3.67157 13.5 4.5 13.5H5.5C6.32843 13.5 7 13.3284 7 12.5C7 11.6716 6.32843 11.5 5.5 11.5H4.5Z"
          fill="#3BA55D"
        />
      </svg>
    );
  }
  return null;
}

/* =====================================================================
   Icon Bar (left server nav)
   ===================================================================== */
function SideNavbar() {
  return (
    <nav className="icon-bar">
      {/* App logo — active home */}
      <div className="icon-bar-item icon-bar-item--active">
        <button className="icon-bar-logo" aria-label="Home">
          <svg width="48" height="48" viewBox="29 0 73 73" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="29" width="73" height="73" rx="36.5" fill="#14AC7B" />
            <path
              d="M68.0098 43.1577L62.1278 41.2142C57.325 39.4342 52.7671 35.6254 53.3599 30.6569C51.7496 30.1806 50.1275 29.6644 48.6291 29.7841C45.1715 30.0609 42.1316 32.5526 41.7781 35.8663C41.4793 38.6677 42.4913 41.046 44.7922 42.417L44.7844 42.4186C44.7844 42.4186 46.4909 43.4564 47.8603 43.8693C48.8692 44.1736 49.9688 44.5693 50.7039 44.861L51.2842 45.105C51.2991 45.1121 51.3163 45.1191 51.3304 45.1262C51.3327 45.1269 51.3359 45.1261 51.3382 45.1277L61.9495 49.5856C62.2576 49.7154 62.5837 50.4756 62.5305 50.7947C62.4758 51.1216 61.8329 51.3671 61.3418 51.3734L44.9439 51.5861C42.4913 51.6182 41.4957 54.4517 41.735 56.3959C41.965 58.2635 43.6433 60.0459 45.8894 60.0514L66.6936 60.1045C69.1313 60.1108 71.5644 59.5954 73.4312 57.7872C76.5094 54.8067 76.7691 49.943 74.2524 46.6238C72.7062 44.5849 70.3263 43.9233 68.0106 43.1584L68.0098 43.1577Z"
              fill="#E5F1F9"
            />
            <path
              d="M88.9218 35.821C88.67 32.3493 85.5745 30.1548 82.3704 29.788C80.7405 29.6019 79.1216 30.2041 77.4495 30.6647C77.1328 32.7411 78.4091 34.1841 77.0155 36.9292C76.7323 37.4876 74.8288 37.2647 74.6762 36.6445L74.3947 31.8058C74.2031 28.5171 71.0263 24.8054 67.9543 24.5355C67.302 24.4785 66.3541 24.43 65.7879 24.4511L63.1241 24.5504C59.873 24.6716 56.9269 27.9454 56.4913 31.0221C56.1206 33.6413 57.1944 36.1377 59.518 37.0175C61.9338 37.9318 64.2707 38.7021 66.7272 39.4803C70.8996 40.8012 74.8765 41.5841 77.4479 45.2341C79.3312 47.9072 79.4767 50.9386 79.2405 54.3187C81.8839 53.2872 84.1871 52.229 86.5764 51.0387C88.2461 50.2073 89.0173 48.3233 89.0251 46.397C89.0392 42.891 89.187 39.4827 88.9211 35.821H88.9218Z"
              fill="#E5F1F9"
            />
            <path
              d="M66.8203 23.6815C69.8234 23.1153 71.343 20.0456 70.7604 17.2137C70.2004 14.4929 67.5578 12.5384 64.6179 12.985C61.3715 13.4777 59.3451 16.4637 60.0091 19.4825C60.6817 22.5381 63.4166 24.3244 66.8203 23.6823V23.6815Z"
              fill="#E5F1F9"
            />
            <path
              d="M81.3161 29.0458C83.6537 29.2632 85.7137 27.6568 86.3926 25.5828C87.1481 23.2756 86.2463 20.8926 83.9791 19.7383C82.5534 19.0125 81.3044 19.0101 79.8732 19.5208C77.6372 20.3186 76.3953 22.6539 76.8168 24.9242C77.2297 27.15 79.0864 28.8385 81.3161 29.0458Z"
              fill="#E5F1F9"
            />
            <path
              d="M48.8879 29.1209C51.9005 29.2319 54.1506 26.7441 53.9785 23.7386C53.8221 21.0091 51.2138 18.9226 48.3248 19.3199C46.1937 19.6131 44.6107 21.0256 44.2322 23.3116C43.7278 26.3578 46.0435 29.0161 48.8872 29.1209H48.8879Z"
              fill="#E5F1F9"
            />
          </svg>
        </button>
      </div>

      <div className="icon-bar-divider" />

      {/* Server list */}
      {SERVERS.map((server) => (
        <div key={server.id} className="icon-bar-item">
          <button
            className="icon-bar-server"
            style={{ background: server.gradient }}
            aria-label={`Server ${server.id}`}
          />
        </div>
      ))}

      {/* Add Server */}
      <div className="icon-bar-item">
        <button className="icon-bar-action-btn" aria-label="Add Server">
          <svg width="18" height="18" viewBox="0 0 12 12" fill="none">
            <path d="M6.23388 0H4.98388V4.9825H0V6.2325H4.98388V11.2277H6.23388V6.2325H11.2264V4.9825H6.23388V0Z" fill="#14AC7B" />
          </svg>
        </button>
      </div>

      {/* Discover Servers */}
      <div className="icon-bar-item">
        <button className="icon-bar-action-btn" aria-label="Discover Servers">
          <svg width="22" height="22" viewBox="0 0 38 38" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M19 0C8.507 0 0 8.507 0 19C0 29.493 8.507 38 19 38C29.493 38 38 29.493 38 19C38 8.507 29.493 0 19 0ZM27.17 11.16L23.124 23.124L11.16 27.17L15.206 15.206L27.17 11.16Z"
              fill="#14AC7B"
            />
            <circle cx="19" cy="19" r="3" fill="#14AC7B" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

/* =====================================================================
   DM Sidebar
   ===================================================================== */
function DMSidebar({
  activeDmId,
  onSelectDm,
  open,
}: {
  activeDmId: string | null;
  onSelectDm: (id: string) => void;
  open: boolean;
}) {
  return (
    <aside className={`dm-sidebar${open ? ' dm-sidebar--open' : ''}`}>
      {/* Find a Conversation header */}
      <div className="dm-find-bar">
        <svg className="dm-find-icon" width="21" height="17" viewBox="0 0 21 17" fill="none">
          <path
            d="M3.77528 0H0C0 8.62319 3.77528 11.744 5.66292 12.0725V17H21C21 10.5942 16.2809 10.5942 12.9775 10.5942C5.66292 10.5942 3.77528 4.43478 3.77528 0Z"
            fill="white"
          />
          <path
            d="M12.9775 0.5C18.6405 0.5 18.6405 9.12319 12.9775 9.12319C7.0867 9.12319 7.31461 0.5 12.9775 0.5Z"
            fill="white"
          />
        </svg>
        <span className="dm-find-text">Find a converseation</span>
      </div>

      {/* Active indicator underline */}
      <div className="dm-active-indicator" />

      {/* DM list scroll area */}
      <div className="dm-scroll-area">
        <div className="dm-section-heading">
          <span className="dm-section-title">Direct Messages</span>
          <button className="dm-section-add-btn" aria-label="New Direct Message">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6.23388 0H4.98388V4.9825H0V6.2325H4.98388V11.2277H6.23388V6.2325H11.2264V4.9825H6.23388V0Z"
                fill="#14AC7B"
              />
            </svg>
          </button>
        </div>

        <div className="dm-user-list">
          {DM_USERS.map((user) => (
            <div
              key={user.id}
              className={`dm-user-item${activeDmId === user.id ? ' dm-user-item--active' : ''}`}
              onClick={() => onSelectDm(user.id)}
            >
              <div className="dm-avatar-wrapper">
                <div className="dm-avatar-circle" style={{ background: user.color }}>
                  {user.name[0]}
                </div>
                <span className="dm-status-badge">
                  <StatusBadge status={user.status} />
                </span>
              </div>
              <span className="dm-username">{user.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom profile bar */}
      <div className="dm-user-profile-bar">
        <div className="dm-profile-avatar-wrap">
          <div className="dm-profile-avatar">B</div>
          <span className="dm-profile-online-dot" />
        </div>
        <div className="dm-profile-info">
          <span className="dm-profile-name">bawwub</span>
          <span className="dm-profile-discriminator">#0001</span>
        </div>
        <div className="dm-profile-actions">
          {/* Mic */}
          <button className="dm-profile-action-btn" aria-label="Toggle Microphone">
            <svg width="14" height="17" viewBox="0 0 12 17" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.56286 8.05263C8.56286 9.5379 7.42286 10.7368 6 10.7368C4.57714 10.7368 3.42857 9.5379 3.42857 8.05263V2.68421C3.42857 1.19895 4.57714 0 6 0C7.42286 0 8.57143 1.19895 8.57143 2.68421L8.56286 8.05263ZM6 12.6158C8.36571 12.6158 10.5429 10.7368 10.5429 8.05263H12C12 11.1126 9.66857 13.6358 6.85714 14.0653V17H5.14286V14.0653C2.33143 13.6268 0 11.1037 0 8.05263H1.45714C1.45714 10.7368 3.63429 12.6158 6 12.6158Z"
                fill="#C7C9CB"
              />
            </svg>
          </button>
          {/* Headphones */}
          <button className="dm-profile-action-btn" aria-label="Toggle Headphones">
            <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
              <path
                d="M8 0.5C3.5888 0.5 0 4.088 0 8.5V14.9C0 15.7832 0.716 16.5 1.6 16.5H3.2C4.0832 16.5 4.8 15.7832 4.8 14.9V12.5C4.8 11.6168 4.0832 10.9 3.2 10.9H1.6V8.5C1.6 4.97039 4.4712 2.1 8 2.1C11.5288 2.1 14.4 4.97039 14.4 8.5V10.9H12.8C11.9168 10.9 11.2 11.6168 11.2 12.5V14.9C11.2 15.7832 11.9168 16.5 12.8 16.5H14.4C15.2832 16.5 16 15.7832 16 14.9V8.5C16 4.088 12.4112 0.5 8 0.5Z"
                fill="#C7C9CB"
              />
            </svg>
          </button>
          {/* Settings */}
          <button className="dm-profile-action-btn" aria-label="User Settings">
            <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M14.1904 6.9H16V10.1H14.1912C14.0016 10.8448 13.68 11.5384 13.252 12.1512L14.4 13.3L12.8 14.9L11.652 13.7512C11.0376 14.1792 10.3456 14.4984 9.6 14.6904V16.5H6.4V14.6904C5.6552 14.4984 4.9624 14.1792 4.3488 13.7512L3.2 14.9L1.6 13.3L2.7488 12.1512C2.3208 11.5392 2.0016 10.8456 1.8096 10.1H0V6.9H1.8096C2.0016 6.1544 2.32 5.4616 2.7488 4.8488L1.6 3.7L3.2 2.1L4.3488 3.2488C4.9616 2.82 5.6544 2.5016 6.4 2.3096V0.5H9.6V2.3088C10.3456 2.5016 11.0376 2.82 11.652 3.248L12.8 2.0992L14.4 3.6992L13.2512 4.8488C13.6792 5.4616 13.9984 6.1552 14.1904 6.9ZM8 11.7C9.7673 11.7 11.2 10.2673 11.2 8.5C11.2 6.73269 9.7673 5.3 8 5.3C6.2327 5.3 4.8 6.73269 4.8 8.5C4.8 10.2673 6.2327 11.7 8 11.7Z"
                fill="#C7C9CB"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

/* =====================================================================
   Chat Area
   ===================================================================== */
function ChatArea({ recipientName }: { recipientName: string }) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <section className="chat-area">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-left">
          <img
            src={KATARA_AVATAR}
            alt={recipientName}
            className="chat-header-avatar"
          />
          <span className="chat-header-name">{recipientName}</span>
        </div>

        <div className="chat-header-actions">
          {/* Call button */}
          <button className="chat-header-action-btn" aria-label="Voice Call">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M6.56459 1.47368V0C10.5872 0 13.8586 3.30547 13.8586 7.36842H12.3998C12.3998 4.11821 9.78197 1.47368 6.56459 1.47368ZM10.941 7.36842H9.48219C9.48219 5.74368 8.17365 4.42105 6.56459 4.42105V2.94737C8.97818 2.94737 10.941 4.93021 10.941 7.36842ZM6.56459 5.89474V7.36842H8.02339C8.02339 6.55495 7.37058 5.89474 6.56459 5.89474ZM8.75279 9.57895H11.6704C12.0737 9.57895 12.3998 9.90832 12.3998 10.3158V13.2632C12.3998 13.6706 12.0737 14 11.6704 14H8.02339C3.59229 14 0 10.3711 0 5.89474V2.21053C0 1.80305 0.326771 1.47368 0.729399 1.47368H3.647C4.05035 1.47368 4.3764 1.80305 4.3764 2.21053V5.15789C4.3764 5.56537 4.05035 5.89474 3.647 5.89474H2.9176C2.96355 8.79642 5.1058 11.0526 8.02339 11.0526V10.3158C8.02339 9.90832 8.34943 9.57895 8.75279 9.57895Z"
                fill="#14AC7B"
              />
            </svg>
          </button>

          {/* Video call button */}
          <button className="chat-header-action-btn" aria-label="Video Call">
            <svg width="17" height="14" viewBox="0 0 17 13" fill="none">
              <path
                d="M15.6209 3.69914C15.385 3.54229 15.0898 3.52943 14.8426 3.66143L12.8002 4.756V2.71429C12.8002 1.76886 12.0826 1 11.2002 1H1.6002C0.717799 1 0.000199318 1.76886 0.000199318 2.71429V11.2857C0.000199318 12.232 0.717799 13 1.6002 13H11.2002C12.0826 13 12.8002 12.232 12.8002 11.2857V9.244L14.8426 10.3377C14.9554 10.3986 15.0778 10.4286 15.2002 10.4286C15.3466 10.4286 15.4922 10.3849 15.621 10.3009C15.8562 10.144 16.0002 9.86886 16.0002 9.57143V4.42857C16.0002 4.13114 15.8562 3.856 15.6209 3.69914Z"
                fill="#14AC7B"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="chat-messages-scroll">
        {MESSAGES.map((msg) => (
          <div key={msg.id}>
            <div className="chat-message">
              <img
                src={KATARA_AVATAR}
                alt="Katara"
                className="chat-message-avatar"
              />
              <div className="chat-message-body">
                <div className="chat-message-meta">
                  <span className="chat-message-author">Katara</span>
                  <span className="chat-message-timestamp">{msg.timestamp}</span>
                </div>
                <p className="chat-message-text">{msg.text}</p>
              </div>
            </div>

            {/* Date separator after each message group */}
            <div className="chat-date-separator">
              <div className="chat-date-line" />
              <span className="chat-date-label">{msg.date}</span>
              <div className="chat-date-line" />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="chat-input-bar">
        <button className="chat-input-add-btn" aria-label="Add attachment">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 0C3.5888 0 0 3.5888 0 8.00001C0 12.4112 3.5888 16 8 16C12.4112 16 16 12.4112 16 8.00001C16 3.5888 12.4112 0 8 0ZM12 8.80001H8.8V12H7.2V8.80001H4V7.20001H7.2V4H8.8V7.20001H12V8.80001Z"
              fill="#8E9297"
            />
          </svg>
        </button>

        <input
          className="chat-input-field"
          type="text"
          placeholder={`Message ${recipientName}`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && inputValue.trim()) setInputValue('');
          }}
          aria-label={`Message ${recipientName}`}
        />

        <div className="chat-input-actions">
          {/* GIF */}
          <button className="chat-input-action-btn" aria-label="GIF">
            <svg width="18" height="15" viewBox="0 0 18 15" fill="none">
              <path
                d="M1.4702 0C0.658231 0 0 0.671573 0 1.5V13.5C0 14.3284 0.65823 15 1.4702 15H16.1722C16.9842 15 17.6424 14.3284 17.6424 13.5V1.5C17.6424 0.671573 16.9842 0 16.1722 0H1.4702ZM7.17784 7.086V10.11C6.54272 10.533 5.79291 10.767 4.9549 10.767C3.02306 10.767 1.9557 9.471 1.9557 7.554C1.9557 5.628 3.11127 4.323 4.99019 4.323C5.73999 4.323 6.36629 4.503 6.85146 4.782L6.64857 6.123C6.18987 5.826 5.65177 5.592 5.02547 5.592C3.97575 5.592 3.46412 6.384 3.46412 7.545C3.46412 8.715 3.99339 9.534 5.04311 9.534C5.37832 9.534 5.61649 9.462 5.86348 9.336V8.229H4.72555V7.086H7.17784ZM8.489 4.44H9.99743V10.65H8.489V4.44ZM15.0492 4.44V5.727H12.9057V6.996H14.5994V8.283H12.9057V10.65H11.4061V4.44H15.0492Z"
                fill="#8E9297"
              />
            </svg>
          </button>

          {/* Emoji */}
          <button className="chat-input-action-btn" aria-label="Emoji">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
              <path
                d="M8.5 0C3.80558 0 0 3.80558 0 8.5C0 13.1944 3.80558 17 8.5 17C13.1944 17 17 13.1944 17 8.5C17 3.80558 13.1944 0 8.5 0Z"
                fill="#8E9297"
              />
              <path
                d="M8.5 9.91674C6.78919 9.91674 5.65418 9.71741 4.25032 9.44449C3.92967 9.38262 3.30591 9.44449 3.30591 10.3889C3.30591 12.2778 5.47568 14.6389 8.5002 14.6389C11.5243 14.6389 13.6945 12.2778 13.6945 10.3889C13.6945 9.44449 13.0708 9.38211 12.7501 9.44449C11.3463 9.71741 10.2108 9.91674 8.5 9.91674Z"
                fill="#40444B"
              />
              <path
                d="M4.25 10.3889C4.25 10.3889 5.66667 10.8611 8.5 10.8611C11.3333 10.8611 12.75 10.3889 12.75 10.3889C12.75 10.3889 11.8056 12.2778 8.5 12.2778C5.19444 12.2778 4.25 10.3889 4.25 10.3889Z"
                fill="#8E9297"
              />
              <circle cx="5.85703" cy="7.52779" r="1.18056" fill="#40444B" />
              <circle cx="11.1432" cy="7.52779" r="1.18056" fill="#40444B" />
            </svg>
          </button>

          <div className="chat-input-divider" />

          {/* Send */}
          <button
            className="chat-input-send-btn"
            aria-label="Send Message"
            onClick={() => setInputValue('')}
          >
            <svg width="18" height="18" viewBox="0 0 22 21" fill="none">
              <path
                d="M20.0239 10.9981L13.7051 11.609L12.0423 16.9269C11.9432 17.2413 12.0404 17.585 12.2906 17.8003C12.5399 18.0155 12.894 18.0609 13.1905 17.9164L21 11.2106C21.271 11.0784 21.4429 10.8036 21.4429 10.5024C21.4429 10.2012 21.271 9.92645 21 9.79425L13.1999 3.0836C12.9034 2.93914 12.5493 2.98446 12.3 3.19974C12.0498 3.41503 11.9526 3.75778 12.0517 4.07221L13.7145 9.39006L19.921 10.0019C20.1759 10.0274 20.3704 10.2417 20.3704 10.4976C20.3704 10.7535 20.1759 10.9678 19.921 10.9933L20.0239 10.9981Z"
                fill="#14AC7B"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   Right User Profile Panel
   ===================================================================== */
function UserProfilePanel() {
  return (
    <aside className="profile-panel">
      {/* Avatar + name */}
      <div className="profile-panel-user-block">
        <img
          src={KATARA_AVATAR}
          alt="Katara"
          className="profile-panel-avatar"
        />
        <div className="profile-panel-name-block">
          <span className="profile-panel-name">Katara</span>
          <span className="profile-panel-last-seen">last seen recently</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="profile-panel-actions">
        {/* Voice call */}
        <button className="profile-panel-action-btn" aria-label="Voice Call">
          <svg width="34" height="38" viewBox="0 0 34 38" fill="none">
            <path
              d="M18 4V0C29.03 0 38 8.972 38 20H34C34 11.178 26.822 4 18 4ZM30 20H26C26 15.59 22.412 12 18 12V8C24.618 8 30 13.382 30 20ZM18 16V20H22C22 17.792 20.21 16 18 16ZM24 26H32C33.106 26 34 26.894 34 28V36C34 37.106 33.106 38 32 38H22C9.85 38 0 28.15 0 16V6C0 4.894 0.896 4 2 4H10C11.106 4 12 4.894 12 6V14C12 15.106 11.106 16 10 16H8C8.126 23.876 14 30 22 30V28C22 26.894 22.894 26 24 26Z"
              fill="#14AC7B"
            />
          </svg>
        </button>

        {/* Video call */}
        <button className="profile-panel-action-btn" aria-label="Video Call">
          <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
            <path
              d="M42.9572 7.1977C42.3082 6.77943 41.4964 6.74514 40.8166 7.0971L35.2 10.016V4.57143C35.2 2.05029 33.2266 0 30.8 0H4.4C1.9734 0 0 2.05029 0 4.57143V27.4286C0 29.952 1.9734 32 4.4 32H30.8C33.2266 32 35.2 29.952 35.2 27.4286V21.984L40.8166 24.9006C41.1268 25.0629 41.4634 25.1429 41.8 25.1429C42.2026 25.1429 42.603 25.0263 42.9572 24.8023C43.604 24.384 44 23.6503 44 22.8571V9.14286C44 8.34971 43.604 7.616 42.9572 7.1977Z"
              fill="#14AC7B"
            />
          </svg>
        </button>
      </div>

      {/* Info cards */}
      <div className="profile-panel-cards">
        {/* Member Since */}
        <div className="info-card">
          <span className="info-card-title">Member Since</span>
          <span className="info-card-value">30 Jan 2024</span>
        </div>

        {/* Mutual Servers */}
        <div className="info-card">
          <span className="info-card-title">Mutual Servers -2</span>
          <div className="info-card-row">
            <div
              className="info-card-avatar-circle"
              style={{ background: 'linear-gradient(135deg, #f9ca24 0%, #f0932b 100%)' }}
            >
              W
            </div>
            <span className="info-card-label">Work</span>
          </div>
        </div>

        {/* Mutual Friends */}
        <div className="info-card">
          <span className="info-card-title">Mutual Friends -1</span>
          <div className="info-card-row">
            <div
              className="info-card-avatar-circle"
              style={{ background: 'linear-gradient(135deg, #14AC7B 0%, #0D8760 100%)' }}
            >
              A
            </div>
            <span className="info-card-label">Ahmad Khalil</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* =====================================================================
   Home Page — root component
   ===================================================================== */
export default function HomePage() {
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeUser = DM_USERS.find((u) => u.id === activeDmId);
  const recipientName = activeUser ? activeUser.name : 'Katara';

  return (
    <div className="home-page">
      <SideNavbar />
      <DMSidebar
        activeDmId={activeDmId}
        onSelectDm={(id) => {
          setActiveDmId(id);
          setSidebarOpen(false);
        }}
        open={sidebarOpen}
      />
      <ChatArea recipientName={recipientName} />
      <UserProfilePanel />
    </div>
  );
}
